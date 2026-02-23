import { config } from "../../config.js";
import { type ShrunkImage, type ParsedResult, buildPrompt, parseJsonResponse } from "./types.js";
import { logCost } from "./cost-logger.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "openai/gpt-4o-mini";

export async function analyzeWithGPT4oMini(images: ShrunkImage[], promptOverride?: string): Promise<ParsedResult> {
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
      model: MODEL,
      messages: [{ role: "user", content }],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(
      new Error(`GPT-4o mini HTTP ${res.status}: ${text.slice(0, 200)}`),
      { statusCode: 502 }
    );
  }

  // Log cost from headers
  const creditsUsed = res.headers.get("x-openrouter-credits-used");
  if (creditsUsed) {
    logCost({
      timestamp: new Date().toISOString(),
      provider: "OpenRouter",
      model: MODEL,
      creditsUsed: parseFloat(creditsUsed),
      details: `GPT-4o mini - ${images.length} images`,
    });
  }

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = json.choices[0]?.message?.content ?? "";
  console.log(`[GPT-4o mini] used model: ${MODEL}, credits: ${creditsUsed || "unknown"}`);
  console.log("[GPT-4o mini raw response]", raw.slice(0, 500));
  return parseJsonResponse(raw);
}
