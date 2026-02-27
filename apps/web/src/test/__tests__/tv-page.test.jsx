/**
 * Stage 2A: TV.jsx integration tests (MSW + RTL).
 *
 * Tests the full TV page with realistic HTTP responses (via MSW) and
 * simulated WebSocket events (via MockWebSocket). Real sub-components render —
 * no stubs.
 *
 * Route: /tv/:joinCode  →  TV.jsx calls getByCode(joinCode) → loads quiz/state/questions/teams.
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { http, HttpResponse } from "msw";
import TV from "../../pages/TV";
import { server } from "../msw/server";
import { defaultQuiz, defaultState, defaultQuestion } from "../msw/handlers";
import { sendWsMessage } from "../msw/ws-mock";
import { makeQuiz, makeState, makeQuestion, makeTeam } from "../utils";

// ─── helpers ──────────────────────────────────────────────────────────────────

const BASE = "http://localhost/api";

/** Render TV page for a given joinCode. */
function renderTV(joinCode = "TEST01") {
  return render(
    <MemoryRouter initialEntries={[`/tv/${joinCode}`]}>
      <Routes>
        <Route path="/tv/:joinCode" element={<TV />} />
      </Routes>
    </MemoryRouter>
  );
}

/** Wait until the "Загрузка…" spinner disappears. */
async function waitForLoad() {
  await waitFor(() =>
    expect(screen.queryByText(/загрузка/i)).not.toBeInTheDocument()
  );
}

/** Override a single MSW handler for the duration of one test. */
function useHandler(...handlers) {
  server.use(...handlers);
}

// ─── fixtures ─────────────────────────────────────────────────────────────────

const quiz = makeQuiz();

const questionWithSlides = makeQuestion({
  id: 1,
  text: "Столица Франции?",
  slides: [
    { id: 10, type: "question", sortOrder: 2, imageUrl: null, videoUrl: null },
    { id: 11, type: "timer",    sortOrder: 3, imageUrl: null, videoUrl: null },
    { id: 12, type: "answer",   sortOrder: 4, imageUrl: null, videoUrl: null },
    { id: 13, type: "extra",    sortOrder: 5, imageUrl: null, videoUrl: null },
  ],
});

// ─── Loading and error states ──────────────────────────────────────────────────

describe("TV: loading / error", () => {
  it("shows loading state initially", () => {
    renderTV();
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });

  it("shows fallback image on API error (quiz not found)", async () => {
    useHandler(
      http.get(`${BASE}/quizzes/by-code/:code`, () =>
        HttpResponse.json({ error: "not found" }, { status: 404 })
      )
    );
    renderTV("BADCODE");
    await waitForLoad();
    // TV.jsx shows a fallback img when error or no quizId
    expect(document.querySelector("img")).toBeInTheDocument();
  });
});

// ─── Lobby states ─────────────────────────────────────────────────────────────

describe("TV: lobby", () => {
  it("lobby + regOpen=false → shows TVRules (text 'Правила квиза')", async () => {
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(makeState({ status: "lobby", registrationOpen: false }))
      )
    );
    renderTV();
    await waitForLoad();
    expect(screen.getByText("Правила квиза")).toBeInTheDocument();
  });

  it("lobby + regOpen=true → shows TVLobby ('Регистрация команд')", async () => {
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(makeState({ status: "lobby", registrationOpen: true }))
      ),
      http.get(`${BASE}/quizzes/:id/teams`, () => HttpResponse.json([]))
    );
    renderTV();
    await waitForLoad();
    expect(screen.getByText("Регистрация команд")).toBeInTheDocument();
  });

  it("lobby + regOpen=true + teams → shows team names", async () => {
    const teams = [
      makeTeam({ id: 1, name: "Альфа" }),
      makeTeam({ id: 2, name: "Бета" }),
    ];
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(makeState({ status: "lobby", registrationOpen: true }))
      ),
      http.get(`${BASE}/quizzes/:id/teams`, () => HttpResponse.json(teams))
    );
    renderTV();
    await waitForLoad();
    expect(screen.getByText("Альфа")).toBeInTheDocument();
    expect(screen.getByText("Бета")).toBeInTheDocument();
  });
});

// ─── Playing states ───────────────────────────────────────────────────────────

