import { config } from "../../config.js";
import { analyzeWithOpenRouter, OPENROUTER_MODELS } from "./openrouter.js";
import {
  type ShrunkImage,
  type HybridParsedResult,
  type DocxParsedResult,
  type DocxParsedQuestion,
  buildHybridPrompt,
  buildDocxParsePrompt,
  parseDocxJsonResponse,
  buildDocxImageParsePrompt,
  parseDocxImageJsonResponse,
} from "./types.js";

export type { ShrunkImage, HybridParsedResult, DocxParsedResult, DocxParsedQuestion };

type Provider = {
  name: string;
  fn: (images: ShrunkImage[], prompt: string) => Promise<any>;
};

const ALL_PROVIDERS: Provider[] = OPENROUTER_MODELS.map((m) => ({
  name: m.name,
  fn: analyzeWithOpenRouter(m.model, m.name),
}));

function getProvider(name: string): Provider {
  const provider = ALL_PROVIDERS.find((p) => p.name === name);
  if (!provider) {
    throw Object.assign(new Error(`Unknown model: ${name}`), { statusCode: 400 });
  }
  if (!config.OPENROUTER_API_KEY) {
    throw Object.assign(new Error(`${name}: OPENROUTER_API_KEY not configured`), { statusCode: 500 });
  }
  return provider;
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
    docxQuestions.length,
    docxQuestions.map((q) => ({ title: q.title, correctAnswer: q.correctAnswer ?? "" }))
  );

  const runWithPrompt = async (fn: Provider["fn"]) => {
    return (await fn(images, prompt)) as HybridParsedResult;
  };

  if (selectedModel) {
    const provider = getProvider(selectedModel);
    console.log(`[LLM hybrid] using selected model: ${selectedModel}`);
    return await runWithPrompt(provider.fn);
  }

  for (const { name, fn } of ALL_PROVIDERS) {
    if (!config.OPENROUTER_API_KEY) {
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
  const emptyImages: ShrunkImage[] = [];

  if (selectedModel) {
    const provider = getProvider(selectedModel);
    console.log(`[LLM docx] using selected model: ${selectedModel}`);
    const raw = await provider.fn(emptyImages, prompt);
    return parseDocxJsonResponse(JSON.stringify(raw));
  }

  for (const { name, fn } of ALL_PROVIDERS) {
    if (!config.OPENROUTER_API_KEY) {
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

  const shrunkImages: ShrunkImage[] = images.map((img, i) => ({
    ...img,
    name: `page-${i + 1}.png`,
  }));

  if (selectedModel) {
    const provider = getProvider(selectedModel);
    console.log(`[LLM docx-image] using selected model: ${selectedModel}`);
    const raw = await provider.fn(shrunkImages, prompt);
    return parseDocxImageJsonResponse(JSON.stringify(raw));
  }

  for (const { name, fn } of ALL_PROVIDERS) {
    if (!config.OPENROUTER_API_KEY) {
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
