# Импорт квизов (DOCX + ZIP)

## Обзор

Импорт квиза происходит в два этапа:
1. **DOCX** → парсинг текста вопросов через LLM
2. **ZIP** → парсинг слайдов и группировка по вопросам через LLM

## Этап 1: DOCX

### Формат DOCX
```
1. Сколько лет Ивану?
How old is Ivan?

A. 25
B. 28
C. 30
D. 32

Объяснение: Ивану 28 лет, он родился в 1998 году.
_______________________________________________________

2. Назовите 5 любимых фильмов Ивана.
Name 5 favorite movies of Ivan.

Правильный ответ: Матрица, Начало, Интерстеллар, Бойцовский клуб, Криминальное чтиво

Объяснение: Это его топ-5 по версии IMDb.
_______________________________________________________
```

### Парсинг
- **Endpoint**: `POST /api/quizzes/:id/import-docx`
- **LLM модель**: GPT-5 mini / GPT-4o mini / Gemini 3 Flash (выбор пользователя)
- **Промпт**: `buildDocxParsePrompt()` в `apps/api/src/services/llm/types.ts`

### Логика
1. Извлечь текст из DOCX (`extractTextFromDocx()`)
2. Отправить текст LLM с промптом
3. LLM возвращает JSON:
```json
{
  "questions": [
    {
      "title": "Сколько лет Ивану?",
      "questionType": "choice",
      "options": ["25", "28", "30", "32"],
      "correctIndex": 1,
      "correctAnswer": "28",
      "explanation": "Ивану 28 лет, он родился в 1998 году."
    },
    {
      "title": "Назовите 5 любимых фильмов Ивана.",
      "questionType": "text",
      "options": [],
      "correctIndex": -1,
      "correctAnswer": "Матрица, Начало, Интерстеллар, Бойцовский клуб, Криминальное чтиво",
      "explanation": "Это его топ-5 по версии IMDb."
    }
  ]
}
```

### Промпт (buildDocxParsePrompt)
```
Ты парсишь текст из DOCX файла с вопросами для квиза.

Структура документа (повторяющийся паттерн):
- Текст вопроса (может быть на двух языках)
- Варианты ответа ИЛИ правильный ответ текстом
- Объяснение (опционально)

КРИТИЧЕСКИ ВАЖНО — как определить тип вопроса:
• "choice" — варианты ответа идут СПИСКОМ на отдельных строках с A/B/C/D
  ЕСЛИ видишь 3-4 строки подряд с буквами A/B/C/D - это ВСЕГДА choice
  ЕСЛИ варианты картинки (только буквы без текста) - тоже choice, options оставь пустыми []

• "text" — правильный ответ написан INLINE (через запятую, в строку)
  НЕТ структуры A/B/C/D

Правила:
- "questionType" — "choice" (если A/B/C/D) или "text"
- "options" — массив вариантов (без A/B/C/D). Если варианты картинки → []
- "correctAnswer" — текст правильного ответа
- "explanation" — ПОЛНЫЙ текст объяснения (все строки до следующего вопроса)
```

**Ключевые изменения** (из истории):
- Промпт теперь различает choice с текстовыми вариантами vs choice с картинками
- Если в DOCX только буквы A/B/C/D без текста → `options: []`, LLM заполнит из ZIP

---

## Этап 2: ZIP + OCR (deprecated)

**Статус**: OCR больше не используется (PLAN.md Этап 1)

Ранее использовался Tesseract OCR + Vision модель для распознавания вариантов-картинок.
Сейчас упор на более чёткие DOCX + слайды.

---

## Этап 3: ZIP (слайды)

### Формат ZIP
```
quiz-slides.zip
├── 01.jpg    # Demo слайд (опционально)
├── 02.jpg    # Rules слайд (опционально)
├── 03.jpg    # Вопрос 1 (question)
├── 04.jpg    # Вопрос 1 (timer)
├── 05.jpg    # Вопрос 1 (answer)
├── 06.jpg    # Вопрос 2 (video_warning)
├── 07.jpg    # Вопрос 2 (video_intro)
├── 08.jpg    # Вопрос 2 (question)
├── 09.jpg    # Вопрос 2 (timer)
└── 10.jpg    # Вопрос 2 (answer)
```

### Парсинг
- **Endpoint**: `POST /api/quizzes/:id/import-zip`
- **LLM модель**: Kimi K2.5 / Grok 4 / Gemini 3 Flash / Gemini 3 Pro (выбор пользователя)
- **Промпт**: `buildHybridPrompt()` в `apps/api/src/services/llm/types.ts`

### Логика (Hybrid mode)
1. Извлечь все изображения из ZIP (`processZip()`)
2. Сохранить все изображения на диск (генерируются UUID имена)
3. Уменьшить изображения для LLM (`shrinkImage()` → 1024px, JPEG 80%)
4. Отправить LLM:
   - Уменьшенные изображения (base64)
   - Список вопросов из DOCX (текст + правильный ответ)
   - Промпт: сгруппируй слайды по вопросам
