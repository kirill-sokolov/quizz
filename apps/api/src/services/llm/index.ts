import { config } from "../../config.js";
import { analyzeWithGemini } from "./gemini.js";
import { analyzeWithGroq } from "./groq.js";
import { analyzeWithOpenRouter } from "./openrouter.js";
import { analyzeWithPixtral } from "./pixtral.js";
import { analyzeWithGPT4oMini } from "./gpt4o-mini.js";
import {
  type ShrunkImage,
  type ParsedResult,
  type HybridParsedResult,
  type DocxParsedResult,
  type DocxParsedQuestion,
  buildHybridPrompt,
  parseHybridJsonResponse,
  buildDocxParsePrompt,
  parseDocxJsonResponse,
  buildDocxImageParsePrompt,
  parseDocxImageJsonResponse,
} from "./types.js";

export type { ShrunkImage, ParsedResult, HybridParsedResult, DocxParsedResult, DocxParsedQuestion };

type Provider = {
  name: string;
  fn: (images: ShrunkImage[], promptOverride?: string) => Promise<ParsedResult>;
  key: string | undefined;
};

const ALL_PROVIDERS: Provider[] = [
  { name: "Gemini",      fn: analyzeWithGemini,     key: config.GEMINI_API_KEY },
  { name: "Groq",        fn: analyzeWithGroq,       key: config.GROQ_API_KEY },
  { name: "OpenRouter",  fn: analyzeWithOpenRouter, key: config.OPENROUTER_API_KEY },
  { name: "Pixtral",     fn: analyzeWithPixtral,    key: config.OPENROUTER_API_KEY },
  { name: "GPT-4o-mini", fn: analyzeWithGPT4oMini,  key: config.OPENROUTER_API_KEY },
];

export async function analyzeImages(
  images: ShrunkImage[],
  selectedModel?: string | null
): Promise<ParsedResult> {
  // If a specific model is selected, use only that one
  if (selectedModel) {
    const provider = ALL_PROVIDERS.find((p) => p.name === selectedModel);
    if (!provider) {
      throw Object.assign(
        new Error(`Unknown model: ${selectedModel}`),
        { statusCode: 400 }
      );
    }
    if (!provider.key) {
      throw Object.assign(
        new Error(`${selectedModel}: API key not configured`),
        { statusCode: 500 }
      );
    }
    console.log(`[LLM] using selected model: ${selectedModel}`);
    return await provider.fn(images);
  }

  // Otherwise, try all providers in order
  for (const { name, fn, key } of ALL_PROVIDERS) {
    if (!key) {
      console.log(`[LLM] ${name}: no key, skip`);
      continue;
    }
    try {
      const result = await fn(images);
      console.log(`[LLM] success via ${name}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM] ${name} failed: ${msg.slice(0, 200)}`);
    }
  }

  throw Object.assign(
    new Error("All LLM providers failed"),
    { statusCode: 502 }
  );
}

// ─── Hybrid mode: DOCX text + LLM for slide grouping ──────────────────────

export async function analyzeImagesHybrid(
  images: ShrunkImage[],
  docxQuestions: DocxParsedQuestion[],
  selectedModel?: string | null
): Promise<HybridParsedResult> {
  const prompt = buildHybridPrompt(
    images.length,
    images.map((i) => i.name),
    docxQuestions.length
  );

  // Use the same provider logic but with promptOverride
  const runWithPrompt = async (fn: Provider["fn"]) => {
    const raw = await fn(images, prompt);
    // The provider returns ParsedResult but we sent a hybrid prompt,
    // so re-parse the raw response as HybridParsedResult.
    // Since providers call parseJsonResponse which just JSON.parses,
    // the result structure matches HybridParsedResult.
    return raw as unknown as HybridParsedResult;
  };

  if (selectedModel) {
    const provider = ALL_PROVIDERS.find((p) => p.name === selectedModel);
    if (!provider) {
      throw Object.assign(new Error(`Unknown model: ${selectedModel}`), { statusCode: 400 });
    }
    if (!provider.key) {
      throw Object.assign(new Error(`${selectedModel}: API key not configured`), { statusCode: 500 });
    }
    console.log(`[LLM hybrid] using selected model: ${selectedModel}`);
    return await runWithPrompt(provider.fn);
  }

  for (const { name, fn, key } of ALL_PROVIDERS) {
    if (!key) {
      console.log(`[LLM hybrid] ${name}: no key, skip`);
      continue;
    }
    try {
      const result = await runWithPrompt(fn);
      console.log(`[LLM hybrid] success via ${name}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM hybrid] ${name} failed: ${msg.slice(0, 200)}`);
    }
  }

  throw Object.assign(new Error("All LLM providers failed (hybrid)"), { statusCode: 502 });
}

