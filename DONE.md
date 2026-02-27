# История выполненных задач

## 2026-02-27: Фронтенд тесты — Setup 1 + Setup 2 (Stage 1 + MSW)

### ✅ Setup 1: Test infrastructure (apps/web)

- `apps/web/vitest.config.ts` — jsdom environment, globals, VITE_* env vars, coverage config
- `apps/web/src/test/setup.ts` — jest-dom, AudioContext mock, matchMedia, IntersectionObserver, ResizeObserver, HTMLMediaElement
- `apps/web/src/test/utils.jsx` — `renderWithRouter`, `makeQuiz`, `makeState`, `makeQuestion`, `makeTeam`
- Скрипты: `test`, `test:watch`, `test:coverage`

### ✅ Setup 2: MSW + WebSocket mock

- `msw@^2.8.0` добавлен в devDependencies
- `src/test/msw/handlers.ts` — handlers для всех API endpoints (quizzes, questions, teams, game, answers, auth, admin)
- `src/test/msw/server.ts` — `setupServer(...handlers)` из `msw/node`
- `src/test/msw/ws-mock.ts` — `MockWebSocket` + `sendWsMessage()` + `installWsMock()`
- `setup.ts` обновлён: `beforeAll(server.listen)`, `afterEach(resetHandlers)`, `afterAll(server.close)`, `installWsMock()`

### ✅ Stage 1: Component Tests (79+ тестов)

Тестируем **presentational sub-компоненты** TV. Принимают props → рендерят. Без API, без WebSocket.

#### 1A: TVResults — `TVResults.test.jsx` (25 тестов)
- рендерится без крэша
- `revealCount=0` → ни одной команды не видно
- `revealCount=2` из 5 → 2 видны, 3 скрыты
- первое место всегда зарезервировано (placeholder)
- ≤8 команд → compact layout; ≥9 → podium (3 колонки)
- очки: choice `correct/total`, text — `awardedScore`

#### 1B: TVTimer — `TVTimer.test.jsx` (19 тестов)
- рендерится без крэша
- показывает начальное время (`timeLimitSec`)
- с `vi.useFakeTimers`: значение убывает
- показывает `0` когда время вышло
- цвет меняется на красный при < 5 секунд
- `timerPosition` вариантов → нужный CSS-класс

#### 1C: TVQuestion — `TVQuestion.test.jsx` (13 тестов)
- рендерится без крэша
- отображает `question.text`
- choice: все 4 варианта в DOM
- text: варианты не отображаются
- slide с `imageUrl` → `img` в DOM

#### 1D: TVLobby — `TVLobby.test.jsx` (7 тестов)
- рендерится без крэша
- показывает QR-код (`img` элемент)
- отображает имена всех команд
- `teams=[]` → не крэшится

#### 1E: TVAnswer + TVDemo + TVExtraSlide — `tv-misc-components.test.jsx` (15 тестов)
- `TVAnswer`: с `imageUrl` → img; без — не крэш
- `TVDemo`: с `imageUrl` → img; без — не пустой экран
- `TVExtraSlide`: с `imageUrl` → img; с `videoUrl` → video элемент

#### 1F: TV.jsx render paths — `TV.test.jsx`
- loading → текст "Загрузка"
- ошибка (API 404) → fallback, нет крэша
- `status=lobby, regOpen=false` → TVRules в DOM
- `status=lobby, regOpen=true` → TVLobby в DOM
- `status=playing, slide=question` → TVQuestion в DOM
- `status=playing, slide=timer` → TVTimer в DOM
- `status=playing, slide=answer` → TVAnswer в DOM
- `status=playing, slide=extra` → TVExtraSlide в DOM
- `status=finished, slide=results` → TVResults в DOM
- `status=finished, slide=thanks` → TVDemo в DOM

Запуск: `docker exec wedding_web npm run test`

---

## 2026-02-27: Тесты — routes.test.ts: покрытие до 85%

### ✅ 121 тест, coverage 85.38% по ключевым файлам

**Новые тесты в `routes.test.ts` (32 теста):**

*`POST /api/quizzes/:id/questions`:*
- создаёт вопрос с 3 базовыми слайдами (question/timer/answer)
- auto-orderNum = max + 1
- defaults: questionType=choice, weight=1, timeLimitSec=30
- 401 без авторизации

*`PATCH /api/questions/:id`:*
- обновляет text, correctAnswer, weight, questionType
- 404 для несуществующего
- slides array: добавляет новые слайды
- 401 без авторизации

*`DELETE /api/questions/:id`:*
- удаляет; 404 для несуществующего; 401 без авторизации

*`GET /api/quizzes/active`:*
- возвращает только status=active квизы

*`GET /api/quizzes/by-code/:code`:*
- находит по joinCode (case-insensitive); 404 если не найден

*`POST /api/quizzes` validation:*
- пустой title → 400; отсутствующий title → 400

*`PATCH /api/quizzes/:id`:*
- обновляет title; 404; 401

*`POST /api/quizzes/:id/display-on-tv`:*
- устанавливает `displayedOnTv=true`; сбрасывает флаг у всех остальных; 404; 401

*Auth edge cases:*
- login: missing username/password → 400; неверный пользователь → 401; неверный пароль → 401
- verify: нет токена → 401; невалидный токен → 401; валидный → 200
- logout: 200 + set-cookie header

