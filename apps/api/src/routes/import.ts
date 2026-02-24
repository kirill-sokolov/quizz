import { FastifyInstance } from "fastify";
import {
  importZip,
  saveImportedQuiz,
  type ImportPreviewItem,
  type ImportPreviewResult,
} from "../services/import-service.js";
import { parseDocxText, parseDocxImages } from "../services/llm/index.js";
import { extractTextFromDocx, convertDocxToImages } from "../services/docx-parser.js";
import { config } from "../config.js";
import path from "path";
import { authenticateToken } from "../middleware/auth.js";

export async function importRoutes(app: FastifyInstance) {
  // Upload ZIP (+ optional DOCX or pre-parsed questions), parse with LLM, return preview
  app.post<{ Params: { id: string } }>(
    "/api/quizzes/:id/import-zip",
    { preHandler: authenticateToken },
    async (req, reply) => {
      const quizId = Number(req.params.id);

      // Parse multipart form data
      let zipBuffer: Buffer | null = null;
      let docxBuffer: Buffer | null = null;
      let selectedModel: string | null = null;
      let docxQuestions: string | null = null;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "file") {
          zipBuffer = await part.toBuffer();
        } else if (part.type === "file" && part.fieldname === "docx") {
          docxBuffer = await part.toBuffer();
        } else if (part.type === "field" && part.fieldname === "model") {
          selectedModel = String(part.value) || null;
        } else if (part.type === "field" && part.fieldname === "docxQuestions") {
          docxQuestions = String(part.value) || null;
        }
      }

      if (!zipBuffer) {
        return reply.code(400).send({ error: "No file uploaded" });
      }

      const preview = await importZip(
        quizId,
        zipBuffer,
        selectedModel,
        docxBuffer,
        docxQuestions ? JSON.parse(docxQuestions) : null
      );
      return preview;
    }
  );

  // Save edited preview as actual questions
  app.post<{
    Params: { id: string };
    Body: ImportPreviewResult;
  }>(
    "/api/quizzes/:id/import-save",
    { preHandler: authenticateToken },
    async (req, reply) => {
    const quizId = Number(req.params.id);
    const { questions, demoImageUrl, rulesImageUrl } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return reply.code(400).send({ error: "No questions provided" });
    }

    const result = await saveImportedQuiz(quizId, { questions, demoImageUrl, rulesImageUrl });
    return reply.code(201).send(result);
  });

  // Parse DOCX только (without ZIP)
  app.post<{ Params: { id: string } }>(
    "/api/quizzes/:id/import-docx",
    { preHandler: authenticateToken },
    async (req, reply) => {
      let docxBuffer: Buffer | null = null;
      let selectedModel: string | null = null;

      const parts = req.parts();
      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "docx") {
          docxBuffer = await part.toBuffer();
        } else if (part.type === "field" && part.fieldname === "model") {
          selectedModel = String(part.value) || null;
        }
      }

      if (!docxBuffer) {
        return reply.code(400).send({ error: "No DOCX file uploaded" });
      }

      // Try image-based parsing first, fallback to text
      try {
        const debugDir = path.resolve(config.MEDIA_DIR, "debug-docx");
        const docxImages = await convertDocxToImages(docxBuffer, debugDir);
        const docxParsed = await parseDocxImages(docxImages, selectedModel);
        return reply.code(200).send({ questions: docxParsed.questions });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`[DOCX parse] Image conversion failed (${errMsg}), falling back to text parsing`);

        const docxText = extractTextFromDocx(docxBuffer);
        const docxParsed = await parseDocxText(docxText, selectedModel);
        return reply.code(200).send({ questions: docxParsed.questions });
      }
    }
  );
}
