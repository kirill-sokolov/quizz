export interface ShrunkImage {
  data: string;      // base64 JPEG
  mimeType: string;  // always "image/jpeg" after shrink
  name: string;      // original filename for prompt context
}

export interface ParsedQuizQuestion {
  question: string;
  options: { A: string; B: string; C: string; D: string };
  correct: string;
  time_limit_sec: number;
  timer_position?: string;
  slides: {
    video_warning: number | null;
    video_intro: number | null;
    question: number | null;
    timer: number | null;
    answer: number | null;
  };
}

export interface ParsedResult {
  questions: ParsedQuizQuestion[];
  demoSlide?: number | null;
  rulesSlide?: number | null;
  thanksSlide?: number | null;
  finalSlide?: number | null;
}

// ─── Hybrid mode (DOCX + ZIP) ──────────────────────────────────────────────

export interface HybridParsedQuestion {
  slides: {
    video_warning: number | null;
    video_intro: number | null;
    question: number | null;
    timer: number | null;
    answer: number | null;
  };
  timer_position: string;
  extraSlides?: number[];
}

export interface HybridParsedResult {
  questions: HybridParsedQuestion[];
  demoSlide?: number | null;
  rulesSlide?: number | null;
  thanksSlide?: number | null;
  finalSlide?: number | null;
  extraSlides?: number[];
}

export function buildPrompt(n: number, names: string[]): string {
  return `
Ты анализируешь ${n} изображений — слайды из квиза-презентации.
Имена файлов (в порядке, с 0): ${names.map((name, i) => `[${i}] ${name}`).join(", ")}.

КЛЮЧЕВОЕ ПРАВИЛО: несколько слайдов могут относиться к ОДНОМУ вопросу.
Слайды одного вопроса похожи визуально — одинаковый фон, одинаковый текст вопроса — но различаются деталями:

• «video_warning» — предупреждение о видео (если вопрос с видео). Идёт перед всеми остальными слайдами.
• «video_intro» — видео-вступление (опционально). Идёт после video_warning, перед вопросом.
• «question» — слайд с текстом вопроса и 4 вариантами ответов (A, B, C, D). Все варианты оформлены одинаково.
• «timer»   — тот же вопрос + заметный таймер/часы/обратный отсчёт.
• «answer»  — тот же вопрос, но ОДИН вариант выделен как правильный (другой цвет, обводка, галочка, стрелка и т.п.).

ВАЖНО: В архиве также могут быть дополнительные слайды, не относящиеся к вопросам:
• Слайд-заставка / демо (титульный слайд с названием квиза, без вопросов) → demoSlide
• Слайд с правилами игры → rulesSlide
• Слайд «Спасибо» / «Paldies» / «Thank you» (показывается после результатов) → thanksSlide
• Финальный закрывающий слайд (показывается последним перед выключением TV) → finalSlide
Эти слайды нужно распознать и вернуть отдельно.

Алгоритм:
1. Найди слайды-заставку, правила, спасибо и финальный (если есть).
2. Определи, сколько УНИКАЛЬНЫХ вопросов (не слайдов) присутствует.
3. Сгруппируй слайды — похожие по содержанию и дизайну относятся к одному вопросу.
4. Для каждой группы: назначь тип каждому слайду и извлеки текст вопроса, варианты, правильный ответ.

Верни строго JSON (без markdown, без пояснений):
{
  "demoSlide": 0,
  "rulesSlide": 1,
  "thanksSlide": null,
  "finalSlide": null,
  "questions": [
    {
      "question": "Текст вопроса",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "B",
      "time_limit_sec": 30,
      "slides": {
        "video_warning": 2,
        "video_intro": null,
        "question": 3,
        "timer": null,
        "answer": 4
      }
    }
  ]
}

Правила:
- "demoSlide", "rulesSlide", "thanksSlide", "finalSlide" — индексы соответствующих слайдов (null если нет).
- "video_warning" и "video_intro" — опциональные слайды перед вопросом (null если нет).
- Если слайда "timer" или "answer" нет в группе — ставь null (система использует слайд "question" вместо них).
- "correct" — одна буква: A, B, C или D.
- "time_limit_sec" — число секунд из слайда (30 если не указано).
- Каждый индекс используй не более одного раза.
`.trim();
}

