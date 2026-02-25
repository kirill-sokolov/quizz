/**
 * API routes для тестовых агентов (ботов)
 * Этот файл изолирован и может быть легко удалён
 */

import { FastifyInstance } from "fastify";
import { authenticateToken } from "../middleware/auth.js";
import { BotAgentService } from "../test-agents/index.js";
import { db } from "../db/index.js";
import { gameState } from "../db/schema.js";
import { eq } from "drizzle-orm";

export async function testAgentsRoutes(
  app: FastifyInstance,
  botService: BotAgentService
) {
  // Создать тестовых ботов
  app.post<{
    Params: { id: string };
    Body: { count: number };
  }>(
    "/api/quizzes/:id/test-bots",
    { preHandler: authenticateToken },
    async (req, reply) => {
      const quizId = Number(req.params.id);
      const count = Math.min(Math.max(req.body.count || 1, 1), 20); // 1-20

      const bots = await botService.createBots(quizId, {
        count,
        answerDelay: 1000,
      });

      return { ok: true, bots, count: bots.length };
    }
  );

  // Удалить всех тестовых ботов
  app.delete<{ Params: { id: string } }>(
    "/api/quizzes/:id/test-bots",
    { preHandler: authenticateToken },
    async (req, reply) => {
      const quizId = Number(req.params.id);
      await botService.removeBots(quizId);
      return { ok: true };
    }
  );

  // Переключить показ ботов на TV
  app.post<{
    Params: { id: string };
    Body: { showBotsOnTv: boolean };
  }>(
    "/api/game/:id/toggle-bots-visibility",
    { preHandler: authenticateToken },
    async (req, reply) => {
      const quizId = Number(req.params.id);

      await db
        .update(gameState)
        .set({ showBotsOnTv: req.body.showBotsOnTv })
        .where(eq(gameState.quizId, quizId));

      return { ok: true, showBotsOnTv: req.body.showBotsOnTv };
    }
  );
}
