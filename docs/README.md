# 📚 Документация проекта Wedding Quiz

## 📖 Содержание

### 🏗 Архитектура и технологии
- [**ARCHITECTURE.md**](./ARCHITECTURE.md) — общая архитектура, стек технологий, принципы разработки

### 💾 Данные
- [**DATABASE.md**](./DATABASE.md) — схема базы данных, все таблицы, связи, enum-ы, индексы

### 🌐 API и интеграции
- [**API.md**](./API.md) — все REST endpoints, форматы request/response
- [**WEBSOCKET.md**](./WEBSOCKET.md) — WebSocket события, формат payload-ов, подключение
- [**BOT.md**](./BOT.md) — Telegram bot команды, flow взаимодействия, webhook

### 🎮 Бизнес-логика
- [**QUIZ-FLOW.md**](./QUIZ-FLOW.md) — жизненный цикл квиза, состояния, переходы, правила оценки

### 🎨 Фронтенд
- [**FRONTEND.md**](./FRONTEND.md) — структура React компонентов, роутинг, TV экран, стили

### 📥 Импорт
- [**IMPORT.md**](./IMPORT.md) — логика импорта DOCX/ZIP, LLM промпты, парсинг

---

## 🚀 Быстрая навигация

### Начало работы
1. Прочитай [ARCHITECTURE.md](./ARCHITECTURE.md) — поймёшь общую структуру
2. Изучи [QUIZ-FLOW.md](./QUIZ-FLOW.md) — узнаешь как работает квиз
3. Открой [API.md](./API.md) — посмотри все endpoints

### Работа с кодом
- **Backend разработка** → [API.md](./API.md) + [DATABASE.md](./DATABASE.md)
- **Frontend разработка** → [FRONTEND.md](./FRONTEND.md) + [WEBSOCKET.md](./WEBSOCKET.md)
- **Telegram bot** → [BOT.md](./BOT.md)
- **Импорт квизов** → [IMPORT.md](./IMPORT.md)

### Debugging
- **Проблемы с игрой** → [QUIZ-FLOW.md](./QUIZ-FLOW.md)
- **Проблемы с real-time** → [WEBSOCKET.md](./WEBSOCKET.md)
- **Проблемы с импортом** → [IMPORT.md](./IMPORT.md)

---

## 📋 Диаграммы

### Архитектура системы
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

### Жизненный цикл квиза
```
draft → active → finished → archived
  ↑                           |
  └───────────────────────────┘
           restart
```

### Слайды вопроса
```
video_warning → video_intro → question → timer → answer
   (optional)     (optional)
```

---

## 🔍 Поиск по документации

| Ищешь | Смотри |
|-------|--------|
| Какие есть endpoints? | [API.md](./API.md) |
| Как устроена БД? | [DATABASE.md](./DATABASE.md) |
| Как работает игра? | [QUIZ-FLOW.md](./QUIZ-FLOW.md) |
| Как подключиться к WebSocket? | [WEBSOCKET.md](./WEBSOCKET.md) |
| Команды бота? | [BOT.md](./BOT.md) |
| Структура компонентов? | [FRONTEND.md](./FRONTEND.md) |
| Как работает импорт? | [IMPORT.md](./IMPORT.md) |
| Стек технологий? | [ARCHITECTURE.md](./ARCHITECTURE.md) |

---

## 📝 Соглашения

### Именование
- **API endpoints**: `/api/resource` (kebab-case)
- **WebSocket events**: `snake_case` (например: `slide_changed`)
- **Компоненты React**: `PascalCase` (например: `TVQuestion`)
- **Файлы**: `kebab-case.ext` (например: `game-service.ts`)

### Комментарии в коде
- TypeScript/JavaScript: `// Комментарий` или `/* Комментарий */`
- React JSX: `{/* Комментарий */}`
- Документация функций: JSDoc формат

### Git
- Коммиты: imperative mood, кратко (например: "Add quiz deletion button")
- Ветки: `feature/название`, `fix/название`

---

## 🤝 Вклад в проект

При внесении изменений:
1. Обнови соответствующий файл в `docs/` если меняется API, БД, или логика
2. Проверь что изменения соответствуют архитектурным принципам
3. Обнови `PLAN.md` если завершил этап разработки
4. Добавь запись в `DONE.md` с описанием изменений

---

## 📞 Контакты

Вопросы? Проблемы? Идеи?
- Открой issue в репозитории
- Или напиши мне напрямую

---

**Совет:** Добавь эту папку в закладки браузера для быстрого доступа к документации!
