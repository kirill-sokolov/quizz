## Реализовать фичи

> Выполненные этапы — в [DONE.md](DONE.md)

---

## Тесты фронтенда

Цель: зафиксировать текущее поведение (characterization tests) перед большим рефакторингом.

**Готово:** Setup 1, Setup 2 (MSW), Stage 1 (1A–1F) — см. DONE.md

---

### Stage 2: Integration Tests (MSW + RTL)

Тестируем **страницы целиком** с реалистичными HTTP-ответами и симуляцией WebSocket событий.
Setup 2 уже выполнен (MSW handlers, server, ws-mock готовы).

#### 2A: TV.jsx integration (1 агент)

Файл: `src/test/__tests__/tv-page.test.jsx`

Загрузка и lobby:
- `joinCode` → API → `state(lobby, regOpen=false)` → TVRules
- `state(lobby, regOpen=true, teams=[A,B])` → TVLobby, имена A и B видны

Playing per slide:
- `slide=question` → текст вопроса в DOM
- `slide=timer` → TVTimer виден
- `slide=answer` → TVAnswer виден
- `slide=extra` → TVExtraSlide виден

Finished:
- `slide=results, revealCount=2` → TVResults с 2 командами
- `slide=thanks` → TVDemo (thanks)

WebSocket события:
- `"team_registered"` → новая команда в TVLobby без reload
- `"slide_changed"` → компонент переключается (question → timer)
- `"quiz_finished"` → TVResults появляется
- `"results_revealed"` → revealCount увеличивается

#### 2B: Game.jsx integration (1 агент)

Файл: `src/test/__tests__/game-page.test.jsx`

States:
- `state=null` → кнопка "Запустить квиз"; клик → `gameApi.start` вызван
- `state=lobby, regClosed` → "Открыть регистрацию"; клик → `gameApi.openRegistration`
- `state=lobby, regOpen, teams=[A,B]` → имена команд + "Начать квиз"
- `state=playing` → текст вопроса + slide nav видны

Playing interactions:
- клик "▶" (следующий слайд) → `gameApi.setSlide` с правильным `slideId`
- кнопка "Завершить" задизейблена до последнего слайда последнего вопроса
- клик "Завершить" → `gameApi.finish`

Finished:
- таблица результатов видна
- "Показать место" → `gameApi.revealNextResult`
- kick → `teamsApi.kick`
- score дропдаун (text) → `answersApi.updateScore`

WebSocket:
- `"answer_submitted"` → список ответов обновляется

---

### Stage 3: E2E Tests (Playwright)

Реальный браузер против работающего Docker стека.

#### Setup 3 (1 агент, sequential)

- Установить `@playwright/test` в `apps/web`
- `playwright.config.ts` — baseURL: `http://localhost:5173`, browser: chromium
- `e2e/fixtures.ts` — хелперы создания данных через API (`createTestQuiz`, `startGame`)
- Запуск: `npx playwright test`

#### 3A: TV slide smoke tests (1 агент, parallel после Setup 3)

Файл: `e2e/tv-slides.spec.ts`

Для каждого slide type — TV рендерит контент, нет JS-ошибок в консоли:
- `lobby/regClosed` → rules элемент виден
- `lobby/regOpen` → QR код виден
- `playing/question` → текст вопроса виден
- `playing/timer` → countdown виден
- `playing/answer` → нет крэша
- `finished/results` → таблица результатов

#### 3B: Full game flow E2E (1 агент, parallel после Setup 3)

Файл: `e2e/game-flow.spec.ts`

Два tab'а: Admin + TV открыты параллельно:
1. Admin: "Запустить" → TV: rules
2. Admin: "Открыть регистрацию" → TV: QR/lobby
3. Admin: "Начать квиз" → TV: первый вопрос
4. Admin: "▶" (таймер) → TV: таймер
5. Admin: "▶" (ответ) → TV: ответ
6. Admin: "Завершить" → TV: results
7. Admin: "Показать место" × N → TV: места появляются

---

### Критерии готовности фронтенда

- [x] `npm run test` в `apps/web` запускается без ошибок
- [x] Stage 1: все компонентные тесты зелёные (1A–1F)
- [ ] Stage 2: TV.jsx и Game.jsx integration тесты зелёные
- [ ] Stage 3: Playwright smoke + game flow зелёные
- [ ] Удалённая/сломанная компонента ловится тестом

---

## 🤖 Тестовые агенты (боты) — Полное удаление

Тестовые боты реализованы как изолированный модуль для лёгкого удаления.
Если функция больше не нужна, выполните следующие шаги:

### Шаг 1: Удалить backend файлы

```bash
rm -rf apps/api/src/test-agents/
rm apps/api/src/routes/test-agents.ts
```

### Шаг 2: Удалить frontend файлы

```bash
rm apps/web/src/components/Admin/TestBotsPanel.jsx
```

### Шаг 3: Убрать импорты и интеграцию

#### `apps/api/src/index.ts`

Удалить строки:
```typescript
import { testAgentsRoutes } from "./routes/test-agents.js";
import { BotAgentService } from "./test-agents/index.js";
import { broadcast } from "./ws/index.js";

let botServiceInstance: BotAgentService | null = null;
export const getBotService = () => botServiceInstance;

const wsServer = { broadcast };
const botService = new BotAgentService(wsServer);
botServiceInstance = botService;

await app.register(async (app) => testAgentsRoutes(app, botService));
```

#### `apps/api/src/services/game-service.ts`

Удалить строку:
```typescript
import { getBotService } from "../index.js";
```

Удалить блок кода (после `broadcast("slide_changed", ...)`):
```typescript
if (slide === "timer" && updated.currentQuestionId) {
  const botService = getBotService();
  if (botService) {
    const [question] = await db
      .select()
      .from(questions)
      .where(eq(questions.id, updated.currentQuestionId));
    if (question) {
      await botService.handleQuestion(quizId, question);
    }
  }
}
```

Удалить блок в функции `finishGame()`:
```typescript
const botService = getBotService();
if (botService) {
  await botService.onQuizFinished(quizId);
}
```

#### `apps/api/src/routes/teams.ts`

Убрать фильтрацию ботов в `GET /api/quizzes/:id/teams` и вернуть `rows.map(serializeTeam)` напрямую.

#### `apps/web/src/pages/Game.jsx`

Удалить импорт и использование `<TestBotsPanel>`.

### Шаг 4: Удалить из базы данных (опционально)

```sql
ALTER TABLE teams DROP COLUMN IF EXISTS is_bot;
ALTER TABLE game_state DROP COLUMN IF EXISTS show_bots_on_tv;
```

---

## Опционально в будущем

- Web Admin: вести на телефоне должно быть удобно (проверить и поправить дизайн)
- Web Admin: единый стиль админки с брендбука (lovable)
- Web Admin: затраты красивые графики, остаток счета API, красным если меньше 5$
- Web TV: статистика самые быстрые (может ещё какие номинации)
- Web Admin: разные шаблоны вывода результатов (fade-in, карточки мест переворачиваются)

## Деплой

- github actions
- Настроить деплой на VPS
- Написать инструкцию для ведущего (1 страница A4)

### Проверка

- 20 одновременных команд работают без ошибок
- Деплой проходит одной командой
- Инструкция написана и понятна нетехническому пользователю
