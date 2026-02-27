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

// ─── lobby: handleBegin ────────────────────────────────────────────────────────
describe("Game.jsx — lobby: handleBegin", () => {
  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "lobby", registrationOpen: true })
    );
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(gameApi.begin).mockResolvedValue({});
  });

  it("clicking 'Начать квиз' calls gameApi.begin", async () => {
    const user = userEvent.setup();
    renderGame();
    const beginBtn = await screen.findByText("Начать квиз");
    await user.click(beginBtn);
    expect(vi.mocked(gameApi.begin)).toHaveBeenCalledWith(1);
  });
});

// ─── playing: next question ────────────────────────────────────────────────────
describe("Game.jsx — playing: next question button", () => {
  const Q2 = makeQuestion({
    id: 2,
    text: "Второй вопрос",
    slides: [
      { id: 20, type: "question", sortOrder: 2, imageUrl: null, videoUrl: null },
      { id: 21, type: "timer",    sortOrder: 3, imageUrl: null, videoUrl: null },
      { id: 22, type: "answer",   sortOrder: 4, imageUrl: null, videoUrl: null },
    ],
  });

  beforeEach(() => {
    setupDefault();
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION, Q2]);
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(answersApi.list).mockResolvedValue([]);
  });

  it("'→ Следующий вопрос' is disabled when not on last slide of question", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "question",
        currentSlideId: SLIDE_QUESTION_ID,
      })
    );
    renderGame();
    await screen.findByText(QUESTION.text);
    expect(screen.getByText("→ Следующий вопрос")).toBeDisabled();
  });

  it("'→ Следующий вопрос' is enabled on last slide + more questions exist", async () => {
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
    expect(screen.getByText("→ Следующий вопрос")).not.toBeDisabled();
  });

  it("clicking '→ Следующий вопрос' calls gameApi.nextQuestion", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "answer",
        currentSlideId: SLIDE_ANSWER_ID,
      })
    );
    vi.mocked(gameApi.nextQuestion).mockResolvedValue(
      makeState({ status: "playing", currentQuestionId: Q2.id, currentSlide: "question", currentSlideId: 20 })
    );

    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);
    await user.click(screen.getByText("→ Следующий вопрос"));

    expect(vi.mocked(gameApi.nextQuestion)).toHaveBeenCalledWith(1);
  });
});

// ─── playing: prev slide ────────────────────────────────────────────────────────
describe("Game.jsx — playing: prev slide (◀)", () => {
  beforeEach(() => {
    setupDefault();
    // Start on timer slide (index 1) so ◀ is enabled
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "timer",
        currentSlideId: SLIDE_TIMER_ID,
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(answersApi.list).mockResolvedValue([
      { id: 1, teamId: TEAM_A.id, answerText: "A", awardedScore: 0 },
    ]);
  });

  it("clicking ◀ calls setSlide with previous slide", async () => {
    vi.mocked(gameApi.getState)
      .mockResolvedValueOnce(
        makeState({
          status: "playing",
          currentQuestionId: QUESTION.id,
          currentSlide: "timer",
          currentSlideId: SLIDE_TIMER_ID,
        })
      )
      .mockResolvedValue(
        makeState({
          status: "playing",
          currentQuestionId: QUESTION.id,
          currentSlide: "question",
          currentSlideId: SLIDE_QUESTION_ID,
        })
      );

    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);

    const prevBtn = screen.getByText("◀");
    expect(prevBtn).not.toBeDisabled();
    await user.click(prevBtn);

    expect(vi.mocked(gameApi.setSlide)).toHaveBeenCalledWith(1, { slideId: SLIDE_QUESTION_ID });
  });
});

// ─── playing: TimerDisplay ─────────────────────────────────────────────────────
describe("Game.jsx — playing: TimerDisplay", () => {
  it("shows timer countdown on timer slide when timerStartedAt is set", async () => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "timer",
        currentSlideId: SLIDE_TIMER_ID,
        timerStartedAt: new Date().toISOString(),
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(answersApi.list).mockResolvedValue([
      { id: 1, teamId: TEAM_A.id, answerText: "A", awardedScore: 0 },
    ]);

    renderGame();
    await screen.findByText(QUESTION.text);
    await waitFor(() => expect(screen.getByText(/⏱/)).toBeInTheDocument());
  });
});