describe("TV: playing", () => {
  it("slide=question → renders TVQuestion (background slide, no text, no timer)", async () => {
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({ status: "playing", currentQuestionId: 1, currentSlide: "question" })
        )
      ),
      http.get(`${BASE}/quizzes/:quizId/questions`, () =>
        HttpResponse.json([questionWithSlides])
      )
    );
    renderTV();
    await waitForLoad();
    // TVQuestion is a background-only slide — no text, no timer countdown
    // Verify component loaded without error (no fallback Demo image)
    expect(document.querySelector('img[alt="Demo"]')).not.toBeInTheDocument();
    // Timer countdown "30" is not shown (that only appears on TVTimer slide)
    expect(screen.queryByText("30")).not.toBeInTheDocument();
    // Lobby text is not shown
    expect(screen.queryByText("Регистрация команд")).not.toBeInTheDocument();
  });

  it("slide=timer → shows timer countdown", async () => {
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({
            status: "playing",
            currentQuestionId: 1,
            currentSlide: "timer",
            timerStartedAt: new Date().toISOString(),
          })
        )
      ),
      http.get(`${BASE}/quizzes/:quizId/questions`, () =>
        HttpResponse.json([questionWithSlides])
      )
    );
    renderTV();
    await waitForLoad();
    // TVTimer renders the time remaining (starts at timeLimitSec=30)
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("slide=answer → renders without crash, question text gone", async () => {
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({ status: "playing", currentQuestionId: 1, currentSlide: "answer" })
        )
      ),
      http.get(`${BASE}/quizzes/:quizId/questions`, () =>
        HttpResponse.json([questionWithSlides])
      )
    );
    renderTV();
    await waitForLoad();
    // TVAnswer renders TVSlideBg (background only), no question text
    expect(screen.queryByText("Столица Франции?")).not.toBeInTheDocument();
  });

  it("slide=extra → renders TVExtraSlide, no question text", async () => {
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({
            status: "playing",
            currentQuestionId: 1,
            currentSlide: "extra",
            currentSlideId: 13,
          })
        )
      ),
      http.get(`${BASE}/quizzes/:quizId/questions`, () =>
        HttpResponse.json([questionWithSlides])
      )
    );
    renderTV();
    await waitForLoad();
    expect(screen.queryByText("Столица Франции?")).not.toBeInTheDocument();
  });
});

// ─── Finished states ──────────────────────────────────────────────────────────

describe("TV: finished", () => {
  it("slide=results + revealCount=2 → shows TVResults with 2 teams visible", async () => {
    // TVResults expects flat format: { teamId, name, correct, total }
    const results = [
      { teamId: 1, name: "Победители", correct: 3, total: 3, totalScore: 10 },
      { teamId: 2, name: "Финалисты", correct: 2, total: 3, totalScore: 5 },
      { teamId: 3, name: "Третьи", correct: 1, total: 3, totalScore: 2 },
    ];
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({ status: "finished", currentSlide: "results", resultsRevealCount: 2 })
        )
      ),
      http.get(`${BASE}/game/results/:quizId`, () => HttpResponse.json(results))
    );
    renderTV();
    await waitForLoad();
    // revealCount=2 → positions 2 and 3 revealed (revealOrder=[1,2,0], slice(0,2)=[1,2])
    expect(screen.getByText("Финалисты")).toBeInTheDocument();
    expect(screen.getByText("Третьи")).toBeInTheDocument();
    // Position 1 is still a placeholder (🥇 with • • •)
    expect(screen.queryByText("Победители")).not.toBeInTheDocument();
  });

  it("slide=thanks → shows TVDemo with thanks image", async () => {
    const quizWithThanks = makeQuiz({ thanksImageUrl: "/api/media/seed/thanks.png" });
    useHandler(
      http.get(`${BASE}/quizzes/by-code/:code`, () => HttpResponse.json(quizWithThanks)),
      http.get(`${BASE}/quizzes/:id`, () => HttpResponse.json(quizWithThanks)),
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(makeState({ status: "finished", currentSlide: "thanks" }))
      ),
      http.get(`${BASE}/game/results/:quizId`, () => HttpResponse.json([]))
    );
    renderTV();
    await waitForLoad();
    const img = document.querySelector('img[src*="thanks"]');
    expect(img).toBeInTheDocument();
  });
});

