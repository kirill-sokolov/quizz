import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { wsPlugin } from "./ws/index.js";
import { authRoutes } from "./routes/auth.js";
import { quizzesRoutes } from "./routes/quizzes.js";
import { questionsRoutes } from "./routes/questions.js";
import { teamsRoutes } from "./routes/teams.js";
import { answersRoutes } from "./routes/answers.js";
import { gameRoutes } from "./routes/game.js";
import { mediaRoutes } from "./routes/media.js";
import { importRoutes } from "./routes/import.js";
import { adminRoutes } from "./routes/admin.js";
import { testAgentsRoutes } from "./routes/test-agents.js";
import { BotAgentService } from "./test-agents/index.js";
import { broadcast } from "./ws/index.js";
import { setBotService } from "./bot-service-registry.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

async function main() {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Check your .env file.");
  }
  const mediaRoot = path.resolve(__dirname, "..", config.MEDIA_DIR);
  fs.mkdirSync(mediaRoot, { recursive: true });

  await app.register(cors, {
    origin: true,
    credentials: true
  });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  await app.register(wsPlugin);

  // Создаём сервис тестовых ботов (изолированный модуль)
  const wsServer = { broadcast };
  const botService = new BotAgentService(wsServer);
  setBotService(botService);

  await app.register(authRoutes);
  await app.register(quizzesRoutes);
  await app.register(questionsRoutes);
  await app.register(teamsRoutes);
  await app.register(answersRoutes);
  await app.register(gameRoutes);
  await app.register(mediaRoutes);
  await app.register(importRoutes);
  await app.register(adminRoutes);
  await app.register(async (app) => testAgentsRoutes(app, botService));

  app.get("/health", async () => ({ status: "ok" }));

  app.setErrorHandler((err: unknown, req, reply) => {
    req.log.error(err);
    const statusCode =
      typeof (err as { statusCode?: number }).statusCode === "number"
        ? (err as { statusCode: number }).statusCode
        : 500;
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return reply.code(statusCode).send({ error: String(message) });
  });

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