// ─── playing: remind ────────────────────────────────────────────────────────────
describe("Game.jsx — playing: remind", () => {
  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "question",
        currentSlideId: SLIDE_QUESTION_ID,
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(answersApi.list).mockResolvedValue([]); // TEAM_A has not submitted
    vi.mocked(gameApi.remind).mockResolvedValue({});
  });

  it("clicking 'Напомнить' for individual team calls gameApi.remind with teamId", async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);

    await user.click(screen.getByText("Напомнить"));
    expect(vi.mocked(gameApi.remind)).toHaveBeenCalledWith(1, TEAM_A.id);
  });

  it("clicking '📢 Напомнить всем несдавшим' calls gameApi.remind with no teamId", async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);

    await user.click(screen.getByText(/напомнить всем/i));
    expect(vi.mocked(gameApi.remind)).toHaveBeenCalledWith(1, undefined);
  });

  it("'📢 Напомнить всем' button not shown when all teams submitted", async () => {
    vi.mocked(answersApi.list).mockResolvedValue([
      { id: 1, teamId: TEAM_A.id, answerText: "A", awardedScore: 0 },
    ]);
    renderGame();
    await screen.findByText(QUESTION.text);
    expect(screen.queryByText(/напомнить всем/i)).not.toBeInTheDocument();
  });
});

// ─── playing: results modal ────────────────────────────────────────────────────
describe("Game.jsx — playing: results modal (📊)", () => {
  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "question",
        currentSlideId: SLIDE_QUESTION_ID,
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    vi.mocked(teamsApi.list).mockResolvedValue([TEAM_A]);
    vi.mocked(answersApi.list).mockResolvedValue([]);
  });

  it("clicking '📊 Результаты' opens modal with loaded results", async () => {
    vi.mocked(gameApi.getResults).mockResolvedValue([
      { teamId: 1, name: "Team Alpha", correct: 2, total: 3 },
      { teamId: 2, name: "Team Beta",  correct: 1, total: 3 },
    ]);
    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);

    await user.click(screen.getByText(/Результаты/));

    await screen.findByText("Текущие результаты");
    expect(screen.getAllByText("Team Alpha").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Team Beta").length).toBeGreaterThan(0);
    expect(vi.mocked(gameApi.getResults)).toHaveBeenCalledWith(1);
  });

  it("clicking 'Подробнее' inside results modal opens team details", async () => {
    vi.mocked(gameApi.getResults).mockResolvedValue([
      { teamId: 1, name: "Team Alpha", correct: 2, total: 3 },
    ]);
    vi.mocked(gameApi.getTeamDetails).mockResolvedValue({
      teamId: 1,
      teamName: "Team Alpha",
      totalCorrect: 2,
      totalQuestions: 3,
      details: [],
    });

    const user = userEvent.setup();
    renderGame();
    await screen.findByText(QUESTION.text);

    // Open results modal
    await user.click(screen.getByText(/Результаты/));
    await screen.findByText("Текущие результаты");

    // Click "Подробнее" inside that modal (results modal has its own "Подробнее" button)
    await user.click(screen.getByRole("button", { name: "Подробнее" }));

    // Team details modal opens
    await screen.findByText(/баллов из/);
    expect(vi.mocked(gameApi.getTeamDetails)).toHaveBeenCalledWith(1, 1);
  });
});

