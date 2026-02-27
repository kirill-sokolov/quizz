## Реализовать фичи

> Выполненные этапы — в [DONE.md](DONE.md)

---

## Тесты фронтенда

✅ Все этапы завершены — см. DONE.md

| Этап | Описание | Статус |
|---|---|---|
| Setup 1 | Vitest + jsdom + утилиты | ✅ |
| Setup 2 | MSW handlers + WS mock | ✅ |
| Stage 1 (1A–1F) | Компонентные тесты TV (79+ тестов) | ✅ |
| Stage 2A | TV.jsx integration (13 тестов) | ✅ |
| Stage 2B | Game.jsx integration (15 тестов) | ✅ |
| Setup 3 | Playwright + fixtures | ✅ |
| Stage 3A | TV slide smoke E2E (6 тестов) | ✅ |
| Stage 3B | Full game flow E2E (1 тест) | ✅ |

### Критерии готовности фронтенда

- [x] `npm run test` в `apps/web` запускается без ошибок
- [x] Stage 1: все компонентные тесты зелёные (1A–1F)
- [x] Stage 2: TV.jsx и Game.jsx integration тесты зелёные
- [x] Stage 3: Playwright smoke + game flow зелёные (3A ✅, 3B ✅)
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
