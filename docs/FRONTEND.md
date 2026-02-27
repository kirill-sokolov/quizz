# Frontend структура

## Технологии
- **React** 18 (Vite)
- **React Router** — навигация
- **Tailwind CSS** — стили
- **WebSocket** — real-time обновления

## Структура

```
apps/web/src/
├── pages/              # Страницы
│   ├── Landing.jsx     # / — лендинг с ссылкой на админку
│   ├── Login.jsx       # /login — вход в админку
│   ├── Home.jsx        # /admin — список квизов
│   ├── QuizEdit.jsx    # /admin/quiz/:id/edit — редактор квиза
│   ├── Game.jsx        # /admin/game/:id — управление игрой (ведущий)
│   └── TV.jsx          # /tv/:code — экран для зрителей
├── components/
│   ├── QuestionForm.jsx      # Форма редактирования вопроса (с extras + drag&drop)
│   ├── ImportPreview.jsx     # Preview импорта DOCX+ZIP (с orderedSlides + drag&drop)
│   ├── slides/               # Drag & drop компоненты для слайдов
│   │   ├── SlideStrip.jsx    # Горизонтальная лента слайдов (для ImportPreview)
│   │   └── SlideDndList.jsx  # Вертикальный список с drag handles (для QuestionForm)
│   └── TV/                   # Компоненты TV экрана
│       ├── TVDemo.jsx        # Demo слайд
│       ├── TVRules.jsx       # Правила
│       ├── TVLobby.jsx       # Регистрация команд (QR + список)
│       ├── TVQuestion.jsx    # Слайд вопроса
│       ├── TVTimer.jsx       # Слайд таймера
│       ├── TVAnswer.jsx      # Слайд ответа
│       ├── TVExtraSlide.jsx  # Экстра-слайд (полноэкранная картинка/видео)
│       ├── TVResults.jsx     # Итоговая таблица
│       ├── TVVideoWarning.jsx
│       ├── TVVideoIntro.jsx
│       └── TVSlideBg.jsx     # Общий фон слайда (картинка + видео)
├── api/
│   └── client.js       # API клиент (fetch wrappers)
├── constants/
│   └── slides.js       # Константы типов слайдов
└── App.jsx             # Роутинг, AuthProvider
```

---

## Роутинг

### Публичные маршруты
- `/` — Landing page
- `/login` — Вход в админку
- `/tv/:code` — TV экран (доступ по joinCode)

### Защищённые маршруты (требуют авторизации)
- `/admin` — Список квизов
- `/admin/quiz/:id/edit` — Редактор квиза
- `/admin/game/:id` — Управление игрой

### App.jsx
```jsx
<Routes>
  <Route path="/" element={<Landing />} />
  <Route path="/login" element={<Login />} />
  <Route path="/tv/:joinCode" element={<TV />} />

  <Route element={<RequireAuth />}>
    <Route path="/admin" element={<Home />} />
    <Route path="/admin/quiz/:id/edit" element={<QuizEdit />} />
    <Route path="/admin/game/:id" element={<Game />} />
  </Route>
</Routes>
```

---

## Страницы

### Landing (`/`)
Простая страница с:
- Логотипом/названием проекта
- Кнопкой "Админка" → `/login`

### Login (`/login`)
Форма входа:
- Username + password
- POST `/api/auth/login`
- При успехе → `/admin`

### Home (`/admin`)
Список квизов:
- Таблица (десктоп) или карточки (мобайл)
- Для каждого квиза:
  - Название, статус, дата
  - Demo TV картинка (загрузка/замена)
  - Кнопки: "Редактировать" / "Начать" / "Управление" / "Перезапустить" / "Удалить"
- Кнопка "Создать квиз"
- Кнопка "Пересоздать из seed" (внизу)

### QuizEdit (`/admin/quiz/:id/edit`)
Редактор квиза:
- **Настройки**: загрузка картинок квиза:
  - Демо-слайд (заставка до начала)
  - Правила (после «Начать», до регистрации)
  - «Спасибо» (после раскрытия результатов)
  - Финальный (последний слайд перед выключением TV)
  - После успешного импорта настройки перезагружаются автоматически
