import { FastifyInstance } from "fastify";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { db } from "../db/index.js";
import { admins } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";

const JWT_SECRET = config.JWT_SECRET || "your-secret-key-change-in-production";

export async function authRoutes(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const { username, password } = req.body as {
      username?: string;
      password?: string;
    };

    if (!username || !password) {
      return reply.code(400).send({ error: "Username and password required" });
    }

    const [admin] = await db
      .select()
      .from(admins)
      .where(eq(admins.username, username))
      .limit(1);

    if (!admin) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    reply.setCookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
      path: "/",
    });

    return { success: true };
  });

  app.post("/api/auth/verify", async (req, reply) => {
    const token = req.cookies.auth_token;

    if (!token) {
      return reply.code(401).send({ error: "No token provided" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      return { valid: true, user: decoded };
    } catch {
      return reply.code(401).send({ error: "Invalid token" });
    }
  });

  app.post("/api/auth/logout", async (req, reply) => {
    reply.clearCookie("auth_token", { path: "/" });
    return { success: true };
  });
}
