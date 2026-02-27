/**
 * Characterization tests for TVQuestion.
 *
 * TVQuestion is a background-only slide: it picks the slide with type="question"
 * from the slides array and delegates rendering to TVSlideBg (image + optional
 * video). It does NOT render question.text or answer options — those belong to
 * TVTimer / TVAnswer slides.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TVQuestion from "../../components/TV/TVQuestion";
import { makeQuestion } from "../utils";

// TVSlideBg calls getMediaUrl() to build absolute URLs.
vi.mock("../../api/client", () => ({
  getMediaUrl: (path) => (path ? `http://mock/${path}` : ""),
}));

// ─── slide fixtures ────────────────────────────────────────────────────────────

const SLIDE = {
  bare:      { id: 10, type: "question", sortOrder: 1, imageUrl: null,    videoUrl: null    },
  withImage: { id: 10, type: "question", sortOrder: 1, imageUrl: "q.jpg", videoUrl: null    },
  withVideo: { id: 10, type: "question", sortOrder: 1, imageUrl: null,    videoUrl: "q.mp4" },
  timer:     { id: 11, type: "timer",    sortOrder: 2, imageUrl: null,    videoUrl: null    },
  answer:    { id: 12, type: "answer",   sortOrder: 3, imageUrl: null,    videoUrl: null    },
};

// ─── helper ───────────────────────────────────────────────────────────────────

function renderTVQuestion(question = makeQuestion(), slidesOverride) {
  const slides = slidesOverride !== undefined ? slidesOverride : question.slides;
  return render(
    <TVQuestion
      question={question}
      currentIndex={0}
      totalQuestions={3}
      slides={slides}
    />
  );
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("TVQuestion", () => {
  // ── crash safety ────────────────────────────────────────────────────────────

  it("renders without crash with default props", () => {
    expect(() => renderTVQuestion()).not.toThrow();
  });

  it("renders without crash when slides is null", () => {
    expect(() => renderTVQuestion(makeQuestion(), null)).not.toThrow();
  });

  it("renders without crash when slides is an empty array", () => {
    expect(() => renderTVQuestion(makeQuestion(), [])).not.toThrow();
  });

  it("renders without crash when slides contains no 'question' type", () => {
    expect(() =>
      renderTVQuestion(makeQuestion(), [SLIDE.timer, SLIDE.answer])
    ).not.toThrow();
  });

  // ── content: this component is background-only ──────────────────────────────

  it("does NOT display question.text (background-only slide)", () => {
    const q = makeQuestion({ text: "Столица Франции?" });
    renderTVQuestion(q, [SLIDE.bare]);
    expect(screen.queryByText("Столица Франции?")).not.toBeInTheDocument();
  });

  it("does NOT display answer options for choice questions", () => {
    const q = makeQuestion({
      questionType: "choice",
      options: ["Берлин", "Париж", "Рим", "Мадрид"],
    });
    renderTVQuestion(q, [SLIDE.bare]);
    for (const opt of ["Берлин", "Париж", "Рим", "Мадрид"]) {
      expect(screen.queryByText(opt)).not.toBeInTheDocument();
    }
  });

  it("does NOT display answer options for text questions", () => {
    const q = makeQuestion({
      questionType: "text",
      options: ["Вариант А", "Вариант Б"],
    });
    renderTVQuestion(q, [SLIDE.bare]);
    expect(screen.queryByText("Вариант А")).not.toBeInTheDocument();
    expect(screen.queryByText("Вариант Б")).not.toBeInTheDocument();
  });

  // ── image ───────────────────────────────────────────────────────────────────

  it("renders img when the 'question' slide has imageUrl", () => {
    // alt="" makes the role "presentation" per ARIA spec — use querySelector
    const { container } = renderTVQuestion(makeQuestion(), [SLIDE.withImage]);
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "http://mock/q.jpg");
  });

  it("does NOT render img when the 'question' slide has no imageUrl", () => {
    const { container } = renderTVQuestion(makeQuestion(), [SLIDE.bare]);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("ignores imageUrl on non-'question' slides", () => {
    const timerWithImage = { ...SLIDE.timer, imageUrl: "timer.jpg" };
    const { container } = renderTVQuestion(makeQuestion(), [timerWithImage, SLIDE.answer]);
    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  // ── video ───────────────────────────────────────────────────────────────────

  it("renders video element when the 'question' slide has videoUrl", () => {
    const { container } = renderTVQuestion(makeQuestion(), [SLIDE.withVideo]);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "http://mock/q.mp4");
  });

  it("does NOT render video when the 'question' slide has no videoUrl", () => {
    const { container } = renderTVQuestion(makeQuestion(), [SLIDE.bare]);
    expect(container.querySelector("video")).not.toBeInTheDocument();
  });

  // ── slide selection ─────────────────────────────────────────────────────────

  it("picks the first 'question' slide when multiple exist", () => {
    const first  = { id: 1, type: "question", imageUrl: "first.jpg",  videoUrl: null };
    const second = { id: 2, type: "question", imageUrl: "second.jpg", videoUrl: null };
    const { container } = renderTVQuestion(makeQuestion(), [first, second]);
    expect(container.querySelector("img")).toHaveAttribute("src", "http://mock/first.jpg");
  });
});
