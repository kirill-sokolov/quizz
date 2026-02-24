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
}

export interface HybridParsedResult {
  questions: HybridParsedQuestion[];
  demoSlide?: number | null;
  rulesSlide?: number | null;
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
• Слайд-заставка / демо (титульный слайд с названием квиза, без вопросов)
• Слайд с правилами игры
Эти слайды нужно распознать и вернуть отдельно (demoSlide, rulesSlide).

Алгоритм:
1. Найди слайд-заставку и слайд с правилами (если есть).
2. Определи, сколько УНИКАЛЬНЫХ вопросов (не слайдов) присутствует.
3. Сгруппируй слайды — похожие по содержанию и дизайну относятся к одному вопросу.
4. Для каждой группы: назначь тип каждому слайду и извлеки текст вопроса, варианты, правильный ответ.

Верни строго JSON (без markdown, без пояснений):
{
  "demoSlide": 0,
  "rulesSlide": 1,
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
- "demoSlide" и "rulesSlide" — индексы слайдов-заставки и правил (null если нет).
- "video_warning" и "video_intro" — опциональные слайды перед вопросом (null если нет).
- Если слайда "timer" или "answer" нет в группе — ставь null (система использует слайд "question" вместо них).
- "correct" — одна буква: A, B, C или D.
- "time_limit_sec" — число секунд из слайда (30 если не указано).
- Каждый индекс используй не более одного раза.
`.trim();
}

export function buildHybridPrompt(n: number, names: string[], questionCount: number): string {
  return `
Ты анализируешь ${n} изображений — слайды из квиза-презентации.
Имена файлов (в порядке, с 0): ${names.map((name, i) => `[${i}] ${name}`).join(", ")}.

Всего вопросов: ${questionCount}.

ВАЖНО: В архиве также могут быть дополнительные слайды, не относящиеся к вопросам:
• Слайд-заставка / демо (титульный слайд с названием квиза)
• Слайд с правилами игры
Эти слайды нужно распознать и вернуть отдельно (demoSlide, rulesSlide).

Твоя задача:
1. Найди слайд-заставку и слайд с правилами (если есть).
2. Сгруппируй слайды — похожие по содержанию и дизайну относятся к одному вопросу. (обычно они следуют друг за другом)
3. Для каждой группы определи тип каждого слайда:
   • «video_warning» — предупреждение о видео (если вопрос с видео). Идёт перед всеми остальными слайдами.
   • «video_intro» — видео-вступление (опционально). Идёт после video_warning, перед вопросом.
   • «question» — слайд с вопросом и вариантами ответов
   • «timer» — слайд с таймером/обратным отсчётом
   • «answer» — слайд с выделенным правильным ответом
4. Определи позицию таймера на слайде (где должны быть расположены часы/цифры таймера - чтобы не попадало на текст вопросов и текст ответов, и выглядело красиво).
   • доступные позиции - "center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"

Верни строго JSON (без markdown, без пояснений):
{
  "demoSlide": 0,
  "rulesSlide": 1,
  "questions": [
    {
      "slides": {
        "video_warning": 2,
        "video_intro": null,
        "question": 3,
        "timer": null,
        "answer": 4
      },
      "timer_position": "center"
    }
  ]
}

Правила:
- "demoSlide" и "rulesSlide" — индексы слайдов-заставки и правил (null если нет).
- "video_warning" и "video_intro" — опциональные слайды перед вопросом (null если нет).
- Кол-во элементов в "questions" должно быть ровно ${questionCount} (по числу вопросов из DOCX).
- Если слайда "timer" или "answer" нет в группе — ставь null (система использует слайд "question" вместо них).
- "timer_position" — одно из: "center", "top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right".
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
  options: string[];
  correctIndex: number;
  explanation: string | null;
}

export interface DocxParsedResult {
  questions: DocxParsedQuestion[];
}

export function buildDocxParsePrompt(text: string): string {
  return `
Ты парсишь текст из DOCX файла с вопросами для квиза.

Структура документа (повторяющийся паттерн):
- Текст вопроса
- 4 варианта ответа (могут быть с префиксами A/B/C/D или без)
- Правильный ответ (может быть отмечен как "правильный", "верный", "+", или выделен)
- Объяснение (опционально)

Текст документа:
"""
${text}
"""

Извлеки все вопросы и верни строго JSON (без markdown, без пояснений):
{
  "questions": [
    {
      "title": "Текст вопроса",
      "options": ["вариант A", "вариант B", "вариант C", "вариант D"],
      "correctIndex": 0,
      "explanation": "Объяснение правильного ответа или null"
    }
  ]
}

Правила:
- "correctIndex" — индекс правильного ответа (0-3), где 0 = A, 1 = B, 2 = C, 3 = D
- "options" — массив из 4 строк (без префиксов A/B/C/D)
- "explanation" — текст объяснения или null если нет
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
- Текст вопроса
- 4 варианта ответа (могут быть с префиксами A/B/C/D или без)
- Правильный ответ отмечен цветом/выделением (обычно зелёным)
- Объяснение правильного ответа (опционально)

Извлеки ВСЕ вопросы из всех страниц и верни строго JSON (без markdown, без пояснений):
{
  "questions": [
    {
      "title": "Текст вопроса",
      "options": ["вариант A", "вариант B", "вариант C", "вариант D"],
      "correctIndex": 0,
      "explanation": "Объяснение правильного ответа или null"
    }
  ]
}

Правила:
- "correctIndex" — индекс правильного ответа (0-3), определи по цвету/выделению на изображении
- "options" — массив из 4 строк (без префиксов A/B/C/D)
- "explanation" — текст объяснения или null если нет
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
