/**
 * Step 3 — Integration tests for the full quiz/game lifecycle:
 *
 *  Quiz CRUD
 *  Team registration & kick
 *  Game flow: start → open-reg → begin → slides → next-question → finish
 *  Answer submission: choice & text
 *  Scoring & results ordering
 *  Edge cases: duplicate answer, invalid letter, kicked team excluded
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
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
import { evaluateTextAnswers } from "../../services/llm/evaluate-text-answer.js";
import type { FastifyInstance } from "fastify";

const mockEvaluate = vi.mocked(evaluateTextAnswers);

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

async function getState(quizId: number) {
  const res = await app.inject({ method: "GET", url: `/api/game/state/${quizId}` });
  return res.json();
}

async function getSlides(quizId: number, questionId: number) {
  const res = await app.inject({ method: "GET", url: `/api/quizzes/${quizId}/questions` });
  const questions = res.json() as Array<{ id: number; slides: Array<{ id: number; type: string; sortOrder: number }> }>;
  const q = questions.find((q) => q.id === questionId);
  return q?.slides ?? [];
}

async function slideOfType(quizId: number, questionId: number, type: string) {
  const allSlides = await getSlides(quizId, questionId);
  return allSlides.find((s) => s.type === type)!;
}

// Full setup: quiz active, team registered, ready to begin
async function setupLobby() {
  const quiz = await createQuiz({ title: "Live Quiz" });
  const q1 = await createQuestionWithSlides(quiz.id, {
    orderNum: 1,
    text: "Capital of France?",
    options: ["Berlin", "Paris", "Rome", "Madrid"],
    correctAnswer: "B",
    questionType: "choice",
    weight: 1,
  });
  const q2 = await createQuestionWithSlides(quiz.id, {
    orderNum: 2,
    text: "Capital of Italy?",
    options: ["Paris", "Madrid", "Rome", "Berlin"],
    correctAnswer: "C",
    questionType: "choice",
    weight: 2,
  });

  await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
  await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

  const teamA = await registerTeamViaBot(app, quiz.id, "Team A");
  const teamB = await registerTeamViaBot(app, quiz.id, "Team B");

  return { quiz, q1, q2, teamA, teamB };
}

// ─── Quiz CRUD ────────────────────────────────────────────────────────────────

describe("Quiz CRUD", () => {
  it("creates and retrieves a quiz", async () => {
    const res = await adminPost(app, cookie, "/api/quizzes", { title: "My Quiz" });
    expect(res.statusCode).toBe(201);
    const { id } = res.json();

    const get = await app.inject({ method: "GET", url: `/api/quizzes/${id}` });
    expect(get.json().title).toBe("My Quiz");
  });

  it("lists all quizzes", async () => {
    await createQuiz({ title: "Q1" });
    await createQuiz({ title: "Q2" });
    const res = await app.inject({ method: "GET", url: "/api/quizzes" });
    expect(res.json()).toHaveLength(2);
  });

  it("deletes a quiz and its questions cascade", async () => {
    const quiz = await createQuiz({ title: "Delete Me" });
    await createQuestionWithSlides(quiz.id);

    const del = await adminPost(app, cookie, `/api/quizzes/${quiz.id}`, {});
    // DELETE uses method DELETE, not POST
    const delRes = await app.inject({
      method: "DELETE",
      url: `/api/quizzes/${quiz.id}`,
      cookies: { auth_token: cookie },
    });
    expect(delRes.statusCode).toBe(200);

    const check = await app.inject({ method: "GET", url: `/api/quizzes/${quiz.id}` });
    expect(check.statusCode).toBe(404);
  });
});

// ─── Game lifecycle ───────────────────────────────────────────────────────────

describe("Game lifecycle", () => {
  it("start game → status=lobby, game state created", async () => {
    const quiz = await createQuiz({ title: "Start Test" });
    const res = await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    expect(res.statusCode).toBe(200);

    const state = await getState(quiz.id);
    expect(state.status).toBe("lobby");
    expect(state.registrationOpen).toBe(false);
  });

  it("open-registration → registrationOpen=true", async () => {
    const quiz = await createQuiz({ title: "Reg Test" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

    const state = await getState(quiz.id);
    expect(state.registrationOpen).toBe(true);
  });

  it("begin game → status=playing, currentSlide set from first slide", async () => {
    const { quiz, q1 } = await setupLobby();
    const res = await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
    expect(res.statusCode).toBe(200);

    const state = await getState(quiz.id);
    expect(state.status).toBe("playing");
    expect(state.currentQuestionId).toBe(q1.id);
    expect(state.currentSlide).toBeTruthy();
  });

  it("begin fails if not in lobby", async () => {
    const quiz = await createQuiz({ title: "No Lobby" });
    const res = await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
    expect(res.statusCode).toBe(500);
  });

  it("set-slide by slideId advances to timer → timerStartedAt set", async () => {
    const { quiz, q1 } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    const timerSlide = await slideOfType(quiz.id, q1.id, "timer");
    await adminPost(app, cookie, "/api/game/set-slide", {
      quizId: quiz.id,
      slideId: timerSlide.id,
    });

    const state = await getState(quiz.id);
    expect(state.currentSlide).toBe("timer");
    expect(state.timerStartedAt).not.toBeNull();
  });

  it("set-slide to answer → currentSlide=answer, timerStartedAt=null", async () => {
    const { quiz, q1 } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    const answerSlide = await slideOfType(quiz.id, q1.id, "answer");
    await adminPost(app, cookie, "/api/game/set-slide", {
      quizId: quiz.id,
      slideId: answerSlide.id,
    });

    const state = await getState(quiz.id);
    expect(state.currentSlide).toBe("answer");
    expect(state.timerStartedAt).toBeNull();
  });

  it("next-question advances to q2", async () => {
    const { quiz, q2 } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
    const res = await adminPost(app, cookie, "/api/game/next-question", { quizId: quiz.id });
    expect(res.statusCode).toBe(200);

    const state = await getState(quiz.id);
    expect(state.currentQuestionId).toBe(q2.id);
  });

  it("next-question after last → done=true", async () => {
    const { quiz } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/next-question", { quizId: quiz.id }); // to q2
    const res = await adminPost(app, cookie, "/api/game/next-question", { quizId: quiz.id }); // past last
    expect(res.json()).toMatchObject({ done: true });
  });

  it("finish game → quiz status=finished", async () => {
    const { quiz } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const state = await getState(quiz.id);
    expect(state.status).toBe("finished");

    const quizRes = await app.inject({ method: "GET", url: `/api/quizzes/${quiz.id}` });
    expect(quizRes.json().status).toBe("finished");
  });

  it("archive quiz → status=archived", async () => {
    const { quiz } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });
    const res = await adminPost(app, cookie, "/api/game/archive", { quizId: quiz.id });
    expect(res.statusCode).toBe(200);

    const quizRes = await app.inject({ method: "GET", url: `/api/quizzes/${quiz.id}` });
    expect(quizRes.json().status).toBe("archived");
  });
});

// ─── Team registration ────────────────────────────────────────────────────────

describe("Team registration", () => {
  it("team appears in teams list after registering", async () => {
    const { quiz, teamA } = await setupLobby();

    const res = await app.inject({ method: "GET", url: `/api/quizzes/${quiz.id}/teams` });
    const names = res.json().map((t: any) => t.name);
    expect(names).toContain("Team A");
  });

  it("two teams with same name can both register (no unique constraint)", async () => {
    const quiz = await createQuiz({ status: "active" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    const r1 = await registerTeamViaBot(app, quiz.id, "Same Name", 111);
    const r2 = await registerTeamViaBot(app, quiz.id, "Same Name", 222);
    expect(r1.id).not.toBe(r2.id);
  });

  it("kicked team is excluded from default teams list", async () => {
    const { quiz, teamA } = await setupLobby();

    await app.inject({
      method: "DELETE",
      url: `/api/teams/${teamA.id}`,
      cookies: { auth_token: cookie },
    });

    const res = await app.inject({ method: "GET", url: `/api/quizzes/${quiz.id}/teams` });
    const ids = res.json().map((t: any) => t.id);
    expect(ids).not.toContain(teamA.id);
  });

  it("kicked team appears with ?all=true", async () => {
    const { quiz, teamA } = await setupLobby();
    await app.inject({
      method: "DELETE",
      url: `/api/teams/${teamA.id}`,
      cookies: { auth_token: cookie },
    });

    const res = await app.inject({
      method: "GET",
      url: `/api/quizzes/${quiz.id}/teams?all=true`,
    });
    const ids = res.json().map((t: any) => t.id);
    expect(ids).toContain(teamA.id);
  });
});

// ─── Answer submission ────────────────────────────────────────────────────────

describe("Answer submission", () => {
  it("choice answer is accepted and stored", async () => {
    const { quiz, q1, teamA } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    const res = await submitAnswerViaBot(app, q1.id, teamA.id, "B");
    expect(res.answerText).toBe("B");
    expect(res.questionId).toBe(q1.id);
  });

  it("choice answer is normalised to uppercase", async () => {
    const { quiz, q1, teamA } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    const res = await submitAnswerViaBot(app, q1.id, teamA.id, "b");
    expect(res.answerText).toBe("B");
  });

  it("invalid choice letter → 400", async () => {
    const { quiz, q1, teamA } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    const res = await app.inject({
      method: "POST",
      url: "/api/answers",
      payload: { questionId: q1.id, teamId: teamA.id, answerText: "Z" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("empty answer → 400", async () => {
    const { quiz, q1, teamA } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    const res = await app.inject({
      method: "POST",
      url: "/api/answers",
      payload: { questionId: q1.id, teamId: teamA.id, answerText: "   " },
    });
    expect(res.statusCode).toBe(400);
  });

  it("duplicate answer → 409", async () => {
    const { quiz, q1, teamA } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    await submitAnswerViaBot(app, q1.id, teamA.id, "B");
    const res = await app.inject({
      method: "POST",
      url: "/api/answers",
      payload: { questionId: q1.id, teamId: teamA.id, answerText: "C" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("text answer is stored as-is (trimmed)", async () => {
    const quiz = await createQuiz({ status: "active" });
    const q = await createQuestionWithSlides(quiz.id, {
      questionType: "text",
      correctAnswer: "Paris",
    });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    const team = await registerTeamViaBot(app, quiz.id, "Text Team");

    const res = await submitAnswerViaBot(app, q.id, team.id, "  Paris  ");
    expect(res.answerText).toBe("Paris");
  });

  it("text answer with more items than correct answers is truncated", async () => {
    const quiz = await createQuiz({ status: "active" });
    // correctAnswer has 2 items → only first 2 user answers kept
    const q = await createQuestionWithSlides(quiz.id, {
      questionType: "text",
      correctAnswer: "Red, Blue",
    });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    const team = await registerTeamViaBot(app, quiz.id, "Trim Team");

    const res = await submitAnswerViaBot(app, q.id, team.id, "Red, Blue, Green, Yellow");
    expect(res.answerText).toBe("Red, Blue");
  });
});

// ─── Scoring & results ────────────────────────────────────────────────────────

describe("Scoring and results", () => {
  it("correct choice answer earns weight points", async () => {
    const { quiz, q1, q2, teamA } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    // q1: weight=1, correct=B → 1 point
    await submitAnswerViaBot(app, q1.id, teamA.id, "B");
    // q2: weight=2, correct=C → 2 points
    await submitAnswerViaBot(app, q2.id, teamA.id, "C");

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({ method: "GET", url: `/api/game/results/${quiz.id}` });
    const teamResult = res.json().find((r: any) => r.teamId === teamA.id);
    expect(teamResult.correct).toBe(3); // 1 + 2
  });

  it("wrong choice answer earns 0 points", async () => {
    const { quiz, q1, teamA } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    await submitAnswerViaBot(app, q1.id, teamA.id, "A"); // wrong, correct=B

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({ method: "GET", url: `/api/game/results/${quiz.id}` });
    const teamResult = res.json().find((r: any) => r.teamId === teamA.id);
    expect(teamResult.correct).toBe(0);
  });

  it("results are ordered highest score first", async () => {
    const { quiz, q1, teamA, teamB } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    await submitAnswerViaBot(app, q1.id, teamA.id, "B"); // correct
    await submitAnswerViaBot(app, q1.id, teamB.id, "A"); // wrong

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({ method: "GET", url: `/api/game/results/${quiz.id}` });
    const results = res.json();
    expect(results[0].teamId).toBe(teamA.id); // winner first
    expect(results[1].teamId).toBe(teamB.id);
  });

  it("tie — both teams appear at the same score", async () => {
    const { quiz, q1, teamA, teamB } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    await submitAnswerViaBot(app, q1.id, teamA.id, "B"); // both correct
    await submitAnswerViaBot(app, q1.id, teamB.id, "B");

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({ method: "GET", url: `/api/game/results/${quiz.id}` });
    const results = res.json();
    expect(results[0].correct).toBe(results[1].correct); // tied
  });

  it("kicked team is excluded from results", async () => {
    const { quiz, q1, teamA, teamB } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    await submitAnswerViaBot(app, q1.id, teamA.id, "B");
    await submitAnswerViaBot(app, q1.id, teamB.id, "B");

    // Kick teamA before finishing
    await app.inject({
      method: "DELETE",
      url: `/api/teams/${teamA.id}`,
      cookies: { auth_token: cookie },
    });

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({ method: "GET", url: `/api/game/results/${quiz.id}` });
    const ids = res.json().map((r: any) => r.teamId);
    expect(ids).not.toContain(teamA.id);
    expect(ids).toContain(teamB.id);
  });

  it("text answer score from LLM is applied to results", async () => {
    const quiz = await createQuiz({ title: "Text Quiz", status: "active" });
    const q = await createQuestionWithSlides(quiz.id, {
      questionType: "text",
      correctAnswer: "Paris",
      weight: 2,
    });

    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });
    const team = await registerTeamViaBot(app, quiz.id, "Text Team");
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    // Configure mock: full score
    mockEvaluate.mockResolvedValueOnce([{ teamId: team.id, score: 2 }]);

    await submitAnswerViaBot(app, q.id, team.id, "Paris");
    // Wait for fire-and-forget LLM evaluation
    await new Promise((r) => setTimeout(r, 100));

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({ method: "GET", url: `/api/game/results/${quiz.id}` });
    const teamResult = res.json().find((r: any) => r.teamId === team.id);
    expect(teamResult.correct).toBe(2);
  });

  it("team with no answers has score 0", async () => {
    const { quiz, teamA, teamB, q1 } = await setupLobby();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    // Only teamA answers
    await submitAnswerViaBot(app, q1.id, teamA.id, "B");

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({ method: "GET", url: `/api/game/results/${quiz.id}` });
    const teamBResult = res.json().find((r: any) => r.teamId === teamB.id);
    expect(teamBResult.correct).toBe(0);
  });
});
