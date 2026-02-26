/**
 * Константы типов слайдов
 */

export const SLIDE_TYPES = {
  VIDEO_WARNING: "video_warning",
  VIDEO_INTRO: "video_intro",
  QUESTION: "question",
  TIMER: "timer",
  ANSWER: "answer",
  RESULTS: "results",
  THANKS: "thanks",
  FINAL: "final",
};

/**
 * Базовые типы слайдов (без видео)
 */
export const BASE_SLIDE_TYPES = [
  SLIDE_TYPES.QUESTION,
  SLIDE_TYPES.TIMER,
  SLIDE_TYPES.ANSWER,
];

/**
 * Все типы слайдов
 */
export const ALL_SLIDE_TYPES = [
  SLIDE_TYPES.VIDEO_WARNING,
  SLIDE_TYPES.VIDEO_INTRO,
  SLIDE_TYPES.QUESTION,
  SLIDE_TYPES.TIMER,
  SLIDE_TYPES.ANSWER,
];

/**
 * Полный список с видео слайдами
 */
export const FULL_SLIDE_TYPES = [
  SLIDE_TYPES.VIDEO_WARNING,
  SLIDE_TYPES.VIDEO_INTRO,
  SLIDE_TYPES.QUESTION,
  SLIDE_TYPES.TIMER,
  SLIDE_TYPES.ANSWER,
];

/**
 * Типы видео слайдов
 */
export const VIDEO_SLIDE_TYPES = [
  SLIDE_TYPES.VIDEO_WARNING,
  SLIDE_TYPES.VIDEO_INTRO,
];

/**
 * Лейблы слайдов для UI
 */
export const SLIDE_LABELS = {
  [SLIDE_TYPES.VIDEO_WARNING]: "Предупреждение: вопрос с видео",
  [SLIDE_TYPES.VIDEO_INTRO]: "Видео перед вопросом",
  [SLIDE_TYPES.QUESTION]: "Слайд: вопрос",
  [SLIDE_TYPES.TIMER]: "Слайд: таймер",
  [SLIDE_TYPES.ANSWER]: "Слайд: ответ",
  [SLIDE_TYPES.RESULTS]: "Слайд: результаты",
  [SLIDE_TYPES.THANKS]: "Слайд: спасибо",
  [SLIDE_TYPES.FINAL]: "Слайд: финальный",
};

/**
 * Лейблы для TV режима
 */
export const TV_SLIDE_LABELS = {
  [SLIDE_TYPES.VIDEO_WARNING]: "Предупреждение",
  [SLIDE_TYPES.VIDEO_INTRO]: "Видео",
  [SLIDE_TYPES.QUESTION]: "Вопрос",
  [SLIDE_TYPES.TIMER]: "Таймер",
  [SLIDE_TYPES.ANSWER]: "Ответ",
  [SLIDE_TYPES.RESULTS]: "Результаты",
  [SLIDE_TYPES.THANKS]: "Спасибо",
  [SLIDE_TYPES.FINAL]: "Финальный",
};
