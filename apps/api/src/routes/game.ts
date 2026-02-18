import { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { gameState, questions } from "../db/schema.js";
import { eq } from "drizzle-orm";
import {
  startGame,
  nextQuestion,
  setSlide,
  getRemind,
  finishGame,
} from "../services/game-service.js";

export async function gameRoutes(app: FastifyInstance) {
  app.get<{ Params: { quizId: string } }>(
    "/api/game/state/:quizId",
    async (req, reply) => {
      const quizId = Number(req.params.quizId);
      const [state] = await db
        .select()
        .from(gameState)
        .where(eq(gameState.quizId, quizId));
      if (!state) return reply.code(404).send({ error: "Game not started" });

      let question = null;
      if (state.currentQuestionId) {
        const [q] = await db
          .select()
          .from(questions)
          .where(eq(questions.id, state.currentQuestionId));
        question = q ?? null;
      }

      return { ...state, question };
    }
  );

  app.post<{ Body: { quizId: number } }>(
    "/api/game/start",
    async (req, reply) => {
      const state = await startGame(req.body.quizId);
      return reply.code(200).send(state);
    }
  );

  app.post<{ Body: { quizId: number } }>(
    "/api/game/next-question",
    async (req, reply) => {
      const state = await nextQuestion(req.body.quizId);
      if (!state) {
        return reply
          .code(200)
          .send({ done: true, message: "No more questions" });
      }
      return state;
    }
  );

  app.post<{ Body: { quizId: number; slide: "question" | "timer" | "answer" } }>(
    "/api/game/set-slide",
    async (req, reply) => {
      const state = await setSlide(req.body.quizId, req.body.slide);
      return state;
    }
  );

  app.post<{ Body: { quizId: number; teamId?: number } }>(
    "/api/game/remind",
    async (req, reply) => {
      const notSubmitted = await getRemind(req.body.quizId, req.body.teamId);
      const { broadcast } = await import("../ws/index.js");
      broadcast("remind", {
        quizId: req.body.quizId,
        teams: notSubmitted.map((t) => ({
          teamId: t.id,
          telegramChatId: t.telegramChatId ? Number(t.telegramChatId) : null,
        })),
      });
      return notSubmitted.map((t) => ({
        ...t,
        telegramChatId: t.telegramChatId ? Number(t.telegramChatId) : null,
      }));
    }
  );

  app.post<{ Body: { quizId: number } }>(
    "/api/game/finish",
    async (req, reply) => {
      const results = await finishGame(req.body.quizId);
      return results;
    }
  );
}
