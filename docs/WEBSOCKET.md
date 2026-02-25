# WebSocket Events

URL: `ws://HOST/ws` или `wss://HOST/ws`

## Формат сообщений

Все сообщения имеют формат:
```json
{
  "event": "event_name",
  "data": { ... }
}
```

## События (Server → Client)

### `game_lobby`
Квиз запущен, показывается лобби.

**Data:**
```json
{
  "quizId": 1,
  "status": "lobby",
  "registrationOpen": false
}
```

**Реакция:**
- **TV**: показать demo слайд
- **Admin**: обновить состояние

---

### `registration_opened`
Открыта регистрация команд.

**Data:**
```json
{
  "quizId": 1,
  "registrationOpen": true
}
```

**Реакция:**
- **TV**: показать QR-код и список команд
- **Admin**: обновить UI

---

### `team_registered`
Зарегистрирована новая команда.

**Data:**
```json
{
  "quizId": 1,
  "teamId": 5,
  "teamName": "Команда Алексея"
}
```

**Реакция:**
- **TV**: добавить команду в список на экране регистрации
- **Admin**: обновить список команд

---

### `team_kicked`
Команда выгнана.

**Data:**
```json
{
  "quizId": 1,
  "teamId": 5
}
```

**Реакция:**
- **TV**: убрать команду из списка
- **Admin**: обновить список команд

---

### `slide_changed`
Переключился слайд.

**Data:**
```json
{
  "quizId": 1,
  "currentQuestionId": 10,
  "currentSlide": "timer",
  "timerStartedAt": "2026-02-25T14:30:00Z"
}
```

**Реакция:**
- **TV**: показать новый слайд (question/timer/answer)
- **Admin**: обновить UI, показать текущий слайд

---

### `quiz_finished`
Квиз завершён, показаны результаты.

**Data:**
```json
{
  "quizId": 1,
  "status": "finished",
  "results": [
    {
      "teamId": 3,
      "teamName": "Команда Алексея",
      "totalScore": 85,
      "correctAnswers": 17,
      "totalAnswers": 20
    }
  ]
}
```

**Реакция:**
- **TV**: показать экран с результатами
- **Admin**: перейти на страницу результатов

---

### `quiz_archived`
Квиз архивирован.

**Data:**
```json
{
  "quizId": 1,
  "status": "archived"
}
```

**Реакция:**
- **TV**: показать demo слайд
- **Admin**: обновить статус

---

## Подключение

### Frontend (TV)
```javascript
const ws = new WebSocket(getWsUrl());

ws.onmessage = (ev) => {
  const { event, data } = JSON.parse(ev.data);

  // Игнорировать события не нашего квиза
  if (data?.quizId !== currentQuizId) return;

  switch (event) {
    case "slide_changed":
      // Обновить state
      break;
    case "quiz_finished":
      // Показать результаты
      break;
  }
};
```

### Reconnect
- При разрыве соединения клиент автоматически переподключается через 3 секунды
- После переподключения загружается актуальное состояние через REST API

## Broadcast
- Все WebSocket события отправляются **всем подключенным клиентам**
- Клиенты сами фильтруют события по `quizId`

## См. также
- [API.md](./API.md) — REST endpoints
- [QUIZ-FLOW.md](./QUIZ-FLOW.md) — жизненный цикл квиза