export function buildHybridPrompt(n: number, names: string[], questionCount: number, questionHints?: { title: string; correctAnswer: string }[]): string {
  return `
Ты анализируешь ${n} изображений — слайды из квиза-презентации (экспортированы из Canva).
Имена файлов (в порядке, с 0): ${names.map((name, i) => `[${i}] ${name}`).join(", ")}.

Всего вопросов: ${questionCount}.
${questionHints && questionHints.length > 0 ? `
ТЕКСТЫ ВОПРОСОВ ИЗ DOCX (используй для сопоставления со слайдами):
${questionHints.map((q, i) => `  ${i + 1}. "${q.title}" → правильный ответ: "${q.correctAnswer}"`).join("\n")}

КЛЮЧЕВАЯ ПОДСКАЗКА: текст вопроса из DOCX будет написан на слайде «question». На слайде «answer» будет выделен правильный ответ (буква или текст из списка выше). Используй это для точного сопоставления слайдов с вопросами.
` : ""}
ВАЖНО — типы слайдов в презентации:

НУЖНЫЕ слайды (используй их):
• «question» — слайд с текстом вопроса и вариантами ответов (A, B, C, D) или картинкой (найти на картинке)
• «answer» — тот же вопрос, но ОДИН вариант выделен как правильный (другой цвет, обводка, галочка), или на нем только один ответ, может быть с видео.
• «video_warning» — предупреждение перед видео-вопросом. На нём НЕТ текста вопроса и НЕТ вариантов ответа. Обычно написано что-то вроде "Видео вопрос", "Готовьтесь смотреть", "Video jautājums" и т.п. Идёт ПЕРЕД слайдом question.
• «video_intro» — сам видео-слайд (опционально). Идёт после video_warning, перед question.

ЛИШНИЕ слайды (верни их в extraSlides):
• Слайды с цифрами таймера / обратным отсчётом (30, 29, 28...)
• Слайды которые как question, но с будильником / часами
• Юмористические / мемные слайды между вопросами (не содержат вопрос и варианты)
• Любые декоративные слайды без контента вопроса

СПЕЦИАЛЬНЫЕ слайды (вернуть отдельно):
• Слайд-заставка / демо (титульный слайд с названием квиза) → demoSlide
• Слайд с правилами игры → rulesSlide. Заголовок "Правила" / "Rules" / "Noteikumi" и т.п. НЕ путай с вопросами — если есть варианты A/B/C/D или текст совпадает с вопросом из DOCX, это НЕ правила. Если правил нет — ставь null.
• Слайд «Спасибо» / «Paldies» / «Thank you» / «Pateicamies» (показывается после объявления результатов) → thanksSlide. Если нет — null.
• Финальный закрывающий слайд (последний слайд, показывается перед выключением TV, обычно идёт после «Спасибо») → finalSlide. Если нет — null.

Алгоритм:
1. Файлы идут ПО ПОРЯДКУ — слайды одного вопроса следуют друг за другом.
2. Найди заставку и правила (если есть).
3. Для каждого вопроса найди: question (обязательно), answer (обязательно), video_warning и video_intro (если перед вопросом есть предупреждение о видео).
4. Все лишние слайды (таймеры, будильники, юмор) — добавь их индексы в "extraSlides" для соответствующего вопроса.
5. Определи позицию таймера по слайду question: таймер должен быть там, где МЕНЬШЕ ВСЕГО текста и элементов. Если текст вопроса и варианты занимают центр — ставь таймер вбок (left/right). "center" используй ТОЛЬКО если центр слайда свободен.

Верни строго JSON (без markdown, без пояснений):
{
  "demoSlide": 0,
  "rulesSlide": 1,
  "thanksSlide": null,
  "finalSlide": null,
  "questions": [
    {
      "slides": {
        "video_warning": 2,
        "video_intro": null,
        "question": 3,
        "timer": null,
        "answer": 4
      },
      "timer_position": "left",
      "extraSlides": [5, 6]
    }
  ]
}

Правила:
- "demoSlide", "rulesSlide", "thanksSlide", "finalSlide" — индексы соответствующих слайдов (null если нет).
- "video_warning" — слайд-предупреждение БЕЗ текста вопроса, перед вопросом (null если нет).
- "video_intro" — видео-слайд после video_warning, перед вопросом (null если нет).
- "timer" — всегда null (система сама наложит таймер на слайд question).
- Кол-во элементов в "questions" должно быть ровно ${questionCount} (по числу вопросов из DOCX).
- Слайды "question" и "answer" есть у КАЖДОГО вопроса — обязательно найди оба.
- "timer_position" — одно из: "center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right". Выбирай по свободному пространству на слайде question.
- "extraSlides" — массив индексов лишних слайдов (таймеры, будильники, юмор), которые идут после данного вопроса. Если лишних нет — пустой массив [].
- Каждый индекс слайда используй не более одного раза.
`.trim();
}

