# База данных

## Схема

### Таблицы

#### `quizzes`
Квизы (события).

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial PRIMARY KEY | ID квиза |
| title | text NOT NULL | Название квиза |
| status | text NOT NULL | Статус: `draft`, `active`, `finished`, `archived` |
| joinCode | text UNIQUE | Код для подключения к квизу |
| displayedOnTv | boolean NOT NULL DEFAULT false | Флаг: показывать ли этот квиз на ТВ (только один может быть true) |
| demoImageUrl | text | URL демо-слайда (показывается на /tv до начала) |
| rulesImageUrl | text | URL слайда с правилами |
| thanksImageUrl | text | URL слайда «Спасибо» (показывается после результатов) |
| finalImageUrl | text | URL финального закрывающего слайда (перед выключением TV) |
| createdAt | timestamp | Дата создания |

#### `questions`
Вопросы квиза.

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial PRIMARY KEY | ID вопроса |
| quizId | integer REFERENCES quizzes(id) | Ссылка на квиз |
| orderNum | integer NOT NULL | Порядковый номер |
| text | text NOT NULL | Текст вопроса |
| questionType | text NOT NULL | Тип: `choice` (A/B/C/D) или `text` (свободный ввод) |
| options | text[] | Варианты ответа (для choice) |
| correctAnswer | text NOT NULL | Правильный ответ |
| explanation | text | Объяснение ответа |
| timeLimitSec | integer NOT NULL | Лимит времени (сек) |
| timerPosition | text | Позиция таймера: `center`, `top-left`, `top-right`, `bottom-left`, `bottom-right` |
| weight | integer DEFAULT 1 | Вес вопроса (баллы за правильный ответ) |

#### `slides`
Слайды для каждого вопроса.

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial PRIMARY KEY | ID слайда |
| questionId | integer REFERENCES questions(id) | Ссылка на вопрос |
| type | text NOT NULL | Тип слайда: `video_warning`, `video_intro`, `question`, `timer`, `answer`, `extra` |
| imageUrl | text | URL картинки слайда |
| videoUrl | text | URL видео (для video_intro или наложения) |
| videoLayout | jsonb | Позиция видео: `{top, left, width, height}` в % |
| sortOrder | integer NOT NULL DEFAULT 0 | Порядок слайда внутри вопроса (определяет навигацию ◀▶) |

#### `teams`
Команды (капитаны).

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial PRIMARY KEY | ID команды |
| quizId | integer REFERENCES quizzes(id) | Ссылка на квиз |
| name | text NOT NULL | Название команды |
| chatId | bigint UNIQUE | Telegram chat ID капитана |
| isKicked | boolean DEFAULT false | Выгнана ли команда |
| isBot | boolean DEFAULT false | Тестовый бот (для симуляции команд) |
| registeredAt | timestamp | Дата регистрации |

#### `answers`
Ответы команд на вопросы.

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial PRIMARY KEY | ID ответа |
| questionId | integer REFERENCES questions(id) | Ссылка на вопрос |
| teamId | integer REFERENCES teams(id) | Ссылка на команду |
| answerText | text NOT NULL | Текст ответа (для choice: A/B/C/D, для text: свободный текст) |
| isCorrect | boolean | Правильный ли ответ (для choice) |
| awardedScore | integer | Баллы за ответ (для text, проставляется LLM или вручную) |
| submittedAt | timestamp | Время отправки ответа |

#### `game_state`
Текущее состояние игры (одна строка на квиз).

| Поле | Тип | Описание |
|------|-----|----------|
| id | serial PRIMARY KEY | ID состояния |
| quizId | integer UNIQUE REFERENCES quizzes(id) | Ссылка на квиз |
| status | text NOT NULL | Статус: `lobby`, `playing`, `finished` |
| registrationOpen | boolean DEFAULT false | Открыта ли регистрация |
| currentQuestionId | integer REFERENCES questions(id) | Текущий вопрос |
| currentSlide | text | Текущий слайд: `video_warning`, `video_intro`, `question`, `timer`, `answer`, `extra`, `results`, `thanks`, `final` |
| currentSlideId | integer REFERENCES slides(id) | ID конкретного слайда (для точной навигации, null для post-game slides) |
| timerStartedAt | timestamp | Время запуска таймера |
| showBotsOnTv | boolean DEFAULT true | Показывать ли тестовых ботов на TV |

## Индексы

```sql
CREATE INDEX idx_questions_quiz ON questions(quizId);
CREATE INDEX idx_slides_question ON slides(questionId);
CREATE INDEX idx_teams_quiz ON teams(quizId);
CREATE INDEX idx_teams_chat ON teams(chatId);
CREATE INDEX idx_answers_question ON answers(questionId);
CREATE INDEX idx_answers_team ON answers(teamId);
CREATE INDEX idx_game_state_quiz ON game_state(quizId);
```

## Миграции

Файлы миграций: `apps/api/src/db/migrations/`

Применение миграций:
```bash
npm run db:migrate
```

## Enum-ы

### Quiz Status
- `draft` — черновик, редактируется
- `active` — квиз запущен, идёт игра
- `finished` — квиз завершён, показаны результаты
- `archived` — квиз архивирован

### Question Type
- `choice` — выбор из A/B/C/D
- `text` — свободный текст (оценивается LLM или вручную)

### Slide Type
- `video_warning` — предупреждение о видео (опционально)
- `video_intro` — видео-вступление (опционально)
- `question` — слайд с вопросом
- `timer` — слайд с таймером
- `answer` — слайд с правильным ответом
- `extra` — дополнительный/шуточный слайд (в любой позиции внутри вопроса, определяется `sort_order`)
- `results` — итоговые результаты
- `thanks` — слайд «Спасибо» (опционально, если нет картинки — кнопка не появляется)
- `final` — финальный закрывающий слайд (опционально, перед выключением TV)

### Game State Status
- `lobby` — лобби (до начала игры)
- `playing` — идёт игра
- `finished` — игра завершена

### Timer Position
- `center` — по центру экрана
- `top-left`, `top-right` — верхние углы
- `bottom-left`, `bottom-right` — нижние углы

## См. также
- [ARCHITECTURE.md](./ARCHITECTURE.md) — общая архитектура
- [QUIZ-FLOW.md](./QUIZ-FLOW.md) — жизненный цикл квиза
