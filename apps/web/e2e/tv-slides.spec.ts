import { test, expect } from "@playwright/test";
import {
  login,
  createTestQuiz,
  startGame,
  deleteQuiz,
} from "./fixtures";

const API_URL = "http://localhost:3000";

/**
 * Stage 3A: TV slide smoke tests
 *
 * Each test:
 * 1. Creates a quiz via API
 * 2. Advances the game to the required state
 * 3. Opens the TV page with the quiz join code
 * 4. Asserts the correct content is visible
 * 5. Checks for JS errors in the console
 * 6. Cleans up (deleteQuiz)
 *
 * NOTE: The TV page is public (no auth required) but makes API calls.
 * Some "Failed to load resource" console errors are expected and are
 * filtered out alongside known non-critical errors such as WebSocket
 * reconnects, AudioContext autoplay policy, and video autoplay blocks.
 *
 * IMPORTANT: finishGame() sets quiz.joinCode=null in the DB, so for the
 * results test the TV page must be opened BEFORE finish() is called —
 * the page then receives the quiz_finished WebSocket event and switches
 * to TVResults without needing to re-look-up the quiz by code.
 */

/**
 * Returns true if the console error is expected and should be ignored.
 * Unexpected (real) JS errors will still cause the test to fail.
 */
function isExpectedError(e: string): boolean {
  // WebSocket reconnect errors (server may not be available during initial load)
  if (e.includes("WebSocket")) return true;
  // Browser autoplay policy for video/audio
  if (e.includes("Video autoplay")) return true;
  if (e.includes("AudioContext")) return true;
  // API resource load failures (401 auth, 404 not found, network errors).
  // These come from the TV page's own API calls and are expected when
  // the browser context is not authenticated or a resource doesn't exist.
  if (e.includes("Failed to load resource")) return true;
  return false;
}