// ─── DOCX text parsing with LLM ─────────────────────────────────────────────

export async function parseDocxText(
  text: string,
  selectedModel?: string | null
): Promise<DocxParsedResult> {
  const prompt = buildDocxParsePrompt(text);

  // Use Gemini for text-only requests (or OpenRouter as fallback)
  // Pass empty images array with promptOverride
  const emptyImages: ShrunkImage[] = [];

  const textProviders = [
    { name: "Gemini",      fn: analyzeWithGemini,     key: config.GEMINI_API_KEY },
    { name: "Groq",        fn: analyzeWithGroq,       key: config.GROQ_API_KEY },
    { name: "OpenRouter",  fn: analyzeWithOpenRouter, key: config.OPENROUTER_API_KEY },
    { name: "Pixtral",     fn: analyzeWithPixtral,    key: config.OPENROUTER_API_KEY },
    { name: "GPT-4o-mini", fn: analyzeWithGPT4oMini,  key: config.OPENROUTER_API_KEY },
  ];

  if (selectedModel) {
    const provider = textProviders.find((p) => p.name === selectedModel);
    if (!provider) {
      throw Object.assign(new Error(`Unknown model for text: ${selectedModel}`), { statusCode: 400 });
    }
    if (!provider.key) {
      throw Object.assign(new Error(`${selectedModel}: API key not configured`), { statusCode: 500 });
    }
    console.log(`[LLM docx] using selected model: ${selectedModel}`);
    const raw = await provider.fn(emptyImages, prompt);
    return parseDocxJsonResponse(JSON.stringify(raw));
  }

  for (const { name, fn, key } of textProviders) {
    if (!key) {
      console.log(`[LLM docx] ${name}: no key, skip`);
      continue;
    }
    try {
      const raw = await fn(emptyImages, prompt);
      const result = parseDocxJsonResponse(JSON.stringify(raw));
      console.log(`[LLM docx] success via ${name}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM docx] ${name} failed: ${msg.slice(0, 200)}`);
    }
  }

  throw Object.assign(new Error("All LLM providers failed (docx)"), { statusCode: 502 });
}

// ─── DOCX image parsing with vision LLM ─────────────────────────────────────

export async function parseDocxImages(
  images: { data: string; mimeType: string }[],
  selectedModel?: string | null
): Promise<DocxParsedResult> {
  const prompt = buildDocxImageParsePrompt();

  // Convert to ShrunkImage format
  const shrunkImages: ShrunkImage[] = images.map((img, i) => ({
    ...img,
    name: `page-${i + 1}.png`,
  }));

  // Use vision models (Gemini, GPT-4o-mini, etc.)
  if (selectedModel) {
    const provider = ALL_PROVIDERS.find((p) => p.name === selectedModel);
    if (!provider) {
      throw Object.assign(new Error(`Unknown model: ${selectedModel}`), { statusCode: 400 });
    }
    if (!provider.key) {
      throw Object.assign(new Error(`${selectedModel}: API key not configured`), { statusCode: 500 });
    }
    console.log(`[LLM docx-image] using selected model: ${selectedModel}`);
    const raw = await provider.fn(shrunkImages, prompt);
    return parseDocxImageJsonResponse(JSON.stringify(raw));
  }

  for (const { name, fn, key } of ALL_PROVIDERS) {
    if (!key) {
      console.log(`[LLM docx-image] ${name}: no key, skip`);
      continue;
    }
    try {
      const raw = await fn(shrunkImages, prompt);
      const result = parseDocxImageJsonResponse(JSON.stringify(raw));
      console.log(`[LLM docx-image] success via ${name}, found ${result.questions.length} questions`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[LLM docx-image] ${name} failed: ${msg.slice(0, 200)}`);
    }
  }

  throw Object.assign(new Error("All LLM providers failed (docx-image)"), { statusCode: 502 });
}
