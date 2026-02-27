/**
 * Test data helpers — create minimal in-DB fixtures.
 * Does NOT require media files; uses null for image/video URLs.
 */
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import {
  quizzes,
  questions,
  slides,
  teams,
  gameState,
  admins,
} from "../db/schema.js";
import bcrypt from "bcrypt";

// ─── Quizzes ─────────────────────────────────────────────────────────────────

export async function createQuiz(overrides: Partial<typeof quizzes.$inferInsert> = {}) {
  const [quiz] = await db
    .insert(quizzes)
    .values({
      title: "Test Quiz",
      status: "draft",
      ...overrides,
    })
    .returning();
  return quiz;
}

// ─── Questions ────────────────────────────────────────────────────────────────

export async function createQuestion(
  quizId: number,
  overrides: Partial<typeof questions.$inferInsert> = {}
) {
  const [q] = await db
    .insert(questions)
    .values({
      quizId,
      orderNum: 1,
      text: "What is 2+2?",
      options: ["1", "2", "4", "8"],
      correctAnswer: "C",
      questionType: "choice",
      timeLimitSec: 30,
      timerPosition: "center",
      weight: 1,
      ...overrides,
    })
    .returning();
  return q;
}

/** Create question with standard slides: question → timer → answer */
export async function createQuestionWithSlides(
  quizId: number,
  overrides: Partial<typeof questions.$inferInsert> = {}
) {
  const q = await createQuestion(quizId, overrides);
  await db.insert(slides).values([
    { questionId: q.id, type: "question", sortOrder: 2 },
    { questionId: q.id, type: "timer", sortOrder: 3 },
    { questionId: q.id, type: "answer", sortOrder: 4 },
  ]);
  return q;
}

// ─── Teams ────────────────────────────────────────────────────────────────────

export async function createTeam(
  quizId: number,
  overrides: Partial<typeof teams.$inferInsert> = {}
) {
  const [team] = await db
    .insert(teams)
    .values({
      quizId,
      name: "Team Alpha",
      telegramChatId: BigInt(100_000 + Math.floor(Math.random() * 900_000)),
      ...overrides,
    })
    .returning();
  return team;
}

// ─── Full quiz fixture ────────────────────────────────────────────────────────

/**
 * Creates a quiz with 4 questions covering edge cases:
 *  Q1 – choice, 4 options
 *  Q2 – text, single correct answer
 *  Q3 – text, multiple correct answers (comma-separated)
 *  Q4 – choice, weight=2
 */
export async function createDemoQuiz() {
  const quiz = await createQuiz({ title: "Demo Test Quiz", status: "active", joinCode: "DEMO01" });

  const q1 = await createQuestionWithSlides(quiz.id, {
    orderNum: 1,
    text: "Which season comes after winter?",
    options: ["Summer", "Autumn", "Spring", "Winter"],
    correctAnswer: "C",
    questionType: "choice",
    weight: 1,
    timerPosition: "center",
  });

  const q2 = await createQuestionWithSlides(quiz.id, {
    orderNum: 2,
    text: "What is the capital of France?",
    options: [],
    correctAnswer: "Paris",
    questionType: "text",
    weight: 1,
    timerPosition: "top-right",
  });

  const q3 = await createQuestionWithSlides(quiz.id, {
    orderNum: 3,
    text: "Name two primary colors. (list 2)",
    options: [],
    correctAnswer: "Red, Blue",
    questionType: "text",
    weight: 1,
    timerPosition: "bottom-left",
  });

  const q4 = await createQuestionWithSlides(quiz.id, {
    orderNum: 4,
    text: "How many days in a leap year?",
    options: ["364", "365", "366", "367"],
    correctAnswer: "C",
    questionType: "choice",
    weight: 2,
    timerPosition: "top-right",
  });

  return { quiz, questions: [q1, q2, q3, q4] };
}

// ─── Admin HTTP helpers ───────────────────────────────────────────────────────

/** Authenticated POST — shortcut for admin API calls. */
export async function adminPost(
  app: FastifyInstance,
  cookie: string,
  url: string,
  body: Record<string, unknown> = {}
) {
  return app.inject({
    method: "POST",
    url,
    cookies: { auth_token: cookie },
    payload: body,
  });
}

// ─── Bot-simulated actions ────────────────────────────────────────────────────
// These mirror what apps/bot/ does: POST to API endpoints directly.

let _nextChatId = 200_000;

/**
 * Simulates a team registration via the Telegram bot:
 * POST /api/quizzes/:id/teams
 */
export async function registerTeamViaBot(
  app: FastifyInstance,
  quizId: number,
  name: string,
  telegramChatId?: number
) {
  const chatId = telegramChatId ?? _nextChatId++;
  const res = await app.inject({
    method: "POST",
    url: `/api/quizzes/${quizId}/teams`,
    payload: { name, telegramChatId: chatId },
  });
  if (res.statusCode !== 201) {
    throw new Error(`registerTeamViaBot failed: ${res.statusCode} ${res.body}`);
  }
  return res.json() as { id: number; quizId: number; name: string; telegramChatId: number };
}

/**
 * Simulates an answer submission via the Telegram bot:
 * POST /api/answers
 */
export async function submitAnswerViaBot(
  app: FastifyInstance,
  questionId: number,
  teamId: number,
  answerText: string
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/answers",
    payload: { questionId, teamId, answerText },
  });
  if (res.statusCode !== 201) {
    throw new Error(`submitAnswerViaBot failed: ${res.statusCode} ${res.body}`);
  }
  return res.json() as {
    id: number;
    questionId: number;
    teamId: number;
    answerText: string;
    awardedScore: number | null;
  };
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export async function createAdmin(username = "admin", password = "password") {
  const hash = await bcrypt.hash(password, 4); // low rounds for speed in tests
  const [admin] = await db
    .insert(admins)
    .values({ username, password: hash })
    .returning();
  return admin;
}

/**
 * Log in as an admin and return the auth_token cookie value.
 * Use this to make authenticated requests in tests.
 */
export async function loginAs(
  app: FastifyInstance,
  username: string,
  password: string
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Login failed: ${res.statusCode} ${res.body}`);
  }
  const setCookie = res.headers["set-cookie"];
  const cookieStr = Array.isArray(setCookie) ? setCookie[0] : (setCookie as string);
  const match = cookieStr?.match(/auth_token=([^;]+)/);
  if (!match) throw new Error("No auth_token cookie in login response");
  return match[1];
}

// ─── Game state ───────────────────────────────────────────────────────────────

export async function createGameState(
  quizId: number,
  overrides: Partial<typeof gameState.$inferInsert> = {}
) {
  const [state] = await db
    .insert(gameState)
    .values({
      quizId,
      status: "lobby",
      currentSlide: "question",
      registrationOpen: false,
      resultsRevealCount: 0,
      showBotsOnTv: true,
      ...overrides,
    })
    .returning();
  return state;
}
