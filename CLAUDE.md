# Wedding Quiz — Telegram-бот для квизов на мероприятиях

## 📚 Документация

Полная документация находится в [`docs/`](./docs/):

- [**ARCHITECTURE.md**](./docs/ARCHITECTURE.md) — общая архитектура, стек, принципы
- [**DATABASE.md**](./docs/DATABASE.md) — схема БД, все таблицы, связи, enum-ы
- [**API.md**](./docs/API.md) — все endpoints, request/response форматы
- [**WEBSOCKET.md**](./docs/WEBSOCKET.md) — события WebSocket, формат payload-ов
- [**BOT.md**](./docs/BOT.md) — команды бота, flow взаимодействия, webhook формат
- [**QUIZ-FLOW.md**](./docs/QUIZ-FLOW.md) — бизнес-логика: жизненный цикл квиза, состояния, переходы
- [**FRONTEND.md**](./docs/FRONTEND.md) — структура компонентов Admin и TV, роутинг
- [**IMPORT.md**](./docs/IMPORT.md) — логика импорта DOCX/ZIP, LLM промпты

## 🎯 Архитектура (кратко)

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

- **Telegram Bot** — капитаны команд: ввод названия команды, отправка ответов
- **Web Admin** — ведущий: управление игрой, переключение слайдов, кик игроков
- **Web TV** — экран для зрителей: только вопрос → таймер → ответ → статистика (read-only)
- **Backend API** — единственный источник истины, бизнес-логика

## 📝 Текущий статус

✅ **Реализовано:**
- Полный цикл квиза: создание → импорт → регистрация → игра → результаты
- Импорт DOCX + ZIP через LLM (OpenRouter API)
- Real-time синхронизация через WebSocket
- Telegram бот для команд
- TV экран с полноэкранным режимом
- Админка для ведущего
- Оценка текстовых ответов через LLM
- Удаление квизов
- Автоматический пропуск пустых слайдов (video_warning/video_intro)

📋 **Ближайшие планы** (см. [`PLAN.md`](./PLAN.md)):

### Этап 1 ✅
- ~~Полностью убрать OCR~~ (сделано)

### Этап 2
- Web TV: QR код больше — максимум доступного пространства
- Web TV: на слайде регистрации убрать цифры команд, красиво оформить

### Этап 3
- Web TV: шрифт результатов больше (в 2 раза)
- Web TV: результаты появляются постепенно (2→3→4→...→1 место последним)

### Этап 4
- Web TV + Admin: места появляются при клике из админки

### Этап 5
- Telegram Bot: капитаны получают вопрос только на слайде таймера

### Этап 6
- API: улучшить оценку текстовых ответов (валидация, логика подсчета)

### Этап 7
- Web Admin + TV: слайд "Спасибо" в конце
- Web Admin + TV: опциональный дополнительный слайд после "Спасибо"

### Этап 8
- Web Admin + TV: дополнительные слайды между вопросами (шутки) с поддержкой mp4

### Этап 9
- Web Admin: улучшить seed Demo quiz для покрытия всех кейсов

## 🛠 Стек технологий

**Backend:**
- Node.js + TypeScript
- Fastify (HTTP + WebSocket)
- Drizzle ORM + PostgreSQL
- OpenRouter API (LLM)
- node-telegram-bot-api

**Frontend:**
- React (Vite) + React Router
- Tailwind CSS
- WebSocket (real-time)

**Деплой:**
- Docker Compose
- Nginx (опционально)

## 💡 Правила работы

1. **Документация первична** — всегда сверяйся с `docs/` перед изменениями
2. **Один этап за раз** — реализовывать по одному этапу из PLAN.md
3. **Подтверждение после каждого этапа** — ждать OK от пользователя
4. **Безопасность** — не использовать деструктивные git команды без явного запроса
5. **DRY принцип** — использовать service layer, избегать дублирования кода
6. **Real-time обновления** — всегда использовать WebSocket для синхронизации TV и Admin

## 📂 Структура проекта

```
wedding-quiz/
├── apps/
│   ├── api/              # Backend (Node.js + Fastify)
│   │   ├── src/
│   │   │   ├── db/       # Drizzle schema, миграции
│   │   │   ├── routes/   # HTTP endpoints
│   │   │   ├── services/ # Бизнес-логика
│   │   │   ├── bot/      # Telegram bot
│   │   │   └── server.ts
│   │   └── Dockerfile
│   └── web/              # Frontend (React + Vite)
│       ├── src/
│       │   ├── pages/    # Admin, TV, Game
│       │   ├── components/
│       │   └── api/
│       └── Dockerfile
├── docs/                 # Документация
├── PLAN.md               # План развития
└── docker-compose.yml
```

## 🚀 Быстрый старт

```bash
# Запуск в dev режиме
docker compose up -d

# Пересоздать БД и seed данные
docker exec -it wedding-quiz-api-1 npm run db:migrate
docker exec -it wedding-quiz-api-1 npm run seed

# Логи
docker compose logs -f api
```

## 🔗 Полезные ссылки

- Документация: [`docs/`](./docs/)
- План развития: [`PLAN.md`](./PLAN.md)
- История задач: [`DONE.md`](./DONE.md)

---

**Важно:** Перед началом работы всегда читай соответствующие разделы документации в `docs/`.
