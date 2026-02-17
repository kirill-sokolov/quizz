import { FastifyInstance } from "fastify";
import {
  startGame,
  nextQuestion,
  setSlide,
  getRemind,
  finishGame,
} from "../services/game-service.js";

export async function gameRoutes(app: FastifyInstance) {
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
      return notSubmitted;
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
