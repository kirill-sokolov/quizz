/**
 * MSW v2 request handlers — default responses for all API endpoints.
 *
 * Specific routes (e.g. /quizzes/active) are listed BEFORE parameterised
 * routes (e.g. /quizzes/:id) so MSW matches them in the right order.
 *
 * Override in individual tests:
 *   server.use(http.get("http://localhost/api/quizzes/active", () => HttpResponse.json(myQuiz)))
 */
import { http, HttpResponse } from "msw";

const BASE = "http://localhost/api";

// ─── Default fixtures ──────────────────────────────────────────────────────

export const defaultQuiz = {
  id: 1,
  title: "Test Quiz",
  status: "active",
  joinCode: "TEST01",
  demoImageUrl: null,
  rulesImageUrl: null,
  thanksImageUrl: null,
  finalImageUrl: null,
  displayedOnTv: true,
};

export const defaultState = {
  id: 1,
  quizId: 1,
  status: "lobby",
  registrationOpen: false,
  currentQuestionId: null,
  currentSlideId: null,
  currentSlide: "question",
  timerStartedAt: null,
  resultsRevealCount: 0,
};

export const defaultQuestion = {
  id: 1,
  quizId: 1,
  orderNum: 1,
  text: "What is the capital of France?",
  questionType: "choice",
  options: ["Berlin", "Paris", "Rome", "Madrid"],
  correctAnswer: "B",
  explanation: null,
  timeLimitSec: 30,
  timerPosition: "top-right",
  weight: 1,
  slides: [
    { id: 10, type: "question", sortOrder: 2, imageUrl: null, videoUrl: null },
    { id: 11, type: "timer",    sortOrder: 3, imageUrl: null, videoUrl: null },
    { id: 12, type: "answer",   sortOrder: 4, imageUrl: null, videoUrl: null },
  ],
};

// ─── Handlers ─────────────────────────────────────────────────────────────

export const handlers = [
  // ── Quizzes (specific paths before /:id) ────────────────────────────────
  http.get(`${BASE}/quizzes/active`, () =>
    HttpResponse.json(defaultQuiz)),

  http.get(`${BASE}/quizzes/by-code/:code`, () =>
    HttpResponse.json(defaultQuiz)),

  http.get(`${BASE}/quizzes`, () =>
    HttpResponse.json([defaultQuiz])),

  http.get(`${BASE}/quizzes/:id`, () =>
    HttpResponse.json(defaultQuiz)),

  http.post(`${BASE}/quizzes`, () =>
    HttpResponse.json(defaultQuiz, { status: 201 })),

  http.patch(`${BASE}/quizzes/:id`, () =>
    HttpResponse.json(defaultQuiz)),

  http.delete(`${BASE}/quizzes/:id`, () =>
    new HttpResponse(null, { status: 204 })),

  http.post(`${BASE}/quizzes/:id/display-on-tv`, () =>
    HttpResponse.json({ ok: true })),

  // ── Questions ───────────────────────────────────────────────────────────
  http.get(`${BASE}/quizzes/:quizId/questions`, () =>
    HttpResponse.json([defaultQuestion])),

  http.post(`${BASE}/quizzes/:quizId/questions`, () =>
    HttpResponse.json(defaultQuestion, { status: 201 })),

  http.patch(`${BASE}/questions/:id`, () =>
    HttpResponse.json(defaultQuestion)),

  http.delete(`${BASE}/questions/:id`, () =>
    new HttpResponse(null, { status: 204 })),

  // ── Answers ─────────────────────────────────────────────────────────────
  http.get(`${BASE}/questions/:id/answers`, () =>
    HttpResponse.json([])),

  http.patch(`${BASE}/answers/:id/score`, () =>
    HttpResponse.json({ ok: true })),

  // ── Teams ───────────────────────────────────────────────────────────────
  http.get(`${BASE}/quizzes/:id/teams`, () =>
    HttpResponse.json([])),

  http.delete(`${BASE}/teams/:id`, () =>
    new HttpResponse(null, { status: 204 })),

  // ── Game state ──────────────────────────────────────────────────────────
  http.get(`${BASE}/game/state/:quizId`, () =>
    HttpResponse.json(defaultState)),

  http.post(`${BASE}/game/start`, () =>
    HttpResponse.json(defaultState)),

  http.post(`${BASE}/game/open-registration`, () =>
    HttpResponse.json({ ...defaultState, registrationOpen: true })),

  http.post(`${BASE}/game/begin`, () =>
    HttpResponse.json({ ...defaultState, status: "playing" })),

  http.post(`${BASE}/game/next-question`, () =>
    HttpResponse.json(defaultState)),

  http.post(`${BASE}/game/set-slide`, () =>
    HttpResponse.json(defaultState)),

  http.post(`${BASE}/game/remind`, () =>
    HttpResponse.json({ ok: true })),

  http.post(`${BASE}/game/finish`, () =>
    HttpResponse.json({ ...defaultState, status: "finished" })),

  http.post(`${BASE}/game/archive`, () =>
    HttpResponse.json(defaultState)),

  http.post(`${BASE}/game/restart`, () =>
    HttpResponse.json(defaultState)),

  http.post(`${BASE}/game/reveal-next-result`, () =>
    HttpResponse.json({ results: [], resultsRevealCount: 1 })),

  http.get(`${BASE}/game/results/:quizId/:teamId`, () =>
    HttpResponse.json({ team: null, answers: [] })),

  http.get(`${BASE}/game/results/:quizId`, () =>
    HttpResponse.json([])),

  // ── Auth ────────────────────────────────────────────────────────────────
  http.post(`${BASE}/auth/login`, () =>
    HttpResponse.json({ ok: true })),

  http.post(`${BASE}/auth/verify`, () =>
    HttpResponse.json({ valid: true })),

  http.post(`${BASE}/auth/logout`, () =>
    HttpResponse.json({ ok: true })),

  // ── Admin ───────────────────────────────────────────────────────────────
  http.post(`${BASE}/admin/seed`, () =>
    HttpResponse.json({ ok: true })),

  http.post(`${BASE}/admin/reset`, () =>
    HttpResponse.json({ ok: true })),
];