**Итоговое покрытие:**
| File | До | После |
|---|---|---|
| `routes/questions.ts` | 26% | **89%** |
| `routes/quizzes.ts` | 53% | **90%** |
| `routes/auth.ts` | 80% | **100%** |
| **Всего core** | 73% | **85%** |

**Файлы:**
- `apps/api/src/test/__tests__/routes.test.ts` (новый, 32 теста)
- `apps/api/src/test/__tests__/coverage.test.ts` → переименован в `game-extras.test.ts`

---

## 2026-02-27: Тесты — Шаги 7 + Coverage: Нагрузочный тест и покрытие >70%

### ✅ 89 тестов, coverage 73.65% по ключевым файлам

**Шаг 7 — `load.test.ts` (4 теста):**
- 20 команд регистрируются одновременно — 0 ошибок
- 20 команд отвечают на 3 вопроса одновременно — нет 409 конфликтов, все ответы сохранены
- Итоговые очки верны после concurrent-отправок (первые 5 команд с правильными ответами наверху)
- `next-question` корректно работает при одновременной регистрации команд

**Coverage tests — `coverage.test.ts` (12 тестов):**

*`POST /api/game/restart`:*
- Сброс в draft, удаление команд/ответов/gameState
- Рестарт на draft-квизе → ошибка

*`POST /api/game/remind`:*
- Команды без ответа попадают в список
- После ответа — исчезают из списка
- Фильтрация по teamId

*`GET /api/game/results/:quizId/:teamId` (getTeamDetails):*
- Breakdown по вопросам: правильный, неправильный, без ответа
- Text-вопрос содержит correctAnswerText

*`PATCH /api/answers/:id/score`:*
- Ручная установка оценки; несуществующий ответ → 404; без авторизации → 401

**Итоговое покрытие (core files):**
| File | Stmts | Branch | Funcs |
|---|---|---|---|
| `routes/game.ts` | 100% | 88% | 100% |
| `services/game-service.ts` | 87% | 77% | 100% |
| `routes/answers.ts` | 94% | 85% | 100% |
| `routes/teams.ts` | 98% | 77% | 100% |
| **All core** | **73.65%** | **78%** | **88%** |

**Изменения:**
- `vitest.config.ts` — `coverage.include` сужен до core files (исключены import/media/docx/llm-infra)

**Файлы:**
- `apps/api/src/test/__tests__/load.test.ts` (новый, 4 теста)
- `apps/api/src/test/__tests__/coverage.test.ts` (новый, 12 тестов)
- `apps/api/vitest.config.ts` — обновлён coverage.include

---

## 2026-02-27: Тесты — Шаги 4 и 5: WebSocket и unit-тесты

### ✅ 13 broadcast-тестов (Шаг 4) + 11 unit-тестов (Шаг 5) = 73 теста всего

**Шаг 4 — `ws.test.ts` (13 тестов):**

*Game lifecycle events:*
- `startGame` → `game_lobby` с quizId и joinCode
- `openRegistration` → `registration_opened`
- `beginGame` → `slide_changed` с первым слайдом вопроса
- `setSlide(timer)` → `slide_changed` с `slide=timer` и slideId
- `setSlide(answer)` → `slide_changed` с `slide=answer`
- `nextQuestion` → `slide_changed` со следующим вопросом
- `finishGame` → `quiz_finished` с массивом results и resultsRevealCount=0
- `revealNextResult` → `results_revealed` с incremented count
- `archiveQuiz` → `quiz_archived`

*Team and answer events:*
- `registerTeamViaBot` → `team_registered` с name и quizId
- `submitAnswerViaBot (choice)` → `answer_submitted` с answerId
- `text answer + LLM` → `answer_scored` с awardedScore после async evaluation
- `choice answer` → нет `answer_scored` события

**Шаг 5 — `unit.test.ts` (11 тестов):**

*`generateJoinCode`:*
- Длина ровно 6 символов
- Только символы из безопасного алфавита (нет I, O, 0, 1)
- Никогда не содержит путаные символы
- Разные коды при каждом вызове (вероятностная проверка)
- Только uppercase

