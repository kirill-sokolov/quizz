import { config } from "../../config.js";
import { type ShrunkImage, type ParsedResult, buildPrompt, parseJsonResponse } from "./types.js";
import { logCost } from "./cost-logger.js";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const MODELS = [
  "mistralai/pixtral-12b",
  "mistral/pixtral-12b",
  "pixtral-12b",
];

export async function analyzeWithPixtral(images: ShrunkImage[], promptOverride?: string): Promise<ParsedResult> {
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

  let lastError: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
          "HTTP-Referer": "http://localhost",
          "X-Title": "WeddingQuiz",
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

      // Log cost from headers
      const creditsUsed = res.headers.get("x-openrouter-credits-used");
      if (creditsUsed) {
        logCost({
          timestamp: new Date().toISOString(),
          provider: "OpenRouter",
          model,
          creditsUsed: parseFloat(creditsUsed),
          details: `Pixtral 12B - ${images.length} images`,
        });
      }

      const json = (await res.json()) as { choices: { message: { content: string } }[] };
      const raw = json.choices[0]?.message?.content ?? "";
      console.log(`[Pixtral] used model: ${model}, credits: ${creditsUsed || "unknown"}`);
      console.log("[Pixtral raw response]", raw.slice(0, 500));
      return parseJsonResponse(raw);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Pixtral] ${model} failed: ${msg.slice(0, 150)}`);
      lastError = err;
    }
  }

  throw Object.assign(
    new Error(
      `All Pixtral model variants failed. Last error: ${lastError instanceof Error ? lastError.message.slice(0, 200) : String(lastError)}`
    ),
    { statusCode: 502 }
  );
}
