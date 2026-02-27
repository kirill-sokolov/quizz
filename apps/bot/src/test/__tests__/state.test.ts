import { describe, test, expect, beforeEach } from "vitest";
import {
  getState,
  setState,
  deleteState,
  clearAllState,
  getAllRegistered,
  getRegisteredByTeamId,
} from "../../state.js";

describe("state", () => {
  beforeEach(() => clearAllState());

  test("getState returns idle for unknown chatId", () => {
    expect(getState(999)).toEqual({ step: "idle" });
  });

  test("setState + getState roundtrip", () => {
    setState(1, { step: "awaiting_name", quizId: 42 });
    expect(getState(1)).toEqual({ step: "awaiting_name", quizId: 42 });
  });

  test("setState overwrites existing state", () => {
    setState(1, { step: "awaiting_name", quizId: 1 });
    setState(1, { step: "registered", quizId: 1, teamId: 5 });
    expect(getState(1)).toEqual({ step: "registered", quizId: 1, teamId: 5 });
  });

  test("deleteState removes entry, getState returns idle", () => {
    setState(1, { step: "awaiting_name", quizId: 1 });
    deleteState(1);
    expect(getState(1)).toEqual({ step: "idle" });
  });

  test("deleteState on unknown chatId is safe", () => {
    expect(() => deleteState(999)).not.toThrow();
  });

  test("clearAllState empties all users", () => {
    setState(1, { step: "awaiting_name", quizId: 1 });
    setState(2, { step: "registered", quizId: 1, teamId: 1 });
    clearAllState();
    expect(getState(1)).toEqual({ step: "idle" });
    expect(getState(2)).toEqual({ step: "idle" });
  });

  describe("getAllRegistered", () => {
    test("returns registered and awaiting_answer users only", () => {
      setState(1, { step: "registered", quizId: 10, teamId: 100 });
      setState(2, { step: "awaiting_answer", quizId: 10, teamId: 200, questionId: 5 });
      setState(3, { step: "awaiting_name", quizId: 10 });
      setState(4, { step: "idle" });

      const result = getAllRegistered();
      expect(result).toHaveLength(2);
      expect(result).toContainEqual({ chatId: 1, teamId: 100, quizId: 10 });
      expect(result).toContainEqual({ chatId: 2, teamId: 200, quizId: 10 });
    });

    test("returns empty array when no registered users", () => {
      expect(getAllRegistered()).toEqual([]);
    });

    test("includes users from different quizzes", () => {
      setState(1, { step: "registered", quizId: 1, teamId: 10 });
      setState(2, { step: "registered", quizId: 2, teamId: 20 });
      expect(getAllRegistered()).toHaveLength(2);
    });
  });

  describe("getRegisteredByTeamId", () => {
    test("finds chatId for registered user", () => {
      setState(42, { step: "registered", quizId: 1, teamId: 77 });
      expect(getRegisteredByTeamId(77)).toBe(42);
    });

    test("finds chatId for awaiting_answer user", () => {
      setState(55, { step: "awaiting_answer", quizId: 1, teamId: 88, questionId: 5 });
      expect(getRegisteredByTeamId(88)).toBe(55);
    });

    test("returns undefined for unknown teamId", () => {
      expect(getRegisteredByTeamId(999)).toBeUndefined();
    });

    test("does not find idle or awaiting_name users", () => {
      setState(1, { step: "idle" });
      setState(2, { step: "awaiting_name", quizId: 1 });
      expect(getRegisteredByTeamId(1)).toBeUndefined();
      expect(getRegisteredByTeamId(2)).toBeUndefined();
    });
  });
});
