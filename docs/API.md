# API Endpoints

Базовый URL: `/api`

## Аутентификация

### POST `/auth/login`
Вход в админ-панель.

**Request:**
```json
{
  "username": "admin",
  "password": "password"
}
```

**Response:**
```json
{
  "success": true
}
```
Set-Cookie: `auth_token=...`

### POST `/auth/verify`
Проверка токена.

**Response:**
```json
{
  "valid": true
}
```

### POST `/auth/logout`
Выход.

**Response:**
```json
{
  "success": true
}
```

---

## Квизы

### GET `/quizzes`
Список всех квизов.

**Response:**
```json
[
  {
    "id": 1,
    "title": "Квиз Анны и Ивана",
    "status": "draft",
    "joinCode": "ABC123",
    "demoImageUrl": "/api/media/demo.png",
    "rulesImageUrl": "/api/media/rules.png",
    "createdAt": "2026-02-25T10:00:00Z"
  }
]
```

### GET `/quizzes/:id`
Получить квиз по ID.

### GET `/quizzes/by-code/:code`
Получить квиз по joinCode (для TV и бота).

### POST `/quizzes`
Создать новый квиз.

**Request:**
```json
{
  "title": "Квиз Анны и Ивана"
}
```

### PATCH `/quizzes/:id`
Обновить квиз.

**Request:**
```json
{
  "title": "Новое название",
  "demoImageUrl": "/api/media/new-demo.png",
  "rulesImageUrl": "/api/media/new-rules.png"
}
```

### DELETE `/quizzes/:id`
Удалить квиз.

### POST `/quizzes/:id/display-on-tv`
Вывести квиз на ТВ (сбрасывает флаг у других квизов).

**Response:**
```json
{
  "ok": true,
  "quiz": {
    "id": 1,
    "title": "Квиз Анны и Ивана",
    "displayedOnTv": true,
    ...
  }
}
```

**Примечание:** Только один квиз может быть выбран для показа на ТВ. При установке флага у одного квиза, у всех остальных `displayedOnTv` устанавливается в `false`.

---

## Вопросы

### GET `/quizzes/:id/questions`
Список вопросов квиза (с слайдами).

**Response:**
```json
[
  {
    "id": 1,
    "quizId": 1,
    "orderNum": 1,
    "text": "Сколько лет Ивану?",
    "questionType": "choice",
    "options": ["25", "28", "30", "32"],
    "correctAnswer": "28",
    "explanation": "Ивану 28 лет",
    "timeLimitSec": 30,
    "timerPosition": "center",
    "weight": 1,
    "slides": [
      {
        "id": 1,
        "questionId": 1,
        "type": "question",
        "imageUrl": "/api/media/question-1.png",
        "videoUrl": null,
        "videoLayout": null
      },
      {
        "id": 2,
        "questionId": 1,
        "type": "timer",
        "imageUrl": "/api/media/question-1.png",
        "videoUrl": null,
        "videoLayout": null
      },
      {
        "id": 3,
        "questionId": 1,
        "type": "answer",
        "imageUrl": "/api/media/answer-1.png",
        "videoUrl": null,
        "videoLayout": null
      }
    ]
  }
]
```

### POST `/quizzes/:id/questions`
Создать вопрос.

### PATCH `/questions/:id`
Обновить вопрос (с слайдами).

**Request:**
```json
{
  "text": "Новый текст вопроса",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "B",
  "timeLimitSec": 45,
  "slides": [
    {
      "id": 1,
      "type": "question",
      "imageUrl": "/api/media/new-question.png"
    }
  ]
}
```

### DELETE `/questions/:id`
Удалить вопрос.

---

## Игра (Game State)

### GET `/game/state/:quizId`
Получить состояние игры.

**Response:**
```json
{
  "id": 1,
  "quizId": 1,
  "status": "playing",
  "registrationOpen": false,
  "currentQuestionId": 5,
  "currentSlide": "timer",
  "timerStartedAt": "2026-02-25T14:30:00Z"
}
```

### POST `/game/start`
Запустить квиз (создать game_state, генерировать joinCode).

**Request:**
```json
{
  "quizId": 1
}
```

### POST `/game/open-registration`
Открыть регистрацию команд.

### POST `/game/begin`
Начать игру (закрыть регистрацию, перейти к первому вопросу).

### POST `/game/next-question`
Перейти к следующему вопросу.

### POST `/game/set-slide`
Переключить слайд текущего вопроса.

**Request:**
```json
{
  "quizId": 1,
  "slide": "timer"
}
```

### POST `/game/remind`
Отправить напоминание в Telegram (всем или одной команде).

**Request:**
```json
{
  "quizId": 1,
  "teamId": 5  // optional
}
```

### POST `/game/finish`
Завершить квиз (показать результаты).