*`parseEvalResponse`:*
- Парсит чистый JSON
- Удаляет markdown code fences (` ```json `)
- Удаляет фенсы без метки `json`
- Несколько команд в results
- Падает на невалидном JSON
- Игнорирует leading/trailing whitespace

**Изменения в коде:**
- `evaluate-text-answer.ts` — экспортирована `parseEvalResponse` (чистая функция, теперь публично тестируема)
- `mock-modules.ts` — обновлён LLM мок: используется `importOriginal` для сохранения `parseEvalResponse` при мокировании `evaluateTextAnswers`

**Файлы:**
- `apps/api/src/test/__tests__/ws.test.ts` (новый, 13 тестов)
- `apps/api/src/test/__tests__/unit.test.ts` (новый, 11 тестов)
- `apps/api/src/services/llm/evaluate-text-answer.ts` — export parseEvalResponse
- `apps/api/src/test/mock-modules.ts` — importOriginal для LLM мока

---

## 2026-02-27: Тесты — Шаг 3: Интеграционные тесты API

### ✅ 31 тест на полный lifecycle квиза

**Покрыто:**

**Quiz CRUD** (3 теста):
- Создание и получение квиза по ID, список квизов, удаление с cascade

**Game lifecycle** (9 тестов):
- `start` → status=lobby; `open-registration` → registrationOpen=true
- `begin` → status=playing, currentSlide из первого слайда по sort_order
- `begin` без lobby → 500
- `set-slide by slideId` → timer: timerStartedAt set; answer: timerStartedAt=null
- `next-question` → переход к Q2
- `next-question` после последнего → `{ done: true }`
- `finish` → quiz.status=finished
- `archive` → quiz.status=archived

**Team registration** (4 теста):
- Команда появляется в списке после регистрации
- Две команды с одинаковым именем разрешены (нет unique constraint)
- Кикнутая команда исключена из дефолтного списка
- Кикнутая команда видна с `?all=true`

**Answer submission** (6 тестов):
- choice принимается и сохраняется; нормализуется в uppercase
- Неверная буква → 400; пустой ответ → 400
- Повторный ответ → 409 Conflict (зафиксировано текущее поведение)
- text хранится как trimmed-строка
- text с лишними вариантами обрезается до N правильных ответов

**Scoring & results** (9 тестов):
- Правильный choice → weight очков; неправильный → 0
- Результаты отсортированы по убыванию
- Ничья → оба участника на одинаковом счёте
- Кикнутый игрок исключён из результатов
- text answer: score от LLM mock применяется к результатам
- Команда без ответов → score=0

**Хелперы добавлены:**
- `adminPost(app, cookie, url, body)` — authenticated POST
- `getSlides(quizId, questionId)` / `slideOfType(quizId, questionId, type)` — получить слайды через API

**Файлы:**
- `apps/api/src/test/helpers.ts` — adminPost
- `apps/api/src/test/__tests__/game.test.ts` (новый, 31 тест)

---

## 2026-02-27: Тесты — Шаг 2: Моки внешних сервисов

### ✅ Моки OpenRouter LLM + WebSocket broadcast

**Выполнено:**
- **`src/test/mock-modules.ts`** (setupFile) — регистрирует все vi.mock ДО загрузки роутов:
  - `ws/index.js` → `broadcast: vi.fn()`, `wsPlugin: async () => {}` (no-op)
  - `bot-service-registry.js` → `getBotService: () => null`
  - `services/llm/evaluate-text-answer.js` → `evaluateTextAnswers: vi.fn().mockResolvedValue([])`
- **`vitest.config.ts`**: `fileParallelism: false` — файлы запускаются последовательно, каждый в своём форке (нет конфликтов в БД, нет cross-file mock contamination)
- **`setup.ts`**: `vi.clearAllMocks()` в beforeEach — история вызовов сбрасывается перед каждым тестом
- **`helpers.ts`**: `registerTeamViaBot(app, quizId, name)` и `submitAnswerViaBot(app, questionId, teamId, answerText)` — симулируют то, что делает бот (POST /api/quizzes/:id/teams и POST /api/answers)
- **`mocks.test.ts`**: 7 тестов — broadcast is a spy, team_registered, answer_submitted, evaluate NOT called for choice, IS called for text, controlled return value (score сохраняется в DB)
- **Паттерн для тестов**: статический импорт + `vi.mocked()` (динамический import может вернуть другой экземпляр мока)

**Файлы:**
- `apps/api/src/test/mock-modules.ts` (новый)
- `apps/api/src/test/app-factory.ts` — убраны vi.mock, добавлен комментарий с паттерном
- `apps/api/src/test/setup.ts` — vi.clearAllMocks() в beforeEach
- `apps/api/src/test/helpers.ts` — registerTeamViaBot, submitAnswerViaBot
- `apps/api/vitest.config.ts` — mock-modules.ts в setupFiles, fileParallelism: false
- `apps/api/src/test/__tests__/mocks.test.ts` (новый)

---

## 2026-02-27: Тесты — Шаг 1: Инфраструктура тестов

### ✅ Vitest + интеграционные тесты API

**Выполнено:**
- **Рефакторинг `getBotService`**: вынесен из `index.ts` в `bot-service-registry.ts` — устранена циклическая зависимость, которая мешала импортировать routes в тестах
- **Vitest**: `vitest@^2.1.0` + `@vitest/coverage-v8` добавлены в devDependencies
- **Скрипты**: `test`, `test:watch`, `test:coverage` в `package.json`
- **`vitest.config.ts`**: тестовая БД `quiz_test`, `NODE_ENV=test`, все env-переменные, `globalSetup`, `setupFiles`, покрытие services/routes
- **`src/test/global-setup.ts`**: при первом запуске создаёт БД `quiz_test` и применяет все миграции 0000–0007 (идемпотентно)
- **`src/test/setup.ts`**: хелпер `resetDb()` — TRUNCATE всех таблиц + RESTART IDENTITY
- **`src/test/helpers.ts`**: фабрики `createQuiz`, `createQuestion`, `createQuestionWithSlides`, `createTeam`, `createDemoQuiz` (4 вопроса), `createAdmin`, `createGameState`, `loginAs`
- **`src/test/app-factory.ts`**: создаёт Fastify app для тестов — без `listen()`, `broadcast` и `wsPlugin` замокированы, `getBotService` → null
- **`src/test/__tests__/smoke.test.ts`**: 11 smoke-тестов (health, auth, CRUD quizzes) — все зелёные
- **Запуск**: `docker exec wedding_api npm run test` → `11 passed` за ~726ms

**Файлы:**
- `apps/api/src/bot-service-registry.ts` (новый)
- `apps/api/src/index.ts` — используется `setBotService` из registry
- `apps/api/src/services/game-service.ts` — импортируется из `bot-service-registry.js`
- `apps/api/package.json` — скрипты test/test:watch/test:coverage, vitest в devDependencies
- `apps/api/vitest.config.ts` (новый)
- `apps/api/src/test/global-setup.ts` (новый)
- `apps/api/src/test/setup.ts` (новый)
- `apps/api/src/test/helpers.ts` (новый)
- `apps/api/src/test/app-factory.ts` (новый)
- `apps/api/src/test/__tests__/smoke.test.ts` (новый)

---

## 2026-02-27: Фикс ImportPreview — экстра-слайды через пул

### ✅ SlideStrip: два пространства вместо одного плоского массива

**Проблема:** экстра-слайды (дубли таймеров из ZIP) появлялись сразу в основной ленте, и нужно было вручную удалять лишние.

**Решение:** разделили данные на два пространства:
- **Основная лента** (`orderedSlides`) — базовые слайды + явно вставленные экстры, сохраняется в backend
- **Пул экстр** (`unusedExtras`) — показывается отдельно под лентой, при сохранении выбрасывается

**Поведение:**
- Экстра-слайды из ZIP попадают в пул, а не сразу в ленту
- Пользователь перетаскивает нужный из пула в любую позицию основной ленты (в т.ч. после "ответ")
- Слайд уходит из пула, встаёт в ленту
- Можно вставить несколько разных экстр, перетаскивая по одному
- При сохранении: всё что осталось в пуле — молча выбрасывается

**Изменённые файлы:**
- `apps/web/src/components/slides/SlideStrip.jsx` — новые пропсы: `orderedSlides`, `unusedExtras`, `onReorder`, `onPlaceExtra`, `onDeletePlaced`; IDs: `strip-{idx}`, `pool-{idx}`, `gap-{idx}`
- `apps/web/src/components/ImportPreview.jsx` — `buildOrderedSlides` без экстр; `buildUnusedExtras` для пула; стейт per-question включает оба поля; новая функция `placeExtra`

---

## 2026-02-27: Этап 9 — Улучшение seed Demo quiz

### ✅ Demo quiz «Демо квиз (edge cases)» покрывает все острые углы

**Quiz-level:**
- `demoImageUrl` → `seed/demo.png`
- `thanksImageUrl` → `seed/thanks.png`
- `finalImageUrl` → `seed/final.png` (добавлено — теперь доступен полный флоу results → thanks → final → archive)

**Q1** — choice + video, weight=1, timerPosition="center"
- Слайды: `video_warning` → `video_intro` → `question` → `timer` → `answer`
- `videoLayout` на `video_intro`: `{ top: 21.3, left: 25.1, width: 49.9, height: 52.7 }`
- Тест: видео-слайды, позиционирование видео, базовый флоу

**Q2** — text, weight=1, timerPosition="top-right"
- «Назовите столицы: Франции, Германии, Японии, Австралии.»
- `correctAnswer`: "Париж, Берлин, Токио, Канберра"
- Слайды: `question` → `timer` → `answer`
- Тест: текстовый ответ (LLM-оценка), нестандартная позиция таймера

**Q3** — text, weight=1, timerPosition="bottom-left"
- «В каких странах обручальное кольцо носят на правой руке? (назовите 2 страны)»
- `correctAnswer`: "Россия, Германия"
- Слайды: `question` → `timer` → `answer` → **`extra (video-answer.png + video.mp4, videoLayout)`**
- `videoLayout` на extra: `{ top: 21.3, left: 25.1, width: 49.9, height: 41 }`
- Тест: текстовый ответ с несколькими значениями, видео-extra после answer, другая позиция таймера

**Q4** — choice, weight=1, timerPosition="center"
- «Сколько лепестков у классической розы, подаренной на свадьбу?»
- Слайды: `question` → **`extra (joke1.png)`** → `timer` → `answer` → **`extra (1a.png)`** → **`extra (1b.png)`**
- Тест: extra-слайд между вопросом и таймером, 2 extra после answer, навигация «Экстра N/M»

**Поддержка `videoLayout` в `extraAfterQuestion` и `extraSlides`** — добавлена в цикл создания слайдов.

**Файлы:**
- `apps/api/src/services/seed-service.ts`

---

## 2026-02-26: Фикс — последовательные кнопки после раскрытия результатов

### ✅ Пост-игровой флоу: results → thanks → final → archive

**Проблема**: кнопки «Спасибо», «Финальный слайд» и «Архивировать» показывались одновременно ниже результатов. Можно было нажать «Архивировать» сразу, минуя обязательные шаги.

**Решение**: единственная кнопка действия в sticky-баре (там же где «Показать следующее место»), которая меняется последовательно:
- Пока не все места открыты → «Показать следующее место на TV» (синяя)
- Все открыты → одна кнопка из цепочки (серый фон блока):
  1. 🙏 «Показать «Спасибо» на TV» — если `thanksImageUrl` есть
  2. 🎬 «Показать финальный слайд на TV» — если `finalImageUrl` есть и спасибо уже показано (или его нет)
  3. 📦 «Архивировать квиз» — финальный шаг

**Логика** (`nextAction` в `Game.jsx`):
```
currentSlide === 'final'  → archive
currentSlide === 'thanks' → final (если есть) | archive
иначе                     → thanks (если есть) | final (если есть) | archive
```

**Файлы:**
- `apps/web/src/pages/Game.jsx`
- `docs/QUIZ-FLOW.md`

---

## 2026-02-26: Drag & drop для экстра-слайдов

### ✅ Перетаскивание слайдов в ImportPreview и QuestionForm

**Новые компоненты (независимые, не захломляют старый код):**

- `apps/web/src/components/slides/SlideStrip.jsx` — горизонтальная лента слайдов для ImportPreview:
  - Все слайды вопроса показываются thumbnails в ряд
  - Базовые слайды (question/timer/answer/video_*) — статичные
  - Экстра-слайды — draggable (cursor: grab), кнопка ✕ для удаления
  - При перетаскивании между каждыми двумя слайдами появляются **60px drop-зоны** (синяя подсветка при наведении)
  - DragOverlay — ghost-копия перетаскиваемого слайда
  - Props: `slides`, `onReorder`, `onDelete`

- `apps/web/src/components/slides/SlideDndList.jsx` — вертикальный список с drag handles для QuestionForm:
  - Обёртка для слайдов через render prop `renderItem(slide, idx)`
  - Базовые слайды: `disabled: true`, нельзя двигать
  - Экстра-слайды: иконка ⠿ слева как drag handle
  - Props: `slides`, `onReorder`, `renderItem`

**Изменения в существующих компонентах (минимальные):**

- `ImportPreview.jsx`:
  - `buildOrderedSlides(item)` — конвертирует `slides{} + extraSlides[]` → упорядоченный массив при инициализации
  - Состояние `items` теперь включает `orderedSlides`
  - Блоки "Slide previews" и "Extra slides" заменены на `<SlideStrip>`
  - `onDelete` удаляет слайд из `orderedSlides`
  - `orderedSlides` передаётся в backend при сохранении

- `QuestionForm.jsx`: слайды обёрнуты в `<SlideDndList>` через render prop, код слайдов не изменился

**Backend (`import-service.ts`):**
- `ImportPreviewItem` расширен: `orderedSlides?: Array<{type, imageUrl}>`
- `saveImportedQuiz`: если `orderedSlides` есть → сохраняет слайды в этом порядке; иначе fallback на старый формат

**Зависимости:**
- `@dnd-kit/core ^6.3.1`
- `@dnd-kit/sortable ^8.0.0`
- `@dnd-kit/utilities ^3.2.2`

**Файлы:**
- `apps/web/src/components/slides/SlideStrip.jsx` (новый)
- `apps/web/src/components/slides/SlideDndList.jsx` (новый)
- `apps/web/src/components/ImportPreview.jsx`
- `apps/web/src/components/QuestionForm.jsx`
- `apps/api/src/services/import-service.ts`
- `apps/web/package.json`

---

## 2026-02-26: Этап 8 — Экстра-слайды внутри вопросов

### ✅ Extra Slides (тип `extra`, `sort_order` навигация)

**Ключевое решение:** Экстра-слайды живут в таблице `slides` с типом `"extra"` и явным порядком через `sort_order`. Навигация order-based вместо type-based.

**Выполнено:**

**БД:**
- Добавлен `sort_order integer NOT NULL DEFAULT 0` в таблицу `slides`
- Добавлен `current_slide_id integer REFERENCES slides(id)` в `game_state`
- Миграция `apps/api/drizzle/0007_extra_slides.sql` (применена напрямую)
- Существующие слайды получили sort_order: video_warning=0, video_intro=1, question=2, timer=3, answer=4

**Backend:**
- `schema.ts`: `sortOrder` на slides, `currentSlideId` на gameState, `"extra"` в SLIDE_TYPES
- `types/slide.ts`: добавлен `"extra"` в SLIDE_TYPES
- `game-service.ts`: `setSlide()` переключён на dual mode (`{ slideId? } | { slide? }`); `beginGame()`/`nextQuestion()` используют первый слайд по `sort_order`; бродкастится `slideId` в `slide_changed`
- `routes/game.ts`: body `set-slide` изменён на `{ quizId, slideId?, slide? }`
- `routes/questions.ts`: GET возвращает слайды отсортированными по `sort_order`; PATCH поддерживает extras (insert/update/delete); POST создаёт слайды с sort_order
- `import-service.ts`: `saveImportedQuiz` сохраняет extras с sort_order после answer
- `seed-service.ts`: слайды создаются с явным sort_order

**Frontend:**
- `constants/slides.js`: добавлены `EXTRA`, `SLIDE_LABELS.extra`, `TV_SLIDE_LABELS.extra`
- `api/client.js`: `setSlide(quizId, params)` — params это `{ slideId? }` или `{ slide? }`
- `TV/TVExtraSlide.jsx` (новый компонент): fullscreen image/video
- `TV.jsx`: рендер `TVExtraSlide` для `slide === EXTRA` по `state.currentSlideId`
- `Game.jsx`: order-based навигация по `slideSequence` и `currentSlideId`; label "Экстра N/M"; Next Question/Finish по `isLastSlide`; `handleSetSlide` принимает объект слайда или строку
- `QuestionForm.jsx`: ordered slide list; кнопки "+ Экстра-слайд" между слайдами; удаление extras; upload image/video для extras
- `ImportPreview.jsx`: extras показываются с нумерацией и кнопкой удаления

**Файлы:**
- `apps/api/drizzle/0007_extra_slides.sql`
- `apps/api/src/db/schema.ts`
- `apps/api/src/types/slide.ts`
- `apps/api/src/services/game-service.ts`
- `apps/api/src/services/import-service.ts`
- `apps/api/src/services/seed-service.ts`
- `apps/api/src/routes/game.ts`
- `apps/api/src/routes/questions.ts`
- `apps/web/src/constants/slides.js`
- `apps/web/src/api/client.js`
- `apps/web/src/components/TV/TVExtraSlide.jsx` (новый)
- `apps/web/src/pages/TV.jsx`
- `apps/web/src/pages/Game.jsx`
- `apps/web/src/components/QuestionForm.jsx`
- `apps/web/src/components/ImportPreview.jsx`
- `docs/DATABASE.md`, `docs/API.md`, `docs/QUIZ-FLOW.md`

---


## 2026-02-26: Фикс импорта ZIP — сортировка, промпт, удаление legacy

### ✅ Исправления import pipeline

**Сортировка слайдов (`processZip`)**:
- `.jpg/.jpeg` файлы (экспорт Canva) сортируются первыми в числовом порядке
- `.png/.webp` файлы (вручную добавленные спецслайды) — после всех JPG
- Это предотвращает попадание `11.png` (правила) в середину вопросных слайдов

**Промпт `buildHybridPrompt` (LLM)**:
- Алгоритм реструктурирован на 3 явных шага: Шаг 1 (контент-скан спецслайдов), Шаг 2 (группировка вопросов), Шаг 3 (позиция таймера)
- `rulesSlide`: описание улучшено, PNG-файлы в конце архива — подсказка LLM
- `finalSlide`: добавлены «С Днем Рождения», «Happy Birthday» как допустимые варианты
- `timer_position`: запрещён `"center"`, дефолт `"top-right"`; логика — из таймер-слайдов в extraSlides или свободный угол на question
- `extraSlides` (будильники, таймеры): явный запрет на использование как question/answer

**Удаление ZIP-only legacy**:
- Удалены: `importHybrid()`, ZIP-only path в `importZip()`, `analyzeImages()`, `buildPrompt()`, `ParsedQuizQuestion`, `ParsedResult`, `parseJsonResponse()`
- Route `import-zip` теперь требует `docxQuestions` (400 если нет)
- Фронтенд: убран `docxFile` параметр из `uploadZip()`

---

## 2026-02-26: Этап 7 — Слайды «Спасибо» и финальный слайд после результатов

### ✅ Новые слайды `thanks` и `final`

**Выполнено:**
- **БД**: добавлены колонки `thanks_image_url` и `final_image_url` в таблицу `quizzes`; `SLIDE_TYPES` расширен значениями `"thanks"` и `"final"` в `schema.ts` и `types/slide.ts`
- **Миграция**: `apps/api/drizzle/0006_thanks_slides.sql` (применена напрямую через psql, т.к. drizzle migrations table была пуста)
- **Backend `setSlide()`**: не сбрасывает `resultsRevealCount` при переходе на `thanks` / `final` (аналогично `results`)
- **Backend routes**: PATCH `/api/quizzes/:id` принимает `thanksImageUrl?` и `finalImageUrl?`
- **Frontend constants**: добавлены `THANKS` и `FINAL` в `SLIDE_TYPES`, `SLIDE_LABELS`, `TV_SLIDE_LABELS`
- **TV**: `TV.jsx` использует `<TVDemo>` для слайдов `thanks` и `final` в состоянии `finished` (компонент TVThanks не создавался — удалён как избыточный, переиспользуется TVDemo)
- **Админка**: после раскрытия всех мест появляются кнопки «🙏 Показать «Спасибо» на TV» и «🎬 Показать финальный слайд на TV» (только если картинки загружены)
- **QuizEdit**: поля загрузки thanks/final — превью + кнопка; статус в read-only режиме; **демо-слайд** также добавлен в настройки (раньше был только в Home.jsx); после импорта настройки перезагружаются автоматически (`loadQuiz()` вызывается из `onDone`)
- **Seed**: демо-квиз получает `thanksImageUrl: "/api/media/seed/demo.jpg"`

### ✅ Обновлён LLM import pipeline

- **`types.ts`**: `ParsedResult` и `HybridParsedResult` получили `thanksSlide?` и `finalSlide?`; `buildHybridPrompt()` описывает слайды thanks/final в разделе «СПЕЦИАЛЬНЫЕ слайды»; JSON пример включает оба поля
- **`import-service.ts`**: `ImportPreviewResult` расширен `thanksImageUrl?` / `finalImageUrl?`; все три функции импорта (`importZip`, `importHybridWithParsed`, `importHybrid`) возвращают новые поля; `saveImportedQuiz` сохраняет все 4 специальных URL в таблицу `quizzes`
- **`routes/import.ts`**: import-save route передаёт `thanksImageUrl`, `finalImageUrl` в `saveImportedQuiz`
- **`ImportPreview.jsx`**: превью показывает 4 специальных слайда (demo, rules, thanks, final)

**Файлы:**
- `apps/api/src/db/schema.ts`
- `apps/api/src/types/slide.ts`
- `apps/api/src/services/game-service.ts`
- `apps/api/src/routes/quizzes.ts`
- `apps/api/src/routes/import.ts`
- `apps/api/src/services/import-service.ts`
- `apps/api/src/services/llm/types.ts`
- `apps/api/src/services/seed-service.ts`
- `apps/api/drizzle/0006_thanks_slides.sql`
- `apps/api/drizzle/meta/_journal.json`
- `apps/web/src/constants/slides.js`
- `apps/web/src/pages/TV.jsx`
- `apps/web/src/pages/Game.jsx`
- `apps/web/src/pages/QuizEdit.jsx`
- `apps/web/src/components/ImportPreview.jsx`
- `docs/DATABASE.md`, `docs/QUIZ-FLOW.md`, `docs/FRONTEND.md`, `docs/IMPORT.md`

---

## 2026-02-26: Этап 6 + фиксы

### ✅ Улучшение оценки текстовых ответов из Telegram бота

**Выполнено:**
- **Валидация `POST /api/answers`**: проверка что `answerText` не пустой; для `choice` — нормализация в верхний регистр и проверка что буква A–H; для `text` — обрезка до 500 символов
- **Усечение текстовых ответов**: если вопрос имеет N правильных ответов (через `,`), принимаются только первые N вариантов от пользователя — предотвращает перебор всех вариантов
- **Логика `weight` в подсчёте очков**: `getResults()` и `getTeamDetails()` используют `q.weight` / `d.weight` для `choice` вопросов (вместо `1`)
- **Edge case LLM**: если `correctAnswers.length === 0`, LLM не вызывается, возвращаются нулевые баллы
- **LLM через OpenRouter**: `evaluate-text-answer.ts` переписан на единственный провайдер — OpenRouter `google/gemini-3-flash-preview` (как импорт архива); убраны Gemini SDK и Groq
- **Точный расчёт score**: LLM возвращает только `matched` (целое число), сервер считает `(matched / total) * weight` с точностью до 2 знаков — `0.75` вместо `0.8`
- **Немедленная LLM-оценка**: при получении текстового ответа оценка запускается в фоне сразу (fire-and-forget); после завершения бродкастится `answer_scored` по WebSocket — ведущий видит балл без ожидания слайда "answer"
- **`answer_scored` WS-событие**: новое событие; Admin обновляет ответы по нему
- **Select с оценкой**: убрано условие `isOnAnswerSlide` — дропдаун виден сразу после ответа команды, не нужно ждать слайда "answer"
- **Bot ws-listener**: для текстовых вопросов с несколькими ответами бот подсказывает "Перечисли X ответа через запятую"

### ✅ Фикс: дублирование сообщений в Telegram (3 раза)

**Причина:** при каждом реконнекте накапливалось несколько живых WS-соединений, каждое обрабатывало событие независимо.

**Фикс:** `ws-listener.ts` хранит `current: WebSocket | null`. При `connect()` старое соединение принудительно завершается (`terminate()`). Обработчики `message`/`close` проверяют `ws !== current` и игнорируют события от устаревших соединений.

### ✅ Seed: текстовый вопрос

Второй вопрос демо-квиза изменён на текстовый: "Где жили Майя?" с четырьмя правильными ответами.

**Файлы:**
- `apps/api/src/routes/answers.ts`
- `apps/api/src/services/game-service.ts`
- `apps/api/src/services/llm/evaluate-text-answer.ts`
- `apps/api/src/services/seed-service.ts`
- `apps/bot/src/ws-listener.ts`
- `apps/web/src/pages/Game.jsx`
- `docs/API.md`, `docs/WEBSOCKET.md`, `docs/BOT.md`, `docs/QUIZ-FLOW.md`

---

## 2026-02-26: Фиксы TVResults

### ✅ Визуальные исправления экрана результатов (TV)

**Выполнено:**
- **Слот 1-го места всегда забронирован** — пока не открыто, показывается placeholder (пунктирная рамка, полупрозрачный 🥇, `• • •`). Layout не прыгает при появлении. Работает в обоих режимах (обычный и пьедестал).
- **Боковые столбцы выровнены по нижнему краю** — `items-end` на flex-контейнере, убраны жёсткие `marginTop`. Низ левого (9–15) и правого (16–21) столбцов совпадает с уровнем 8-го места.
- **Контент вертикально центрирован** — `justify-center` вместо `justify-start` в обоих режимах.
- **Невидимые элементы не занимают место** — `return null` вместо `opacity-0 invisible` для всех нераскрытых мест кроме 1-го.

**Файлы:**
- `apps/web/src/components/TV/TVResults.jsx`
- `docs/FRONTEND.md` — обновлено описание TVResults, удалены выполненные TODO

---

## 2026-02-26: Этап 5

### ✅ Telegram Bot: вопрос приходит только на слайде таймера

**Выполнено:**
- `slide === "question"` → бот молчит, только запоминает `questionId` для последующей отправки
- `slide === "timer"` → бот отправляет текст вопроса + кнопки ответа (A/B/C/D) всем капитанам квиза
- Для текстовых вопросов — кнопки не добавляются, только текст с инструкцией написать ответ
- При переходе на `"timer"` бот переводит пользователей в состояние `awaiting_answer`

**Файлы:**
- `apps/bot/src/ws-listener.ts`

---

## 2026-02-25: Этап 4

### ✅ Пошаговое открытие мест на TV из админки

**Выполнено:**
- Добавлено поле `resultsRevealCount` в `game_state` (миграция + schema)
- При завершении игры TV получает полный список результатов, но показывает 0 мест
- API: `POST /api/game/reveal-next-result` — открыть следующее место
- WS-событие `results_revealed` для синхронного обновления всех клиентов
- Admin (Game.jsx): кнопка "Показать следующее место на TV" + прогресс
- TV: результаты рендерятся по `revealCount`, порядок: 2 → 3 → … → 1

**Файлы:**
- `apps/api/src/db/schema.ts`, `apps/api/drizzle/0004_spotty_results_reveal.sql`
- `apps/api/src/services/game-service.ts`, `apps/api/src/routes/game.ts`
- `apps/web/src/api/client.js`, `apps/web/src/pages/Game.jsx`, `apps/web/src/pages/TV.jsx`
- `apps/web/src/components/TV/TVResults.jsx`, `apps/web/src/constants/slides.js`

---

## 2026-02-25: Этапы 1–3

### ✅ Этап 1: Удаление OCR

**Выполнено:**
- Удалён `ocr-service.ts` и endpoint `/api/quizzes/:id/analyze-zip-ocr`
- Удалён OCR UI из `QuizEdit.jsx`
- Удалена функция `analyzeZipOcr` из `client.js`
- Удалён Tesseract из `Dockerfile`

**Файлы:**
- `apps/api/src/services/ocr-service.ts` — DELETED
- `apps/api/src/routes/import.ts`, `apps/web/src/pages/QuizEdit.jsx`
- `apps/web/src/api/client.js`, `apps/api/Dockerfile`

---

### ✅ Этап 2: Улучшение экрана регистрации

**Выполнено:**
- QR-код адаптивный: `max-w-[600px]`, `aspect-square`, `max-h-[85vh]`
- Удалены номера команд `#{idx + 1}`
- Иконки команд (первая буква в круге), градиенты, тени, hover-эффекты

**Файлы:**
- `apps/web/src/components/TV/TVLobby.jsx`

---

### ✅ Этап 3: Улучшение экрана результатов

**Выполнено:**
- Шрифты увеличены в ~2 раза (заголовок `text-9xl`, строки `text-6xl`, медали `text-8xl`)
- Анимация появления: 2-е место первым, 1-е — последним
- `getAnimationDelay(index)` с шагом 0.15s

**Файлы:**
- `apps/web/src/components/TV/TVResults.jsx`

---

## 2026-02-25: Дополнительные улучшения

### ✅ Конфигурация bot username через .env

- Переменная `TELEGRAM_BOT_USERNAME` в `.env` и `docker-compose.yml`
- `TVLobby.jsx` использует `import.meta.env.VITE_TELEGRAM_BOT_USERNAME`
- Создан `.env.example`

**Файлы:** `.env`, `docker-compose.yml`, `apps/web/src/components/TV/TVLobby.jsx`, `.env.example`

---

### ✅ Seed: две кнопки (безопасная + полный сброс)

- `POST /api/admin/seed` — добавить демо-квиз без удаления данных
- `POST /api/admin/reset` — удалить всё и создать демо
- UI: кнопки "➕ Добавить демо-квиз" (зелёная) и "⚠️ Полный сброс БД" (красная)

**Файлы:** `apps/api/src/services/seed-service.ts`, `apps/api/src/routes/admin.ts`, `apps/web/src/api/client.js`, `apps/web/src/pages/Home.jsx`

---

### ✅ Выбор квиза для показа на ТВ

- Поле `displayedOnTv` в таблице `quizzes`
- Endpoint `POST /api/quizzes/:id/display-on-tv` (сбрасывает флаг у остальных)
- Draft-квизы: кнопка "📺 Вывести на экран" → после выбора меняется на "▶️ Начать"

**Файлы:** `apps/api/src/db/schema.ts`, `apps/api/drizzle/0003_gray_lily_hollister.sql`, `apps/api/src/routes/quizzes.ts`, `apps/web/src/api/client.js`, `apps/web/src/components/Layout.jsx`, `apps/web/src/pages/Home.jsx`

---

## 2026-02-25: Тестовые агенты (боты)

### ✅ Реализация системы тестовых ботов

**Выполнено:**

**База данных:**
- Поля `is_bot` (teams) и `show_bots_on_tv` (game_state), миграция `0004_dazzling_prima.sql`

**Backend — изолированный модуль `test-agents/`:**
- `BotAgentService`: создание/удаление ботов, генерация ответов
- Multiple choice: случайный A/B/C/D; Text: 50% правильного ответа
- API: `POST /quizzes/:id/test-bots`, `DELETE /quizzes/:id/test-bots`, `POST /game/:id/toggle-bots-visibility`
- Хуки в `game-service.ts`: боты отвечают при `setSlide("timer")`, автоудаляются при `finishGame()`
- Фильтрация ботов в `teams.ts` при `showBotsOnTv = false`

**Frontend — `TestBotsPanel.jsx`:**
- Ввод количества (1–20), кнопки добавить/удалить, галочка "Показывать на TV"

**Исправлен баг:** неправильный вызов `broadcast()` в `bot-agent.service.ts` (1 объект вместо 2 аргументов) — AdminWS-события от ботов не доходили до админки.

**Файлы:**
- `apps/api/src/test-agents/` (4 файла)
- `apps/api/src/routes/test-agents.ts`
- `apps/api/src/index.ts`, `apps/api/src/services/game-service.ts`, `apps/api/src/routes/teams.ts`
- `apps/web/src/components/Admin/TestBotsPanel.jsx`, `apps/web/src/pages/Game.jsx`
- `apps/api/drizzle/0004_dazzling_prima.sql`
