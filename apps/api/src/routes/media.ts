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
      path: `/api/media/${filename}`,
      url: `/api/media/${filename}`,
    });
  });

  app.get<{ Params: { "*": string } }>(
    "/api/media/*",
    async (req, reply) => {
      const filePath = req.params["*"];
      const fullPath = path.join(config.MEDIA_DIR, filePath);
      if (!fs.existsSync(fullPath)) {
        return reply.code(404).send({ error: "File not found" });
      }

      // Determine content type from extension
      const ext = path.extname(fullPath).toLowerCase();
      const contentTypes: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
      };
      const contentType = contentTypes[ext] || "application/octet-stream";

      reply.header("Content-Type", contentType);
      return reply.send(fs.createReadStream(fullPath));
    }
  );
}
