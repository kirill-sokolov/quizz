import AdmZip from "adm-zip";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { quizzes, questions, slides } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { analyzeImages, analyzeImagesHybrid, parseDocxText, parseDocxImages, type ShrunkImage } from "./llm/index.js";
import { extractTextFromDocx, convertDocxToImages } from "./docx-parser.js";
import { SLIDE_TYPES } from "../types/slide.js";

interface ExtractedImage {
  name: string;
  buffer: Buffer;
  ext: string;
}

export interface ImportPreviewItem {
  orderNum: number;
  text: string;
  options: string[];
  correctAnswer: string;
  explanation: string | null;
  timeLimitSec: number;
  timerPosition: string | null;
  slides: {
    video_warning: string | null;
    video_intro: string | null;
    question: string | null;
    timer: string | null;
    answer: string | null;
  };
}

export interface ImportPreviewResult {
  questions: ImportPreviewItem[];
  demoImageUrl?: string | null;
  rulesImageUrl?: string | null;
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const ANSWER_LABELS = ["A", "B", "C", "D"];

// ─── ZIP Extraction ───────────────────────────────────────────────────────────

function extractWithAdmZip(buffer: Buffer): ExtractedImage[] {
  const zip = new AdmZip(buffer);
  const images: ExtractedImage[] = [];
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    if (entry.entryName.includes("__MACOSX")) continue;
    const basename = path.basename(entry.entryName);
    if (basename.startsWith(".") || basename.startsWith("__")) continue;
    const ext = path.extname(basename).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) continue;
    images.push({ name: basename, buffer: entry.getData(), ext });
  }
  return images;
}

function extractWithSystemUnzip(buffer: Buffer): ExtractedImage[] {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "quiz-import-"));
  const zipPath = path.join(tmpDir, "upload.zip");
  const outDir = path.join(tmpDir, "out");
  fs.mkdirSync(outDir, { recursive: true });
  try {
    fs.writeFileSync(zipPath, buffer);
    execSync(`unzip -o -q "${zipPath}" -d "${outDir}"`);
    const images: ExtractedImage[] = [];
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") || entry.name.startsWith("__")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === "__MACOSX") continue;
          walk(full);
        } else {
          const ext = path.extname(entry.name).toLowerCase();
          if (!IMAGE_EXTS.has(ext)) continue;
          images.push({ name: entry.name, buffer: fs.readFileSync(full), ext });
        }
      }
    };
    walk(outDir);
    return images;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

export function processZip(buffer: Buffer): ExtractedImage[] {
  let images: ExtractedImage[];
  try {
    images = extractWithAdmZip(buffer);
    if (images.length === 0) throw new Error("empty");
  } catch {
    images = extractWithSystemUnzip(buffer);
  }
  images.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );
  return images;
}

// ─── Media storage ────────────────────────────────────────────────────────────

function saveImageToDisk(img: ExtractedImage): string {
  const filename = `${randomUUID()}${img.ext}`;
  const dest = path.resolve(config.MEDIA_DIR, filename);
  fs.writeFileSync(dest, img.buffer);
  return `/api/media/${filename}`;
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return map[ext] || "image/png";
}

// ─── Image resize (reduce tokens sent to LLM) ────────────────────────────────