export function parseHybridJsonResponse(raw: string): HybridParsedResult {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as HybridParsedResult;
  } catch {
    throw Object.assign(
      new Error(`LLM вернул неверный JSON (hybrid): ${raw.slice(0, 300)}`),
      { statusCode: 502 }
    );
  }
}

// ─── DOCX text parsing ──────────────────────────────────────────────────────

export interface DocxParsedQuestion {
  title: string;
  questionType: "choice" | "text";
  options: string[];
  correctIndex: number;
  correctAnswer: string;
  explanation: string | null;
}

export interface DocxParsedResult {
  questions: DocxParsedQuestion[];
}

export function buildDocxParsePrompt(text: string): string {
  return `
Ты парсишь текст из DOCX файла с вопросами для квиза.

Структура документа (повторяющийся паттерн):
- Текст вопроса (может быть на двух языках)
- Варианты ответа ИЛИ правильный ответ текстом
- Объяснение (опционально, может занимать несколько строк)

КРИТИЧЕСКИ ВАЖНО — как определить тип вопроса:
• "choice" — варианты ответа идут СПИСКОМ, каждый на отдельной строке, часто с префиксами A/B/C/D или А/Б/В/Г.
• "text" — правильный ответ написан INLINE (через запятую, в строку, просто текстом). НЕТ структуры из нескольких вариантов на отдельных строках. Если ответы перечислены через запятую — это text, НЕ choice.

Текст документа:
"""
${text}
"""

Извлеки все вопросы и верни строго JSON (без markdown, без пояснений):
{
  "questions": [
    {
      "title": "Текст вопроса",
      "questionType": "choice",
      "options": ["вариант A", "вариант B", "вариант C", "вариант D"],
      "correctIndex": 0,
      "correctAnswer": "текст правильного ответа",
      "explanation": "Объяснение правильного ответа или null"
    }
  ]
}

Правила:
- "questionType" — "choice" или "text" (см. правила выше)
- "correctIndex" — индекс правильного ответа (0-3) для choice-вопросов, -1 для text-вопросов
- "correctAnswer" — текст правильного ответа. Для choice — текст правильного варианта, для text — весь правильный ответ целиком
- "options" — массив из нескольких строк (без префиксов A/B/C/D) для choice, пустой массив [] для text
- "explanation" — ПОЛНЫЙ текст объяснения, включая ВСЕ строки до следующего вопроса. Если объяснение занимает несколько строк/абзацев — объедини их через \\n. НЕ обрезай текст. null если объяснения нет
- Если структура документа нестандартная — сделай всё возможное чтобы извлечь вопросы
`.trim();
}

