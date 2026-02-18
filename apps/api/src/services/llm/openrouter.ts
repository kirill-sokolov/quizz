import { config } from "../../config.js";
import { type ShrunkImage, type ParsedResult, buildPrompt, parseJsonResponse } from "./types.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.2-11b-vision-instruct:free";

export async function analyzeWithOpenRouter(images: ShrunkImage[]): Promise<ParsedResult> {
  if (!config.OPENROUTER_API_KEY) {
    throw Object.assign(new Error("OPENROUTER_API_KEY is not configured"), { statusCode: 500 });
  }

  const content: unknown[] = [
    { type: "text", text: buildPrompt(images.length, images.map((i) => i.name)) },
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
      new Error(`OpenRouter HTTP ${res.status}: ${text.slice(0, 200)}`),
      { statusCode: 502 }
    );
  }

  const json = (await res.json()) as { choices: { message: { content: string } }[] };
  const raw = json.choices[0]?.message?.content ?? "";
  console.log(`[OpenRouter] used model: ${MODEL}`);
  console.log("[OpenRouter raw response]", raw.slice(0, 500));
  return parseJsonResponse(raw);
}
