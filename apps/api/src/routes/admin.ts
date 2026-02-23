import { FastifyInstance } from "fastify";
import { authenticateToken } from "../middleware/auth.js";
import { runSeed } from "../services/seed-service.js";

export async function adminRoutes(app: FastifyInstance) {
  app.post(
    "/api/admin/seed",
    { preHandler: authenticateToken },
    async (_req, reply) => {
      const result = await runSeed();
      return reply.send({ ok: true, ...result });
    }
  );
}
