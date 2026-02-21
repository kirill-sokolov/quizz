import AdmZip from "adm-zip";
import sharp from "sharp";
import { randomUUID } from "crypto";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { config } from "../config.js";
import { db } from "../db/index.js";
import { questions, slides } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { analyzeImages, type ShrunkImage } from "./llm/index.js";
import { BASE_SLIDE_TYPES } from "../types/slide.js";

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
  timeLimitSec: number;
  slides: {
    question: string | null;
    timer: string | null;
    answer: string | null;
  };
}

const IMAGE_EXTS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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

// ─── Main pipeline ────────────────────────────────────────────────────────────

export async function importZip(
  _quizId: number,
  buffer: Buffer
): Promise<ImportPreviewItem[]> {
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
    llmResult = await analyzeImages(shrunk);
  } catch (err) {
    console.error("LLM error:", err instanceof Error ? err.message : err);
    // Fallback: treat each image as a separate question slide
    llmResult = {
      questions: images.map((_, i) => ({
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        correct: "A",
        time_limit_sec: 30,
        slides: { question: i, timer: null, answer: null },
      })),
    };
  }

  // 4. Map LLM indices → saved URLs
  return llmResult.questions.map((q, i) => {
    const getUrl = (idx: number | null) =>
      idx != null && idx >= 0 && idx < savedUrls.length ? savedUrls[idx] : null;

    const opts = q.options ?? { A: "", B: "", C: "", D: "" };

    // If one of question/timer slides is missing, fall back to the other
    let questionUrl = getUrl(q.slides?.question ?? null);
    let timerUrl = getUrl(q.slides?.timer ?? null);
    if (!timerUrl) timerUrl = questionUrl;
    if (!questionUrl) questionUrl = timerUrl;

    return {
      orderNum: i + 1,
      text: q.question ?? "",
      options: [opts.A ?? "", opts.B ?? "", opts.C ?? "", opts.D ?? ""],
      correctAnswer: q.correct ?? "A",
      timeLimitSec: q.time_limit_sec ?? 30,
      slides: {
        question: questionUrl,
        timer: timerUrl,
        answer: getUrl(q.slides?.answer ?? null),
      },
    };
  });
}

// ─── Save to DB ───────────────────────────────────────────────────────────────

export async function saveImportedQuiz(
  quizId: number,
  items: ImportPreviewItem[]
): Promise<{ created: number }> {
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
        timeLimitSec: item.timeLimitSec,
      })
      .returning();

    for (const type of BASE_SLIDE_TYPES) {
      await db.insert(slides).values({
        questionId: question.id,
        type,
        imageUrl: item.slides[type] ?? null,
      });
    }
  }

  return { created: items.length };
}
