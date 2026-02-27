import { config } from "../../config.js";
import { type ShrunkImage } from "./types.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

export const TEXT_MODELS = [
  { name: "GPT-4o-mini",    model: "openai/gpt-4o-mini" },
  { name: "GPT-5 mini",     model: "openai/gpt-5-mini" },
  { name: "Gemini 3 Flash", model: "google/gemini-3-flash-preview" },
] as const;

export const IMAGE_MODELS = [
  { name: "Kimi K2.5",      model: "moonshotai/kimi-k2.5" },
  { name: "Grok 4",         model: "x-ai/grok-4" },
  { name: "Gemini 3 Flash", model: "google/gemini-3-flash-preview" },
  { name: "Gemini 3 Pro",   model: "google/gemini-3-pro-preview" },
] as const;

export const OPENROUTER_MODELS = [...TEXT_MODELS, ...IMAGE_MODELS];


export type OpenRouterModelName = (typeof OPENROUTER_MODELS)[number]["name"];

export function analyzeWithOpenRouter(modelId: string, displayName: string) {
  return async function (images: ShrunkImage[], prompt: string): Promise<any> {
    if (!config.OPENROUTER_API_KEY) {
      throw Object.assign(new Error("OPENROUTER_API_KEY is not configured"), { statusCode: 500 });
    }

    const content: unknown[] = [
      { type: "text", text: prompt },
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

    const json = (await res.json()) as { choices: { message: { content: string } }[] };
    const raw = json.choices[0]?.message?.content ?? "";
    console.log(`[${displayName} raw response]`, raw.slice(0, 500));
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
      return JSON.parse(cleaned);
    } catch {
      throw Object.assign(new Error(`LLM вернул неверный JSON: ${raw.slice(0, 300)}`), { statusCode: 502 });
    }
  };
}

/**
 * Vision batch analysis - returns raw array without parsing as ParsedResult
 */
export async function analyzeVisionBatch(
  modelId: string,
  displayName: string,
  images: ShrunkImage[],
  prompt: string
): Promise<any[]> {
  if (!config.OPENROUTER_API_KEY) {
    throw Object.assign(new Error("OPENROUTER_API_KEY is not configured"), { statusCode: 500 });
  }

  const content: unknown[] = [
    { type: "text", text: prompt },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    })),
    { type: "text", text: "Верни только JSON массив, без markdown и пояснений." },
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

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = json.choices[0]?.message?.content ?? "";

  // Parse JSON response - expect array
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const results = JSON.parse(cleaned);

  if (!Array.isArray(results)) {
    throw new Error(`Expected array but got ${typeof results}`);
  }

  return results;
}
