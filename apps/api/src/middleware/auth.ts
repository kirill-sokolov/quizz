import { FastifyRequest, FastifyReply } from "fastify";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

const JWT_SECRET = config.JWT_SECRET || "your-secret-key-change-in-production";

export async function authenticateToken(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const token = request.cookies.auth_token;

  if (!token) {
    return reply.code(401).send({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    (request as any).user = decoded;
  } catch {
    return reply.code(401).send({ error: "Invalid or expired token" });
  }
}
