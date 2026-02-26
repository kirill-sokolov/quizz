import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { questions, slides } from "../db/schema.js";
import { eq, asc } from "drizzle-orm";
import { authenticateToken } from "../middleware/auth.js";
import type { SlideType } from "../types/slide.js";

const BASE_QUESTION_TYPES = ["question", "timer", "answer"] as const;

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
          .where(eq(slides.questionId, q.id))
          .orderBy(asc(slides.sortOrder));
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
      questionType?: string;
      weight?: number;
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
        questionType: (req.body.questionType ?? "choice") as "choice" | "text",
        weight: req.body.weight ?? 1,
      })
      .returning();

    const createdSlides = [];
    for (let i = 0; i < BASE_QUESTION_TYPES.length; i++) {
      const type = BASE_QUESTION_TYPES[i];
      const [slide] = await db
        .insert(slides)
        .values({ questionId: question.id, type, sortOrder: i + 2 }) // question=2, timer=3, answer=4
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
      questionType?: string;
      weight?: number;
      orderNum?: number;
      slides?: Array<{
        id?: number | null;
        type: SlideType;
        imageUrl?: string | null;
        videoUrl?: string | null;
        videoLayout?: { top: number; left: number; width: number; height: number } | null;
        sortOrder?: number;
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
      // Get existing slides
      const existingSlides = await db
        .select()
        .from(slides)
        .where(eq(slides.questionId, questionId));

      const existingById = new Map(existingSlides.map(s => [s.id, s]));
      const processedIds = new Set<number>();

      // Process each slide in order
      for (let idx = 0; idx < slideUpdates.length; idx++) {
        const s = slideUpdates[idx];
        if (!s.type) continue;

        const sortOrder = s.sortOrder ?? idx;
        const slideId = typeof s.id === "number" && s.id > 0 ? s.id : null;

        if (slideId && existingById.has(slideId)) {
          // Update existing slide
          const setPayload: Record<string, any> = { sortOrder };
          if (s.imageUrl !== undefined) setPayload.imageUrl = s.imageUrl;
          if (s.videoUrl !== undefined) setPayload.videoUrl = s.videoUrl;
          if (s.videoLayout !== undefined) setPayload.videoLayout = s.videoLayout;
          await db.update(slides).set(setPayload).where(eq(slides.id, slideId));
          processedIds.add(slideId);
        } else if (!slideId) {
          // Insert new slide (extras or new base slides)
          const [inserted] = await db.insert(slides).values({
            questionId,
            type: s.type,
            imageUrl: s.imageUrl || null,
            videoUrl: s.videoUrl || null,
            videoLayout: s.videoLayout || null,
            sortOrder,
          }).returning();
          processedIds.add(inserted.id);
        }
      }

      // Delete extra slides that are no longer in the array
      // (only delete 'extra' type slides — never delete base question/timer/answer/video slides)
      for (const existing of existingSlides) {
        if (!processedIds.has(existing.id) && existing.type === "extra") {
          await db.delete(slides).where(eq(slides.id, existing.id));
        }
      }

      // Handle video slides: delete if not in the update list
      const updatedTypes = new Set(slideUpdates.map(s => s.type));
      for (const existing of existingSlides) {
        if (!processedIds.has(existing.id) &&
            (existing.type === "video_warning" || existing.type === "video_intro") &&
            !updatedTypes.has(existing.type as any)) {
          await db.delete(slides).where(eq(slides.id, existing.id));
        }
      }
    }

    const qSlides = await db
      .select()
      .from(slides)
      .where(eq(slides.questionId, questionId))
      .orderBy(asc(slides.sortOrder));

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
