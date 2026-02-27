/**
 * CRUD route tests for questions, quizzes extras, and auth edge cases.
 * Covers the previously untested routes to push coverage above 80%.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestApp } from "../app-factory.js";
import { resetDb } from "../setup.js";
import { createQuiz, createQuestion, createAdmin, loginAs } from "../helpers.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;
let cookie: string;

beforeAll(async () => {
  app = await createTestApp();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await resetDb();
  await createAdmin("admin", "pass");
  cookie = await loginAs(app, "admin", "pass");
});

// ─── Questions CRUD ───────────────────────────────────────────────────────────

describe("POST /api/quizzes/:id/questions", () => {
  it("creates a question with auto-generated base slides", async () => {
    const quiz = await createQuiz();

    const res = await app.inject({
      method: "POST",
      url: `/api/quizzes/${quiz.id}/questions`,
      cookies: { auth_token: cookie },
      payload: {
        text: "What is 1+1?",
        options: ["1", "2", "3", "4"],
        correctAnswer: "B",
        questionType: "choice",
        weight: 1,
      },
    });

    expect(res.statusCode).toBe(201);
    const q = res.json();
    expect(q.text).toBe("What is 1+1?");
    expect(q.slides).toHaveLength(3); // question, timer, answer
    const types = q.slides.map((s: any) => s.type);
    expect(types).toContain("question");
    expect(types).toContain("timer");
    expect(types).toContain("answer");
  });

  it("auto-assigns orderNum after existing questions", async () => {
    const quiz = await createQuiz();
    await createQuestion(quiz.id, { orderNum: 1 });
    await createQuestion(quiz.id, { orderNum: 2 });

    const res = await app.inject({
      method: "POST",
      url: `/api/quizzes/${quiz.id}/questions`,
      cookies: { auth_token: cookie },
      payload: { text: "Q3" },
    });

    expect(res.statusCode).toBe(201);
    expect(res.json().orderNum).toBe(3);
  });

  it("uses defaults when body fields are omitted", async () => {
    const quiz = await createQuiz();
    const res = await app.inject({
      method: "POST",
      url: `/api/quizzes/${quiz.id}/questions`,
      cookies: { auth_token: cookie },
      payload: {},
    });

    expect(res.statusCode).toBe(201);
    const q = res.json();
    expect(q.questionType).toBe("choice");
    expect(q.weight).toBe(1);
    expect(q.timeLimitSec).toBe(30);
  });

  it("requires authentication", async () => {
    const quiz = await createQuiz();
    const res = await app.inject({
      method: "POST",
      url: `/api/quizzes/${quiz.id}/questions`,
      payload: { text: "Unauthorized" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("PATCH /api/questions/:id", () => {
  it("updates question text and correctAnswer", async () => {
    const quiz = await createQuiz();
    const q = await createQuestion(quiz.id, { text: "Old text", correctAnswer: "A" });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/questions/${q.id}`,
      cookies: { auth_token: cookie },
      payload: { text: "New text", correctAnswer: "C" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().text).toBe("New text");
    expect(res.json().correctAnswer).toBe("C");
  });

  it("updates weight and questionType", async () => {
    const quiz = await createQuiz();
    const q = await createQuestion(quiz.id, { questionType: "choice", weight: 1 });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/questions/${q.id}`,
      cookies: { auth_token: cookie },
      payload: { weight: 3, questionType: "text" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().weight).toBe(3);
    expect(res.json().questionType).toBe("text");
  });

  it("returns 404 for non-existent question", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/questions/999999`,
      cookies: { auth_token: cookie },
      payload: { text: "Ghost" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("adding a slide via slides array inserts new slide", async () => {
    const quiz = await createQuiz();
    const q = await createQuestion(quiz.id);

    // Start with no slides, then add one via PATCH
    const res = await app.inject({
      method: "PATCH",
      url: `/api/questions/${q.id}`,
      cookies: { auth_token: cookie },
      payload: {
        slides: [
          { type: "question", sortOrder: 1 },
          { type: "timer", sortOrder: 2 },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const returnedSlides = res.json().slides;
    expect(returnedSlides.length).toBeGreaterThanOrEqual(2);
  });

  it("requires authentication", async () => {
    const quiz = await createQuiz();
    const q = await createQuestion(quiz.id);
    const res = await app.inject({
      method: "PATCH",
      url: `/api/questions/${q.id}`,
      payload: { text: "Sneaky" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("DELETE /api/questions/:id", () => {
  it("deletes an existing question", async () => {
    const quiz = await createQuiz();
    const q = await createQuestion(quiz.id);

    const res = await app.inject({
      method: "DELETE",
      url: `/api/questions/${q.id}`,
      cookies: { auth_token: cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });

  it("returns 404 for non-existent question", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/api/questions/999999`,
      cookies: { auth_token: cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("requires authentication", async () => {
    const quiz = await createQuiz();
    const q = await createQuestion(quiz.id);
    const res = await app.inject({
      method: "DELETE",
      url: `/api/questions/${q.id}`,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Quizzes extras ───────────────────────────────────────────────────────────

describe("GET /api/quizzes/active", () => {
  it("returns only active-status quizzes", async () => {
    await createQuiz({ title: "Draft", status: "draft" });
    await createQuiz({ title: "Active 1", status: "active" });
    await createQuiz({ title: "Active 2", status: "active" });
    await createQuiz({ title: "Finished", status: "finished" });

    const res = await app.inject({ method: "GET", url: "/api/quizzes/active" });
    const titles = res.json().map((q: any) => q.title);
    expect(titles).toContain("Active 1");
    expect(titles).toContain("Active 2");
    expect(titles).not.toContain("Draft");
    expect(titles).not.toContain("Finished");
  });
});

describe("GET /api/quizzes/by-code/:code", () => {
  it("returns quiz matching the join code (case-insensitive)", async () => {
    await createQuiz({ title: "Code Quiz", joinCode: "ABC123" });

    const res = await app.inject({
      method: "GET",
      url: "/api/quizzes/by-code/abc123",
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Code Quiz");
  });

  it("returns 404 for unknown code", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/quizzes/by-code/XXXXXX",
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("POST /api/quizzes — validation", () => {
  it("empty title → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/quizzes",
      cookies: { auth_token: cookie },
      payload: { title: "   " },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toMatch(/title/i);
  });

  it("missing title → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/quizzes",
      cookies: { auth_token: cookie },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/quizzes/:id", () => {
  it("updates quiz title", async () => {
    const quiz = await createQuiz({ title: "Old" });

    const res = await app.inject({
      method: "PATCH",
      url: `/api/quizzes/${quiz.id}`,
      cookies: { auth_token: cookie },
      payload: { title: "New Title" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("New Title");
  });

  it("returns 404 for non-existent quiz", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/quizzes/999999`,
      cookies: { auth_token: cookie },
      payload: { title: "Ghost" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("requires authentication", async () => {
    const quiz = await createQuiz();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/quizzes/${quiz.id}`,
      payload: { title: "Sneaky" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/quizzes/:id/display-on-tv", () => {
  it("sets displayedOnTv=true for target quiz", async () => {
    const quiz = await createQuiz({ title: "TV Quiz" });

    const res = await app.inject({
      method: "POST",
      url: `/api/quizzes/${quiz.id}/display-on-tv`,
      cookies: { auth_token: cookie },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().quiz.displayedOnTv).toBe(true);
  });

  it("clears displayedOnTv flag from all other quizzes", async () => {
    const q1 = await createQuiz({ title: "First" });
    const q2 = await createQuiz({ title: "Second" });

    // Display q1 first
    await app.inject({
      method: "POST",
      url: `/api/quizzes/${q1.id}/display-on-tv`,
      cookies: { auth_token: cookie },
    });

    // Then display q2 — q1 should lose the flag
    await app.inject({
      method: "POST",
      url: `/api/quizzes/${q2.id}/display-on-tv`,
      cookies: { auth_token: cookie },
    });

    const q1Res = await app.inject({ method: "GET", url: `/api/quizzes/${q1.id}` });
    const q2Res = await app.inject({ method: "GET", url: `/api/quizzes/${q2.id}` });

    expect(q1Res.json().displayedOnTv).toBe(false);
    expect(q2Res.json().displayedOnTv).toBe(true);
  });

  it("returns 404 for non-existent quiz", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/api/quizzes/999999/display-on-tv`,
      cookies: { auth_token: cookie },
    });
    expect(res.statusCode).toBe(404);
  });

  it("requires authentication", async () => {
    const quiz = await createQuiz();
    const res = await app.inject({
      method: "POST",
      url: `/api/quizzes/${quiz.id}/display-on-tv`,
    });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Auth edge cases ──────────────────────────────────────────────────────────

describe("POST /api/auth/login — edge cases", () => {
  it("missing username → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { password: "pass" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("missing password → 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("unknown username → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "nobody", password: "pass" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("wrong password → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", password: "wrongpass" },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /api/auth/verify — edge cases", () => {
  it("no token → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify",
    });
    expect(res.statusCode).toBe(401);
  });

  it("invalid/tampered token → 401", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify",
      cookies: { auth_token: "this.is.not.valid" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("valid token → 200 with user info", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/verify",
      cookies: { auth_token: cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().valid).toBe(true);
  });
});

describe("POST /api/auth/logout", () => {
  it("clears auth_token cookie and returns success", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      cookies: { auth_token: cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().success).toBe(true);
    // Cookie should be cleared (empty value or max-age=0)
    const setCookie = res.headers["set-cookie"] as string;
    expect(setCookie).toBeDefined();
  });
});
