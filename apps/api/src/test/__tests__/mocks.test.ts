/**
 * Step 2 verification — confirms mocks are wired correctly.
 * Uses direct static imports for mock references (most reliable approach).
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { createTestApp } from "../app-factory.js";
import { resetDb } from "../setup.js";
import {
  createQuiz,
  createQuestionWithSlides,
  registerTeamViaBot,
  submitAnswerViaBot,
} from "../helpers.js";
// Static imports → same mock instance as what route handlers received
import { broadcast } from "../../ws/index.js";
import { evaluateTextAnswers } from "../../services/llm/evaluate-text-answer.js";
import type { FastifyInstance } from "fastify";

const mockBroadcast = vi.mocked(broadcast);
const mockEvaluate = vi.mocked(evaluateTextAnswers);

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

describe("broadcast mock", () => {
  it("is a vi.fn() spy", () => {
    expect(vi.isMockFunction(mockBroadcast)).toBe(true);
  });

  it("is called with team_registered when a team joins", async () => {
    const quiz = await createQuiz({ status: "active", joinCode: "MOCK01" });
    await registerTeamViaBot(app, quiz.id, "Team Bravo");

    expect(mockBroadcast).toHaveBeenCalledWith(
      "team_registered",
      expect.objectContaining({ name: "Team Bravo", quizId: quiz.id })
    );
  });

  it("is called with answer_submitted on choice answer", async () => {
    const quiz = await createQuiz({ status: "active" });
    const q = await createQuestionWithSlides(quiz.id, { questionType: "choice" });
    const team = await registerTeamViaBot(app, quiz.id, "Team C");

    await submitAnswerViaBot(app, q.id, team.id, "A");

    expect(mockBroadcast).toHaveBeenCalledWith(
      "answer_submitted",
      expect.objectContaining({ questionId: q.id, teamId: team.id })
    );
  });
});

describe("evaluateTextAnswers mock", () => {
  it("is a vi.fn() spy", () => {
    expect(vi.isMockFunction(mockEvaluate)).toBe(true);
  });

  it("is NOT called for choice questions", async () => {
    const quiz = await createQuiz({ status: "active" });
    const q = await createQuestionWithSlides(quiz.id, { questionType: "choice" });
    const team = await registerTeamViaBot(app, quiz.id, "Choice Team");

    await submitAnswerViaBot(app, q.id, team.id, "B");

    await new Promise((r) => setTimeout(r, 20));
    expect(mockEvaluate).not.toHaveBeenCalled();
  });

  it("IS called (async) for text questions", async () => {
    const quiz = await createQuiz({ status: "active" });
    const q = await createQuestionWithSlides(quiz.id, {
      questionType: "text",
      correctAnswer: "Paris",
    });
    const team = await registerTeamViaBot(app, quiz.id, "Text Team");

    await submitAnswerViaBot(app, q.id, team.id, "Paris");

    await new Promise((r) => setTimeout(r, 50));
    expect(mockEvaluate).toHaveBeenCalledWith(
      ["Paris"],
      [{ teamId: team.id, answerText: "Paris" }],
      1
    );
  });

  it("controlled return value is applied for text questions", async () => {
    const quiz = await createQuiz({ status: "active" });
    const q = await createQuestionWithSlides(quiz.id, {
      questionType: "text",
      correctAnswer: "Paris",
    });
    const team = await registerTeamViaBot(app, quiz.id, "Score Team");

    mockEvaluate.mockResolvedValueOnce([{ teamId: team.id, score: 1.0 }]);

    await submitAnswerViaBot(app, q.id, team.id, "Paris");
    await new Promise((r) => setTimeout(r, 100));

    const res = await app.inject({
      method: "GET",
      url: `/api/questions/${q.id}/answers`,
    });
    const [answer] = res.json();
    expect(answer.awardedScore).toBe(1.0);
  });
});
