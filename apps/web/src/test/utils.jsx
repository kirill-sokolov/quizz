/**
 * Test utilities for the web app.
 *
 * renderWithRouter — renders a component inside a MemoryRouter so that
 * hooks like useNavigate / Link / useParams work without a real browser.
 *
 * Usage:
 *   renderWithRouter(<MyComponent />, { route: "/game/42" })
 *
 *   // With a parameterised path (react-router v7):
 *   renderWithRouter(<MyComponent />, {
 *     path: "/game/:id",
 *     route: "/game/42",
 *   })
 */
import React from "react";
import { render } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

export function renderWithRouter(ui, { path = "/", route = "/" } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <Routes>
        <Route path={path} element={ui} />
      </Routes>
    </MemoryRouter>
  );
}

/**
 * Minimal quiz object for use in tests.
 */
export function makeQuiz(overrides = {}) {
  return {
    id: 1,
    title: "Test Quiz",
    status: "active",
    joinCode: "TEST01",
    demoImageUrl: null,
    rulesImageUrl: null,
    thanksImageUrl: null,
    finalImageUrl: null,
    displayedOnTv: true,
    ...overrides,
  };
}

/**
 * Minimal game state object for use in tests.
 */
export function makeState(overrides = {}) {
  return {
    id: 1,
    quizId: 1,
    status: "lobby",
    registrationOpen: false,
    currentQuestionId: null,
    currentSlideId: null,
    currentSlide: "question",
    timerStartedAt: null,
    resultsRevealCount: 0,
    ...overrides,
  };
}

/**
 * Minimal question object for use in tests.
 */
export function makeQuestion(overrides = {}) {
  return {
    id: 1,
    quizId: 1,
    orderNum: 1,
    text: "What is the capital of France?",
    questionType: "choice",
    options: ["Berlin", "Paris", "Rome", "Madrid"],
    correctAnswer: "B",
    explanation: null,
    timeLimitSec: 30,
    timerPosition: "center",
    weight: 1,
    slides: [
      { id: 10, type: "question", sortOrder: 2, imageUrl: null, videoUrl: null },
      { id: 11, type: "timer",    sortOrder: 3, imageUrl: null, videoUrl: null },
      { id: 12, type: "answer",   sortOrder: 4, imageUrl: null, videoUrl: null },
    ],
    ...overrides,
  };
}

/**
 * Minimal team object for use in tests.
 */
export function makeTeam(overrides = {}) {
  return {
    id: 1,
    quizId: 1,
    name: "Team Alpha",
    telegramChatId: 100001,
    isKicked: false,
    isBot: false,
    ...overrides,
  };
}
