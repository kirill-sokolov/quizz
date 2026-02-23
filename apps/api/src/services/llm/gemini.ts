import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";
import { type ShrunkImage, type ParsedResult, buildPrompt, parseJsonResponse } from "./types.js";
import { logCost } from "./cost-logger.js";

const MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
];

export async function analyzeWithGemini(images: ShrunkImage[], promptOverride?: string): Promise<ParsedResult> {
  if (!config.GEMINI_API_KEY) {
    throw Object.assign(new Error("GEMINI_API_KEY is not configured"), { statusCode: 500 });
  }

  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);

  const promptParts = [
    { text: promptOverride ?? buildPrompt(images.length, images.map((i) => i.name)) },
    ...images.map((s) => ({ inlineData: { data: s.data, mimeType: s.mimeType } })),
    { text: "Верни только JSON, без markdown и пояснений." },
  ];

  let raw = "";
  let lastError: unknown;
  for (const modelName of MODELS) {
    try {
      const m = genAI.getGenerativeModel({ model: modelName });
      const result = await m.generateContent(promptParts);
      raw = result.response.text();

      // Log token usage if available
      const usage = result.response.usageMetadata;
      if (usage) {
        logCost({
          timestamp: new Date().toISOString(),
          provider: "Gemini",
          model: modelName,
          tokensPrompt: usage.promptTokenCount,
          tokensCompletion: usage.candidatesTokenCount,
          tokensTotal: usage.totalTokenCount,
          details: `${images.length} images`,
        });
      }

      console.log(`[Gemini] used model: ${modelName}, tokens: ${usage?.totalTokenCount || "unknown"}`);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Gemini] ${modelName} failed: ${msg.slice(0, 150)}`);
      lastError = err;
    }
  }

  if (!raw) {
    throw Object.assign(
      new Error(
        `All Gemini models failed. Last error: ${lastError instanceof Error ? lastError.message.slice(0, 200) : String(lastError)}`
      ),
      { statusCode: 502 }
    );
  }

  console.log("[Gemini raw response]", raw.slice(0, 500));
  return parseJsonResponse(raw);
}
