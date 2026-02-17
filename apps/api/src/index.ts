import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config.js";
import { wsPlugin } from "./ws/index.js";
import { quizzesRoutes } from "./routes/quizzes.js";
import { questionsRoutes } from "./routes/questions.js";
import { teamsRoutes } from "./routes/teams.js";
import { answersRoutes } from "./routes/answers.js";
import { gameRoutes } from "./routes/game.js";
import { mediaRoutes } from "./routes/media.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: true });

async function main() {
  await app.register(cors, { origin: true });
  await app.register(multipart);
  await app.register(fastifyStatic, {
    root: path.resolve(__dirname, "..", config.MEDIA_DIR),
    prefix: "/api/media/",
    decorateReply: true,
  });

  await app.register(wsPlugin);
  await app.register(quizzesRoutes);
  await app.register(questionsRoutes);
  await app.register(teamsRoutes);
  await app.register(answersRoutes);
  await app.register(gameRoutes);
  await app.register(mediaRoutes);

  app.get("/health", async () => ({ status: "ok" }));

  await app.listen({ port: config.PORT, host: config.HOST });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