- **Импорт**:
  - Шаг 1: Загрузить DOCX → LLM парсит вопросы
  - Шаг 2: Загрузить ZIP → LLM группирует слайды → preview → сохранить
  - LLM автоматически определяет demo/rules/thanks/final слайды из ZIP
- **Список вопросов**: редактирование, удаление, перестановка
- **Форма вопроса** (QuestionForm):
  - Текст вопроса, тип (choice/text), варианты, правильный ответ, пояснение
  - Время, позиция таймера, вес
  - Слайды: ordered list (question, timer, answer, video_warning, video_intro + extras)
  - Кнопка "+ Экстра-слайд" между каждыми двумя слайдами
  - Экстра-слайды: drag handle ⠿ для перестановки (via `SlideDndList`), кнопка удаления, upload image/video

### Game (`/admin/game/:id`)
Управление игрой (для ведущего):
- **Верх**:
  - Название квиза, joinCode, ссылка на TV
  - Статус игры
  - Кнопки: "Открыть регистрацию" / "Начать игру" / "Завершить"
- **Текущий вопрос**:
  - Номер вопроса (5 из 20)
  - Текст вопроса
  - Переключатель слайдов: ◀ [Слайд] ▶
  - Таймер (если слайд = timer)
  - Список команд + статус ответа (✅ ответил / ⏳ не ответил)
  - Кнопка "Напомнить" (всем или одной команде)
  - Кнопка "Следующий вопрос"
- **Результаты** (после завершения):
  - Итоговая таблица по командам
  - Кнопка "Показать следующее место на TV" (пошаговое раскрытие)
  - После раскрытия всех мест (если загружены картинки):
    - Кнопка "Показать «Спасибо» на TV" → слайд `thanks`
    - Кнопка "Показать финальный слайд на TV" → слайд `final`
  - Кнопки: "Архивировать" / "Перезапустить"

### TV (`/tv/:code`)
Экран для зрителей (TV или проектор):
- **Полноэкранный режим** (клик для переключения)
- **Масштабирование** (1920x1080 canvas, автомасштабирование под экран)
- **Real-time обновления** через WebSocket
- **Слайды**:
  - Demo (если квиз не начался)
  - Rules (после "Начать", до "Начать игру")
  - Lobby (регистрация команд): QR-код + список команд
  - Question / Timer / Answer (во время игры)
  - Results (итоговая таблица)
  - Thanks (слайд «Спасибо», опционально)
  - Final (финальный закрывающий слайд, опционально)
- **Без UI элементов**, только контент

---

## Компоненты TV

### TVSlideBg
Базовый компонент для всех слайдов:
- Фоновая картинка (imageUrl) — растягивается на весь экран
- Опционально видео (videoUrl):
  - Если `videoLayout` задан → видео в указанной позиции (top, left, width, height в %)
  - Если не задан → видео по центру с controls

### TVDemo
Полноэкранная картинка. Используется для нескольких слайдов:
- Demo — показывается до начала квиза (или когда квиз архивирован)
- Thanks (`thanks`) — слайд «Спасибо» после раскрытия результатов
- Final (`final`) — финальный закрывающий слайд перед выключением TV

### TVRules
Слайд с правилами (показывается после "Начать", до регистрации).

### TVLobby
Экран регистрации команд:
- **QR-код** (максимальный размер)
- **Список команд** (обновляется в реальном времени)

### TVQuestion
Слайд вопроса:
- Фоновая картинка слайда "question"

### TVTimer
Слайд таймера:
- Фоновая картинка слайда "timer"
- **Таймер** (круговой прогресс-бар):
  - Позиция: `question.timerPosition` (center / top-left / top-right / bottom-left / bottom-right)
  - Обратный отсчёт от `question.timeLimitSec`
  - Запускается с `state.timerStartedAt`

### TVAnswer
Слайд ответа:
- Фоновая картинка слайда "answer"