// ─── finished: team details modal ─────────────────────────────────────────────
describe("Game.jsx — finished: team details modal", () => {
  const RESULTS = [{ teamId: 1, name: "Team Alpha", correct: 3, total: 3 }];
  const TEAM_DETAILS = {
    teamId: 1,
    teamName: "Team Alpha",
    totalCorrect: 3,
    totalQuestions: 3,
    details: [
      {
        questionId: 1,
        questionText: "Q1",
        questionType: "choice",
        options: ["A", "B"],
        teamAnswer: "A",
        teamAnswerText: "A text",
        correctAnswer: "A",
        correctAnswerText: "A text",
        isCorrect: true,
        awardedScore: 1,
        weight: 1,
      },
    ],
  };

  beforeEach(() => {
    setupDefault();
    vi.mocked(quizzesApi.get).mockResolvedValue(makeQuiz({ status: "finished" }));
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "finished", currentSlide: "results", resultsRevealCount: 0 })
    );
    vi.mocked(gameApi.getResults).mockResolvedValue(RESULTS);
    vi.mocked(gameApi.getTeamDetails).mockResolvedValue(TEAM_DETAILS);
  });

  it("clicking 'Подробнее' opens team details modal", async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByText("Team Alpha");

    await user.click(screen.getByRole("button", { name: "Подробнее" }));

    await screen.findByText(/баллов из/);
    expect(vi.mocked(gameApi.getTeamDetails)).toHaveBeenCalledWith(1, 1);
    expect(screen.getByText("Q1")).toBeInTheDocument();
  });

  it("closing team details modal via ✕ removes the modal", async () => {
    const user = userEvent.setup();
    renderGame();
    await screen.findByText("Team Alpha");

    await user.click(screen.getByRole("button", { name: "Подробнее" }));
    await screen.findByText(/баллов из/);

    // Close via ✕ button (not the kick button — there's no kick here in finished state)
    await user.click(screen.getByRole("button", { name: "✕" }));

    await waitFor(() =>
      expect(screen.queryByText(/баллов из/)).not.toBeInTheDocument()
    );
  });
});

// ─── finished: next-action buttons ─────────────────────────────────────────────
describe("Game.jsx — finished: next action buttons (all results revealed)", () => {
  // 1 team, resultsRevealCount=1 → allRevealed=true
  const RESULTS = [{ teamId: 1, name: "Team Alpha", correct: 3, total: 3 }];

  beforeEach(() => {
    setupDefault();
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "finished", currentSlide: "results", resultsRevealCount: 1 })
    );
    vi.mocked(gameApi.getResults).mockResolvedValue(RESULTS);
  });

  it("shows '🙏 Показать «Спасибо»' button when quiz has thanksImageUrl", async () => {
    vi.mocked(quizzesApi.get).mockResolvedValue(
      makeQuiz({ status: "finished", thanksImageUrl: "/api/media/seed/thanks.png" })
    );
    renderGame();
    await waitFor(() =>
      expect(screen.getByText(/Показать «Спасибо»/)).toBeInTheDocument()
    );
  });

  it("shows '🎬 Показать финальный слайд' when only finalImageUrl is set", async () => {
    vi.mocked(quizzesApi.get).mockResolvedValue(
      makeQuiz({ status: "finished", finalImageUrl: "/api/media/seed/final.png" })
    );
    renderGame();
    await waitFor(() =>
      expect(screen.getByText(/финальный слайд/i)).toBeInTheDocument()
    );
  });

  it("shows '📦 Архивировать квиз' when no thanks/final images", async () => {
    vi.mocked(quizzesApi.get).mockResolvedValue(makeQuiz({ status: "finished" }));
    renderGame();
    await waitFor(() =>
      expect(screen.getByText(/Архивировать квиз/)).toBeInTheDocument()
    );
  });

  it("clicking '🙏 Спасибо' calls setSlide with 'thanks'", async () => {
    vi.mocked(quizzesApi.get).mockResolvedValue(
      makeQuiz({ status: "finished", thanksImageUrl: "/api/media/seed/thanks.png" })
    );
    const user = userEvent.setup();
    renderGame();
    await user.click(await screen.findByText(/Показать «Спасибо»/));
    expect(vi.mocked(gameApi.setSlide)).toHaveBeenCalledWith(1, { slide: "thanks" });
  });

  it("clicking '📦 Архивировать квиз' calls gameApi.archive after confirm", async () => {
    vi.mocked(quizzesApi.get).mockResolvedValue(makeQuiz({ status: "finished" }));
    vi.mocked(gameApi.archive).mockResolvedValue({});
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    const user = userEvent.setup();
    renderGame();
    await user.click(await screen.findByText(/Архивировать квиз/));

    expect(vi.mocked(gameApi.archive)).toHaveBeenCalledWith(1);
    confirmSpy.mockRestore();
  });
});

