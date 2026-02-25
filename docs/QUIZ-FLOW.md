# Жизненный цикл квиза

## Статусы квиза

```
draft → active → finished → archived
  ↑                           |
  └───────────────────────────┘
           restart
```

### `draft`
- Квиз создан, редактируется
- Можно добавлять/удалять вопросы
- Можно импортировать DOCX/ZIP
- Кнопка: **"Начать"**

### `active`
- Квиз запущен, идёт игра
- Генерируется `joinCode`
- Создаётся `game_state`
- Нельзя редактировать вопросы
- TV показывает demo слайд
- Кнопка: **"Завершить"**

### `finished`
- Квиз завершён
- Показываются результаты на TV
- В админке доступна статистика
- Кнопка: **"Архивировать"** или **"Перезапустить"**

### `archived`
- Квиз архивирован
- Результаты сохранены, но TV показывает demo слайд
- Кнопка: **"Перезапустить"**

---

## Состояния игры (`game_state.status`)

```
lobby → playing → finished
```

### `lobby`
- Ожидание начала игры
- TV показывает demo слайд или правила
- Команды могут регистрироваться (если `registrationOpen = true`)

### `playing`
- Идёт игра
- Отображается текущий вопрос и слайд
- Команды отвечают через Telegram

### `finished`
- Игра завершена
- Показываются результаты

---

## Слайды вопроса

```
video_warning → video_intro → question → timer → answer
   (optional)     (optional)
```

### `video_warning`
- Предупреждение о видео-вопросе
- Текст типа "Видео вопрос. Приготовьтесь смотреть!"
- **Пропускается**, если нет imageUrl/videoUrl

### `video_intro`
- Само видео (YouTube или mp4)
- **Пропускается**, если нет imageUrl/videoUrl

### `question`
- Слайд с вопросом и вариантами ответа
- **Обязательный**

### `timer`
- Слайд с таймером
- Команды могут отправлять ответы через бота
- Таймер запускается автоматически
- **Обязательный**

### `answer`
- Слайд с правильным ответом
- Показывается после того как все ответили или время вышло
- **Обязательный**

---

## Последовательность действий

### 1. Подготовка квиза
```
1. Создать квиз (POST /quizzes)
2. Импортировать DOCX + ZIP (POST /import-docx, POST /import-zip)
3. Проверить preview, отредактировать при необходимости
4. Сохранить (POST /import-save)
5. Загрузить demo и rules картинки
```

### 2. Запуск квиза
```
1. Кнопка "Начать" → POST /game/start
   - status: draft → active
   - Генерируется joinCode (например "ABC123")
   - Создаётся game_state (status=lobby, registrationOpen=false)
   - WebSocket: game_lobby

2. TV открывается по ссылке /tv/ABC123
   - Показывается demo слайд

3. Кнопка "Открыть регистрацию" → POST /game/open-registration
   - game_state.registrationOpen = true
   - WebSocket: registration_opened
   - TV показывает QR-код и список команд
```

### 3. Регистрация команд
```
1. Капитан сканирует QR → открывается t.me/bot?start=ABC123
2. /start ABC123 → бот спрашивает название команды
3. Капитан вводит название
4. POST /bot/register-team
   - Создаётся запись в teams
   - WebSocket: team_registered
   - TV добавляет команду в список
```

### 4. Начало игры
```
1. Кнопка "Начать игру" → POST /game/begin
   - game_state.status = playing
   - game_state.registrationOpen = false
   - Переход к первому вопросу:
     - game_state.currentQuestionId = 1
     - game_state.currentSlide = "video_warning" или "question" (если video_warning пустой)
   - WebSocket: slide_changed
   - TV показывает первый слайд вопроса
```

### 5. Проведение вопроса
```
1. Ведущий переключает слайды кнопками ◀ ▶
   - question → timer → answer

2. При переходе на "timer":
   - POST /game/set-slide {slide: "timer"}
   - game_state.timerStartedAt = now()
   - WebSocket: slide_changed
   - Бот автоматически отправляет вопрос всем командам

3. Команды отвечают: /answer B
   - POST /bot/submit-answer
   - Сохраняется в answers
   - Команда видит ✅ "Ответ принят!"

4. Ведущий в админке видит кто ответил
   - Может отправить напоминание (POST /game/remind)

5. Переход на слайд "answer":
   - POST /game/set-slide {slide: "answer"}
   - Если вопрос text-типа → автоматически запускается LLM оценка
   - TV показывает правильный ответ
```

### 6. Следующий вопрос
```
1. Кнопка "Следующий вопрос" → POST /game/next-question
   - game_state.currentQuestionId = next
   - game_state.currentSlide = "video_warning" или "question"
   - WebSocket: slide_changed
   - TV переключается на новый вопрос
```

### 7. Завершение квиза
```
1. После последнего вопроса: кнопка "Завершить" → POST /game/finish
   - status: active → finished
   - game_state.status = finished
   - Рассчитываются результаты
   - WebSocket: quiz_finished
   - TV показывает итоговую таблицу

2. Результаты (GET /game/results/:id):
   - Команды отсортированы по totalScore
   - Для каждой команды: correctAnswers, totalAnswers, totalScore
```

### 8. Архивирование или перезапуск
```
Архивировать:
  POST /game/archive
  - status: finished → archived
  - WebSocket: quiz_archived
  - TV показывает demo слайд

Перезапустить:
  POST /game/restart
  - Удаляются teams, answers, game_state
  - status: finished → draft
  - Можно снова редактировать и запускать
```

---

## Правила оценки

### Choice вопросы
- Правильный ответ = `question.weight` баллов (обычно 1)
- Неправильный = 0 баллов
- Проверяется автоматически при сохранении ответа

### Text вопросы
- Оцениваются LLM (POST /llm/evaluate-text-answers)
- Оценка от 0.0 до 1.0
- Итоговый балл = `score * question.weight`
- Запускается автоматически при переходе на слайд "answer"
- Ведущий может изменить оценку вручную (PATCH /answers/:id/score)

---

## Диаграмма последовательности

```
Ведущий        API          TV         Bot      Команда
   |            |            |          |          |
   |--START---->|            |          |          |
   |            |--game_lobby-->        |          |
   |            |            |--demo----|          |
   |            |            |          |          |
   |--REGISTER->|            |          |          |
   |            |--reg_open->|          |          |
   |            |            |--QR+list-|          |
   |            |            |          |          |
   |            |            |          |<-/start--|
   |            |<--register-|          |          |
   |            |--team_reg->|          |          |
   |            |            |--add team|          |
   |            |            |          |--confirm>|
   |            |            |          |          |
   |--BEGIN---->|            |          |          |
   |            |--slide_ch->|          |          |
   |            |            |--question|          |
   |            |            |          |          |
   |--TIMER---->|            |          |          |
   |            |--slide_ch->|          |          |
   |            |            |--timer---|          |
   |            |            |          |--quest-->|
   |            |            |          |          |
   |            |            |          |<-/answer-|
   |            |<--submit---|          |          |
   |            |            |          |--accept->|
   |            |            |          |          |
   |--ANSWER--->|            |          |          |
   |            |--slide_ch->|          |          |
   |            |            |--answer--|          |
   |            |            |          |          |
   |--FINISH--->|            |          |          |
   |            |--quiz_fin->|          |          |
   |            |            |--results-|          |
```

---

## См. также
- [API.md](./API.md) — Endpoints
- [WEBSOCKET.md](./WEBSOCKET.md) — Real-time события
- [BOT.md](./BOT.md) — Telegram bot
- [DATABASE.md](./DATABASE.md) — Структура БД
