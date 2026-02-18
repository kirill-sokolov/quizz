import { FastifyInstance } from "fastify";
import {
  importZip,
  saveImportedQuiz,
  type ImportPreviewItem,
} from "../services/import-service.js";

export async function importRoutes(app: FastifyInstance) {
  // Upload ZIP, parse with Gemini, return preview
  app.post<{ Params: { id: string } }>(
    "/api/quizzes/:id/import-zip",
    async (req, reply) => {
      const quizId = Number(req.params.id);
      const file = await req.file();
      if (!file) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      const buffer = await file.toBuffer();

      const preview = await importZip(quizId, buffer);
      return { questions: preview };
    }
  );

  // Save edited preview as actual questions
  app.post<{
    Params: { id: string };
    Body: { questions: ImportPreviewItem[] };
  }>("/api/quizzes/:id/import-save", async (req, reply) => {
    const quizId = Number(req.params.id);
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return reply.code(400).send({ error: "No questions provided" });
    }

    const result = await saveImportedQuiz(quizId, questions);
    return reply.code(201).send(result);
  });
}
