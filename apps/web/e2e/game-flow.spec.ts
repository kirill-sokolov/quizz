/**
 * 3B: Full game flow E2E
 *
 * Two browser contexts (Admin + TV) run in parallel.
 * Admin actions trigger TV state changes via WebSocket.
 *
 * Flow:
 *   1. Admin navigates to game page (auto-starts quiz) → TV: rules
 *   2. Admin opens registration                         → TV: lobby / QR
 *   3. Admin begins quiz                                → TV: question slide
 *   4. Admin advances to timer slide                    → TV: countdown
 *   5. Admin advances to answer slide                   → TV: answer (no countdown)
 *   6. Admin finishes quiz                              → TV: results
 *   7. Admin reveals result                             → TV: 🥇 place revealed
 *
 * Prerequisites: Docker stack running (web: 5173, api: 3000)
 * Run: npm run e2e -- e2e/game-flow.spec.ts
 */
import { test, expect } from "@playwright/test";
import { login, createTestQuiz, deleteQuiz } from "./fixtures";
import type { TestQuiz } from "./fixtures";

test.describe("3B: Full game flow", () => {
  let quiz: TestQuiz;

  test.beforeAll(async ({ request }) => {
    await login(request);
    quiz = await createTestQuiz(request, "E2E 3B Game Flow");
  });

  test.afterAll(async ({ request }) => {
    if (!quiz) return;
    await login(request);
    await deleteQuiz(request, quiz.id);
  });

  test("admin controls drive TV state through full quiz flow", async ({ browser }) => {
    const adminCtx = await browser.newContext();
    const tvCtx = await browser.newContext();
    const adminPage = await adminCtx.newPage();
    const tvPage = await tvCtx.newPage();

    try {
      // ─── Admin: login via browser ────────────────────────────────────────
      await adminPage.goto("/admin/login");
      await adminPage.fill('input[type="text"]', "admin");
      await adminPage.fill('input[type="password"]', "admin");
      await adminPage.getByRole("button", { name: "Войти" }).click();
      await adminPage.waitForURL("**/admin");

      // ─── TV: open quiz page ───────────────────────────────────────────────
      await tvPage.goto(`/tv/${quiz.joinCode}`);

      // ─── Step 1: Admin navigates to game page (auto-starts quiz) ─────────
      // Game.jsx auto-calls gameApi.start() when state is null.
      await adminPage.goto(`/admin/game/${quiz.id}`);

      // TV: state=lobby, regOpen=false → TVRules
      // Test quiz has no rulesImageUrl, so the fallback text is shown.
      await expect(tvPage.getByText("Правила квиза")).toBeVisible({
        timeout: 15_000,
      });

      // ─── Step 2: Admin opens registration ────────────────────────────────
      await adminPage.getByRole("button", { name: "Открыть регистрацию" }).click();

      // TV: state=lobby, regOpen=true → TVLobby
      await expect(tvPage.getByText("Регистрация команд")).toBeVisible({
        timeout: 10_000,
      });

      // ─── Register one test bot via TestBotsPanel UI ───────────────────────
      // Set count to 1, click "Добавить". TestBotsPanel calls onUpdate() after
      // the API response, which triggers load() and refreshes the team list.
      // The bot auto-answers timer slides after ~1 second.
      await adminPage.locator('input[type="number"]').fill("1");
      await adminPage.getByRole("button", { name: "Добавить" }).click();

      // After onUpdate() → load() → teamsApi.list returns [bot] →
      // activeTeams.length = 1 → "Начать квиз" becomes enabled
      await expect(
        adminPage.getByRole("button", { name: "Начать квиз" })
      ).toBeEnabled({ timeout: 10_000 });

      // ─── Step 3: Admin begins quiz ────────────────────────────────────────
      await adminPage.getByRole("button", { name: "Начать квиз" }).click();

      // TV: question slide — TVLobby disappears
      await expect(tvPage.getByText("Регистрация команд")).toBeHidden({
        timeout: 10_000,
      });

      // Admin: slide badge shows "Вопрос"
      await expect(
        adminPage.getByText("Вопрос", { exact: true })
      ).toBeVisible({ timeout: 10_000 });

      // ─── Step 4: Admin advances to timer slide ────────────────────────────
      await adminPage.getByRole("button", { name: "▶" }).click();

      // TV: TVTimer renders large countdown number
      await expect(tvPage.locator("[class*='180px']").first()).toBeVisible({
        timeout: 10_000,
      });

      // Bot auto-answers within ~1 second → answer_submitted WS event →
      // allTeamsSubmitted = true → ▶ re-enables on timer slide
      await expect(
        adminPage.getByRole("button", { name: "▶" })
      ).toBeEnabled({ timeout: 10_000 });

      // ─── Step 5: Admin advances to answer slide ───────────────────────────
      await adminPage.getByRole("button", { name: "▶" }).click();

      // TV: countdown disappears (TVAnswer is a background slide)
      await expect(tvPage.locator("[class*='180px']").first()).toBeHidden({
        timeout: 10_000,
      });

      // Admin: slide badge shows "Ответ"
      await expect(
        adminPage.getByText("Ответ", { exact: true })
      ).toBeVisible({ timeout: 5_000 });

      // ─── Step 6: Admin finishes quiz ──────────────────────────────────────
      // "Завершить квиз" is enabled on the last slide of the last question.
      const finishBtn = adminPage.getByRole("button", { name: "Завершить квиз" });
      await expect(finishBtn).toBeEnabled({ timeout: 5_000 });
      await finishBtn.click();

      // TV: results screen
      await expect(tvPage.getByText("🏆 Итоги квиза")).toBeVisible({
        timeout: 15_000,
      });

      // ─── Step 7: Admin reveals first (and only) place ─────────────────────
      await adminPage
        .getByRole("button", { name: /показать следующее место/i })
        .click();

      // TV: 🥇 revealed (1 bot team → 1st place)
      await expect(tvPage.getByText("🥇")).toBeVisible({ timeout: 10_000 });
    } finally {
      await adminCtx.close();
      await tvCtx.close();
    }
  });
});
