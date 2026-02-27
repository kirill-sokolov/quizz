/**
 * Smoke tests — verify the test infrastructure works:
 * - App starts and responds
 * - DB connection works
 * - Basic CRUD on quizzes
 * - Auth (cookie-based JWT)
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestApp } from "../app-factory.js";
import { resetDb } from "../setup.js";
import { createQuiz, createAdmin, loginAs } from "../helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDb();
});

describe("Health check", () => {
  it("GET /health returns ok", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
  });
});

describe("Auth", () => {
  it("POST /api/auth/login returns 401 with wrong password", async () => {
    await createAdmin("testadmin", "correctpassword");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "testadmin", password: "wrongpassword" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("POST /api/auth/login succeeds and sets auth_token cookie", async () => {
    await createAdmin("testadmin2", "secret");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "testadmin2", password: "secret" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
    const cookies = res.headers["set-cookie"];
    const cookieStr = Array.isArray(cookies) ? cookies[0] : cookies;
    expect(cookieStr).toContain("auth_token=");
  });

  it("POST /api/auth/verify returns valid for authenticated session", async () => {
    await createAdmin("verifyme", "pass123");
    const cookie = await loginAs(app, "verifyme", "pass123");
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify",
      cookies: { auth_token: cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().valid).toBe(true);
  });
});

describe("Quizzes API", () => {
  let authCookie: string;

  beforeEach(async () => {
    await createAdmin("quizadmin", "pass");
    authCookie = await loginAs(app, "quizadmin", "pass");
  });

  it("GET /api/quizzes returns empty list initially", async () => {
    const res = await app.inject({ method: "GET", url: "/api/quizzes" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it("POST /api/quizzes creates a quiz (requires auth)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/quizzes",
      cookies: { auth_token: authCookie },
      payload: { title: "My Quiz" },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.title).toBe("My Quiz");
    expect(body.status).toBe("draft");
    expect(body.id).toBeTypeOf("number");
  });

  it("POST /api/quizzes returns 401 without auth", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/quizzes",
      payload: { title: "Unauthorized Quiz" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("GET /api/quizzes returns created quiz", async () => {
    await createQuiz({ title: "Smoke Quiz" });
    const res = await app.inject({ method: "GET", url: "/api/quizzes" });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Smoke Quiz");
  });

  it("GET /api/quizzes/:id returns quiz by id", async () => {
    const quiz = await createQuiz({ title: "ById Quiz" });
    const res = await app.inject({ method: "GET", url: `/api/quizzes/${quiz.id}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("ById Quiz");
  });

  it("GET /api/quizzes/:id returns 404 for unknown id", async () => {
    const res = await app.inject({ method: "GET", url: "/api/quizzes/9999" });
    expect(res.statusCode).toBe(404);
  });

  it("DELETE /api/quizzes/:id deletes the quiz", async () => {
    const quiz = await createQuiz({ title: "To Delete" });
    const res = await app.inject({
      method: "DELETE",
      url: `/api/quizzes/${quiz.id}`,
      cookies: { auth_token: authCookie },
    });
    expect(res.statusCode).toBe(200);

    const check = await app.inject({
      method: "GET",
      url: `/api/quizzes/${quiz.id}`,
    });
    expect(check.statusCode).toBe(404);
  });
});
