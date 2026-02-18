import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { quizzes } from "../db/schema.js";
import { eq, ne, and } from "drizzle-orm";

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

  app.post<{ Body: { title?: string } }>("/api/quizzes", async (req, reply) => {
    try {
      const title = req.body?.title?.trim() ?? "";
      if (!title) {
        return reply.code(400).send({ error: "title is required" });
      }
      const [quiz] = await db.insert(quizzes).values({ title }).returning();
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
    Body: { title?: string; status?: "draft" | "active" | "finished" };
  }>(
    "/api/quizzes/:id",
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

  app.delete<{ Params: { id: string } }>("/api/quizzes/:id", async (req, reply) => {
    const [quiz] = await db
      .delete(quizzes)
      .where(eq(quizzes.id, Number(req.params.id)))
      .returning();
    if (!quiz) return reply.code(404).send({ error: "Quiz not found" });
    return { ok: true };
  });
}
