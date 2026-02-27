/**
 * TV.jsx render path tests (Stage 1F).
 *
 * Verifies that the correct sub-component is mounted for each game state.
 * API client and WebSocket are mocked; TV sub-components are replaced with
 * data-testid stubs so tests are fast and isolated from implementation details.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import TV from "../../pages/TV";
import { quizzesApi, gameApi, questionsApi, teamsApi } from "../../api/client";
import { makeQuiz, makeState, makeQuestion } from "../utils";

// ─── API mock ─────────────────────────────────────────────────────────────────
vi.mock("../../api/client", () => ({
  quizzesApi: { get: vi.fn(), getByCode: vi.fn() },
  gameApi: { getState: vi.fn(), getResults: vi.fn() },
  questionsApi: { list: vi.fn() },
  teamsApi: { list: vi.fn() },
  getWsUrl: vi.fn(() => "ws://localhost/ws"),
  getMediaUrl: vi.fn((url) => url ?? ""),
}));

// ─── TV sub-component stubs ───────────────────────────────────────────────────
// Each renders a unique data-testid so we can assert which component is shown
// without depending on the real implementation.
vi.mock("../../components/TV/TVRules", () => ({
  default: () => <div data-testid="tv-rules" />,
}));
vi.mock("../../components/TV/TVLobby", () => ({
  default: () => <div data-testid="tv-lobby" />,
}));
vi.mock("../../components/TV/TVQuestion", () => ({
  default: () => <div data-testid="tv-question" />,
}));
vi.mock("../../components/TV/TVTimer", () => ({
  default: () => <div data-testid="tv-timer" />,
}));
vi.mock("../../components/TV/TVAnswer", () => ({
  default: () => <div data-testid="tv-answer" />,
}));
vi.mock("../../components/TV/TVExtraSlide", () => ({
  default: () => <div data-testid="tv-extra" />,
}));
vi.mock("../../components/TV/TVResults", () => ({
  default: () => <div data-testid="tv-results" />,
}));
vi.mock("../../components/TV/TVDemo", () => ({
  default: () => <div data-testid="tv-demo" />,
}));
vi.mock("../../components/TV/TVVideoWarning", () => ({
  default: () => <div data-testid="tv-video-warning" />,
}));
vi.mock("../../components/TV/TVVideoIntro", () => ({
  default: () => <div data-testid="tv-video-intro" />,
}));

// ─── WebSocket mock ───────────────────────────────────────────────────────────
// Prevents real WebSocket connections in jsdom; onclose is never fired so
// the reconnect timer in TV.jsx never fires during tests.
class MockWebSocket {
  constructor() {
    this.readyState = 1; // OPEN
  }
  send() {}
  close() {}
}
global.WebSocket = MockWebSocket;

// ─── Shared fixtures ─────────────────────────────────────────────────────────
const QUIZ = makeQuiz({ status: "active" });
const QUESTION = makeQuestion();

// ─── Render helper ────────────────────────────────────────────────────────────
function renderTV(joinCode = "TEST01") {
  return render(
    <MemoryRouter initialEntries={[`/tv/${joinCode}`]}>
      <Routes>
        <Route path="/tv/:joinCode" element={<TV />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe("TV.jsx render paths", () => {
  beforeEach(() => {
    vi.mocked(quizzesApi.getByCode).mockResolvedValue({ id: QUIZ.id });
    vi.mocked(quizzesApi.get).mockResolvedValue(QUIZ);
    vi.mocked(gameApi.getState).mockResolvedValue(null);
    vi.mocked(gameApi.getResults).mockResolvedValue([]);
    vi.mocked(questionsApi.list).mockResolvedValue([]);
    vi.mocked(teamsApi.list).mockResolvedValue([]);
  });

  it("shows loading indicator before API resolves", () => {
    // Keep the first API call pending so the loading state stays visible.
    let resolve;
    vi.mocked(quizzesApi.getByCode).mockReturnValueOnce(
      new Promise((res) => {
        resolve = res;
      })
    );
    renderTV();
    expect(screen.getByText(/загрузка/i)).toBeInTheDocument();
    // Resolve to avoid unhandled-promise warnings after the test ends.
    resolve({ id: QUIZ.id });
  });

  it("shows fallback without crash when API returns 404", async () => {
    vi.mocked(quizzesApi.getByCode).mockRejectedValue(
      Object.assign(new Error("Not Found"), { status: 404 })
    );
    renderTV();
    await waitFor(() =>
      expect(screen.queryByText(/загрузка/i)).not.toBeInTheDocument()
    );
    // Error state renders img[alt="Demo"] (hardcoded fallback image)
    expect(screen.getByRole("img", { name: /demo/i })).toBeInTheDocument();
  });

  it("renders TVRules when status=lobby, registrationOpen=false", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "lobby", registrationOpen: false })
    );
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-rules")).toBeInTheDocument()
    );
  });

  it("renders TVLobby when status=lobby, registrationOpen=true", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({ status: "lobby", registrationOpen: true })
    );
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-lobby")).toBeInTheDocument()
    );
  });

  it("renders TVQuestion when status=playing, slide=question", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "question",
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-question")).toBeInTheDocument()
    );
  });

  it("renders TVTimer when status=playing, slide=timer", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "timer",
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-timer")).toBeInTheDocument()
    );
  });

  it("renders TVAnswer when status=playing, slide=answer", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: QUESTION.id,
        currentSlide: "answer",
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([QUESTION]);
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-answer")).toBeInTheDocument()
    );
  });

  it("renders TVExtraSlide when status=playing, slide=extra", async () => {
    const extraSlide = {
      id: 99,
      type: "extra",
      sortOrder: 5,
      imageUrl: null,
      videoUrl: null,
    };
    const questionWithExtra = makeQuestion({
      slides: [...QUESTION.slides, extraSlide],
    });
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "playing",
        currentQuestionId: questionWithExtra.id,
        currentSlide: "extra",
        currentSlideId: extraSlide.id,
      })
    );
    vi.mocked(questionsApi.list).mockResolvedValue([questionWithExtra]);
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-extra")).toBeInTheDocument()
    );
  });

  it("renders TVResults when status=finished, slide=results", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "finished",
        currentSlide: "results",
        resultsRevealCount: 1,
      })
    );
    vi.mocked(gameApi.getResults).mockResolvedValue([
      { teamId: 1, name: "Team A", correct: 2, total: 3 },
    ]);
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-results")).toBeInTheDocument()
    );
  });

  it("renders TVDemo (thanks screen) when status=finished, slide=thanks", async () => {
    vi.mocked(gameApi.getState).mockResolvedValue(
      makeState({
        status: "finished",
        currentSlide: "thanks",
        resultsRevealCount: 0,
      })
    );
    vi.mocked(gameApi.getResults).mockResolvedValue([]);
    renderTV();
    await waitFor(() =>
      expect(screen.getByTestId("tv-demo")).toBeInTheDocument()
    );
  });
});
