/**
 * Game.jsx integration tests (Stage 2B).
 *
 * Verifies that the Game admin page renders correctly for each game state,
 * fires the right API calls on user interactions, and reacts to WebSocket events.
 * API client and WebSocket are mocked; TestBotsPanel is replaced with a stub.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Game from "../../pages/Game";
import {
  quizzesApi,
  gameApi,
  questionsApi,
  teamsApi,
  answersApi,
} from "../../api/client";
import { makeQuiz, makeState, makeQuestion, makeTeam } from "../utils";
import { sendWsMessage } from "../msw/ws-mock";

// ─── API mock ──────────────────────────────────────────────────────────────────
vi.mock("../../api/client", () => ({
  quizzesApi: { get: vi.fn() },
  gameApi: {
    getState: vi.fn(),
    start: vi.fn(),
    openRegistration: vi.fn(),
    begin: vi.fn(),
    setSlide: vi.fn(),
    nextQuestion: vi.fn(),
    finish: vi.fn(),
    revealNextResult: vi.fn(),
    getResults: vi.fn(),
    getTeamDetails: vi.fn(),
    remind: vi.fn(),
    archive: vi.fn(),
  },
  questionsApi: { list: vi.fn() },
  teamsApi: { list: vi.fn(), kick: vi.fn() },
  answersApi: { list: vi.fn(), updateScore: vi.fn() },
  getWsUrl: vi.fn(() => "ws://localhost/ws"),
  getMediaUrl: vi.fn((url) => url ?? ""),
}));

// ─── Stub TestBotsPanel ────────────────────────────────────────────────────────
// Prevents real fetch calls inside TestBotsPanel during tests.
vi.mock("../../components/Admin/TestBotsPanel", () => ({
  default: () => <div data-testid="test-bots-panel" />,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const QUIZ = makeQuiz({ status: "active" });
const QUESTION = makeQuestion();
// Slide IDs match the slides defined inside makeQuestion()
const SLIDE_QUESTION_ID = 10;
const SLIDE_TIMER_ID = 11;
const SLIDE_ANSWER_ID = 12;

const TEAM_A = makeTeam({ id: 1, name: "Team Alpha" });
const TEAM_B = makeTeam({ id: 2, name: "Team Beta" });

// ─── Render helper ─────────────────────────────────────────────────────────────
function renderGame(quizId = "1") {
  return render(
    <MemoryRouter initialEntries={[`/admin/game/${quizId}`]}>
      <Routes>
        <Route path="/admin/game/:id" element={<Game />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Default API setup ─────────────────────────────────────────────────────────
// Sets sensible defaults; individual tests override as needed.
function setupDefault() {
  vi.mocked(quizzesApi.get).mockResolvedValue(QUIZ);
  vi.mocked(gameApi.getState).mockResolvedValue(
    makeState({ status: "lobby", registrationOpen: false })
  );
  vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
  vi.mocked(teamsApi.list).mockResolvedValue([]);
  vi.mocked(answersApi.list).mockResolvedValue([]);
  vi.mocked(gameApi.getResults).mockResolvedValue([]);
  vi.mocked(gameApi.start).mockResolvedValue({});
  vi.mocked(gameApi.openRegistration).mockResolvedValue({});
  vi.mocked(gameApi.begin).mockResolvedValue({});
  vi.mocked(gameApi.setSlide).mockResolvedValue({});
  vi.mocked(gameApi.finish).mockResolvedValue({});
  vi.mocked(gameApi.revealNextResult).mockResolvedValue({});
  vi.mocked(teamsApi.kick).mockResolvedValue({});
  vi.mocked(answersApi.updateScore).mockResolvedValue({});
}

// ─── Loading state ─────────────────────────────────────────────────────────────
describe("Game.jsx — loading", () => {
  beforeEach(() => setupDefault());

  it("shows loading indicator before API resolves", () => {
    // Keep the first API call pending so the loading state stays visible.
    vi.mocked(quizzesApi.get).mockReturnValue(new Promise(() => {}));
    renderGame();
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
  });
});

// ─── state = null (game not started) ──────────────────────────────────────────
describe("Game.jsx — state=null (not started)", () => {
  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(null);
    // Keep start() pending so the auto-start effect does not resolve and
    // change the state — the "Запустить квиз" button stays visible.
    vi.mocked(gameApi.start).mockReturnValue(new Promise(() => {}));
  });

  it("shows 'Запустить квиз' button", async () => {
    renderGame();
    await waitFor(() =>
      expect(screen.getByText("Запустить квиз")).toBeInTheDocument()
    );
  });

  it("clicking 'Запустить квиз' calls gameApi.start", async () => {
    const user = userEvent.setup();
    renderGame();
    const button = await screen.findByText("Запустить квиз");
    // Clear auto-start call so we can isolate the button click.
    vi.mocked(gameApi.start).mockClear();
    await user.click(button);
    expect(vi.mocked(gameApi.start)).toHaveBeenCalledWith(1);
  });
});

// ─── state = lobby, registrationOpen = false ──────────────────────────────────
describe("Game.jsx — state=lobby, regClosed", () => {
  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "lobby", registrationOpen: false })
    );
  });

  it("shows 'Открыть регистрацию' button", async () => {
    renderGame();
    await waitFor(() =>
      expect(screen.getByText("Открыть регистрацию")).toBeInTheDocument()
    );
  });

  it("clicking 'Открыть регистрацию' calls gameApi.openRegistration", async () => {
    const user = userEvent.setup();
    renderGame();
    const button = await screen.findByText("Открыть регистрацию");
    await user.click(button);
    expect(vi.mocked(gameApi.openRegistration)).toHaveBeenCalledWith(1);
  });
});

// ─── state = lobby, registrationOpen = true ───────────────────────────────────
describe("Game.jsx — state=lobby, regOpen", () => {
  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "lobby", registrationOpen: true })
    );
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A, TEAM_B]);
  });

  it("shows team names and 'Начать квиз' button", async () => {
    renderGame();
    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
      expect(screen.getByText("Team Beta")).toBeInTheDocument();
      expect(screen.getByText("Начать квиз")).toBeInTheDocument();
    });
  });
});

// ─── state = playing ──────────────────────────────────────────────────────────
describe("Game.jsx — state=playing", () => {
  const PLAYING_STATE = makeState({
    status: "playing",
    currentQuestionId: QUESTION.id,
    currentSlide: "question",
    currentSlideId: SLIDE_QUESTION_ID,
  });

  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(PLAYING_STATE);
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(answersApi.list).mockResolvedValue([]);
  });

  it("shows question text and slide navigation buttons", async () => {
    renderGame();
    await waitFor(() =>
      expect(screen.getByText(QUESTION.text)).toBeInTheDocument()
    );
    expect(screen.getByText("◀")).toBeInTheDocument();
    expect(screen.getByText("▶")).toBeInTheDocument();
  });

  it("clicking '▶' calls gameApi.setSlide with next slideId", async () => {
    // First getState call (initial load) → question slide.
    // Second call (after setSlide) → timer slide.
    vi.mocked(gameApi.getState)
      .mockResolvedValueOnce(PLAYING_STATE)
      .mockResolvedValue(
        makeState({
          status: "playing",
          currentQuestionId: QUESTION.id,
          currentSlide: "timer",
          currentSlideId: SLIDE_TIMER_ID,
        })
      );

    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);

    const nextBtn = screen.getByText("▶");
    expect(nextBtn).not.toBeDisabled();
    await user.click(nextBtn);

    expect(vi.mocked(gameApi.setSlide)).toHaveBeenCalledWith(1, {
      slideId: SLIDE_TIMER_ID,
    });
  });

  it("'Завершить квиз' is disabled when not on last slide", async () => {
    // Current slide is "question" (first), not last.
    renderGame();
    await screen.findByText(QUESTION.text);
    expect(screen.getByText("Завершить квиз")).toBeDisabled();
  });

  it("'Завершить квиз' is enabled on last slide of last question", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "answer",
        currentSlideId: SLIDE_ANSWER_ID,
      })
    );
    renderGame();
    await screen.findByText(QUESTION.text);
    expect(screen.getByText("Завершить квиз")).not.toBeDisabled();
  });

  it("clicking 'Завершить квиз' calls gameApi.finish", async () => {
    // Start on the answer (last) slide so the button is enabled.
    vi.mocked(gameApi.getState)
      .mockResolvedValueOnce(
        makeState({
          status: "playing",
          currentQuestionId: QUESTION.id,
          currentSlide: "answer",
          currentSlideId: SLIDE_ANSWER_ID,
        })
      )
      .mockResolvedValue(makeState({ status: "finished" }));
    vi.mocked(gameApi.getResults).mockResolvedValue([]);

    const user = userEvent.setup();
    renderGame();
    const finishBtn = await screen.findByText("Завершить квиз");
    await user.click(finishBtn);

    expect(vi.mocked(gameApi.finish)).toHaveBeenCalledWith(1);
  });

  it("kick (✕) button calls teamsApi.kick", async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);

    // Kick button is in the bottom panel (title="Исключить").
    const kickBtn = screen.getByTitle("Исключить");
    await user.click(kickBtn);

    expect(vi.mocked(teamsApi.kick)).toHaveBeenCalledWith(TEAM_A.id);
  });

  it("score dropdown (text question) calls answersApi.updateScore on change", async () => {
    const textQuestion = makeQuestion({
      questionType: "text",
      correctAnswer: "Paris",
      weight: 1,
    });
    const textAnswer = {
      id: 99,
      teamId: TEAM_A.id,
      answerText: "Paris",
      awardedScore: 0,
    };
    vi.mocked(questionsApi.list).mockResolvedValue([textQuestion]);
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: textQuestion.id,
        currentSlide: "timer",
        currentSlideId: textQuestion.slides[1].id, // timer slide
      })
    );
    vi.mocked(answersApi.list).mockResolvedValue([textAnswer]);

    const user = userEvent.setup();
    renderGame();
    await screen.findByText(textQuestion.text);

    const scoreSelect = await screen.findByRole("combobox");
    await user.selectOptions(scoreSelect, "1");

    expect(vi.mocked(answersApi.updateScore)).toHaveBeenCalledWith(99, 1);
  });
});

// ─── state = finished ─────────────────────────────────────────────────────────
describe("Game.jsx — state=finished", () => {
  const FINISHED_QUIZ = makeQuiz({ status: "finished" });
  const RESULTS = [
    { teamId: 1, name: "Team Alpha", correct: 3, total: 3 },
    { teamId: 2, name: "Team Beta", correct: 2, total: 3 },
  ];

  beforeEach(() => {
    setupDefault();
    vi.mocked(quizzesApi.get).mockResolvedValue(FINISHED_QUIZ);
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "finished",
        currentSlide: "results",
        resultsRevealCount: 0,
      })
    );
    vi.mocked(gameApi.getResults).mockResolvedValue(RESULTS);
  });

  it("shows results table with team names", async () => {
    renderGame();
    await waitFor(() => {
      expect(screen.getByText("Team Alpha")).toBeInTheDocument();
      expect(screen.getByText("Team Beta")).toBeInTheDocument();
    });
  });

  it("'Показать следующее место' button calls gameApi.revealNextResult", async () => {
    vi.mocked(gameApi.revealNextResult).mockResolvedValue({
      state: makeState({
        status: "finished",
        currentSlide: "results",
        resultsRevealCount: 1,
      }),
    });

    const user = userEvent.setup();
    renderGame();
    const revealBtn = await screen.findByText(/показать следующее место/i);
    await user.click(revealBtn);

    expect(vi.mocked(gameApi.revealNextResult)).toHaveBeenCalledWith(1);
  });
});

// ─── WebSocket events ─────────────────────────────────────────────────────────
describe("Game.jsx — WebSocket events", () => {
  const PLAYING_STATE = makeState({
    status: "playing",
    currentQuestionId: QUESTION.id,
    currentSlide: "question",
    currentSlideId: SLIDE_QUESTION_ID,
  });

  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(PLAYING_STATE);
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(answersApi.list).mockResolvedValue([]);
  });

  it("'answer_submitted' event triggers answer list refresh", async () => {
    vi.mocked(answersApi.list).mockResolvedValue([]);

    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(answersApi.list).mock.calls.length;

    // Dispatch WS message after component mounted and WS connected.
    sendWsMessage({
      event: "answer_submitted",
      data: { quizId: 1, teamId: TEAM_A.id },
    });

    await waitFor(() =>
      expect(vi.mocked(answersApi.list).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });
});
