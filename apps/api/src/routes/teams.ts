import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { teams } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { broadcast } from "../ws/index.js";

export async function teamsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { all?: string } }>(
    "/api/quizzes/:id/teams",
    async (req) => {
      const quizId = Number(req.params.id);
      const showAll = req.query.all === "true";

      if (showAll) {
        return db.select().from(teams).where(eq(teams.quizId, quizId));
      }
      return db
        .select()
        .from(teams)
        .where(and(eq(teams.quizId, quizId), eq(teams.isKicked, false)));
    }
  );

  app.post<{
    Params: { id: string };
    Body: { name: string; telegramChatId: number };
  }>("/api/quizzes/:id/teams", async (req, reply) => {
    const quizId = Number(req.params.id);
    const { name, telegramChatId } = req.body;

    const [team] = await db
      .insert(teams)
      .values({ quizId, name, telegramChatId: BigInt(telegramChatId) })
      .returning();

    broadcast("team_registered", {
      teamId: team.id,
      name: team.name,
      quizId,
    });

    return reply.code(201).send(team);
  });

  app.delete<{ Params: { id: string } }>(
    "/api/teams/:id",
    async (req, reply) => {
      const [team] = await db
        .update(teams)
        .set({ isKicked: true })
        .where(eq(teams.id, Number(req.params.id)))
        .returning();
      if (!team) return reply.code(404).send({ error: "Team not found" });

      broadcast("team_kicked", { teamId: team.id, name: team.name });
      return { ok: true };
    }
  );
}