// ─── WebSocket events ──────────────────────────────────────────────────────────

describe("TV: WebSocket events", () => {
  it("team_registered → new team appears in TVLobby without page reload", async () => {
    const newTeam = makeTeam({ id: 99, name: "НоваяКоманда" });
    // Initial load: empty teams
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(makeState({ status: "lobby", registrationOpen: true }))
      ),
      http.get(`${BASE}/quizzes/:id/teams`, () => HttpResponse.json([]))
    );
    renderTV();
    await waitForLoad();

    // TV is in lobby with no teams yet
    expect(screen.queryByText("НоваяКоманда")).not.toBeInTheDocument();

    // Override teams handler to return the new team for the WS-triggered refetch
    server.use(
      http.get(`${BASE}/quizzes/:id/teams`, () => HttpResponse.json([newTeam]))
    );

    // WS fires team_registered → TV refetches teams
    sendWsMessage({ event: "team_registered", data: { quizId: 1, teamId: 99 } });

    await screen.findByText("НоваяКоманда");
  });

  it("slide_changed → component switches from question slide to timer (countdown appears)", async () => {
    // Initial state: playing, slide=question (TVQuestion = background only, no text)
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({ status: "playing", currentQuestionId: 1, currentSlide: "question" })
        )
      ),
      http.get(`${BASE}/quizzes/:quizId/questions`, () =>
        HttpResponse.json([questionWithSlides])
      )
    );
    renderTV();
    await waitForLoad();
    // On question slide: no timer countdown visible
    expect(screen.queryByText("30")).not.toBeInTheDocument();

    // Override state handler to return timer slide
    server.use(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({
            status: "playing",
            currentQuestionId: 1,
            currentSlide: "timer",
            timerStartedAt: new Date().toISOString(),
          })
        )
      )
    );

    sendWsMessage({ event: "slide_changed", data: { quizId: 1 } });

    // Timer countdown "30" appears
    await screen.findByText("30");
  });

  it("quiz_finished → TVResults appears", async () => {
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({ status: "playing", currentQuestionId: 1, currentSlide: "question" })
        )
      ),
      http.get(`${BASE}/quizzes/:quizId/questions`, () =>
        HttpResponse.json([questionWithSlides])
      )
    );
    renderTV();
    await waitForLoad();

    // WS fires quiz_finished with results
    sendWsMessage({
      event: "quiz_finished",
      data: {
        quizId: 1,
        results: [
          { team: { id: 1, name: "Победители" }, totalScore: 10, rank: 1, correctAnswers: 3, totalAnswers: 3 },
        ],
        resultsRevealCount: 0,
      },
    });

    // TVResults renders (revealCount=0 means 1st place is placeholder)
    await waitFor(() =>
      expect(screen.queryByText("Столица Франции?")).not.toBeInTheDocument()
    );
    // Medals are present (🥇 placeholder always visible)
    await waitFor(() => expect(screen.getByText("🥇")).toBeInTheDocument());
  });

  it("results_revealed → revealCount increases and team becomes visible", async () => {
    // TVResults expects flat format: { teamId, name, correct, total }
    const results = [
      { teamId: 1, name: "Альфа", correct: 3, total: 3, totalScore: 10 },
      { teamId: 2, name: "Бета", correct: 2, total: 3, totalScore: 5 },
    ];
    useHandler(
      http.get(`${BASE}/game/state/:quizId`, () =>
        HttpResponse.json(
          makeState({ status: "finished", currentSlide: "results", resultsRevealCount: 0 })
        )
      ),
      http.get(`${BASE}/game/results/:quizId`, () => HttpResponse.json(results))
    );
    renderTV();
    await waitForLoad();

    // revealCount=0: neither team visible (only 1st-place placeholder)
    expect(screen.queryByText("Бета")).not.toBeInTheDocument();

    // WS fires results_revealed (revealCount becomes 1 → 2nd place appears: revealOrder=[1,0], slice(0,1)=[1])
    await act(async () => {
      sendWsMessage({
        event: "results_revealed",
        data: { quizId: 1, results, resultsRevealCount: 1 },
      });
    });

    await screen.findByText("Бета");
    // 1st place still hidden
    expect(screen.queryByText("Альфа")).not.toBeInTheDocument();
  });
});
