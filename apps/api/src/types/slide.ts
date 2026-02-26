/**
 * Типы слайдов вопроса
 */
export const SLIDE_TYPES = [
  "video_warning",
  "video_intro",
  "question",
  "timer",
  "answer",
  "results",
  "thanks",
  "final",
] as const;

export type SlideType = (typeof SLIDE_TYPES)[number];

/**
 * Базовые типы слайдов (без видео)
 */
export const BASE_SLIDE_TYPES = ["question", "timer", "answer"] as const;

export type BaseSlideType = (typeof BASE_SLIDE_TYPES)[number];

/**
 * Типы видео слайдов
 */
export const VIDEO_SLIDE_TYPES = ["video_warning", "video_intro"] as const;

export type VideoSlideType = (typeof VIDEO_SLIDE_TYPES)[number];
