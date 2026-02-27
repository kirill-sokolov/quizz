import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import TVResults from "../../components/TV/TVResults";

/**
 * Build a results array with `n` teams.
 * Scores decrease with rank (1st place has the highest correct count).
 */
function makeResults(n) {
  return Array.from({ length: n }, (_, i) => ({
    teamId: i + 1,
    name: `Team ${i + 1}`,
    correct: n - i,
    total: n,
    awardedScore: (n - i) * 10,
  }));
}

// ─── Smoke ─────────────────────────────────────────────────────────────────────

describe("TVResults — smoke", () => {
  it("renders without crashing with empty results", () => {
    render(<TVResults results={[]} revealCount={0} />);
  });

  it("renders without crashing with a single team", () => {
    render(<TVResults results={makeResults(1)} />);
  });

  it("renders without crashing with 8 teams (compact boundary)", () => {
    render(<TVResults results={makeResults(8)} />);
  });

  it("renders without crashing with 9 teams (podium boundary)", () => {
    render(<TVResults results={makeResults(9)} />);
  });

  it("renders without crashing with 21 teams (max podium case)", () => {
    render(<TVResults results={makeResults(21)} />);
  });

  it("shows the quiz title", () => {
    render(<TVResults results={makeResults(3)} revealCount={3} />);
    expect(screen.getByText(/Итоги квиза/i)).toBeInTheDocument();
  });
});

// ─── Reveal logic ──────────────────────────────────────────────────────────────

describe("TVResults — reveal logic", () => {
  /*
   * getRevealOrder(n) returns [1, 2, ..., n-1, 0].
   * 1st place (index 0) is always revealed LAST.
   * revealCount=k → first k items from revealOrder are visible.
   */

  it("revealCount=0: no team names visible", () => {
    const results = makeResults(5);
    render(<TVResults results={results} revealCount={0} />);
    results.forEach((r) => {
      expect(screen.queryByText(r.name)).not.toBeInTheDocument();
    });
  });

  it("revealCount=0: first-place placeholder is present in DOM", () => {
    render(<TVResults results={makeResults(5)} revealCount={0} />);
    // Placeholder renders "• • •" instead of the actual team name
    expect(screen.getByText("• • •")).toBeInTheDocument();
  });

  it("revealCount=2 of 5: reveals 2nd and 3rd places first", () => {
    // revealOrder = [1, 2, 3, 4, 0] → first 2 = indices 1 and 2
    const results = makeResults(5);
    render(<TVResults results={results} revealCount={2} />);

    // 2nd place (index 1) — visible
    expect(screen.getByText(results[1].name)).toBeInTheDocument();
    // 3rd place (index 2) — visible
    expect(screen.getByText(results[2].name)).toBeInTheDocument();

    // 1st place (index 0) — NOT visible yet (placeholder instead)
    expect(screen.queryByText(results[0].name)).not.toBeInTheDocument();
    // 4th place (index 3) — hidden
    expect(screen.queryByText(results[3].name)).not.toBeInTheDocument();
    // 5th place (index 4) — hidden
    expect(screen.queryByText(results[4].name)).not.toBeInTheDocument();
  });

  it("1st place is the very last to be revealed", () => {
    const results = makeResults(5);
    const { rerender } = render(<TVResults results={results} revealCount={4} />);
    // After 4 reveals: indices 1, 2, 3, 4 are visible; index 0 is still hidden
    expect(screen.queryByText(results[0].name)).not.toBeInTheDocument();
    expect(screen.getByText("• • •")).toBeInTheDocument();

    // After 5th reveal: index 0 finally appears
    rerender(<TVResults results={results} revealCount={5} />);
    expect(screen.getByText(results[0].name)).toBeInTheDocument();
    expect(screen.queryByText("• • •")).not.toBeInTheDocument();
  });

  it("default revealCount (omitted) shows all teams", () => {
    const results = makeResults(4);
    // No revealCount prop → defaults to results.length (all visible)
    render(<TVResults results={results} />);
    results.forEach((r) => {
      expect(screen.getByText(r.name)).toBeInTheDocument();
    });
  });

  it("single team: revealCount=0 shows placeholder", () => {
    // getRevealOrder(1) = [0], revealCount=0 → visibleSet empty
    render(<TVResults results={makeResults(1)} revealCount={0} />);
    expect(screen.getByText("• • •")).toBeInTheDocument();
  });

  it("single team: revealCount=1 reveals that team", () => {
    const results = makeResults(1);
    render(<TVResults results={results} revealCount={1} />);
    expect(screen.getByText(results[0].name)).toBeInTheDocument();
    expect(screen.queryByText("• • •")).not.toBeInTheDocument();
  });
});

