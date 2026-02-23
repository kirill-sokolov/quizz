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

export async function evaluateTextAnswers(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): Promise<EvaluationResult[]> {
  if (teamAnswers.length === 0) return [];

  if (!config.GEMINI_API_KEY) {
    console.warn("[evaluateTextAnswers] No GEMINI_API_KEY, returning 0 scores");
    return teamAnswers.map((t) => ({ teamId: t.teamId, score: 0 }));
  }

  const prompt = buildEvalPrompt(correctAnswers, teamAnswers, weight);

  const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-lite" });

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    console.log("[evaluateTextAnswers] raw:", raw.slice(0, 500));

    const parsed = parseEvalResponse(raw);
    return parsed.results.map((r) => ({
      teamId: r.teamId,
      score: Math.round(r.score * 10) / 10,
    }));
  } catch (err) {
    console.error("[evaluateTextAnswers] LLM error:", err);
    return teamAnswers.map((t) => ({ teamId: t.teamId, score: 0 }));
  }
}
