import AdmZip from "adm-zip";
import { GoogleGenerativeAI } from "@google/generative-ai";
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

interface GeminiQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: string;
  time_limit_sec: number;
  slides: {
    question: number | null;
    timer: number | null;
    answer: number | null;
  };
}

interface GeminiResult {
  questions: GeminiQuestion[];
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

// ─── Image resize (reduce tokens sent to Gemini) ─────────────────────────────

async function shrinkForGemini(img: ExtractedImage): Promise<{ data: string; mimeType: string }> {
  try {
    const jpeg = await sharp(img.buffer)
      .resize({ width: 1024, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
    return { data: jpeg.toString("base64"), mimeType: "image/jpeg" };
  } catch {
    // If sharp fails, fall back to raw base64
    return { data: img.buffer.toString("base64"), mimeType: getMimeType(img.ext) };
  }
}

// ─── Gemini – send ALL images at once ────────────────────────────────────────

const SYSTEM_PROMPT = (n: number, names: string[]) => `
Ты анализируешь ${n} изображений — слайды из квиза-презентации.
Имена файлов (в порядке, с 0): ${names.map((n, i) => `[${i}] ${n}`).join(", ")}.

КЛЮЧЕВОЕ ПРАВИЛО: несколько слайдов могут относиться к ОДНОМУ вопросу.
Слайды одного вопроса похожи визуально — одинаковый фон, одинаковый текст вопроса — но различаются деталями:

• «question» — слайд с текстом вопроса и 4 вариантами ответов (A, B, C, D). Все варианты оформлены одинаково.
• «timer»   — тот же вопрос + заметный таймер/часы/обратный отсчёт.
• «answer»  — тот же вопрос, но ОДИН вариант выделен как правильный (другой цвет, обводка, галочка, стрелка и т.п.).

Алгоритм:
1. Сначала определи, сколько УНИКАЛЬНЫХ вопросов (не слайдов) присутствует.
2. Сгруппируй слайды — похожие по содержанию и дизайну относятся к одному вопросу.
3. Для каждой группы: назначь тип каждому слайду и извлеки текст вопроса, варианты, правильный ответ.

Верни строго JSON (без markdown, без пояснений):
{
  "questions": [
    {
      "question": "Текст вопроса",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "B",
      "time_limit_sec": 30,
      "slides": {
        "question": 0,
        "timer": null,
        "answer": 1
      }
    }
  ]
}

Правила:
- Если слайда какого-то типа нет в группе — ставь null.
- "correct" — одна буква: A, B, C или D.
- "time_limit_sec" — число секунд из слайда (30 если не указано).
- Каждый индекс используй не более одного раза.
`.trim();

export async function parseAllImagesWithGemini(
  images: ExtractedImage[]
): Promise<GeminiResult> {
  if (!config.GEMINI_API_KEY) {
    throw Object.assign(new Error("GEMINI_API_KEY is not configured"), {
      statusCode: 500,
    });
  }

  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

  // Shrink images first to reduce token count
  const shrunk = await Promise.all(images.map(shrinkForGemini));

  const promptParts = [
    { text: SYSTEM_PROMPT(images.length, images.map((i) => i.name)) },
    ...shrunk.map((s) => ({ inlineData: { data: s.data, mimeType: s.mimeType } })),
    { text: "Верни только JSON, без markdown и пояснений." },
  ];

  // Try models in order — handles per-model quota limits
  const MODELS = [
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
    "gemini-1.5-flash-latest",
    "gemini-1.5-flash-8b",
  ];

  let raw = "";
  let lastError: unknown;
  for (const modelName of MODELS) {
    try {
      const m = genAI.getGenerativeModel({ model: modelName });
      const result = await m.generateContent(promptParts);
      raw = result.response.text();
      console.log(`[Gemini] used model: ${modelName}`);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini] ${modelName} failed: ${msg.slice(0, 150)}`);
      lastError = err;
    }
  }

  if (!raw) {
    throw Object.assign(
      new Error(
        `All Gemini models failed. Last error: ${lastError instanceof Error ? lastError.message.slice(0, 200) : String(lastError)}`
      ),
      { statusCode: 502 }
    );
  }

  console.log("[Gemini raw response]", raw.slice(0, 500));

  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as GeminiResult;
  } catch {
    throw Object.assign(
      new Error(`Gemini вернул неверный JSON: ${raw.slice(0, 300)}`),
      { statusCode: 502 }
    );
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

  // 2. Ask Gemini to group and classify everything
  let geminiResult: GeminiResult;
  if (config.GEMINI_API_KEY) {
    try {
      geminiResult = await parseAllImagesWithGemini(images);
    } catch (err) {
      console.error("Gemini error:", err instanceof Error ? err.message : err);
      // Fallback: treat each image as a separate question slide
      geminiResult = {
        questions: images.map((_, i) => ({
          question: "",
          options: { A: "", B: "", C: "", D: "" },
          correct: "A",
          time_limit_sec: 30,
          slides: { question: i, timer: null, answer: null },
        })),
      };
    }
  } else {
    // No API key — return images as empty question stubs
    geminiResult = {
      questions: images.map((_, i) => ({
        question: "",
        options: { A: "", B: "", C: "", D: "" },
        correct: "A",
        time_limit_sec: 30,
        slides: { question: i, timer: null, answer: null },
      })),
    };
  }

  // 3. Map Gemini indices → saved URLs
  return geminiResult.questions.map((q, i) => {
    const getUrl = (idx: number | null) =>
      idx != null && idx >= 0 && idx < savedUrls.length ? savedUrls[idx] : null;

    const opts = q.options ?? { A: "", B: "", C: "", D: "" };
    return {
      orderNum: i + 1,
      text: q.question ?? "",
      options: [opts.A ?? "", opts.B ?? "", opts.C ?? "", opts.D ?? ""],
      correctAnswer: q.correct ?? "A",
      timeLimitSec: q.time_limit_sec ?? 30,
      slides: {
        question: getUrl(q.slides?.question ?? null),
        timer: getUrl(q.slides?.timer ?? null),
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

    for (const type of ["question", "timer", "answer"] as const) {
      await db.insert(slides).values({
        questionId: question.id,
        type,
        imageUrl: item.slides[type] ?? null,
      });
    }
  }

  return { created: items.length };
}
