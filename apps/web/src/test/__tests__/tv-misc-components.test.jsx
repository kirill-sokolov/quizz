/**
 * Stage 1E — TVAnswer + TVDemo + TVExtraSlide smoke / characterization tests.
 *
 * All three components consume `getMediaUrl` from `../../api/client`.
 * We mock that module so the tests don't depend on Vite env vars.
 */

import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// ── mock api/client before any component import ───────────────────────────────
vi.mock("../../api/client", () => ({
  getMediaUrl: (path) => (path ? `/media/${path}` : ""),
}));

import TVAnswer from "../../components/TV/TVAnswer";
import TVDemo from "../../components/TV/TVDemo";
import TVExtraSlide from "../../components/TV/TVExtraSlide";

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Minimal slides array with one answer slide */
function makeSlides({ imageUrl = null, videoUrl = null } = {}) {
  return [
    { id: 10, type: "question", sortOrder: 1, imageUrl: null, videoUrl: null },
    { id: 11, type: "timer",    sortOrder: 2, imageUrl: null, videoUrl: null },
    { id: 12, type: "answer",   sortOrder: 3, imageUrl, videoUrl },
  ];
}

// ─── TVAnswer ─────────────────────────────────────────────────────────────────

describe("TVAnswer", () => {
  it("renders without crash when slides is empty", () => {
    render(<TVAnswer slides={[]} question={null} currentIndex={0} totalQuestions={1} />);
    // No img expected — just no exception
  });

  it("renders without crash when there is no answer slide", () => {
    const slides = [
      { id: 1, type: "question", imageUrl: null, videoUrl: null },
    ];
    render(<TVAnswer slides={slides} question={null} currentIndex={0} totalQuestions={1} />);
  });

  it("renders img when the answer slide has an imageUrl", () => {
    const slides = makeSlides({ imageUrl: "answer-bg.jpg" });
    const { container } = render(<TVAnswer slides={slides} question={null} currentIndex={0} totalQuestions={1} />);
    // TVSlideBg uses alt="" (decorative), so role is "presentation" — use querySelector
    const img = container.querySelector("img");
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("answer-bg.jpg");
  });

  it("renders without crash when answer slide has no imageUrl", () => {
    const slides = makeSlides({ imageUrl: null });
    render(<TVAnswer slides={slides} question={null} currentIndex={0} totalQuestions={1} />);
    // Should still mount — TVSlideBg shows a fallback dark div
    expect(document.querySelector(".bg-stone-900, .bg-stone-800")).toBeTruthy();
  });

  it("renders video when the answer slide has a videoUrl", () => {
    const slides = makeSlides({ videoUrl: "answer-video.mp4" });
    render(<TVAnswer slides={slides} question={null} currentIndex={0} totalQuestions={1} />);
    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video.src).toContain("answer-video.mp4");
  });
});

// ─── TVDemo ───────────────────────────────────────────────────────────────────

describe("TVDemo", () => {
  it("renders without crash when imageUrl is not provided", () => {
    render(<TVDemo />);
    // Should display fallback text, not an empty/blank screen
    expect(screen.getByText("Загрузка...")).toBeInTheDocument();
  });

  it("renders without crash when imageUrl is null", () => {
    render(<TVDemo imageUrl={null} />);
    expect(screen.getByText("Загрузка...")).toBeInTheDocument();
  });

  it("renders img element when imageUrl is provided", () => {
    render(<TVDemo imageUrl="thanks-slide.jpg" />);
    const img = screen.getByAltText("Demo");
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("thanks-slide.jpg");
  });

  it("does not render img when imageUrl is absent", () => {
    render(<TVDemo />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});

// ─── TVExtraSlide ─────────────────────────────────────────────────────────────

describe("TVExtraSlide", () => {
  it("returns null when slide prop is not provided", () => {
    const { container } = render(<TVExtraSlide slide={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders img element when slide has imageUrl", () => {
    const slide = { id: 20, type: "extra", imageUrl: "extra-img.png", videoUrl: null };
    render(<TVExtraSlide slide={slide} />);
    const img = screen.getByAltText("Extra");
    expect(img).toBeInTheDocument();
    expect(img.src).toContain("extra-img.png");
  });

  it("renders video element when slide has videoUrl", () => {
    const slide = { id: 21, type: "extra", imageUrl: null, videoUrl: "extra-video.mp4" };
    render(<TVExtraSlide slide={slide} />);
    const video = document.querySelector("video");
    expect(video).toBeTruthy();
    expect(video.src).toContain("extra-video.mp4");
  });

  it("renders both img and video when slide has both imageUrl and videoUrl", () => {
    const slide = { id: 22, type: "extra", imageUrl: "bg.jpg", videoUrl: "vid.mp4" };
    render(<TVExtraSlide slide={slide} />);
    expect(screen.getByAltText("Extra")).toBeInTheDocument();
    expect(document.querySelector("video")).toBeTruthy();
  });

  it("shows fallback text when slide has neither imageUrl nor videoUrl", () => {
    const slide = { id: 23, type: "extra", imageUrl: null, videoUrl: null };
    render(<TVExtraSlide slide={slide} />);
    expect(screen.getByText("Экстра-слайд")).toBeInTheDocument();
  });

  it("does not crash when slide is undefined", () => {
    const { container } = render(<TVExtraSlide />);
    expect(container).toBeEmptyDOMElement();
  });
});
