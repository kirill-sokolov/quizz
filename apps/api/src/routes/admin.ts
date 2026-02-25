import { FastifyInstance } from "fastify";
import { authenticateToken } from "../middleware/auth.js";
import { runSeed, runFullReset } from "../services/seed-service.js";

export async function adminRoutes(app: FastifyInstance) {
  // Добавить демо-квиз (безопасно, не удаляет существующие)
  app.post(
    "/api/admin/seed",
    { preHandler: authenticateToken },
    async (_req, reply) => {
      const result = await runSeed();
      return reply.send({ ok: true, ...result });
    }
  );

  // ⚠️ Полный сброс БД (удаляет ВСЕ квизы и создаёт демо)
  app.post(
    "/api/admin/reset",
    { preHandler: authenticateToken },
    async (_req, reply) => {
      const result = await runFullReset();
      return reply.send({ ok: true, ...result });
    }
  );
}
