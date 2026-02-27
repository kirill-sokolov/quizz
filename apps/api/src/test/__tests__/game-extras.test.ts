/**
 * Additional coverage tests for endpoints not exercised in game.test.ts:
 *   - POST /api/game/restart
 *   - POST /api/game/remind
 *   - GET  /api/game/results/:quizId/:teamId
 *   - PATCH /api/answers/:id/score
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createTestApp } from "../app-factory.js";
import { resetDb } from "../setup.js";
import {
  createQuiz,
  createQuestionWithSlides,
  createAdmin,
  loginAs,
  adminPost,
  registerTeamViaBot,
  submitAnswerViaBot,
} from "../helpers.js";
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function setupActive() {
  const quiz = await createQuiz({ title: "Active Quiz" });
  const q = await createQuestionWithSlides(quiz.id, {
    orderNum: 1,
    options: ["A opt", "B opt", "C opt", "D opt"],
    correctAnswer: "A",
    questionType: "choice",
    weight: 1,
  });
  await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
  await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });
  const team = await registerTeamViaBot(app, quiz.id, "Coverage Team");
  await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
  return { quiz, q, team };
}

// ─── restartQuiz ──────────────────────────────────────────────────────────────

describe("POST /api/game/restart", () => {
  it("resets quiz to draft and clears teams + answers", async () => {
    const { quiz, q, team } = await setupActive();
    await submitAnswerViaBot(app, q.id, team.id, "A");
    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await adminPost(app, cookie, "/api/game/restart", { quizId: quiz.id });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });

    // Quiz status back to draft
    const quizRes = await app.inject({ method: "GET", url: `/api/quizzes/${quiz.id}` });
    expect(quizRes.json().status).toBe("draft");

    // Teams deleted
    const teamsRes = await app.inject({
      method: "GET",
      url: `/api/quizzes/${quiz.id}/teams`,
    });
    expect(teamsRes.json()).toHaveLength(0);

    // Game state deleted (no state → 404)
    const stateRes = await app.inject({
      method: "GET",
      url: `/api/game/state/${quiz.id}`,
    });
    expect(stateRes.statusCode).toBe(404);
  });

  it("restart a quiz that is already in draft → error", async () => {
    const quiz = await createQuiz({ title: "Draft Quiz", status: "draft" });
    const res = await adminPost(app, cookie, "/api/game/restart", { quizId: quiz.id });
    expect(res.statusCode).toBe(500);
  });
});

// ─── getRemind ────────────────────────────────────────────────────────────────

describe("POST /api/game/remind", () => {
  it("returns teams that have not answered the current question", async () => {
    const { quiz, q, team } = await setupActive();

    // No answers yet — team should appear in remind list
    const res = await adminPost(app, cookie, "/api/game/remind", { quizId: quiz.id });
    expect(res.statusCode).toBe(200);
    const ids = res.json().map((t: any) => t.id);
    expect(ids).toContain(team.id);
  });

  it("team disappears from remind list after submitting answer", async () => {
    const { quiz, q, team } = await setupActive();

    await submitAnswerViaBot(app, q.id, team.id, "A");

    const res = await adminPost(app, cookie, "/api/game/remind", { quizId: quiz.id });
    const ids = res.json().map((t: any) => t.id);
    expect(ids).not.toContain(team.id);
  });

  it("remind with specific teamId filters to that team only", async () => {
    const { quiz, q } = await setupActive();
    const team2 = await registerTeamViaBot(app, quiz.id, "Team 2");

    await submitAnswerViaBot(app, q.id, team2.id, "A"); // team2 answered

    const res = await adminPost(app, cookie, "/api/game/remind", {
      quizId: quiz.id,
      teamId: team2.id,
    });
    // team2 answered — empty list when filtered to team2
    expect(res.json()).toHaveLength(0);
  });
});

// ─── getTeamDetails ───────────────────────────────────────────────────────────

describe("GET /api/game/results/:quizId/:teamId", () => {
  it("returns per-question breakdown for a team", async () => {
    const { quiz, q, team } = await setupActive();
    await submitAnswerViaBot(app, q.id, team.id, "A"); // correct

    const res = await app.inject({
      method: "GET",
      url: `/api/game/results/${quiz.id}/${team.id}`,
    });
    expect(res.statusCode).toBe(200);

    const details = res.json();
    expect(details.teamId).toBe(team.id);
    expect(details.totalCorrect).toBe(1);
    expect(details.details).toHaveLength(1);
    expect(details.details[0]).toMatchObject({
      questionId: q.id,
      teamAnswer: "A",
      isCorrect: true,
    });
  });

  it("unanswered question appears in details with teamAnswer=null", async () => {
    const { quiz, q, team } = await setupActive();
    // No answer submitted

    const res = await app.inject({
      method: "GET",
      url: `/api/game/results/${quiz.id}/${team.id}`,
    });
    const details = res.json();
    expect(details.totalCorrect).toBe(0);
    expect(details.details[0].teamAnswer).toBeNull();
    expect(details.details[0].isCorrect).toBe(false);
  });

  it("wrong answer → isCorrect=false, totalCorrect=0", async () => {
    const { quiz, q, team } = await setupActive();
    await submitAnswerViaBot(app, q.id, team.id, "B"); // wrong (correct=A)

    const res = await app.inject({
      method: "GET",
      url: `/api/game/results/${quiz.id}/${team.id}`,
    });
    const details = res.json();
    expect(details.totalCorrect).toBe(0);
    expect(details.details[0].isCorrect).toBe(false);
  });

  it("text question details include correctAnswerText", async () => {
    const quiz = await createQuiz({ title: "Text Details" });
    const q = await createQuestionWithSlides(quiz.id, {
      questionType: "text",
      correctAnswer: "Paris",
      weight: 1,
    });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });
    const team = await registerTeamViaBot(app, quiz.id, "Text Detail Team");
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
    await submitAnswerViaBot(app, q.id, team.id, "Paris");

    const res = await app.inject({
      method: "GET",
      url: `/api/game/results/${quiz.id}/${team.id}`,
    });
    const details = res.json();
    expect(details.details[0].correctAnswerText).toBe("Paris");
    expect(details.details[0].questionType).toBe("text");
  });
});

// ─── PATCH /api/answers/:id/score ─────────────────────────────────────────────

describe("PATCH /api/answers/:id/score", () => {
  it("admin can manually override answer score", async () => {
    const { quiz, q, team } = await setupActive();
    const answer = await submitAnswerViaBot(app, q.id, team.id, "A");

    const res = await app.inject({
      method: "PATCH",
      url: `/api/answers/${answer.id}/score`,
      cookies: { auth_token: cookie },
      payload: { score: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().awardedScore).toBe(5);
  });

  it("score override for non-existent answer → 404", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/answers/999999/score`,
      cookies: { auth_token: cookie },
      payload: { score: 1 },
    });
    expect(res.statusCode).toBe(404);
  });

  it("score override requires authentication", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/api/answers/1/score`,
      payload: { score: 1 },
    });
    expect(res.statusCode).toBe(401);
  });
});