export function parseDocxJsonResponse(raw: string): DocxParsedResult {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as DocxParsedResult;
  } catch {
    throw Object.assign(
      new Error(`LLM вернул неверный JSON (docx): ${raw.slice(0, 300)}`),
      { statusCode: 502 }
    );
  }
}

/**
 * Prompt for parsing DOCX from images (with visual formatting)
 */
export function buildDocxImageParsePrompt(): string {
  return `
Ты анализируешь страницы DOCX документа с вопросами для квиза.

На изображениях ты видишь документ с вопросами. Структура (повторяющийся паттерн):
- Текст вопроса (может быть на двух языках)
- Варианты ответа (могут быть ТЕКСТОМ или ИЗОБРАЖЕНИЯМИ) ИЛИ правильный ответ текстом
- Правильный ответ отмечен цветом/выделением (обычно зелёным)
- Объяснение правильного ответа (опционально, может занимать несколько строк)

КРИТИЧЕСКИ ВАЖНО — варианты ответа могут быть представлены двумя способами:
1. ТЕКСТОМ — написаны словами (например: "Красный", "Синий", "Зелёный")
2. ИЗОБРАЖЕНИЯМИ — показаны картинками без подписей или с буквами A/B/C/D рядом

ВАЖНО — как определить тип вопроса:
• "choice" — варианты ответа идут СПИСКОМ (4 варианта), каждый на отдельной строке или в виде 4 картинок, часто с префиксами A/B/C/D или А/Б/В/Г.
  - Если варианты представлены КАРТИНКАМИ без текста — опиши каждую картинку коротко (что на ней изображено)
  - Если есть текст — используй текст
  - Правильный вариант определи по цвету/выделению/галочке
• "text" — правильный ответ написан INLINE (через запятую, в строку, просто текстом). НЕТ структуры из нескольких вариантов на отдельных строках. Если ответы перечислены через запятую — это text, НЕ choice.

Извлеки ВСЕ вопросы из всех страниц и верни строго JSON (без markdown, без пояснений):
{
  "questions": [
    {
      "title": "Текст вопроса",
      "questionType": "choice",
      "options": ["вариант A (или описание картинки A)", "вариант B", "вариант C", "вариант D"],
      "correctIndex": 0,
      "correctAnswer": "текст правильного ответа (или описание картинки)",
      "explanation": "Объяснение правильного ответа или null"
    }
  ]
}

Правила:
- "questionType" — "choice" или "text" (см. правила выше)
- "correctIndex" — индекс правильного ответа (0-3) для choice-вопросов, определи по цвету/выделению. -1 для text-вопросов
- "correctAnswer" — текст правильного ответа. Для choice — текст правильного варианта (или описание картинки если вариант был картинкой), для text — весь правильный ответ целиком
- "options" — массив из нескольких строк (без префиксов A/B/C/D) для choice, пустой массив [] для text
  - Если вариант представлен ТЕКСТОМ — используй текст варианта
  - Если вариант представлен КАРТИНКОЙ — опиши картинку кратко (например: "Красная машина", "Человек в шляпе", "Символ сердца")
- "explanation" — ПОЛНЫЙ текст объяснения, включая ВСЕ строки/абзацы. Если объяснение занимает несколько строк — объедини их через \\n. НЕ обрезай, бери ВЕСЬ текст до следующего вопроса. null если нет
- Извлеки ВСЕ вопросы со всех страниц
- Если правильный ответ не выделен цветом, попробуй определить по контексту
`.trim();
}

export function parseDocxImageJsonResponse(raw: string): DocxParsedResult {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as DocxParsedResult;
  } catch {
    throw Object.assign(
      new Error(`LLM вернул неверный JSON (docx image): ${raw.slice(0, 300)}`),
      { statusCode: 502 }
    );
  }
}

export function parseJsonResponse(raw: string): ParsedResult {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  try {
    return JSON.parse(cleaned) as ParsedResult;
  } catch {
    throw Object.assign(
      new Error(`LLM вернул неверный JSON: ${raw.slice(0, 300)}`),
      { statusCode: 502 }
    );
  }
}
