/**
 * Characterization tests for TVTimer component.
 *
 * Tests verify current behaviour so regressions are caught during refactoring.
 * AudioContext is mocked globally in src/test/setup.ts.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import TVTimer from "../../components/TV/TVTimer";
import { makeQuestion } from "../utils";

// TVSlideBg imports getMediaUrl from api/client — stub it out
vi.mock("../api/client", () => ({
  getMediaUrl: (url) => url ?? "",
}));

const timerSlide = {
  id: 11,
  type: "timer",
  sortOrder: 3,
  imageUrl: null,
  videoUrl: null,
};

afterEach(() => {
  // Restore real timers after every test that may have called vi.useFakeTimers()
  vi.useRealTimers();
});

// ─── Basic rendering ──────────────────────────────────────────────────────────

describe("TVTimer — basic rendering", () => {
  it("renders without crash", () => {
    const question = makeQuestion({ timeLimitSec: 30 });
    render(<TVTimer question={question} startedAt={null} slides={[timerSlide]} />);
    // If we reach here without throwing, the component renders
    expect(document.body).toBeTruthy();
  });

  it("shows timeLimitSec as the initial display value when not started", () => {
    const question = makeQuestion({ timeLimitSec: 45 });
    render(<TVTimer question={question} startedAt={null} slides={[timerSlide]} />);
    expect(screen.getByText("45")).toBeInTheDocument();
  });

  it("uses 30 s as default when question.timeLimitSec is undefined", () => {
    // makeQuestion sets timeLimitSec: 30 by default
    render(
      <TVTimer question={{ id: 1 }} startedAt={null} slides={[timerSlide]} />
    );
    expect(screen.getByText("30")).toBeInTheDocument();
  });
});

// ─── Timer countdown ─────────────────────────────────────────────────────────

describe("TVTimer — countdown", () => {
  it("decreases the displayed value as time passes", async () => {
    vi.useFakeTimers();
    const startedAt = new Date().toISOString();
    const question = makeQuestion({ timeLimitSec: 10 });

    render(
      <TVTimer question={question} startedAt={startedAt} slides={[timerSlide]} />
    );

    // At T+0 the component shows the full limit
    expect(screen.getByText("10")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(3000); // 3 s elapsed
    });

    // 10 - 3 = 7 s remaining
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("shows alarm emoji (⏰) when time reaches zero", async () => {
    vi.useFakeTimers();
    const startedAt = new Date().toISOString();
    const question = makeQuestion({ timeLimitSec: 5 });

    render(
      <TVTimer question={question} startedAt={startedAt} slides={[timerSlide]} />
    );

    await act(async () => {
      vi.advanceTimersByTime(6000); // 1 s past the limit → isDone
    });

    expect(screen.getByText("⏰")).toBeInTheDocument();
  });

  it("clamps to 0 — does not go negative", async () => {
    vi.useFakeTimers();
    const startedAt = new Date().toISOString();
    const question = makeQuestion({ timeLimitSec: 3 });

    render(
      <TVTimer question={question} startedAt={startedAt} slides={[timerSlide]} />
    );

    await act(async () => {
      vi.advanceTimersByTime(30_000); // way past the limit
    });

    // isDone state — alarm emoji is shown, not a negative number
    expect(screen.getByText("⏰")).toBeInTheDocument();
  });
});

// ─── Colour changes ───────────────────────────────────────────────────────────

describe("TVTimer — colour changes based on progress", () => {
  it("starts green (progress < 0.33)", async () => {
    vi.useFakeTimers();
    const startedAt = new Date().toISOString();
    const question = makeQuestion({ timeLimitSec: 30 });

    const { container } = render(
      <TVTimer question={question} startedAt={startedAt} slides={[timerSlide]} />
    );

    await act(async () => {
      vi.advanceTimersByTime(1000); // 1 s → 29 s left → progress ≈ 0.03
    });

    expect(container.querySelector(".text-green-400")).toBeInTheDocument();
  });

  it("turns yellow at mid progress (0.33 ≤ progress < 0.66)", async () => {
    vi.useFakeTimers();
    const startedAt = new Date().toISOString();
    // timeLimitSec=30: yellow starts at 30*0.33≈10 s elapsed → 20 s left
    const question = makeQuestion({ timeLimitSec: 30 });

    const { container } = render(
      <TVTimer question={question} startedAt={startedAt} slides={[timerSlide]} />
    );

    await act(async () => {
      vi.advanceTimersByTime(11_000); // 11 s → 19 s left → progress ≈ 0.37
    });

    expect(container.querySelector(".text-yellow-400")).toBeInTheDocument();
  });

  it("turns red in the last third of time (progress ≥ 0.66)", async () => {
    vi.useFakeTimers();
    const startedAt = new Date().toISOString();
    // timeLimitSec=15: red when secondsLeft ≤ 5 → progress ≥ 0.67
    const question = makeQuestion({ timeLimitSec: 15 });

    const { container } = render(
      <TVTimer question={question} startedAt={startedAt} slides={[timerSlide]} />
    );

    await act(async () => {
      vi.advanceTimersByTime(10_000); // 10 s elapsed → 5 s left → progress ≈ 0.67
    });

    expect(container.querySelector(".text-red-500")).toBeInTheDocument();
  });
});

// ─── timerPosition → CSS classes ─────────────────────────────────────────────

describe("TVTimer — timerPosition CSS classes", () => {
  const cases = [
    { pos: "center",       classes: ["items-center", "justify-center"] },
    { pos: "top",          classes: ["items-start",  "justify-center",  "pt-16"] },
    { pos: "bottom",       classes: ["items-end",    "justify-center",  "pb-16"] },
    { pos: "left",         classes: ["items-center", "justify-start",   "pl-16"] },
    { pos: "right",        classes: ["items-center", "justify-end",     "pr-16"] },
    { pos: "top-left",     classes: ["items-start",  "justify-start",   "pt-16", "pl-16"] },
    { pos: "top-right",    classes: ["items-start",  "justify-end",     "pt-16", "pr-16"] },
    { pos: "bottom-left",  classes: ["items-end",    "justify-start",   "pb-16", "pl-16"] },
    { pos: "bottom-right", classes: ["items-end",    "justify-end",     "pb-16", "pr-16"] },
  ];

  it.each(cases)(
    'timerPosition="$pos" → correct positioning classes',
    ({ pos, classes }) => {
      const question = makeQuestion({ timerPosition: pos, timeLimitSec: 30 });
      const { container } = render(
        <TVTimer question={question} startedAt={null} slides={[timerSlide]} />
      );

      // The wrapper div rendered by TVTimer has "absolute inset-0 flex" plus position classes
      const posDiv = container.querySelector(".absolute.inset-0.flex");
      expect(posDiv).toBeInTheDocument();
      classes.forEach((cls) => expect(posDiv).toHaveClass(cls));
    }
  );

  it("unknown timerPosition falls back to center classes", () => {
    const question = makeQuestion({ timerPosition: "unknown-value", timeLimitSec: 30 });
    const { container } = render(
      <TVTimer question={question} startedAt={null} slides={[timerSlide]} />
    );

    const posDiv = container.querySelector(".absolute.inset-0.flex");
    expect(posDiv).toHaveClass("items-center", "justify-center");
  });
});