### TVExtraSlide
Экстра-слайд (произвольный контент между основными слайдами вопроса):
- Полноэкранная картинка (`imageUrl`) — `object-cover`
- Опционально видео (`videoUrl`) поверх картинки (autoPlay, loop)
- Используется для шуток, мемов, фото, анимаций
- TV определяет нужный экстра-слайд по `state.currentSlideId`

### TVVideoWarning
Предупреждение о видео-вопросе.

### TVVideoIntro
Видео-вступление (YouTube или mp4).

### TVResults
Итоговая таблица результатов с постепенным раскрытием мест:
- Пропс `results` — полный список команд (сортированный по убыванию)
- Пропс `revealCount` — сколько мест уже открыто (управляется из Admin)
- **Порядок раскрытия**: 2-е место → 3-е → ... → последнее → 1-е (самое последнее)
- **Слот 1-го места всегда забронирован**: пока не раскрыт — показывается placeholder (пунктирная рамка + `• • •`), чтобы layout не прыгал при появлении
- **Два режима**:
  - **Обычный** (1–8 команд): одна колонка, крупные шрифты
  - **Пьедестал** (9–21 команда): три колонки — центр (1–8), лево (9–15), право (16–21); боковые колонки выровнены снизу по уровню 8-го места (`items-end`)
- Анимация появления — `slideIn` (opacity + translateY)

---

## WebSocket подключение

### TV (`TV.jsx`)
```javascript
useEffect(() => {
  const ws = new WebSocket(getWsUrl());

  ws.onmessage = (ev) => {
    const { event, data } = JSON.parse(ev.data);
    if (data?.quizId !== quizId) return; // Фильтр по quizId

    switch (event) {
      case "slide_changed":
        setState(data);
        break;
      case "quiz_finished":
        setResults(data.results);
        setState({...state, status: "finished"});
        break;
      // ...
    }
  };

  ws.onclose = () => {
    // Переподключение через 3 секунды
    setTimeout(connect, 3000);
  };

  return () => ws.close();
}, [quizId]);
```

### Admin (`Game.jsx`)
Аналогично TV, но также обновляет список команд и ответов.

---

## Стили (Tailwind)

### Основные цвета
- **Amber** (желтый): `bg-amber-600`, `text-amber-600` — акценты, кнопки
- **Stone** (серый): `bg-stone-100`, `text-stone-600` — фон, текст
- **Green**: `bg-green-600` — статус "active", кнопка "Управление"
- **Red**: `bg-red-600` — кнопка "Удалить"
- **Blue**: `bg-blue-600` — кнопка "Перезапустить"

### Компоненты
- **Кнопки**: `px-4 py-2 rounded-lg transition font-medium`
- **Карточки**: `bg-white rounded-xl shadow-sm border border-stone-200`
- **Таблицы**: `border-b border-stone-100 hover:bg-stone-50/50`

### TV экран
- **Canvas**: 1920x1080px (фиксированный размер)
- **Transform**: `scale()` для подгонки под экран
- **Fullscreen**: клик на экран → `document.requestFullscreen()`

---

## API клиент (`client.js`)

### Структура
```javascript
export const quizzesApi = {
  list: () => request("/quizzes"),
  get: (id) => request(`/quizzes/${id}`),
  create: (title) => request("/quizzes", { method: "POST", body: JSON.stringify({title}) }),
  delete: (id) => request(`/quizzes/${id}`, { method: "DELETE" }),
  // ...
};

export const gameApi = { ... };
export const teamsApi = { ... };
export const importApi = { ... };
```

### Функции
- `request(path, options)` — базовая функция для fetch
- `getMediaUrl(path)` — формирует полный URL для медиа-файлов
- `getWsUrl()` — формирует WebSocket URL

---

## Компоненты Drag & Drop (slides/)

### SlideStrip
Горизонтальная лента слайдов для ImportPreview — два пространства:
- Props:
  - `orderedSlides: Array<{type, imageUrl}>` — базовые + явно вставленные экстры (сохраняются)
  - `unusedExtras: Array<{type, imageUrl}>` — пул неиспользованных экстр (показываются отдельно, при сохранении выбрасываются)
  - `onReorder(newOrderedSlides)` — перестановка уже вставленных экстр внутри ленты
  - `onPlaceExtra(poolIdx, insertAt)` — перенос экстра-слайда из пула в ленту
  - `onDeletePlaced(slideIdx)` — удалить вставленный экстра-слайд из ленты
