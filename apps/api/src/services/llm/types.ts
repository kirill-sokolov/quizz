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
  slides: { question: number | null; timer: number | null; answer: number | null };
}

export interface ParsedResult {
  questions: ParsedQuizQuestion[];
}

export function buildPrompt(n: number, names: string[]): string {
  return `
Ты анализируешь ${n} изображений — слайды из квиза-презентации.
Имена файлов (в порядке, с 0): ${names.map((name, i) => `[${i}] ${name}`).join(", ")}.

КЛЮЧЕВОЕ ПРАВИЛО: несколько слайдов могут относиться к ОДНОМУ вопросу.
Слайды одного вопроса похожи визуально — одинаковый фон, одинаковый текст вопроса — но различаются деталями:

• «question» — слайд с текстом вопроса и 4 вариантами ответов (A, B, C, D). Все варианты оформлены одинаково.
• «timer»   — тот же вопрос + заметный таймер/часы/обратный отсчёт.
• «answer»  — тот же вопрос, но ОДИН вариант выделен как правильный (другой цвет, обводка, галочка, стрелка и т.п.).

Алгоритм:
1. Сначала определи, сколько УНИКАЛЬНЫХ вопросов (не слайдов) присутствует.
2. Сгруппируй слайды — похожие по содержанию и дизайну относятся к одному вопросу.
3. Для каждой группы: назначь тип каждому слайду и извлеки текст вопроса, варианты, правильный ответ.

Верни строго JSON (без markdown, без пояснений):
{
  "questions": [
    {
      "question": "Текст вопроса",
      "options": { "A": "...", "B": "...", "C": "...", "D": "..." },
      "correct": "B",
      "time_limit_sec": 30,
      "slides": {
        "question": 0,
        "timer": null,
        "answer": 1
      }
    }
  ]
}

Правила:
- Если слайда какого-то типа нет в группе — ставь null.
- "correct" — одна буква: A, B, C или D.
- "time_limit_sec" — число секунд из слайда (30 если не указано).
- Каждый индекс используй не более одного раза.
`.trim();
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
