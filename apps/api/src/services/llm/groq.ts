import { config } from "../../config.js";
import { type ShrunkImage, type ParsedResult, buildPrompt, parseJsonResponse } from "./types.js";

const ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const MODELS = [
  "meta-llama/llama-4-scout-17b-16e-instruct",
  "llama-3.2-11b-vision-preview",
];

export async function analyzeWithGroq(images: ShrunkImage[]): Promise<ParsedResult> {
  if (!config.GROQ_API_KEY) {
    throw Object.assign(new Error("GROQ_API_KEY is not configured"), { statusCode: 500 });
  }

  const content: unknown[] = [
    { type: "text", text: buildPrompt(images.length, images.map((i) => i.name)) },
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.data}` },
    })),
    { type: "text", text: "Верни только JSON, без markdown и пояснений." },
  ];

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content }],
          temperature: 0,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      const json = (await res.json()) as { choices: { message: { content: string } }[] };
      const raw = json.choices[0]?.message?.content ?? "";
      console.log(`[Groq] used model: ${model}`);
      console.log("[Groq raw response]", raw.slice(0, 500));
      return parseJsonResponse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Groq] ${model} failed: ${msg.slice(0, 150)}`);
      lastError = err;
    }
  }

  throw Object.assign(
    new Error(
      `All Groq models failed. Last error: ${lastError instanceof Error ? lastError.message.slice(0, 200) : String(lastError)}`
    ),
    { statusCode: 502 }
  );
}
