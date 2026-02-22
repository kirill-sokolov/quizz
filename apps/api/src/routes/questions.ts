import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { questions, slides } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import { BASE_SLIDE_TYPES, type SlideType } from "../types/slide.js";

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
      timerPosition?: string;
    };
  }>(
    "/api/quizzes/:id/questions",
    { preHandler: authenticateToken },
    async (req, reply) => {
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
        timerPosition: (req.body.timerPosition ?? "center") as "center" | "top" | "bottom" | "left" | "right" | "top-left" | "top-right" | "bottom-left" | "bottom-right",
      })
      .returning();

    const createdSlides = [];
    for (const type of BASE_SLIDE_TYPES) {
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
      timerPosition?: string;
      orderNum?: number;
      slides?: Array<{
        id: number | null;
        type: SlideType;
        imageUrl?: string | null;
        videoUrl?: string | null;
        videoLayout?: { top: number; left: number; width: number; height: number } | null;
      }>;
    };
  }>(
    "/api/questions/:id",
    { preHandler: authenticateToken },
    async (req, reply) => {
    const questionId = Number(req.params.id);
    const { slides: slideUpdates, ...questionFields } = req.body;

    const hasQuestionUpdates = Object.keys(questionFields).length > 0;
    let question;
    if (hasQuestionUpdates) {
      const [updated] = await db
        .update(questions)
        .set(questionFields as any)
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
      console.log('slideUpdates received:', JSON.stringify(slideUpdates, null, 2));
      // Get existing slides
      const existingSlides = await db
        .select()
        .from(slides)
        .where(eq(slides.questionId, questionId));

      const existingByType = new Map(existingSlides.map(s => [s.type, s]));

      for (const s of slideUpdates) {
        // Skip slides without a valid type
        if (!s.type) {
          console.warn('Skipping slide without type:', s);
          continue;
        }

        const slideId = typeof s.id === "number" && s.id > 0 ? s.id : null;
        const existing = existingByType.get(s.type);

        if (slideId && existing) {
          // Update existing slide
          const setPayload: { imageUrl?: string | null; videoUrl?: string | null; videoLayout?: { top: number; left: number; width: number; height: number } | null } = {};
          if (s.imageUrl !== undefined) setPayload.imageUrl = s.imageUrl;
          if (s.videoUrl !== undefined) setPayload.videoUrl = s.videoUrl;
          if (s.videoLayout !== undefined) setPayload.videoLayout = s.videoLayout;
          if (Object.keys(setPayload).length > 0) {
            await db.update(slides).set(setPayload).where(eq(slides.id, slideId));
          }
        } else if (!existing) {
          // Create new slide if it doesn't exist
          await db.insert(slides).values({
            questionId,
            type: s.type,
            imageUrl: s.imageUrl || null,
            videoUrl: s.videoUrl || null,
            videoLayout: s.videoLayout || null,
          });
        }
      }

      // Delete slides that are not in the update (e.g., video slides when unchecked)
      const updatedTypes = new Set(slideUpdates.map(s => s.type));
      const typesToDelete = existingSlides
        .filter(s => !updatedTypes.has(s.type))
        .filter(s => s.type === "video_warning" || s.type === "video_intro"); // Only delete video slides

      for (const toDelete of typesToDelete) {
        await db.delete(slides).where(eq(slides.id, toDelete.id));
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
    { preHandler: authenticateToken },
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
