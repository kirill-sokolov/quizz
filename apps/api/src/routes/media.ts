import { FastifyInstance } from "fastify";
import { config } from "../config.js";
import path from "path";
import fs from "fs";
import { pipeline } from "stream/promises";
import { randomUUID } from "crypto";
import { authenticateToken } from "../middleware/auth.js";

export async function mediaRoutes(app: FastifyInstance) {
  app.post("/api/media/upload", { preHandler: authenticateToken }, async (req, reply) => {
    const file = await req.file();
    if (!file) return reply.code(400).send({ error: "No file uploaded" });

    const ext = path.extname(file.filename);
    const filename = `${randomUUID()}${ext}`;
    const dest = path.join(config.MEDIA_DIR, filename);

    await pipeline(file.file, fs.createWriteStream(dest));

    return reply.code(201).send({
      filename,
      url: `/api/media/${filename}`,
    });
  });

  app.get<{ Params: { filename: string } }>(
    "/api/media/:filename",
    async (req, reply) => {
      const filePath = path.join(config.MEDIA_DIR, req.params.filename);
      if (!fs.existsSync(filePath)) {
        return reply.code(404).send({ error: "File not found" });
      }
      return reply.sendFile(req.params.filename, config.MEDIA_DIR);
    }
  );
}