// ─── Compact layout (≤8 teams) ─────────────────────────────────────────────────

describe("TVResults — compact layout (≤8 teams)", () => {
  it("renders all 8 teams fully revealed", () => {
    const results = makeResults(8);
    render(<TVResults results={results} revealCount={8} />);
    results.forEach((r) => {
      expect(screen.getByText(r.name)).toBeInTheDocument();
    });
  });

  it("shows scores as 'correct/total правильных'", () => {
    const results = makeResults(3);
    render(<TVResults results={results} revealCount={3} />);
    // Each visible team has a score label with "правильных"
    const scoreEls = screen.getAllByText(/правильных/);
    expect(scoreEls.length).toBe(3);
  });

  it("first score contains the correct number before 'правильных'", () => {
    const results = makeResults(3);
    render(<TVResults results={results} revealCount={3} />);
    // 1st place: correct=3, total=3 → "3/3 правильных"
    // Revealed last (revealOrder=[1,2,0]), but still present with revealCount=3
    expect(screen.getByText("3/3 правильных")).toBeInTheDocument();
  });

  it("shows 🥇 🥈 🥉 for top-3 places", () => {
    const results = makeResults(5);
    render(<TVResults results={results} revealCount={5} />);
    expect(screen.getAllByText("🥇").length).toBeGreaterThan(0);
    expect(screen.getAllByText("🥈").length).toBeGreaterThan(0);
    expect(screen.getAllByText("🥉").length).toBeGreaterThan(0);
  });

  it("shows position numbers (not medals) for 4th place and beyond", () => {
    const results = makeResults(5);
    render(<TVResults results={results} revealCount={5} />);
    // index 3 → "4.", index 4 → "5."
    expect(screen.getByText("4.")).toBeInTheDocument();
    expect(screen.getByText("5.")).toBeInTheDocument();
  });

  it("placeholder has the 🥇 emoji (dashed, dimmed)", () => {
    // When 1st place is not yet revealed, the placeholder still renders 🥇
    render(<TVResults results={makeResults(3)} revealCount={0} />);
    // placeholder and "• • •" are both in DOM
    expect(screen.getByText("• • •")).toBeInTheDocument();
    // 🥇 is present (inside the placeholder span)
    expect(screen.getByText("🥇")).toBeInTheDocument();
  });
});

// ─── Podium layout (≥9 teams) ──────────────────────────────────────────────────

describe("TVResults — podium layout (≥9 teams)", () => {
  it("shows all team names with full reveal (10 teams)", () => {
    const results = makeResults(10);
    render(<TVResults results={results} revealCount={10} />);
    results.forEach((r) => {
      expect(screen.getByText(r.name)).toBeInTheDocument();
    });
  });

  it("does NOT include 'правильных' in scores (podium mode)", () => {
    render(<TVResults results={makeResults(10)} revealCount={10} />);
    expect(screen.queryByText(/правильных/)).not.toBeInTheDocument();
  });

  it("shows scores as 'correct/total' format without trailing text", () => {
    const results = makeResults(9);
    render(<TVResults results={results} revealCount={9} />);
    // 1st place: correct=9, total=9 → "9/9"
    expect(screen.getByText("9/9")).toBeInTheDocument();
  });

  it("revealCount=0 shows placeholder but no team names", () => {
    const results = makeResults(10);
    render(<TVResults results={results} revealCount={0} />);
    results.forEach((r) => {
      expect(screen.queryByText(r.name)).not.toBeInTheDocument();
    });
    expect(screen.getByText("• • •")).toBeInTheDocument();
  });

  it("1st place is still the last revealed in podium mode", () => {
    const results = makeResults(9);
    const { rerender } = render(<TVResults results={results} revealCount={8} />);
    expect(screen.queryByText(results[0].name)).not.toBeInTheDocument();

    rerender(<TVResults results={results} revealCount={9} />);
    expect(screen.getByText(results[0].name)).toBeInTheDocument();
  });

  it("renders correctly for 16+ teams (left+right columns split evenly)", () => {
    const results = makeResults(16);
    render(<TVResults results={results} revealCount={16} />);
    results.forEach((r) => {
      expect(screen.getByText(r.name)).toBeInTheDocument();
    });
  });
});