### POST `/game/restart`
Перезапустить квиз (удалить команды и ответы, вернуть в draft).

### POST `/game/archive`
Архивировать квиз.

### GET `/game/results/:quizId`
Получить итоговые результаты.

**Response:**
```json
[
  {
    "teamId": 3,
    "teamName": "Команда Алексея",
    "totalScore": 85,
    "correctAnswers": 17,
    "totalAnswers": 20
  }
]
```

---

## Команды

### GET `/quizzes/:id/teams`
Список команд квиза.

**Query params:**
- `all=true` — включить выгнанные команды

### DELETE `/teams/:id`
Выгнать команду (kick).

---

## Ответы

### GET `/questions/:id/answers`
Список ответов на вопрос.

**Response:**
```json
[
  {
    "id": 1,
    "questionId": 5,
    "teamId": 3,
    "answerText": "B",
    "isCorrect": true,
    "awardedScore": 1,
    "submittedAt": "2026-02-25T14:31:00Z"
  }
]
```

### PATCH `/answers/:id/score`
Обновить баллы за ответ (для text вопросов, ручная правка).

**Request:**
```json
{
  "score": 0.8
}
```

---

## Импорт

### POST `/quizzes/:id/import-docx`
Распарсить DOCX с вопросами (через LLM).

**Request:** multipart/form-data
- `docx` — файл .docx
- `model` — модель LLM (optional)

**Response:**
```json
{
  "questions": [
    {
      "title": "Вопрос 1",
      "questionType": "choice",
      "options": ["A", "B", "C", "D"],
      "correctIndex": 1,
      "correctAnswer": "B",
      "explanation": "Потому что..."
    }
  ]
}
```

### POST `/quizzes/:id/import-zip`
Импортировать ZIP со слайдами (+ опционально DOCX).

**Request:** multipart/form-data
- `file` — ZIP архив
- `model` — модель LLM (optional)
- `docxQuestions` — JSON с pre-parsed вопросами (optional)
- `ocrHints` — OCR подсказки (optional, deprecated)

**Response:**
```json
{
  "questions": [...],
  "demoImageUrl": "/api/media/demo.png",
  "rulesImageUrl": "/api/media/rules.png"
}
```

### POST `/quizzes/:id/import-save`
Сохранить preview импорта в БД.

**Request:**
```json
{
  "questions": [...],
  "demoImageUrl": "/api/media/demo.png"
}
```

---

## Медиа

### POST `/media/upload`
Загрузить файл.

**Request:** multipart/form-data
- `file` — изображение или видео

**Response:**
```json
{
  "path": "/api/media/abc123.jpg"
}
```

### GET `/media/:filename`
Получить файл.

---

## Webhook (Telegram Bot)

### POST `/webhook`
Обработка обновлений от Telegram Bot API.

**Request:** (от Telegram)
```json
{
  "message": {
    "chat": {"id": 12345},
    "text": "/start ABC123"
  }
}
```

---

## Админ

### POST `/admin/seed`
Добавить демо-квиз БЕЗ удаления существующих данных.

**Response:**
```json
{
  "ok": true,
  "quizId": 1,
  "quizTitle": "Свадебный квиз",
  "joinCode": "ABC123",
  "questionsCount": 3
}
```

**Примечание:** Безопасная операция. Создаёт нового админа (если нет) и добавляет новый демо-квиз с 3 тестовыми вопросами.

### POST `/admin/reset`
⚠️ **ОПАСНО:** Полный сброс БД — удаляет ВСЕ квизы, команды, ответы и создаёт демо-квиз.

**Response:**
```json
{
  "ok": true,
  "quizId": 1,
  "quizTitle": "Свадебный квиз",
  "joinCode": "ABC123",
  "questionsCount": 3
}
```

**Примечание:** Деструктивная операция. Удаляет все данные и создаёт чистый демо-квиз.

---

## Тестовые агенты (боты)

### POST `/quizzes/:id/test-bots`
Создать тестовых ботов для квиза.

**Request:**
```json
{
  "count": 5  // 1-20
}
```

**Response:**
```json
{
  "ok": true,
  "bots": [
    { "id": 1, "teamId": 10, "name": "🤖 Бот 1", "quizId": 1 },
    { "id": 2, "teamId": 11, "name": "🤖 Бот 2", "quizId": 1 }
  ],
  "count": 5
}
```

### DELETE `/quizzes/:id/test-bots`
Удалить всех тестовых ботов квиза.

**Response:**
```json
{
  "ok": true
}
```

### POST `/game/:id/toggle-bots-visibility`
Переключить показ ботов на TV.

**Request:**
```json
{
  "showBotsOnTv": false
}
```

**Response:**
```json
{
  "ok": true,
  "showBotsOnTv": false
}
```

---

## WebSocket

См. [WEBSOCKET.md](./WEBSOCKET.md)
