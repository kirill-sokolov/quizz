import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { quizzes } from "../db/schema.js";
import { eq, ne, and } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { generateJoinCode } from "../services/game-service.js";

export async function quizzesRoutes(app: FastifyInstance) {
  app.get("/api/quizzes", async (req, reply) => {
    req.log.info({ url: req.url }, "GET /api/quizzes");
    try {
      const list = await db.select().from(quizzes);
      return reply.send(list);
    } catch (err) {
      req.log.error(err);
      return reply
        .code(500)
        .send({ error: err instanceof Error ? err.message : "Failed to fetch quizzes" });
    }
  });

  app.get("/api/quizzes/active", async () => {
    const active = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.status, "active"));
    return active;
  });

  app.get<{ Params: { code: string } }>(
    "/api/quizzes/by-code/:code",
    async (req, reply) => {
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.joinCode, req.params.code.toUpperCase()));
      if (!quiz) return reply.code(404).send({ error: "Quiz not found" });
      return quiz;
    }
  );

  app.post<{ Body: { title?: string } }>(
    "/api/quizzes",
    { preHandler: authenticateToken },
    async (req, reply) => {
    try {
      const title = req.body?.title?.trim() ?? "";
      if (!title) {
        return reply.code(400).send({ error: "title is required" });
      }
      const joinCode = generateJoinCode();
      const [quiz] = await db.insert(quizzes).values({ title, joinCode }).returning();
      return reply.code(201).send(quiz);
    } catch (err) {
      req.log.error(err);
      return reply
        .code(500)
        .send({ error: err instanceof Error ? err.message : "Failed to create quiz" });
    }
  });

  app.get<{ Params: { id: string } }>("/api/quizzes/:id", async (req, reply) => {
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.id, Number(req.params.id)));
    if (!quiz) return reply.code(404).send({ error: "Quiz not found" });
    return quiz;
  });

  app.patch<{
    Params: { id: string };
    Body: { title?: string; status?: "draft" | "active" | "finished" | "archived"; demoImageUrl?: string; rulesImageUrl?: string };
  }>(
    "/api/quizzes/:id",
    { preHandler: authenticateToken },
    async (req, reply) => {
      const [quiz] = await db
        .update(quizzes)
        .set(req.body)
        .where(eq(quizzes.id, Number(req.params.id)))
        .returning();
      if (!quiz) return reply.code(404).send({ error: "Quiz not found" });
      return quiz;
    }
  );

  app.delete<{ Params: { id: string } }>(
    "/api/quizzes/:id",
    { preHandler: authenticateToken },
    async (req, reply) => {
    const [quiz] = await db
      .delete(quizzes)
      .where(eq(quizzes.id, Number(req.params.id)))
      .returning();
    if (!quiz) return reply.code(404).send({ error: "Quiz not found" });
    return { ok: true };
  });

  // Вывести квиз на ТВ (сбрасывает флаг у других квизов)
  app.post<{ Params: { id: string } }>(
    "/api/quizzes/:id/display-on-tv",
    { preHandler: authenticateToken },
    async (req, reply) => {
      const quizId = Number(req.params.id);

      // Проверяем что квиз существует
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(eq(quizzes.id, quizId));
      if (!quiz) return reply.code(404).send({ error: "Quiz not found" });

      // Сбрасываем флаг у всех остальных квизов
      await db
        .update(quizzes)
        .set({ displayedOnTv: false })
        .where(ne(quizzes.id, quizId));

      // Устанавливаем флаг для выбранного квиза
      const [updatedQuiz] = await db
        .update(quizzes)
        .set({ displayedOnTv: true })
        .where(eq(quizzes.id, quizId))
        .returning();

      return { ok: true, quiz: updatedQuiz };
    }
  );
}
