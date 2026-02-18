import { config } from "../../config.js";
import { analyzeWithGemini } from "./gemini.js";
import { analyzeWithGroq } from "./groq.js";
import { analyzeWithOpenRouter } from "./openrouter.js";
import { type ShrunkImage, type ParsedResult } from "./types.js";

export type { ShrunkImage, ParsedResult };

export async function analyzeImages(images: ShrunkImage[]): Promise<ParsedResult> {
  const providers = [
    { name: "Gemini",     fn: analyzeWithGemini,     key: config.GEMINI_API_KEY },
    { name: "Groq",       fn: analyzeWithGroq,       key: config.GROQ_API_KEY },
    { name: "OpenRouter", fn: analyzeWithOpenRouter, key: config.OPENROUTER_API_KEY },
  ];

  for (const { name, fn, key } of providers) {
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
