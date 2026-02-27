/**
 * Step 5 — Unit tests for pure business logic functions.
 *
 * Tests pure functions that have no side-effects and no DB dependencies:
 *   - generateJoinCode   (game-service)
 *   - parseEvalResponse  (evaluate-text-answer)
 *
 * Score calculation and results ordering are tested via integration in game.test.ts.
 */
import { describe, it, expect } from "vitest";
import { generateJoinCode } from "../../services/game-service.js";
import { parseEvalResponse } from "../../services/llm/evaluate-text-answer.js";

// ─── generateJoinCode ─────────────────────────────────────────────────────────

describe("generateJoinCode", () => {
  const VALID_CHARS = new Set("ABCDEFGHJKLMNPQRSTUVWXYZ23456789");

  it("returns a 6-character string", () => {
    expect(generateJoinCode()).toHaveLength(6);
  });

  it("uses only characters from the safe alphabet (no I, O, 0, 1)", () => {
    for (let i = 0; i < 100; i++) {
      const code = generateJoinCode();
      for (const ch of code) {
        expect(VALID_CHARS.has(ch)).toBe(true);
      }
    }
  });

  it("never contains confusable characters I, O, 0, or 1", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateJoinCode();
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it("produces different codes across calls (probabilistic)", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateJoinCode()));
    // With a 32-char alphabet and 6 positions there are 32^6 = ~10^9 possibilities;
    // 20 calls should yield at least 15 unique codes with overwhelming probability.
    expect(codes.size).toBeGreaterThanOrEqual(15);
  });

  it("returns uppercase only", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).toBe(code.toUpperCase());
    }
  });
});

// ─── parseEvalResponse ────────────────────────────────────────────────────────

describe("parseEvalResponse", () => {
  it("parses a clean JSON string", () => {
    const raw = JSON.stringify({ results: [{ teamId: 1, matched: 2 }] });
    const parsed = parseEvalResponse(raw);
    expect(parsed.results).toEqual([{ teamId: 1, matched: 2 }]);
  });

  it("strips markdown code fences before parsing", () => {
    const raw = "```json\n{\"results\":[{\"teamId\":42,\"matched\":1}]}\n```";
    const parsed = parseEvalResponse(raw);
    expect(parsed.results[0]).toEqual({ teamId: 42, matched: 1 });
  });

  it("strips triple-backtick fences without 'json' label", () => {
    const raw = "```\n{\"results\":[]}\n```";
    const parsed = parseEvalResponse(raw);
    expect(parsed.results).toEqual([]);
  });

  it("handles multiple teams in results", () => {
    const raw = JSON.stringify({
      results: [
        { teamId: 10, matched: 2 },
        { teamId: 20, matched: 0 },
        { teamId: 30, matched: 1 },
      ],
    });
    const parsed = parseEvalResponse(raw);
    expect(parsed.results).toHaveLength(3);
    expect(parsed.results[1]).toEqual({ teamId: 20, matched: 0 });
  });

  it("throws on malformed JSON", () => {
    expect(() => parseEvalResponse("not json at all")).toThrow();
  });

  it("handles leading/trailing whitespace", () => {
    const raw = "   { \"results\": [] }   ";
    expect(() => parseEvalResponse(raw)).not.toThrow();
    expect(parseEvalResponse(raw).results).toEqual([]);
  });
});
