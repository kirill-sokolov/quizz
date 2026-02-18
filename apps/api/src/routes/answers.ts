import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { answers, teams } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { broadcast } from "../ws/index.js";

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
    const { questionId, teamId, answerText } = req.body;

    try {
      const [answer] = await db
        .insert(answers)
        .values({ questionId, teamId, answerText })
        .returning();

      broadcast("answer_submitted", {
        questionId,
        teamId,
        answerId: answer.id,
      });

      return reply.code(201).send(answer);
    } catch (err: any) {
      if (err.code === "23505") {
        return reply.code(409).send({ error: "Already answered" });
      }
      throw err;
    }
  });
}