5. LLM возвращает JSON:
```json
{
  "questions": [
    {
      "slides": {
        "video_warning": null,
        "video_intro": null,
        "question": 2,
        "timer": 3,
        "answer": 4
      },
      "timer_position": "center"
    }
  ],
  "demoSlide": 0,
  "rulesSlide": 1
}
```
6. Смержить с DOCX данными → preview
7. Показать preview пользователю → редактирование → сохранение

### Промпт (buildHybridPrompt)
```
Ты анализируешь ${n} изображений — слайды квиза (экспортированы из Canva).

Всего вопросов: ${questionCount}.

ТЕКСТЫ ВОПРОСОВ ИЗ DOCX:
${questionHints.map(q => `${i+1}. "${q.title}" → правильный ответ: "${q.correctAnswer}"`)}

КЛЮЧЕВАЯ ПОДСКАЗКА: текст вопроса из DOCX будет на слайде «question».
На слайде «answer» будет выделен правильный ответ.

ВАЖНО — типы слайдов:
• «question» — слайд с текстом вопроса и вариантами A/B/C/D
• «answer» — тот же вопрос, один вариант выделен (цветом/обводкой)
• «timer» — тот же вопрос или пустой слайд (если есть отдельный слайд таймера)
• «video_warning» — предупреждение о видео ("Видео вопрос"), ПЕРЕД question
• «video_intro» — видео-слайд, после video_warning
• «demo» — заглушка до начала квиза
• «rules» — правила квиза

МУСОРНЫЕ слайды (игнорируй):
• Промежуточные слайды с шутками/анимациями
• Слайды благодарности/спонсоров

Задача:
1. Найди demo и rules слайды (если есть)
2. Для каждого вопроса из DOCX найди слайды: question, answer, timer
3. Если перед вопросом есть video_warning/video_intro — добавь их

Верни JSON:
{
  "questions": [
    {
      "slides": {
        "video_warning": null,
        "video_intro": null,
        "question": 2,
        "timer": 3,
        "answer": 4
      },
      "timer_position": "center"
    }
  ],
  "demoSlide": 0,
  "rulesSlide": 1
}
```

**Ключевые особенности**:
- LLM видит текст вопросов из DOCX → легче сопоставить слайды
- LLM видит правильный ответ → может найти слайд answer по выделенному тексту
- LLM определяет позицию таймера на слайде (по визуальному анализу)

---

## Сохранение в БД

### Логика (saveImportedQuiz)
```typescript
for (const item of preview.questions) {
  // 1. Создать вопрос
  const question = await db.insert(questions).values({
    quizId,
    orderNum: nextOrder++,
    text: item.text,
    questionType: item.questionType,
    options: item.options,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
    timeLimitSec: item.timeLimitSec,
    timerPosition: item.timerPosition,
    weight: item.weight || 1,
  });

  // 2. Создать слайды (только с контентом)
  for (const type of SLIDE_TYPES) {
    const imageUrl = item.slides[type];

    // Пропустить пустые video_warning/video_intro
    if ((type === "video_warning" || type === "video_intro") && !imageUrl) {
      continue;
    }

    await db.insert(slides).values({
      questionId: question.id,
      type,
      imageUrl,
    });
  }
}
```

**Важно**:
- Пустые `video_warning` и `video_intro` не создаются
- `question`, `timer`, `answer` создаются всегда (обязательные)

---

## LLM Providers

### OpenRouter
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **API Key**: `OPENROUTER_API_KEY` (env)
- **Модели**:
  - **Text**: GPT-4o mini, GPT-5 mini, Gemini 3 Flash
  - **Image**: Kimi K2.5, Grok 4, Gemini 3 Flash, Gemini 3 Pro

### Cost tracking
- Заголовок ответа: `x-openrouter-credits-used`
- Логируется в `apps/api/cost-log.jsonl`

### Fallback
Если выбранная модель недоступна, система пробует все модели по очереди.

---

## Оптимизации

### Shrinking images
- Resize до 1024px (longest side)
- JPEG quality 80%
- Цель: уменьшить размер payload для LLM

### Batch processing
- Все изображения отправляются в одном запросе
- LLM видит всю презентацию целиком → лучше группирует слайды

### Пропуск пустых слайдов
- `video_warning` и `video_intro` создаются только если есть imageUrl/videoUrl
- При старте вопроса система автоматически пропускает пустые слайды

---

## TODO (PLAN.md)

### Этап 1 ✅
- Полностью убрать OCR (сделано)

### Этап 8
- Поддержка дополнительных слайдов между вопросами (шутки, анимации)
- Поддержка mp4 видео

---

## См. также
- [API.md](./API.md) — Endpoints для импорта
- [FRONTEND.md](./FRONTEND.md) — UI для импорта (QuizEdit.jsx)
- [DATABASE.md](./DATABASE.md) — Структура таблиц questions/slides