// ─── archived quiz ─────────────────────────────────────────────────────────────
describe("Game.jsx — archived quiz", () => {
  beforeEach(() => {
    setupDefault();
    vi.mocked(quizzesApi.get).mockResolvedValue(makeQuiz({ status: "archived" }));
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "finished", currentSlide: "results", resultsRevealCount: 0 })
    );
    vi.mocked(gameApi.getResults).mockResolvedValue([
      { teamId: 1, name: "Team Alpha", correct: 3, total: 3 },
    ]);
  });

  it("shows 'архивирован' in title and results table", async () => {
    renderGame();
    await waitFor(() =>
      expect(screen.getByText(/архивирован/)).toBeInTheDocument()
    );
    expect(screen.getByText("Team Alpha")).toBeInTheDocument();
  });
});

// ─── error state ───────────────────────────────────────────────────────────────
describe("Game.jsx — error state", () => {
  it("shows error message and back link when API throws", async () => {
    vi.mocked(quizzesApi.get).mockRejectedValue(new Error("Сервер недоступен"));
    renderGame();
    await waitFor(() =>
      expect(screen.getByText("Сервер недоступен")).toBeInTheDocument()
    );
    expect(screen.getByText(/К списку квизов/)).toBeInTheDocument();
  });
});

// ─── WebSocket events (additional) ─────────────────────────────────────────────
describe("Game.jsx — WebSocket events (additional)", () => {
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

  it("'registration_opened' event calls getState", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(gameApi.getState).mock.calls.length;
    sendWsMessage({ event: "registration_opened", data: { quizId: 1 } });

    await waitFor(() =>
      expect(vi.mocked(gameApi.getState).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("'slide_changed' event calls getState", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(gameApi.getState).mock.calls.length;
    sendWsMessage({ event: "slide_changed", data: { quizId: 1, slide: "question" } });

    await waitFor(() =>
      expect(vi.mocked(gameApi.getState).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("'slide_changed' with slide=timer also refreshes answers", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(answersApi.list).mock.calls.length;
    sendWsMessage({ event: "slide_changed", data: { quizId: 1, slide: "timer" } });

    await waitFor(() =>
      expect(vi.mocked(answersApi.list).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("'answer_scored' event refreshes answers", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(answersApi.list).mock.calls.length;
    sendWsMessage({ event: "answer_scored", data: { quizId: 1 } });

    await waitFor(() =>
      expect(vi.mocked(answersApi.list).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("'team_registered' event refreshes teams", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(teamsApi.list).mock.calls.length;
    sendWsMessage({ event: "team_registered", data: { quizId: 1 } });

    await waitFor(() =>
      expect(vi.mocked(teamsApi.list).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("'team_kicked' event refreshes teams", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(teamsApi.list).mock.calls.length;
    sendWsMessage({ event: "team_kicked", data: { quizId: 1 } });

    await waitFor(() =>
      expect(vi.mocked(teamsApi.list).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("'quiz_finished' event triggers full reload via quizzesApi.get", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    const callsBefore = vi.mocked(quizzesApi.get).mock.calls.length;
    sendWsMessage({ event: "quiz_finished", data: { quizId: 1 } });

    await waitFor(() =>
      expect(vi.mocked(quizzesApi.get).mock.calls.length).toBeGreaterThan(callsBefore)
    );
  });

  it("'results_revealed' event updates state without error", async () => {
    renderGame();
    await screen.findByText(QUESTION.text);

    sendWsMessage({
      event: "results_revealed",
      data: { quizId: 1, results: [{ teamId: 1 }], resultsRevealCount: 2 },
    });

    // Component remains stable
    await waitFor(() =>
      expect(screen.getByText(QUESTION.text)).toBeInTheDocument()
    );
  });
});