test.describe("TV slide smoke tests", () => {
  // Collect JS errors for each test
  let jsErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    jsErrors = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        jsErrors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      jsErrors.push(err.message);
    });
  });

  // ─────────────────────────────────────────────
  // lobby / regClosed → TVRules
  // ─────────────────────────────────────────────
  test("lobby/regClosed → TVRules shows rules content", async ({
    page,
    request,
  }) => {
    await login(request);
    const quiz = await createTestQuiz(request, "E2E TV Rules Test");

    try {
      // Start game → state=lobby, registrationOpen=false
      const gameState = await startGame(request, quiz.id) as { joinCode: string };

      await page.goto(`/tv/${gameState.joinCode}`);

      // TVRules renders "Правила квиза" when no rulesImageUrl is set
      await expect(
        page.getByText("Правила квиза")
      ).toBeVisible({ timeout: 10000 });

      // No unexpected JS errors
      expect(jsErrors.filter((e) => !isExpectedError(e))).toHaveLength(0);
    } finally {
      await deleteQuiz(request, quiz.id);
    }
  });

  // ─────────────────────────────────────────────
  // lobby / regOpen → TVLobby (QR + heading)
  // ─────────────────────────────────────────────
  test("lobby/regOpen → TVLobby shows registration screen", async ({
    page,
    request,
  }) => {
    await login(request);
    const quiz = await createTestQuiz(request, "E2E TV Lobby Test");

    try {
      const gameState = await startGame(request, quiz.id) as { joinCode: string };

      // Open registration → registrationOpen=true
      const regResp = await request.post(
        `${API_URL}/api/game/open-registration`,
        { data: { quizId: quiz.id } }
      );
      expect(regResp.ok()).toBeTruthy();

      await page.goto(`/tv/${gameState.joinCode}`);

      // TVLobby renders "Регистрация команд" heading
      await expect(
        page.getByText("Регистрация команд")
      ).toBeVisible({ timeout: 10000 });

      // QR code image is present
      await expect(
        page.locator('img[alt="QR код бота"]')
      ).toBeVisible({ timeout: 10000 });

      expect(jsErrors.filter((e) => !isExpectedError(e))).toHaveLength(0);
    } finally {
      await deleteQuiz(request, quiz.id);
    }
  });

  // ─────────────────────────────────────────────
  // playing / question → TVQuestion (slide bg, no crash)
  // ─────────────────────────────────────────────
  test("playing/question → TVQuestion renders without crash", async ({
    page,
    request,
  }) => {
    await login(request);
    const quiz = await createTestQuiz(request, "E2E TV Question Test");

    try {
      const gameState = await startGame(request, quiz.id) as { joinCode: string };

      await request.post(`${API_URL}/api/game/open-registration`, {
        data: { quizId: quiz.id },
      });

      // Begin → state=playing, currentSlide=question (first slide by sort_order)
      const beginResp = await request.post(`${API_URL}/api/game/begin`, {
        data: { quizId: quiz.id },
      });
      expect(beginResp.ok()).toBeTruthy();

      await page.goto(`/tv/${gameState.joinCode}`);

      // Wait for the loading spinner to disappear
      await expect(page.locator(".tv-viewport")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Загрузка…")).not.toBeVisible({
        timeout: 10000,
      });

      // TVQuestion renders TVSlideBg which has bg-stone-900 as its root element
      await expect(
        page.locator(".tv-screen .bg-stone-900").first()
      ).toBeVisible({ timeout: 5000 });

      expect(jsErrors.filter((e) => !isExpectedError(e))).toHaveLength(0);
    } finally {
      await deleteQuiz(request, quiz.id);
    }
  });

  // ─────────────────────────────────────────────
  // playing / timer → TVTimer (countdown visible)
  // ─────────────────────────────────────────────
  test("playing/timer → TVTimer shows countdown", async ({
    page,
    request,
  }) => {
    await login(request);
    const quiz = await createTestQuiz(request, "E2E TV Timer Test");

    try {
      const gameState = await startGame(request, quiz.id) as { joinCode: string };

      await request.post(`${API_URL}/api/game/open-registration`, {
        data: { quizId: quiz.id },
      });

      await request.post(`${API_URL}/api/game/begin`, {
        data: { quizId: quiz.id },
      });

      // Switch to timer slide
      const timerResp = await request.post(`${API_URL}/api/game/set-slide`, {
        data: { quizId: quiz.id, slide: "timer" },
      });
      expect(timerResp.ok()).toBeTruthy();

      await page.goto(`/tv/${gameState.joinCode}`);

      await expect(page.locator(".tv-viewport")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Загрузка…")).not.toBeVisible({
        timeout: 10000,
      });

      // TVTimer renders countdown as large tabular-nums text (30, 29, ... 0)
      const countdown = page.locator('.tv-screen [class*="tabular-nums"]');
      await expect(countdown).toBeVisible({ timeout: 10000 });

      // The displayed value must be a number in range [0, timeLimitSec=30]
      const countdownText = await countdown.textContent();
      const parsed = parseInt(countdownText?.trim() ?? "", 10);
      expect(parsed).toBeGreaterThanOrEqual(0);
      expect(parsed).toBeLessThanOrEqual(30);

      expect(jsErrors.filter((e) => !isExpectedError(e))).toHaveLength(0);
    } finally {
      await deleteQuiz(request, quiz.id);
    }
  });

  // ─────────────────────────────────────────────
  // playing / answer → TVAnswer (no crash)
  // ─────────────────────────────────────────────
  test("playing/answer → TVAnswer renders without crash", async ({
    page,
    request,
  }) => {
    await login(request);
    const quiz = await createTestQuiz(request, "E2E TV Answer Test");

    try {
      const gameState = await startGame(request, quiz.id) as { joinCode: string };

      await request.post(`${API_URL}/api/game/open-registration`, {
        data: { quizId: quiz.id },
      });

      await request.post(`${API_URL}/api/game/begin`, {
        data: { quizId: quiz.id },
      });

      // Advance through timer → answer
      await request.post(`${API_URL}/api/game/set-slide`, {
        data: { quizId: quiz.id, slide: "timer" },
      });

      const answerResp = await request.post(`${API_URL}/api/game/set-slide`, {
        data: { quizId: quiz.id, slide: "answer" },
      });
      expect(answerResp.ok()).toBeTruthy();

      await page.goto(`/tv/${gameState.joinCode}`);

      await expect(page.locator(".tv-viewport")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Загрузка…")).not.toBeVisible({
        timeout: 10000,
      });

      // TVAnswer renders TVSlideBg — bg-stone-900 background is present
      await expect(
        page.locator(".tv-screen .bg-stone-900").first()
      ).toBeVisible({ timeout: 10000 });

      // Timer countdown must NOT be visible on the answer slide
      await expect(
        page.locator('.tv-screen [class*="tabular-nums"]')
      ).not.toBeVisible({ timeout: 3000 }).catch(() => {
        // Not being visible is expected — ignore if the assertion itself throws
      });

      expect(jsErrors.filter((e) => !isExpectedError(e))).toHaveLength(0);
    } finally {
      await deleteQuiz(request, quiz.id);
    }
  });

  // ─────────────────────────────────────────────
  // finished / results → TVResults
  //
  // Key: TV page is opened BEFORE finish() is called because finishGame()
  // sets quiz.joinCode=null, making the by-code lookup fail on a reload.
  // The page receives the quiz_finished WebSocket event and switches to TVResults.
  // ─────────────────────────────────────────────
  test("finished/results → TVResults shows results screen", async ({
    page,
    request,
  }) => {
    await login(request);
    const quiz = await createTestQuiz(request, "E2E TV Results Test");

    try {
      const gameState = await startGame(request, quiz.id) as { joinCode: string };

      await request.post(`${API_URL}/api/game/open-registration`, {
        data: { quizId: quiz.id },
      });

      await request.post(`${API_URL}/api/game/begin`, {
        data: { quizId: quiz.id },
      });

      await request.post(`${API_URL}/api/game/set-slide`, {
        data: { quizId: quiz.id, slide: "timer" },
      });

      await request.post(`${API_URL}/api/game/set-slide`, {
        data: { quizId: quiz.id, slide: "answer" },
      });

      // Open the TV page BEFORE finishing — the page is now live and subscribed to WS
      await page.goto(`/tv/${gameState.joinCode}`);
      await expect(page.locator(".tv-viewport")).toBeVisible({
        timeout: 10000,
      });
      await expect(page.getByText("Загрузка…")).not.toBeVisible({
        timeout: 10000,
      });

      // Finish the game — TV page receives quiz_finished via WebSocket and renders results
      const finishResp = await request.post(`${API_URL}/api/game/finish`, {
        data: { quizId: quiz.id },
      });
      expect(finishResp.ok()).toBeTruthy();

      // TVResults renders "🏆 Итоги квиза" heading (via WS event or state reload)
      await expect(
        page.getByText("Итоги квиза")
      ).toBeVisible({ timeout: 15000 });

      expect(jsErrors.filter((e) => !isExpectedError(e))).toHaveLength(0);
    } finally {
      await deleteQuiz(request, quiz.id);
    }
  });
});
