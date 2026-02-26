import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { answers, teams, questions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { broadcast } from "../ws/index.js";
import { authenticateToken } from "../middleware/auth.js";
import { evaluateTextAnswers } from "../services/llm/evaluate-text-answer.js";

export async function answersRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/questions/:id/answers",
    async (req) => {
      const questionId = Number(req.params.id);
      const rows = await db
        .select({
          id: answers.id,
          questionId: answers.questionId,
          teamId: answers.teamId,
          answerText: answers.answerText,
          awardedScore: answers.awardedScore,
          submittedAt: answers.submittedAt,
          teamName: teams.name,
        })
        .from(answers)
        .innerJoin(teams, eq(answers.teamId, teams.id))
        .where(eq(answers.questionId, questionId));
      return rows;
    }
  );

  app.post<{
    Body: { questionId: number; teamId: number; answerText: string };
  }>("/api/answers", async (req, reply) => {
    const { questionId, teamId } = req.body;
    let { answerText } = req.body;

    if (!answerText || typeof answerText !== "string") {
      return reply.code(400).send({ error: "answerText is required" });
    }
    answerText = answerText.trim();
    if (!answerText) {
      return reply.code(400).send({ error: "answerText cannot be empty" });
    }

    // Fetch question for type-based validation and preprocessing
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, questionId));

    if (!question) {
      return reply.code(404).send({ error: "Question not found" });
    }

    if (question.questionType === "choice") {
      const letter = answerText.toUpperCase();
      const validLetters = ["A", "B", "C", "D", "E", "F", "G", "H"];
      if (!validLetters.includes(letter)) {
        return reply.code(400).send({ error: "Invalid answer: must be a letter A–H" });
      }
      answerText = letter;
    } else {
      // text question: enforce max length, then truncate to first N items
      answerText = answerText.slice(0, 500);

      const correctAnswers = question.correctAnswer
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      if (correctAnswers.length > 1) {
        const userItems = answerText
          .split(/[,\n]+/)
          .map((s) => s.trim())
          .filter(Boolean);

        if (userItems.length > correctAnswers.length) {
          // Only keep the first N items to prevent gaming by listing all possibilities
          answerText = userItems.slice(0, correctAnswers.length).join(", ");
        }
      }
    }

    try {
      const [answer] = await db
        .insert(answers)
        .values({ questionId, teamId, answerText })
        .returning();

      broadcast("answer_submitted", {
        quizId: question.quizId,
        questionId,
        teamId,
        answerId: answer.id,
      });

      // For text questions: evaluate immediately in background, don't block the response
      if (question.questionType === "text") {
        const correctAnswers = question.correctAnswer
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

        (async () => {
          try {
            const [result] = await evaluateTextAnswers(
              correctAnswers,
              [{ teamId, answerText }],
              question.weight
            );
            if (result !== undefined) {
              await db
                .update(answers)
                .set({ awardedScore: result.score })
                .where(eq(answers.id, answer.id));

              broadcast("answer_scored", {
                quizId: question.quizId,
                questionId,
                teamId,
                answerId: answer.id,
                awardedScore: result.score,
              });
            }
          } catch (err) {
            console.error("[answer scored] LLM evaluation failed:", err);
          }
        })();
      }

      return reply.code(201).send(answer);
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.code(409).send({ error: "Already answered" });
      }
      throw err;
    }
  });

  app.patch<{
    Params: { id: string };
    Body: { score: number };
  }>(
    "/api/answers/:id/score",
    { preHandler: authenticateToken },
    async (req, reply) => {
      const answerId = Number(req.params.id);
      const { score } = req.body;

      const [updated] = await db
        .update(answers)
        .set({ awardedScore: score })
        .where(eq(answers.id, answerId))
        .returning();

      if (!updated) {
        return reply.code(404).send({ error: "Answer not found" });
      }

      return updated;
    }
  );
}
