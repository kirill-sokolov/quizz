import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { quizzes } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function quizzesRoutes(app: FastifyInstance) {
  app.get("/api/quizzes", async () => {
    return db.select().from(quizzes);
  });

  app.post<{ Body: { title: string } }>("/api/quizzes", async (req, reply) => {
    const { title } = req.body;
    const [quiz] = await db.insert(quizzes).values({ title }).returning();
    return reply.code(201).send(quiz);
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
