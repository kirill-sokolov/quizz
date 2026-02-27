/**
 * Step 7 — Load / concurrency test.
 *
 * Simulates 20 teams playing a full quiz concurrently:
 *   1. Admin creates quiz with 3 questions
 *   2. 20 teams register simultaneously
 *   3. Game begins; all 20 teams submit answers to each question simultaneously
 *   4. Admin finishes the game
 *   5. Assertions:
 *      - All 20 teams appear in results
 *      - No answers lost (each team has exactly 1 answer per question)
 *      - Score calculation correct (correct answers earn points)
 *      - No duplicate-answer 409 errors (each team submits once)
 *      - Results sorted highest→lowest
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
import { db } from "../../db/index.js";
import { answers } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";

const TEAM_COUNT = 20;

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

// ─── Load test ────────────────────────────────────────────────────────────────

describe(`Load test: ${TEAM_COUNT} concurrent teams`, () => {
  it("all teams register without errors", async () => {
    const quiz = await createQuiz({ title: "Load Quiz" });
    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

    const results = await Promise.allSettled(
      Array.from({ length: TEAM_COUNT }, (_, i) =>
        registerTeamViaBot(app, quiz.id, `Team ${i + 1}`)
      )
    );

    const failures = results.filter((r) => r.status === "rejected");
    expect(failures).toHaveLength(0);

    const teams = await app.inject({
      method: "GET",
      url: `/api/quizzes/${quiz.id}/teams`,
    });
    expect(teams.json()).toHaveLength(TEAM_COUNT);
  });

  it("all 20 teams submit answers concurrently — no 409 conflicts, no lost answers", async () => {
    // Setup: quiz with 3 choice questions
    const quiz = await createQuiz({ title: "Concurrent Quiz" });
    const q1 = await createQuestionWithSlides(quiz.id, {
      orderNum: 1,
      options: ["Alpha", "Beta", "Gamma", "Delta"],
      correctAnswer: "A",
      questionType: "choice",
      weight: 1,
    });
    const q2 = await createQuestionWithSlides(quiz.id, {
      orderNum: 2,
      options: ["One", "Two", "Three", "Four"],
      correctAnswer: "B",
      questionType: "choice",
      weight: 2,
    });
    const q3 = await createQuestionWithSlides(quiz.id, {
      orderNum: 3,
      options: ["X", "Y", "Z", "W"],
      correctAnswer: "C",
      questionType: "choice",
      weight: 1,
    });

    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

    // Register all teams concurrently
    const teams = await Promise.all(
      Array.from({ length: TEAM_COUNT }, (_, i) =>
        registerTeamViaBot(app, quiz.id, `Concurrent Team ${i + 1}`)
      )
    );
    expect(teams).toHaveLength(TEAM_COUNT);

    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    // All teams answer Q1 simultaneously — half correct (A), half wrong (B)
    const q1Results = await Promise.allSettled(
      teams.map((t, i) =>
        submitAnswerViaBot(app, q1.id, t.id, i < TEAM_COUNT / 2 ? "A" : "B")
      )
    );
    const q1Failures = q1Results.filter((r) => r.status === "rejected");
    expect(q1Failures).toHaveLength(0);

    // All teams answer Q2 simultaneously — all correct (B)
    const q2Results = await Promise.allSettled(
      teams.map((t) => submitAnswerViaBot(app, q2.id, t.id, "B"))
    );
    const q2Failures = q2Results.filter((r) => r.status === "rejected");
    expect(q2Failures).toHaveLength(0);

    // All teams answer Q3 simultaneously — all wrong (A, correct is C)
    const q3Results = await Promise.allSettled(
      teams.map((t) => submitAnswerViaBot(app, q3.id, t.id, "A"))
    );
    const q3Failures = q3Results.filter((r) => r.status === "rejected");
    expect(q3Failures).toHaveLength(0);

    // Verify answer counts in DB — exactly 1 answer per team per question
    const q1Answers = await db.select().from(answers).where(eq(answers.questionId, q1.id));
    const q2Answers = await db.select().from(answers).where(eq(answers.questionId, q2.id));
    const q3Answers = await db.select().from(answers).where(eq(answers.questionId, q3.id));

    expect(q1Answers).toHaveLength(TEAM_COUNT);
    expect(q2Answers).toHaveLength(TEAM_COUNT);
    expect(q3Answers).toHaveLength(TEAM_COUNT);

    // Unique teamIds per question — no duplicate submissions
    const q1TeamIds = new Set(q1Answers.map((a) => a.teamId));
    const q2TeamIds = new Set(q2Answers.map((a) => a.teamId));
    expect(q1TeamIds.size).toBe(TEAM_COUNT);
    expect(q2TeamIds.size).toBe(TEAM_COUNT);
  });

  it("score calculation correct after 20 concurrent teams finish", async () => {
    const quiz = await createQuiz({ title: "Score Load Quiz" });
    const q1 = await createQuestionWithSlides(quiz.id, {
      orderNum: 1,
      options: ["Right", "Wrong", "Wrong", "Wrong"],
      correctAnswer: "A",
      questionType: "choice",
      weight: 1,
    });
    const q2 = await createQuestionWithSlides(quiz.id, {
      orderNum: 2,
      options: ["Wrong", "Right", "Wrong", "Wrong"],
      correctAnswer: "B",
      questionType: "choice",
      weight: 2,
    });

    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

    const teams = await Promise.all(
      Array.from({ length: TEAM_COUNT }, (_, i) =>
        registerTeamViaBot(app, quiz.id, `Score Team ${i + 1}`)
      )
    );

    await adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id });

    // All teams answer both questions; first 5 teams answer both correctly (score=3)
    // next 5 answer only Q1 correctly (score=1); next 5 only Q2 (score=2); last 5 wrong (score=0)
    await Promise.all(
      teams.map((t, i) => {
        const q1answer = i < 15 ? "A" : "B"; // first 15 correct on Q1
        const q2answer = i < 5 || i >= 10 ? "B" : "C"; // teams 0-4 and 10-19 correct on Q2...
        // Simplify: first 5 get both right, rest get both wrong
        return Promise.all([
          submitAnswerViaBot(app, q1.id, t.id, i < 5 ? "A" : "B"),
          submitAnswerViaBot(app, q2.id, t.id, i < 5 ? "B" : "A"),
        ]);
      })
    );

    await adminPost(app, cookie, "/api/game/finish", { quizId: quiz.id });

    const res = await app.inject({
      method: "GET",
      url: `/api/game/results/${quiz.id}`,
    });
    const results = res.json() as Array<{ teamId: number; correct: number; name: string }>;

    // All 20 teams appear in results
    expect(results).toHaveLength(TEAM_COUNT);

    // First 5 teams (indices 0-4) should all have score 3 (Q1=1 + Q2=2)
    const top5TeamIds = new Set(teams.slice(0, 5).map((t) => t.id));
    const top5Results = results.filter((r) => top5TeamIds.has(r.teamId));
    expect(top5Results).toHaveLength(5);
    for (const r of top5Results) {
      expect(r.correct).toBe(3);
    }

    // Remaining 15 teams (indices 5-19) should all have score 0
    const bottom15TeamIds = new Set(teams.slice(5).map((t) => t.id));
    const bottom15Results = results.filter((r) => bottom15TeamIds.has(r.teamId));
    expect(bottom15Results).toHaveLength(15);
    for (const r of bottom15Results) {
      expect(r.correct).toBe(0);
    }

    // Results sorted: top 5 winners first, then bottom 15
    for (let i = 0; i < 5; i++) {
      expect(results[i].correct).toBe(3);
    }
    for (let i = 5; i < TEAM_COUNT; i++) {
      expect(results[i].correct).toBe(0);
    }
  });

  it("next-question advances correctly under concurrent team registrations", async () => {
    const quiz = await createQuiz({ title: "NextQ Load" });
    const q1 = await createQuestionWithSlides(quiz.id, { orderNum: 1, questionType: "choice" });
    const q2 = await createQuestionWithSlides(quiz.id, { orderNum: 2, questionType: "choice" });

    await adminPost(app, cookie, "/api/game/start", { quizId: quiz.id });
    await adminPost(app, cookie, "/api/game/open-registration", { quizId: quiz.id });

    // Register teams while simultaneously beginning the game (concurrency)
    const [, ...teamResults] = await Promise.all([
      adminPost(app, cookie, "/api/game/begin", { quizId: quiz.id }),
      ...Array.from({ length: 10 }, (_, i) =>
        registerTeamViaBot(app, quiz.id, `Late Team ${i + 1}`)
      ),
    ]);

    // Move to Q2
    const nextRes = await adminPost(app, cookie, "/api/game/next-question", {
      quizId: quiz.id,
    });
    expect(nextRes.statusCode).toBe(200);

    const stateRes = await app.inject({
      method: "GET",
      url: `/api/game/state/${quiz.id}`,
    });
    expect(stateRes.json().currentQuestionId).toBe(q2.id);
  });
});
