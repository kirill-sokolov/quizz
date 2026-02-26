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
import { analyzeImagesHybrid, type ShrunkImage } from "./llm/index.js";
import { SLIDE_TYPES } from "../types/slide.js";

interface ExtractedImage {
  name: string;
  buffer: Buffer;
  ext: string;
}

export interface ImportPreviewItem {
  orderNum: number;
  text: string;
  questionType: "choice" | "text";
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
  extraSlides?: string[];
  /** Ordered slide sequence from the preview (set by frontend after reordering). */
  orderedSlides?: Array<{ type: string; imageUrl: string | null }>;
}

export interface ImportPreviewResult {
  questions: ImportPreviewItem[];
  demoImageUrl?: string | null;
  rulesImageUrl?: string | null;
  thanksImageUrl?: string | null;
  finalImageUrl?: string | null;
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

// ─── Main pipeline (DOCX + ZIP) ──────────────────────────────────────────────

export async function importZip(
  _quizId: number,
  buffer: Buffer,
  selectedModel?: string | null,
  docxQuestions?: any[] | null
): Promise<ImportPreviewResult> {
  if (!docxQuestions || docxQuestions.length === 0) {
    throw Object.assign(new Error("Необходимо сначала загрузить DOCX с вопросами"), {
      statusCode: 400,
    });
  }
  return importHybridWithParsed(buffer, docxQuestions, selectedModel);
}

// ─── Hybrid pipeline with pre-parsed DOCX ────────────────────────────────────

async function importHybridWithParsed(
  zipBuffer: Buffer,
  docxQuestions: any[],
  selectedModel?: string | null
): Promise<ImportPreviewResult> {
  // docxQuestions already parsed, skip DOCX processing

  // 1. Extract and save images from ZIP
  const images = processZip(zipBuffer);
  if (images.length === 0) {
    throw Object.assign(new Error("В ZIP не найдено изображений"), {
      statusCode: 400,
    });
  }
  const savedUrls = images.map((img) => saveImageToDisk(img));

  // 2. Shrink images for LLM
  const shrunk: ShrunkImage[] = await Promise.all(
    images.map(async (img) => {
      const s = await shrinkImage(img);
      return { ...s, name: img.name };
    })
  );

  // 3. Ask LLM to group slides and determine timer position
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

  // 4. Merge DOCX text with LLM slide grouping
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

    const questionType = dq.questionType ?? "choice";
    const correctAnswer = questionType === "text"
      ? (dq.correctAnswer ?? "")
      : (ANSWER_LABELS[dq.correctIndex] ?? "A");

    return {
      orderNum: i + 1,
      text: dq.title,
      questionType,
      options: dq.options,
      correctAnswer,
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
      extraSlides: (hybrid.extraSlides ?? []).map(idx => getUrl(idx)).filter(Boolean) as string[],
    };
  });

  return {
    questions,
    demoImageUrl: getUrl(hybridResult.demoSlide ?? null),
    rulesImageUrl: getUrl(hybridResult.rulesSlide ?? null),
    thanksImageUrl: getUrl(hybridResult.thanksSlide ?? null),
    finalImageUrl: getUrl(hybridResult.finalSlide ?? null),
  };
}

// ─── Save to DB ───────────────────────────────────────────────────────────────

export async function saveImportedQuiz(
  quizId: number,
  data: ImportPreviewResult
): Promise<{ created: number }> {
  const { questions: items, demoImageUrl, rulesImageUrl, thanksImageUrl, finalImageUrl } = data;

  // Update quiz with special slide images if provided
  const updates: Record<string, string | null> = {};
  if (demoImageUrl !== undefined) updates.demoImageUrl = demoImageUrl;
  if (rulesImageUrl !== undefined) updates.rulesImageUrl = rulesImageUrl;
  if (thanksImageUrl !== undefined) updates.thanksImageUrl = thanksImageUrl;
  if (finalImageUrl !== undefined) updates.finalImageUrl = finalImageUrl;

  if (Object.keys(updates).length > 0) {
    await db.update(quizzes).set(updates).where(eq(quizzes.id, quizId));
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
        questionType: item.questionType ?? "choice",
        options: item.options,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation ?? null,
        timeLimitSec: item.timeLimitSec,
        ...(item.timerPosition ? { timerPosition: item.timerPosition as any } : {}),
      })
      .returning();

    // Save slides with sort_order
    if (item.orderedSlides && item.orderedSlides.length > 0) {
      // Use the ordered sequence provided by the frontend (after user drag-and-drop)
      for (const [idx, s] of item.orderedSlides.entries()) {
        if ((s.type === "video_warning" || s.type === "video_intro") && !s.imageUrl) continue;
        await db.insert(slides).values({
          questionId: question.id,
          type: s.type as any,
          imageUrl: s.imageUrl ?? null,
          sortOrder: idx,
        });
      }
    } else {
      // Fallback: build from old format (slides object + extraSlides array)
      let sortOrder = 0;
      const baseTypes = ["video_warning", "video_intro", "question", "timer", "answer"] as const;
      for (const type of baseTypes) {
        const imageUrl = item.slides[type as keyof typeof item.slides] ?? null;
        if ((type === "video_warning" || type === "video_intro") && !imageUrl) continue;
        await db.insert(slides).values({
          questionId: question.id,
          type,
          imageUrl,
          sortOrder: sortOrder++,
        });
      }
      for (const extraUrl of item.extraSlides ?? []) {
        await db.insert(slides).values({
          questionId: question.id,
          type: "extra",
          imageUrl: extraUrl,
          sortOrder: sortOrder++,
        });
      }
    }
  }

  return { created: items.length };
}
