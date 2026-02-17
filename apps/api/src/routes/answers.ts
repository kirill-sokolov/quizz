import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { answers, teams } from "../db/schema.js";
import { eq } from "drizzle-orm";

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
}
