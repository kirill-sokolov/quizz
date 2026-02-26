# История выполненных задач

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
