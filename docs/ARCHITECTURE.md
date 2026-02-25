# Архитектура проекта

## Общая схема

```
┌─────────────┐
│  Telegram   │──────┐
│     Bot     │      │
└─────────────┘      │
                     ▼
┌─────────────┐  ┌──────────────┐  ┌─────────────┐
│  Web Admin  │─▶│  Backend API │─▶│  PostgreSQL │
└─────────────┘  │   + WebSocket│  └─────────────┘
                 └──────────────┘
┌─────────────┐       │              ┌─────────────┐
│   Web TV    │───────┘              │    Redis    │
└─────────────┘                      └─────────────┘
```

## Стек технологий

### Backend
- **Node.js** + TypeScript
- **Fastify** — веб-фреймворк (HTTP + WebSocket)
- **Drizzle ORM** — работа с БД
- **PostgreSQL** — основная БД
- **Redis** (опционально) — кеш, сессии
- **node-telegram-bot-api** — Telegram Bot API
- **OpenRouter API** — LLM для импорта и оценки текстовых ответов

### Frontend
- **React** (Vite)
- **React Router** — навигация
- **Tailwind CSS** — стили
- **WebSocket** — real-time обновления

### Деплой
- **Docker Compose** — контейнеризация
- **Nginx** (опционально) — reverse proxy

## Структура директорий

```
wedding-quiz/
├── apps/
│   ├── api/          # Backend (Node.js + Fastify)
│   │   ├── src/
│   │   │   ├── db/           # Drizzle schema, миграции
│   │   │   ├── routes/       # HTTP endpoints
│   │   │   ├── services/     # Бизнес-логика
│   │   │   ├── bot/          # Telegram bot
│   │   │   └── server.ts     # Entry point
│   │   └── Dockerfile
│   └── web/          # Frontend (React + Vite)
│       ├── src/
│       │   ├── pages/        # Страницы (Admin, TV, Game)
│       │   ├── components/   # React компоненты
│       │   └── api/          # API client
│       └── Dockerfile
├── docs/             # Документация
└── docker-compose.yml
```

## Принципы

### Разделение ответственности
- **Backend API** — единственный источник истины, бизнес-логика
- **Web Admin** — управление квизом (только для ведущего)
- **Web TV** — отображение для зрителей (read-only, real-time)
- **Telegram Bot** — интерфейс для капитанов команд

### Real-time синхронизация
- WebSocket для мгновенных обновлений TV и Admin
- События: `game_lobby`, `registration_opened`, `team_registered`, `slide_changed`, `quiz_finished`

### Импорт квизов
- DOCX (текст) + ZIP (слайды) → LLM парсит → preview → сохранение
- LLM используется для:
  - Парсинга вопросов из DOCX
  - Группировки слайдов по вопросам
  - Оценки текстовых ответов

### Безопасность
- Все изменения квиза только через авторизацию (cookie-based auth)
- TV и бот — read-only доступ по коду

## См. также
- [DATABASE.md](./DATABASE.md) — схема БД
- [API.md](./API.md) — все endpoints
- [WEBSOCKET.md](./WEBSOCKET.md) — WebSocket события
- [QUIZ-FLOW.md](./QUIZ-FLOW.md) — жизненный цикл квиза
