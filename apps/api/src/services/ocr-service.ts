import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { processZip } from "./import-service.js";
import { IMAGE_MODELS, analyzeVisionBatch } from "./llm/openrouter.js";
import type { ShrunkImage } from "./llm/types.js";

export interface OcrResult {
  index: number;
  filename: string;
  text: string;
  visionAnalysis?: {
    slideType: string;
    hasOptions: boolean;
    optionsCount?: number;
    optionsDescription?: string[];
  };
  error?: string;
  confidence?: number;
}

export interface OcrAnalysisResult {
  totalImages: number;
  results: OcrResult[];
  tesseractVersion?: string;
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

/**
 * Analyze multiple slides with vision model in batch to detect options
 */
async function analyzeSlidesWithVisionBatch(
  images: Array<{ buffer: Buffer; mimeType: string; index: number; filename: string }>
): Promise<Map<number, any>> {
  if (images.length === 0) return new Map();

  const prompt = `Проанализируй ${images.length} слайдов квиза.

Для КАЖДОГО слайда (в порядке отправки) определи:
1. Есть ли на слайде ВАРИАНТЫ ОТВЕТА (обычно 4 варианта с буквами A/B/C/D)?
2. Если варианты есть - сколько их?
3. Как представлен каждый вариант:
   - Если ТЕКСТОМ - напиши текст варианта
   - Если КАРТИНКОЙ/ИКОНКОЙ - кратко опиши что на ней (2-5 слов)

Верни строго JSON - МАССИВ объектов (по одному на каждое изображение в том же порядке):
[
  {
    "slideType": "question",
    "hasOptions": true,
    "optionsCount": 4,
    "optionsDescription": ["вариант A", "вариант B", "вариант C", "вариант D"]
  },
  ...
]

ВАЖНО: количество элементов в массиве должно быть ровно ${images.length}.`;

  try {
    // Use Gemini 3 Flash for vision analysis (fast and cheap)
    const visionModel = IMAGE_MODELS[2]; // Gemini 3 Flash

    // Prepare images in ShrunkImage format
    const shrunkImages: ShrunkImage[] = images.map((img) => ({
      data: img.buffer.toString("base64"),
      mimeType: img.mimeType,
      name: `${img.index}_${img.filename}`,
    }));

    // Call vision batch API
    const results = await analyzeVisionBatch(
      visionModel.model,
      visionModel.name,
      shrunkImages,
      prompt
    );

    // Map results to image indices
    const resultMap = new Map<number, any>();
    images.forEach((img, i) => {
      if (results[i]) {
        resultMap.set(img.index, results[i]);
      }
    });

    console.log(`[Vision] Batch analysis successful: ${resultMap.size} results`);
    return resultMap;
  } catch (err) {
    console.error("[Vision] Batch analysis failed:", err);
    return new Map();
  }
}

/**
 * Analyze ZIP archive with OCR to extract text from images
 * Optionally uses vision model for slides with little text
 */
export async function analyzeZipWithOcr(zipBuffer: Buffer, useVision = false): Promise<OcrAnalysisResult> {
  // Check if Tesseract is installed
  let tesseractVersion = "unknown";
  try {
    tesseractVersion = execSync("tesseract --version", { encoding: "utf8", timeout: 5000 })
      .split("\n")[0]
      .trim();
    console.log(`[OCR] Tesseract version: ${tesseractVersion}`);
  } catch (err) {
    console.error("[OCR] Tesseract not found:", err);
    throw Object.assign(
      new Error("Tesseract OCR not installed. Please rebuild Docker container."),
      { statusCode: 500 }
    );
  }

  // Extract images from ZIP
  const images = processZip(zipBuffer);

  if (images.length === 0) {
    throw Object.assign(new Error("В ZIP не найдено изображений"), {
      statusCode: 400,
    });
  }

  const results: OcrResult[] = [];
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-analysis-"));

  try {
    // Phase 1: Run OCR on all images
    const ocrResults: Array<{ text: string; error?: string }> = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      const imgPath = path.join(tmpDir, `img-${i}${img.ext}`);
      fs.writeFileSync(imgPath, img.buffer);

      let ocrText = "";
      let ocrError: string | undefined;

      try {
        console.log(`[OCR] Processing image ${i + 1}/${images.length}: ${img.name}`);
        const result = execSync(
          `tesseract "${imgPath}" stdout -l eng+rus --psm 6 2>&1`,
          { encoding: "utf8", timeout: 30000 }
        );
        ocrText = result.trim();
      } catch (err: any) {
        const errorMsg = err.message || String(err);
        console.error(`[OCR] Failed for image ${i} (${img.name}):`, errorMsg);
        ocrText = "(OCR error)";
        ocrError = errorMsg.slice(0, 200);
      }

      ocrResults.push({ text: ocrText, error: ocrError });
    }

    // Phase 2: Identify images that need vision analysis
    const imagesToAnalyze: Array<{ buffer: Buffer; mimeType: string; index: number; filename: string }> = [];
    const visionCache = new Map<string, any>(); // Cache by question text

    for (let i = 0; i < images.length; i++) {
      const ocrText = ocrResults[i].text;
      const hasQuestionMarker = /\d+\.|как|что|кто|где|когда|сколько|выберите|какой|какая|какие|kā|kas|kur|cik|izvēlieties/i.test(ocrText);
      const looksLikeSingleAnswer = /^[A-D]\.\s*[^A-D]{10,}$/i.test(ocrText.trim());

      // Check if OCR recognized text options (A/B/C/D with text after them)
      // Match patterns like "A. some text" or "А. текст" (at least 3 chars after dot)
      const optionMatches = ocrText.match(/[A-DА-Г]\.\s*[^\n]{3,}/gi) || [];
      const hasTextOptions = optionMatches.length >= 2; // At least 2 options recognized

      // Count total words in the slide
      const totalWordCount = ocrText.split(/\s+/).filter(w => w.length > 1).length;

      // Extract question key for caching (first line, up to 100 chars)
      const firstLine = ocrText.split('\n')[0];
      const questionKey = firstLine.slice(0, 100).trim();

      // Only use vision if:
      // 1. Question marker present
      // 2. NOT a single answer slide
      // 3. OCR found very few words total (< 15)
      // 4. OCR did NOT recognize text options (meaning options might be images)
      if (useVision && hasQuestionMarker && !looksLikeSingleAnswer && totalWordCount < 15 && !hasTextOptions) {
        // Check cache first
        if (!visionCache.has(questionKey)) {
          console.log(`[Vision] Queuing image ${i} (${images[i].name}): ${totalWordCount} words total, no text options`);
          imagesToAnalyze.push({
            buffer: images[i].buffer,
            mimeType: getMimeType(images[i].ext),
            index: i,
            filename: images[i].name,
          });
        } else {
          console.log(`[Vision] Using cache for image ${i} (${images[i].name})`);
        }
      }
    }

    // Phase 3: Batch vision analysis
    let visionResults = new Map<number, any>();
    if (imagesToAnalyze.length > 0) {
      console.log(`[Vision] Batch analyzing ${imagesToAnalyze.length} images...`);
      visionResults = await analyzeSlidesWithVisionBatch(imagesToAnalyze);
    }

    // Phase 4: Build final results with caching
    for (let i = 0; i < images.length; i++) {
      const ocrText = ocrResults[i].text;
      const ocrError = ocrResults[i].error;

      let visionAnalysis;

      // Check if this image was analyzed with vision
      if (visionResults.has(i)) {
        const visionResult = visionResults.get(i);
        visionAnalysis = {
          slideType: visionResult.slideType || "unknown",
          hasOptions: visionResult.hasOptions || false,
          optionsCount: visionResult.optionsCount,
          optionsDescription: visionResult.optionsDescription,
        };

        // Cache by question text
        const questionKey = ocrText.split('\n')[0].slice(0, 100).trim();
        visionCache.set(questionKey, visionAnalysis);
      } else {
        // Check cache for duplicate questions
        const questionKey = ocrText.split('\n')[0].slice(0, 100).trim();
        if (visionCache.has(questionKey)) {
          visionAnalysis = visionCache.get(questionKey);
        }
      }

      results.push({
        index: i,
        filename: images[i].name,
        text: ocrText || "(no text detected)",
        ...(visionAnalysis && { visionAnalysis }),
        ...(ocrError && { error: ocrError }),
      });
    }

    return {
      totalImages: images.length,
      results,
      tesseractVersion,
    };
  } finally {
    // Cleanup temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
