/**
 * Step 4 — WebSocket broadcast event assertions.
 *
 * Since broadcast is mocked (vi.fn), we verify that every game action
 * calls broadcast with the correct event type and payload shape.
 *
 * Real WS client connections are infrastructure-level; this layer ensures
 * the right events are emitted at the right times with the right data.
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
import { broadcast } from "../../ws/index.js";
import { evaluateTextAnswers } from "../../services/llm/evaluate-text-answer.js";
import type { FastifyInstance } from "fastify";

const mockBroadcast = vi.mocked(broadcast);
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

/** Full setup: quiz with 1 choice question, game begun, 1 team registered */
async function fullSetup() {
  const quiz = await createQuiz({ title: "WS Quiz" });
  const q = await createQuestionWithSlides(quiz.id, {
    orderNum: 1,
    options: ["Opt A", "Opt B", "Opt C", "Opt D"],
    correctAnswer: "A",
    questionType: "choice",
    weight: 1,
  });
  await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
  await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });
  const team = await registerTeamViaBot(app, quiz.id, "WS Team");
  await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });
  return { quiz, q, team };
}

/** Get slides for a question via the quizzes endpoint */
async function getQuestionSlides(quizId: number, questionId: number) {
  const res = await app.inject({ method: "GET", url: `/api/quizzes/${quizId}/questions` });
  const qs = res.json() as Array<{
    id: number;
    slides: Array<{ id: number; type: string }>;
  }>;
  return qs.find((x) => x.id === questionId)?.slides ?? [];
}

// ─── Game lifecycle events ─────────────────────────────────────────────────────

describe("Game lifecycle broadcast events", () => {
  it("startGame → game_lobby with quizId and joinCode", async () => {
    const quiz = await createQuiz({ title: "Lobby Test" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "game_lobby",
      expect.objectContaining({ quizId: quiz.id, joinCode: expect.any(String) })
    );
  });

  it("openRegistration → registration_opened with quizId", async () => {
    const quiz = await createQuiz({ title: "Reg Test" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "registration_opened",
      expect.objectContaining({ quizId: quiz.id })
    );
  });

  it("beginGame → slide_changed with first question's slide", async () => {
    const quiz = await createQuiz({ title: "Begin Test" });
    const q = await createQuestionWithSlides(quiz.id, { questionType: "choice" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "slide_changed",
      expect.objectContaining({
        quizId: quiz.id,
        questionId: q.id,
        slide: "question",
      })
    );
  });

  it("setSlide(timer slideId) → slide_changed with slide=timer and slideId", async () => {
    const { quiz, q } = await fullSetup();
    const slides = await getQuestionSlides(quiz.id, q.id);
    const timerSlide = slides.find((s) => s.type === "timer")!;

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/set-slide", {
      quizId: quiz.id,
      slideId: timerSlide.id,
    });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "slide_changed",
      expect.objectContaining({
        quizId: quiz.id,
        slide: "timer",
        slideId: timerSlide.id,
      })
    );
  });

  it("setSlide(answer slideId) → slide_changed with slide=answer", async () => {
    const { quiz, q } = await fullSetup();
    const slides = await getQuestionSlides(quiz.id, q.id);
    const answerSlide = slides.find((s) => s.type === "answer")!;

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/set-slide", {
      quizId: quiz.id,
      slideId: answerSlide.id,
    });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "slide_changed",
      expect.objectContaining({ quizId: quiz.id, slide: "answer" })
    );
  });

  it("nextQuestion → slide_changed with next question's id", async () => {
    const quiz = await createQuiz({ title: "Next Q Test" });
    await createQuestionWithSlides(quiz.id, { orderNum: 1, questionType: "choice" });
    const q2 = await createQuestionWithSlides(quiz.id, { orderNum: 2, questionType: "choice" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/next-question", { quizId: quiz.id });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "slide_changed",
      expect.objectContaining({ quizId: quiz.id, questionId: q2.id })
    );
  });

  it("finishGame → quiz_finished with results array containing all teams", async () => {
    const { quiz, q, team } = await fullSetup();
    await submitAnswerViaBot(app, q.id, team.id, "A");

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "quiz_finished",
      expect.objectContaining({
        quizId: quiz.id,
        results: expect.arrayContaining([
          expect.objectContaining({ teamId: team.id }),
        ]),
        resultsRevealCount: 0,
      })
    );
  });

  it("revealNextResult → results_revealed with incremented count", async () => {
    const { quiz, q, team } = await fullSetup();
    await submitAnswerViaBot(app, q.id, team.id, "A");
    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/reveal-next-result", { quizId: quiz.id });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "results_revealed",
      expect.objectContaining({
        quizId: quiz.id,
        resultsRevealCount: 1,
        results: expect.any(Array),
      })
    );
  });

  it("archiveQuiz → quiz_archived with quizId", async () => {
    const { quiz } = await fullSetup();
    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    mockBroadcast.mockClear();
    await adminPost(app, cookie, "/api/game/archive", { quizId: quiz.id });

    expect(mockBroadcast).toHaveBeenCalledWith(
      "quiz_archived",
      expect.objectContaining({ quizId: quiz.id })
    );
  });
});

// ─── Team and answer events ────────────────────────────────────────────────────

describe("Team and answer broadcast events", () => {
  it("registerTeamViaBot → team_registered with name and quizId", async () => {
    const quiz = await createQuiz({ status: "active", joinCode: "WS0001" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });

    mockBroadcast.mockClear();
    await registerTeamViaBot(app, quiz.id, "WS Broadcast Team");

    expect(mockBroadcast).toHaveBeenCalledWith(
      "team_registered",
      expect.objectContaining({ quizId: quiz.id, name: "WS Broadcast Team" })
    );
  });

  it("submitAnswerViaBot → answer_submitted with quizId, questionId, teamId", async () => {
    const { quiz, q, team } = await fullSetup();

    mockBroadcast.mockClear();
    await submitAnswerViaBot(app, q.id, team.id, "A");

    expect(mockBroadcast).toHaveBeenCalledWith(
      "answer_submitted",
      expect.objectContaining({
        quizId: quiz.id,
        questionId: q.id,
        teamId: team.id,
        answerId: expect.any(Number),
      })
    );
  });

  it("text answer + LLM result → answer_scored with awardedScore", async () => {
    const quiz = await createQuiz({ title: "Text WS", status: "active" });
    const q = await createQuestionWithSlides(quiz.id, {
      questionType: "text",
      correctAnswer: "Paris",
      weight: 1,
    });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });
    const team = await registerTeamViaBot(app, quiz.id, "Scored Team");

    mockEvaluate.mockResolvedValueOnce([{ teamId: team.id, score: 1.0 }]);

    mockBroadcast.mockClear();
    await submitAnswerViaBot(app, q.id, team.id, "Paris");
    await new Promise((r) => setTimeout(r, 100)); // wait for async LLM mock

    expect(mockBroadcast).toHaveBeenCalledWith(
      "answer_scored",
      expect.objectContaining({
        quizId: quiz.id,
        questionId: q.id,
        teamId: team.id,
        awardedScore: 1.0,
      })
    );
  });

  it("no answer_scored event emitted for choice questions", async () => {
    const { quiz, q, team } = await fullSetup();

    mockBroadcast.mockClear();
    await submitAnswerViaBot(app, q.id, team.id, "A");
    await new Promise((r) => setTimeout(r, 30));

    const calls = mockBroadcast.mock.calls.map((c) => c[0]);
    expect(calls).not.toContain("answer_scored");
  });
});