async function shrinkImage(img: ExtractedImage): Promise<{ data: string; mimeType: string }> {
  try {
    const jpeg = await sharp(img.buffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { data: jpeg.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    return { data: img.buffer.toString("base64"), mimeType: getMimeType(img.ext) };
  }
}

// ─── Main pipeline (ZIP only — legacy) ───────────────────────────────────────

export async function importZip(
  _quizId: number,
  buffer: Buffer,
  selectedModel?: string | null,
  docxBuffer?: Buffer | null
): Promise<ImportPreviewResult> {
  // If DOCX is provided, use hybrid pipeline
  if (docxBuffer) {
    return importHybrid(buffer, docxBuffer, selectedModel);
  }

  const images = processZip(buffer);
  if (images.length === 0) {
    throw Object.assign(new Error("В ZIP не найдено изображений"), {
      statusCode: 400,
    });
  }

  // 1. Save all images to disk first so we have URLs to return
  const savedUrls = images.map((img) => saveImageToDisk(img));

  // 2. Build shrunk image list for LLM
  const shrunk: ShrunkImage[] = await Promise.all(
    images.map(async (img) => {
      const s = await shrinkImage(img);
      return { ...s, name: img.name };
    })
  );

  // 3. Ask LLM orchestrator to group and classify everything
  type LLMResult = Awaited<ReturnType<typeof analyzeImages>>;
  let llmResult: LLMResult;
  try {
    llmResult = await analyzeImages(shrunk, selectedModel);
  } catch (err) {
    console.error("LLM error:", err instanceof Error ? err.message : err);
    // Fallback: treat each image as a separate question slide
    llmResult = {
      questions: images.map((_, i) => ({
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        correct: "A",
        time_limit_sec: 30,
        slides: { video_warning: null, video_intro: null, question: i, timer: null, answer: null },
      })),
    };
  }

  // 4. Map LLM indices → saved URLs
  const getUrl = (idx: number | null) =>
    idx != null && idx >= 0 && idx < savedUrls.length ? savedUrls[idx] : null;

  const questions = llmResult.questions.map((q, i) => {
    const opts = q.options ?? { A: "", B: "", C: "", D: "" };

    // If timer/answer slides are missing, fall back to question slide
    let videoWarningUrl = getUrl(q.slides?.video_warning ?? null);
    let videoIntroUrl = getUrl(q.slides?.video_intro ?? null);
    let questionUrl = getUrl(q.slides?.question ?? null);
    let timerUrl = getUrl(q.slides?.timer ?? null);
    let answerUrl = getUrl(q.slides?.answer ?? null);
    if (!timerUrl) timerUrl = questionUrl;
    if (!answerUrl) answerUrl = questionUrl;
    if (!questionUrl) questionUrl = timerUrl;

    return {
      orderNum: i + 1,
      text: q.question ?? "",
      options: [opts.A ?? "", opts.B ?? "", opts.C ?? "", opts.D ?? ""],
      correctAnswer: q.correct ?? "A",
      explanation: null,
      timeLimitSec: q.time_limit_sec ?? 30,
      timerPosition: q.timer_position ?? null,
      slides: {
        video_warning: videoWarningUrl,
        video_intro: videoIntroUrl,
        question: questionUrl,
        timer: timerUrl,
        answer: answerUrl,
      },
    };
  });

  return {
    questions,
    demoImageUrl: getUrl(llmResult.demoSlide ?? null),
    rulesImageUrl: getUrl(llmResult.rulesSlide ?? null),
  };
}

// ─── Hybrid pipeline (DOCX + ZIP) ────────────────────────────────────────────

async function importHybrid(
  zipBuffer: Buffer,
  docxBuffer: Buffer,
  selectedModel?: string | null
): Promise<ImportPreviewResult> {
  // 1. Parse DOCX with LLM (try image-based first, fallback to text)
  let docxQuestions;

  try {
    // Try image-based parsing (preserves formatting, colors)
    console.log(`[Hybrid] Converting DOCX to images...`);
    const debugDir = path.resolve(config.MEDIA_DIR, "debug-docx");
    const docxImages = await convertDocxToImages(docxBuffer, debugDir);
    console.log(`[Hybrid] Parsing ${docxImages.length} images with vision LLM...`);
    console.log(`[Hybrid] Debug files saved: /api/media/debug-docx/intermediate.pdf + page-1.png...`);
    const docxParsed = await parseDocxImages(docxImages, selectedModel);
    docxQuestions = docxParsed.questions;
    console.log(`[Hybrid] Image-based parsing: found ${docxQuestions.length} questions`);
  } catch (err) {
    // Fallback to text-based parsing
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[Hybrid] Image conversion failed (${errMsg}), falling back to text parsing`);

    const docxText = extractTextFromDocx(docxBuffer);
    console.log(`[Hybrid] Extracted ${docxText.length} chars from DOCX`);
    const docxParsed = await parseDocxText(docxText, selectedModel);
    docxQuestions = docxParsed.questions;
    console.log(`[Hybrid] Text-based parsing: found ${docxQuestions.length} questions`);
  }

  if (docxQuestions.length === 0) {
    throw Object.assign(new Error("В DOCX не найдено вопросов"), {
      statusCode: 400,
    });
  }

  // 2. Extract and save images from ZIP
  const images = processZip(zipBuffer);
  if (images.length === 0) {
    throw Object.assign(new Error("В ZIP не найдено изображений"), {
      statusCode: 400,
    });
  }
  const savedUrls = images.map((img) => saveImageToDisk(img));

  // 3. Shrink images for LLM
  const shrunk: ShrunkImage[] = await Promise.all(
    images.map(async (img) => {
      const s = await shrinkImage(img);
      return { ...s, name: img.name };
    })
  );

  // 4. Ask LLM to group slides and determine timer position
  let hybridResult: Awaited<ReturnType<typeof analyzeImagesHybrid>>;
  try {
    hybridResult = await analyzeImagesHybrid(shrunk, docxQuestions, selectedModel);
  } catch (err) {
    console.error("LLM hybrid error:", err instanceof Error ? err.message : err);
    // Fallback: distribute images evenly across questions
    const perQ = Math.max(1, Math.floor(images.length / docxQuestions.length));
    hybridResult = {
      questions: docxQuestions.map((_, i) => ({
        slides: {
          video_warning: null,
          video_intro: null,
          question: i * perQ < images.length ? i * perQ : null,
          timer: null,
          answer: null,
        },
        timer_position: "center",
      })),
    };
  }

  // 5. Merge DOCX text with LLM slide grouping
  const getUrl = (idx: number | null) =>
    idx != null && idx >= 0 && idx < savedUrls.length ? savedUrls[idx] : null;

  const questions = docxQuestions.map((dq, i) => {
    const hybrid = hybridResult.questions[i] ?? {
      slides: { video_warning: null, video_intro: null, question: null, timer: null, answer: null },
      timer_position: "center",
    };

    // If timer/answer slides are missing, fall back to question slide
    let videoWarningUrl = getUrl(hybrid.slides?.video_warning ?? null);
    let videoIntroUrl = getUrl(hybrid.slides?.video_intro ?? null);
    let questionUrl = getUrl(hybrid.slides?.question ?? null);
    let timerUrl = getUrl(hybrid.slides?.timer ?? null);
    let answerUrl = getUrl(hybrid.slides?.answer ?? null);
    if (!timerUrl) timerUrl = questionUrl;
    if (!answerUrl) answerUrl = questionUrl;
    if (!questionUrl) questionUrl = timerUrl;

    return {
      orderNum: i + 1,
      text: dq.title,
      options: dq.options,
      correctAnswer: ANSWER_LABELS[dq.correctIndex] ?? "A",
      explanation: dq.explanation,
      timeLimitSec: 30,
      timerPosition: hybrid.timer_position ?? "center",
      slides: {
        video_warning: videoWarningUrl,
        video_intro: videoIntroUrl,
        question: questionUrl,
        timer: timerUrl,
        answer: answerUrl,
      },
    };
  });

  return {
    questions,
    demoImageUrl: getUrl(hybridResult.demoSlide ?? null),
    rulesImageUrl: getUrl(hybridResult.rulesSlide ?? null),
  };
}

// ─── Save to DB ───────────────────────────────────────────────────────────────

export async function saveImportedQuiz(
  quizId: number,
  data: ImportPreviewResult
): Promise<{ created: number }> {
  const { questions: items, demoImageUrl, rulesImageUrl } = data;

  // Update quiz with demo and rules images if provided
  if (demoImageUrl !== undefined || rulesImageUrl !== undefined) {
    const updates: Record<string, string | null> = {};
    if (demoImageUrl !== undefined) updates.demoImageUrl = demoImageUrl;
    if (rulesImageUrl !== undefined) updates.rulesImageUrl = rulesImageUrl;

    if (Object.keys(updates).length > 0) {
      await db.update(quizzes).set(updates).where(eq(quizzes.id, quizId));
    }
  }

  const existing = await db
    .select({ orderNum: questions.orderNum })
    .from(questions)
    .where(eq(questions.quizId, quizId))
    .orderBy(asc(questions.orderNum));

  let nextOrder =
    existing.length > 0 ? existing[existing.length - 1].orderNum + 1 : 1;

  for (const item of items) {
    const [question] = await db
      .insert(questions)
      .values({
        quizId,
        orderNum: nextOrder++,
        text: item.text,
        options: item.options,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation ?? null,
        timeLimitSec: item.timeLimitSec,
        ...(item.timerPosition ? { timerPosition: item.timerPosition as any } : {}),
      })
      .returning();

    // Save all slide types
    for (const type of SLIDE_TYPES) {
      await db.insert(slides).values({
        questionId: question.id,
        type,
        imageUrl: item.slides[type as keyof typeof item.slides] ?? null,
      });
    }
  }

  return { created: items.length };
}
