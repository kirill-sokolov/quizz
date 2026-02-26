import { config } from "../../config.js";
import { logCost } from "./cost-logger.js";

const EVAL_MODEL = "google/gemini-3-flash-preview";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";

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

Ответы команд:
${JSON.stringify(teamsJson, null, 2)}

Задача: для каждой команды определи, сколько правильных ответов она назвала (целое число от 0 до ${correctAnswers.length}).
Учитывай синонимы, опечатки, разный порядок слов — если смысл совпадает, засчитай.
Одну и ту же правильную позицию засчитай не более одного раза.
Если команда перечислила несколько вариантов через запятую — считай только первые ${correctAnswers.length} (по порядку).

Верни строго JSON (без markdown, без пояснений):
{
  "results": [
    { "teamId": 123, "matched": 2 }
  ]
}
`.trim();
}

function parseEvalResponse(raw: string): { results: Array<{ teamId: number; matched: number }> } {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

async function evaluateWithOpenRouter(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): Promise<EvaluationResult[]> {
  const prompt = buildEvalPrompt(correctAnswers, teamAnswers, weight);

  const res = await fetch(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
      "HTTP-Referer": "http://localhost",
      "X-Title": "WeddingQuiz",
    },
    body: JSON.stringify({
      model: EVAL_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${errText.slice(0, 200)}`);
  }

  const creditsUsed = res.headers.get("x-openrouter-credits-used");
  if (creditsUsed) {
    logCost({
      timestamp: new Date().toISOString(),
      provider: "OpenRouter",
      model: EVAL_MODEL,
      creditsUsed: parseFloat(creditsUsed),
      details: `evaluate-text-answers - ${teamAnswers.length} teams`,
    });
  }

  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0]?.message?.content || "{}";
  console.log(`[evaluateTextAnswers] model: ${EVAL_MODEL}, credits: ${creditsUsed || "unknown"}`);
  console.log("[evaluateTextAnswers] raw:", raw.slice(0, 300));

  const parsed = parseEvalResponse(raw);
  const total = correctAnswers.length;
  return parsed.results.map((r) => {
    const matched = Math.max(0, Math.min(r.matched, total));
    const score = Math.round((matched / total) * weight * 100) / 100;
    return { teamId: r.teamId, score };
  });
}

export async function evaluateTextAnswers(
  correctAnswers: string[],
  teamAnswers: TeamAnswer[],
  weight: number
): Promise<EvaluationResult[]> {
  if (teamAnswers.length === 0) return [];
  if (correctAnswers.length === 0) {
    // No correct answers defined — cannot evaluate, return 0 scores
    return teamAnswers.map((t) => ({ teamId: t.teamId, score: 0 }));
  }

  if (!config.OPENROUTER_API_KEY) {
    console.error("[evaluateTextAnswers] OPENROUTER_API_KEY not configured, returning 0 scores");
    return teamAnswers.map((t) => ({ teamId: t.teamId, score: 0 }));
  }

  try {
    const result = await evaluateWithOpenRouter(correctAnswers, teamAnswers, weight);
    console.log("[evaluateTextAnswers] success");
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[evaluateTextAnswers] failed: ${msg.slice(0, 200)}`);
    return teamAnswers.map((t) => ({ teamId: t.teamId, score: 0 }));
  }
}
