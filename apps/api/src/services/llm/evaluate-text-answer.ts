import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../../config.js";

export interface TeamAnswer {
  teamId: number;
  answerText: string;
}

export interface EvaluationResult {
  teamId: number;
  score: number;
}

function buildEvalPrompt(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): string {
  const teamsJson = teamAnswers.map((t) => ({
    teamId: t.teamId,
    answer: t.answerText,
  }));

  return `
Ты оцениваешь ответы команд в квизе. Тип вопроса — свободный ввод.

Правильные ответы (всего ${correctAnswers.length}):
${correctAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Максимальный балл за вопрос: ${weight}

Ответы команд:
${JSON.stringify(teamsJson, null, 2)}

Задача: для каждой команды определи, сколько правильных ответов она назвала.
Учитывай синонимы, опечатки, разный порядок слов — если смысл совпадает, засчитай.
Одну и ту же правильную позицию засчитай не более одного раза.

Балл = (количество_угаданных / ${correctAnswers.length}) * ${weight}
Округли до 1 знака после запятой.

Верни строго JSON (без markdown, без пояснений):
{
  "results": [
    { "teamId": 123, "matched": 2, "score": 1.5 }
  ]
}
`.trim();
}

function parseEvalResponse(raw: string): { results: Array<{ teamId: number; score: number }> } {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

async function evaluateWithGemini(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): Promise<EvaluationResult[]> {
  const prompt = buildEvalPrompt(correctAnswers, teamAnswers, weight);
  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  console.log("[evaluateTextAnswers Gemini] raw:", raw.slice(0, 300));

  const parsed = parseEvalResponse(raw);
  return parsed.results.map((r) => ({
    teamId: r.teamId,
    score: Math.round(r.score * 10) / 10,
  }));
}

async function evaluateWithGroq(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): Promise<EvaluationResult[]> {
  const prompt = buildEvalPrompt(correctAnswers, teamAnswers, weight);

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.1,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq API error: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0]?.message?.content || "{}";
  console.log("[evaluateTextAnswers Groq] raw:", raw.slice(0, 300));

  const parsed = parseEvalResponse(raw);
  return parsed.results.map((r) => ({
    teamId: r.teamId,
    score: Math.round(r.score * 10) / 10,
  }));
}

async function evaluateWithOpenRouter(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): Promise<EvaluationResult[]> {
  const prompt = buildEvalPrompt(correctAnswers, teamAnswers, weight);

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-exp:free",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter API error: ${res.status} ${errText.slice(0, 200)}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0]?.message?.content || "{}";
  console.log("[evaluateTextAnswers OpenRouter] raw:", raw.slice(0, 300));

  const parsed = parseEvalResponse(raw);
  return parsed.results.map((r) => ({
    teamId: r.teamId,
    score: Math.round(r.score * 10) / 10,
  }));
}

export async function evaluateTextAnswers(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): Promise<EvaluationResult[]> {
  if (teamAnswers.length === 0) return [];

  const providers = [
    { name: "Gemini", fn: evaluateWithGemini, key: config.GEMINI_API_KEY },
    { name: "Groq", fn: evaluateWithGroq, key: config.GROQ_API_KEY },
    { name: "OpenRouter", fn: evaluateWithOpenRouter, key: config.OPENROUTER_API_KEY },
  ];

  for (const { name, fn, key } of providers) {
    if (!key) {
      console.log(`[evaluateTextAnswers] ${name}: no key, skip`);
      continue;
    }
    try {
      const result = await fn(correctAnswers, teamAnswers, weight);
      console.log(`[evaluateTextAnswers] success via ${name}`);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[evaluateTextAnswers] ${name} failed: ${msg.slice(0, 200)}`);
    }
  }

  // All providers failed - return 0 scores
  console.error("[evaluateTextAnswers] All LLM providers failed, returning 0 scores");
  return teamAnswers.map((t) => ({ teamId: t.teamId, score: 0 }));
}
