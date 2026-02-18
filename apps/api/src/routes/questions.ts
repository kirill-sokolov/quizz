import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { questions, slides } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";

export async function questionsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string } }>(
    "/api/quizzes/:id/questions",
    async (req) => {
      const quizId = Number(req.params.id);
      const rows = await db
        .select()
        .from(questions)
        .where(eq(questions.quizId, quizId))
        .orderBy(asc(questions.orderNum));

      const result = [];
      for (const q of rows) {
        const qSlides = await db
          .select()
          .from(slides)
          .where(eq(slides.questionId, q.id));
        result.push({ ...q, slides: qSlides });
      }
      return result;
    }
  );

  app.post<{
    Params: { id: string };
    Body: {
      text?: string;
      options?: string[];
      correctAnswer?: string;
      timeLimitSec?: number;
    };
  }>("/api/quizzes/:id/questions", async (req, reply) => {
    const quizId = Number(req.params.id);

    const existing = await db
      .select({ orderNum: questions.orderNum })
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(asc(questions.orderNum));
    const nextOrder = existing.length > 0 ? existing[existing.length - 1].orderNum + 1 : 1;

    const [question] = await db
      .insert(questions)
      .values({
        quizId,
        orderNum: nextOrder,
        text: req.body.text ?? "",
        options: req.body.options ?? [],
        correctAnswer: req.body.correctAnswer ?? "",
        timeLimitSec: req.body.timeLimitSec ?? 30,
      })
      .returning();

    const slideTypes = ["question", "timer", "answer"] as const;
    const createdSlides = [];
    for (const type of slideTypes) {
      const [slide] = await db
        .insert(slides)
        .values({ questionId: question.id, type })
        .returning();
      createdSlides.push(slide);
    }

    return reply.code(201).send({ ...question, slides: createdSlides });
  });

  app.patch<{
    Params: { id: string };
    Body: {
      text?: string;
      options?: string[];
      correctAnswer?: string;
      timeLimitSec?: number;
      orderNum?: number;
      slides?: Array<{
        id: number;
        imageUrl?: string | null;
        videoUrl?: string | null;
      }>;
    };
  }>("/api/questions/:id", async (req, reply) => {
    const questionId = Number(req.params.id);
    const { slides: slideUpdates, ...questionFields } = req.body;

    const hasQuestionUpdates = Object.keys(questionFields).length > 0;
    let question;
    if (hasQuestionUpdates) {
      const [updated] = await db
        .update(questions)
        .set(questionFields)
        .where(eq(questions.id, questionId))
        .returning();
      if (!updated) return reply.code(404).send({ error: "Question not found" });
      question = updated;
    } else {
      const [existing] = await db
        .select()
        .from(questions)
        .where(eq(questions.id, questionId));
      if (!existing) return reply.code(404).send({ error: "Question not found" });
      question = existing;
    }

    if (slideUpdates && Array.isArray(slideUpdates)) {
      for (const s of slideUpdates) {
        const slideId = typeof s.id === "number" && s.id > 0 ? s.id : null;
        if (slideId == null) continue;
        const setPayload: { imageUrl?: string | null; videoUrl?: string | null } = {};
        if (s.imageUrl !== undefined) setPayload.imageUrl = s.imageUrl;
        if (s.videoUrl !== undefined) setPayload.videoUrl = s.videoUrl;
        if (Object.keys(setPayload).length > 0) {
          await db.update(slides).set(setPayload).where(eq(slides.id, slideId));
        }
      }
    }

    const qSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.questionId, questionId));

    return { ...question, slides: qSlides };
  });

  app.delete<{ Params: { id: string } }>(
    "/api/questions/:id",
    async (req, reply) => {
      const [deleted] = await db
        .delete(questions)
        .where(eq(questions.id, Number(req.params.id)))
        .returning();
      if (!deleted) return reply.code(404).send({ error: "Question not found" });
      return { ok: true };
    }
  );
}