- Основная лента: базовые слайды статичны, вставленные экстры — draggable с кнопкой ✕
- Пул экстр: отображается под лентой с подсказкой; при перетаскивании слайд уходит в ленту и исчезает из пула
- При перетаскивании показывает 60px drop-зоны между слайдами в основной ленте
- Использует `@dnd-kit/core`: `useDraggable` + `useDroppable` + `DragOverlay`
- IDs: `strip-{idx}` для слайдов ленты, `pool-{idx}` для слайдов пула, `gap-{idx}` для drop-зон

### SlideDndList
Вертикальный список слайдов с drag handles для QuestionForm:
- Props: `slides`, `onReorder(newSlides)`, `renderItem(slide, idx) → ReactNode`
- Базовые слайды: `disabled: true` — нельзя двигать
- Экстра-слайды: иконка ⠿ слева как drag handle
- Контент слайда передаётся через render prop — старый код не изменяется
- Использует `@dnd-kit/sortable`: `SortableContext` + `useSortable`

---

---

## Тестирование

### Стек

- **Vitest** + **jsdom** — unit/integration тесты (запуск без браузера)
- **@testing-library/react** — рендеринг компонентов
- **MSW** (`msw/node`) — мок HTTP API и WebSocket
- **@playwright/test** + **Chromium** — E2E тесты против реального Docker стека

### Запуск

```bash
# Unit + Integration (без Docker)
cd apps/web && npm run test

# E2E (требует запущенного Docker стека)
cd apps/web && npm run e2e
```

### Структура тестов

```
apps/web/
├── src/test/
│   ├── setup.ts              # jest-dom, моки браузерных API (AudioContext, matchMedia, ...)
│   ├── utils.jsx              # renderWithRouter, makeQuiz, makeState, makeQuestion, makeTeam
│   └── msw/
│       ├── handlers.ts        # MSW handlers для всех API endpoints
│       ├── server.ts          # setupServer (msw/node)
│       └── ws-mock.ts         # MockWebSocket + sendWsMessage + installWsMock
├── src/test/__tests__/
│   ├── TVResults.test.jsx     # 25 тестов — компонент TVResults
│   ├── TVTimer.test.jsx       # 19 тестов — TVTimer (fake timers)
│   ├── TVQuestion.test.jsx    # 13 тестов — TVQuestion
│   ├── TVLobby.test.jsx       # 7 тестов — TVLobby
│   ├── tv-misc-components.test.jsx  # 15 тестов — TVAnswer, TVDemo, TVExtraSlide
│   ├── TV.test.jsx            # TV.jsx render paths (все slide types)
│   ├── tv-page.test.jsx       # 13 integration тестов — TV.jsx + MSW + WS
│   └── game-page.test.jsx     # 15 integration тестов — Game.jsx + MSW + WS
└── e2e/
    ├── fixtures.ts            # login(), createTestQuiz(), startGame(), deleteQuiz()
    ├── tv-slides.spec.ts      # 6 E2E smoke тестов — TV для каждого slide type
    └── game-flow.spec.ts      # 1 E2E тест — полный флоу Admin + TV параллельно
```

### E2E fixtures (`e2e/fixtures.ts`)

Хелперы для работы с реальным API (`http://localhost:3000`):

- `login(request)` — авторизует как `admin/admin`
- `createTestQuiz(request, title?)` — создаёт квиз + один вопрос, возвращает `{ id, joinCode, title }`
- `startGame(request, quizId)` — вызывает `/api/game/start`
- `deleteQuiz(request, quizId)` — cleanup после теста

---

## См. также
- [ARCHITECTURE.md](./ARCHITECTURE.md) — общая архитектура
- [API.md](./API.md) — endpoints
- [WEBSOCKET.md](./WEBSOCKET.md) — real-time события
