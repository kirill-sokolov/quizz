import { config } from "../../config.js";
import { type ShrunkImage, type ParsedResult, buildPrompt, parseJsonResponse } from "./types.js";
import { logCost } from "./cost-logger.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const OPENROUTER_MODELS = [
  { name: "GPT-4o-mini",         model: "openai/gpt-4o-mini" },
  { name: "GPT-5 mini",          model: "openai/gpt-5-mini" },
  { name: "GPT-OSS 120B",        model: "openai/gpt-oss-120b" },
  { name: "Gemini 2.5 Flash Lite", model: "google/gemini-2.5-flash-lite" },
  { name: "Gemini 3 Flash",      model: "google/gemini-3-flash-preview" },
  { name: "Gemini 3 Pro",        model: "google/gemini-3-pro-preview" },
  { name: "Kimi K2.5",           model: "moonshotai/kimi-k2.5" },
  { name: "Qwen3 235B",          model: "qwen/qwen3-235b-a22b" },
  { name: "Grok 3 Mini",         model: "x-ai/grok-3-mini" },
] as const;

export type OpenRouterModelName = (typeof OPENROUTER_MODELS)[number]["name"];

export function analyzeWithOpenRouter(modelId: string, displayName: string) {
  return async function (images: ShrunkImage[], promptOverride?: string): Promise<ParsedResult> {
    if (!config.OPENROUTER_API_KEY) {
      throw Object.assign(new Error("OPENROUTER_API_KEY is not configured"), { statusCode: 500 });
    }

    const content: unknown[] = [
      { type: "text", text: promptOverride ?? buildPrompt(images.length, images.map((i) => i.name)) },
      ...images.map((img) => ({
        type: "image_url",
        image_url: { url: `data:${img.mimeType};base64,${img.data}` },
      })),
      { type: "text", text: "Верни только JSON, без markdown и пояснений." },
    ];

    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
        "HTTP-Referer": "http://localhost",
        "X-Title": "WeddingQuiz",
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content }],
        temperature: 0,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw Object.assign(
        new Error(`${displayName} HTTP ${res.status}: ${text.slice(0, 200)}`),
        { statusCode: 502 }
      );
    }

    const creditsUsed = res.headers.get("x-openrouter-credits-used");
    if (creditsUsed) {
      logCost({
        timestamp: new Date().toISOString(),
        provider: "OpenRouter",
        model: modelId,
        creditsUsed: parseFloat(creditsUsed),
        details: `${displayName} - ${images.length} images`,
      });
    }

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = json.choices[0]?.message?.content ?? "";
    console.log(`[${displayName}] model: ${modelId}, credits: ${creditsUsed || "unknown"}`);
    console.log(`[${displayName} raw response]`, raw.slice(0, 500));
    return parseJsonResponse(raw);
  };
}
