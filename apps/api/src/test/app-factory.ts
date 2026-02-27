/**
 * Creates a Fastify application for integration tests.
 * Registers all routes/plugins but does NOT call listen().
 *
 * Module mocks (broadcast, bot-service-registry, LLM) are applied via
 * src/test/mock-modules.ts setupFile — do NOT add vi.mock() here.
 *
 * Helpers for accessing mocks in tests:
 *   getMockBroadcast()  → vi.fn() spy for broadcast
 *   getMockEvaluate()   → vi.fn() spy for evaluateTextAnswers
 */
/**
 * Pattern for mock access in tests — always use STATIC imports:
 *
 *   import { broadcast } from "../../ws/index.js";
 *   import { evaluateTextAnswers } from "../../services/llm/evaluate-text-answer.js";
 *   const mockBroadcast = vi.mocked(broadcast);
 *   const mockEvaluate  = vi.mocked(evaluateTextAnswers);
 *
 * Dynamic `await import(...)` can return a different instance → avoid it.
 */
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";

// ─── App factory ─────────────────────────────────────────────────────────────

const loadRoutes = async () => {
  const [
    { authRoutes },
    { quizzesRoutes },
    { questionsRoutes },
    { teamsRoutes },
    { answersRoutes },
    { gameRoutes },
    { adminRoutes },
  ] = await Promise.all([
    import("../routes/auth.js"),
    import("../routes/quizzes.js"),
    import("../routes/questions.js"),
    import("../routes/teams.js"),
    import("../routes/answers.js"),
    import("../routes/game.js"),
    import("../routes/admin.js"),
  ]);
  return {
    authRoutes,
    quizzesRoutes,
    questionsRoutes,
    teamsRoutes,
    answersRoutes,
    gameRoutes,
    adminRoutes,
  };
};

export async function createTestApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  const routes = await loadRoutes();

  await app.register(routes.authRoutes);
  await app.register(routes.quizzesRoutes);
  await app.register(routes.questionsRoutes);
  await app.register(routes.teamsRoutes);
  await app.register(routes.answersRoutes);
  await app.register(routes.gameRoutes);
  await app.register(routes.adminRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((err: unknown, _req, reply) => {
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return reply.code(statusCode).send({ error: String(message) });
  });

  await app.ready();
  return app;
}
