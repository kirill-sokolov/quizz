import { useState, useEffect } from "react";
import { getMediaUrl } from "../api/client";
import { SLIDE_TYPES, BASE_SLIDE_TYPES, FULL_SLIDE_TYPES, VIDEO_SLIDE_TYPES, SLIDE_LABELS } from "../constants/slides";
import VideoLayoutEditor from "./VideoLayoutEditor";

const OPTION_LETTERS = ["A", "B", "C", "D"];

function ensureFourOptions(options) {
  const arr = Array.isArray(options) ? [...options] : [];
  while (arr.length < 4) arr.push("");
  return arr.slice(0, 4);
}

function getSlides(question) {
  if (!question?.slides?.length) {
    // Default slides for new question
    return BASE_SLIDE_TYPES.map((type, i) => ({
      id: null,
      type,
      imageUrl: null,
      videoUrl: null,
      videoLayout: null,
      sortOrder: i + 2,
    }));
  }

  // Return slides sorted by sortOrder (already sorted by API)
  return question.slides.map(s => ({
    id: s.id ?? null,
    type: s.type,
    imageUrl: s.imageUrl ?? s.image_url ?? null,
    videoUrl: s.videoUrl ?? s.video_url ?? null,
    videoLayout: s.videoLayout ?? s.video_layout ?? null,
    sortOrder: s.sortOrder ?? s.sort_order ?? 0,
  }));
}

export default function QuestionForm({ question, onSave, onCancel, onUpload }) {
  const isNew = !question?.id;
  const [questionType, setQuestionType] = useState(question?.questionType ?? "choice");
  const [text, setText] = useState(question?.text ?? "");
  const [options, setOptions] = useState(ensureFourOptions(question?.options));
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer ?? "A");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [timeLimitSec, setTimeLimitSec] = useState(question?.timeLimitSec ?? 30);
  const [timerPosition, setTimerPosition] = useState(question?.timerPosition ?? "center");
  const [weight, setWeight] = useState(question?.weight ?? 1);
  const [slides, setSlides] = useState(() => getSlides(question));
  const [hasVideoIntro, setHasVideoIntro] = useState(() => {
    return question?.slides?.some(s => VIDEO_SLIDE_TYPES.includes(s.type)) ?? false;
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    if (!question) return;
    setQuestionType(question.questionType ?? "choice");
    setText(question.text ?? "");
    setOptions(ensureFourOptions(question.options));
    setCorrectAnswer(question.correctAnswer ?? "A");
    setExplanation(question.explanation ?? "");
    setTimeLimitSec(question.timeLimitSec ?? 30);
    setTimerPosition(question.timerPosition ?? "center");
    setWeight(question.weight ?? 1);
    setSlides(getSlides(question));
    setHasVideoIntro(question?.slides?.some(s => VIDEO_SLIDE_TYPES.includes(s.type)) ?? false);
  }, [question?.id]);

  const toggleVideoIntro = (enabled) => {
    setHasVideoIntro(enabled);
    if (enabled) {
      setSlides(prev => {
        const hasWarning = prev.some(s => s.type === SLIDE_TYPES.VIDEO_WARNING);
        const hasIntro = prev.some(s => s.type === SLIDE_TYPES.VIDEO_INTRO);
        const result = [...prev];
        if (!hasWarning) {
          result.unshift({ id: null, type: SLIDE_TYPES.VIDEO_WARNING, imageUrl: null, videoUrl: null, videoLayout: null, sortOrder: 0 });
        }
        if (!hasIntro) {
          const insertIndex = result.findIndex(s => s.type === SLIDE_TYPES.QUESTION);
          result.splice(insertIndex, 0, { id: null, type: SLIDE_TYPES.VIDEO_INTRO, imageUrl: null, videoUrl: null, videoLayout: null, sortOrder: 1 });
        }
        return result.map((s, i) => ({ ...s, sortOrder: i }));
      });
    } else {
      setSlides(prev => prev.filter(s => !VIDEO_SLIDE_TYPES.includes(s.type)).map((s, i) => ({ ...s, sortOrder: i })));
    }
  };

  const addExtraAfter = (afterIndex) => {
    setSlides(prev => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, {
        id: null,
        type: SLIDE_TYPES.EXTRA,
        imageUrl: null,
        videoUrl: null,
        videoLayout: null,
        sortOrder: afterIndex + 1,
      });
      return next.map((s, i) => ({ ...s, sortOrder: i }));
    });
  };

  const removeExtra = (index) => {
    setSlides(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sortOrder: i })));
  };

  const handleOptionChange = (index, value) => {
    const next = [...options];
    next[index] = value;
    setOptions(next);
  };

  const handleSlideImage = async (slideIndex, file) => {
    if (!file) return;
    const key = `slide-${slideIndex}`;
    setUploading(key);
    try {
      const { url } = await onUpload(file);
      setSlides((prev) => {
        const next = [...prev];
        next[slideIndex] = { ...next[slideIndex], imageUrl: url };
        return next;
      });
    } finally {
      setUploading(null);
    }
  };

  const handleSlideVideo = async (slideIndex, file) => {
    if (!file) return;
    const key = `video-${slideIndex}`;
    setUploading(key);
    try {
      const { url } = await onUpload(file);
      setSlides((prev) => {
        const next = [...prev];
        next[slideIndex] = { ...next[slideIndex], videoUrl: url };
        return next;
      });
    } finally {
      setUploading(null);
    }
  };

  const handleVideoLayoutChange = (slideIndex, layout) => {
    setSlides((prev) => {
      const next = [...prev];
      next[slideIndex] = { ...next[slideIndex], videoLayout: layout };
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        id: question?.id ?? null,
        text,
        questionType,
        weight: questionType === "text" ? weight : 1,
        options: questionType === "choice" ? options : [],
        correctAnswer: questionType === "choice" ? correctAnswer : correctAnswer,
        explanation: explanation || null,
        timeLimitSec,
        timerPosition,
        orderNum: question?.orderNum,
        slides: slides.map((s, idx) => ({
          id: s.id,
          type: s.type,
          imageUrl: s.imageUrl || null,
          videoUrl: s.videoUrl || null,
          videoLayout: s.videoLayout || null,
          sortOrder: idx,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  const isText = questionType === "text";

  // Base slide types (non-removable)
  const BASE_TYPES = new Set([
    SLIDE_TYPES.VIDEO_WARNING, SLIDE_TYPES.VIDEO_INTRO,
    SLIDE_TYPES.QUESTION, SLIDE_TYPES.TIMER, SLIDE_TYPES.ANSWER,
  ]);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center gap-4 mb-2">
        <label className="block text-sm font-medium text-stone-600">Тип вопроса</label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setQuestionType("choice")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              !isText
                ? "bg-amber-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Варианты (A/B/C/D)
          </button>
          <button
            type="button"
            onClick={() => setQuestionType("text")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              isText
                ? "bg-amber-600 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
          >
            Текстовый ввод
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-600 mb-1">Текст вопроса</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
          placeholder="Вопрос?"
        />
      </div>

      {isText ? (
        <>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              Правильные ответы (через запятую)
            </label>
            <textarea
              value={correctAnswer}
              onChange={(e) => setCorrectAnswer(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              placeholder="ответ1, ответ2, ответ3"
            />
            <p className="text-xs text-stone-400 mt-1">
              Перечислите все правильные ответы через запятую. LLM будет сравнивать ответы команд с этим списком.
            </p>
          </div>
          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Вес вопроса</label>
              <input
                type="number"
                min={1}
                max={10}
                value={weight}
                onChange={(e) => setWeight(Number(e.target.value) || 1)}
                className="w-24 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <p className="text-xs text-stone-400 mt-1">
                Максимум баллов за полный правильный ответ
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Время (сек)</label>
              <input
                type="number"
                min={3}
                max={300}
                value={timeLimitSec}
                onChange={(e) => setTimeLimitSec(Number(e.target.value) || 30)}
                className="w-24 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Позиция таймера</label>
              <select
                value={timerPosition}
                onChange={(e) => setTimerPosition(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="center">Центр</option>
                <option value="top">Верх</option>
                <option value="bottom">Низ</option>
                <option value="left">Лево</option>
                <option value="right">Право</option>
                <option value="top-left">Верх-лево</option>
                <option value="top-right">Верх-право</option>
                <option value="bottom-left">Низ-лево</option>
                <option value="bottom-right">Низ-право</option>
              </select>
            </div>
          </div>
        </>
      ) : (
        <>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Варианты ответов</label>
            <div className="grid gap-2">
              {OPTION_LETTERS.map((letter, i) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className="w-6 font-medium text-stone-500">{letter})</span>
                  <input
                    type="text"
                    value={options[i] ?? ""}
                    onChange={(e) => handleOptionChange(i, e.target.value)}
                    className="flex-1 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                    placeholder={`Вариант ${letter}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">
              Объяснение ответа <span className="text-stone-400 font-normal">(опционально)</span>
            </label>
            <textarea
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              placeholder="Почему именно этот ответ правильный?"
            />
          </div>

          <div className="flex flex-wrap gap-6">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Правильный ответ</label>
              <select
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              >
                {OPTION_LETTERS.map((letter) => (
                  <option key={letter} value={letter}>{letter}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Время (сек)</label>
              <input
                type="number"
                min={3}
                max={120}
                value={timeLimitSec}
                onChange={(e) => setTimeLimitSec(Number(e.target.value) || 30)}
                className="w-24 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Позиция таймера</label>
              <select
                value={timerPosition}
                onChange={(e) => setTimerPosition(e.target.value)}
                className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
              >
                <option value="center">Центр</option>
                <option value="top">Верх</option>
                <option value="bottom">Низ</option>
                <option value="left">Лево</option>
                <option value="right">Право</option>
                <option value="top-left">Верх-лево</option>
                <option value="top-right">Верх-право</option>
                <option value="bottom-left">Низ-лево</option>
                <option value="bottom-right">Низ-право</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div>
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasVideoIntro}
              onChange={(e) => toggleVideoIntro(e.target.checked)}
              className="w-4 h-4 text-amber-600 border-stone-300 rounded focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-stone-700">
              Добавить видео перед вопросом
            </span>
          </label>
        </div>
        <label className="block text-sm font-medium text-stone-600 mb-2">Слайды (картинки и видео)</label>
        <div className="space-y-2">
          {slides.map((slide, idx) => {
            const isExtra = slide.type === SLIDE_TYPES.EXTRA;
            const canHaveVideo = slide.type === SLIDE_TYPES.VIDEO_INTRO || slide.type === SLIDE_TYPES.ANSWER || isExtra;
            const isBase = BASE_TYPES.has(slide.type);

            return (
              <div key={`${slide.type}-${idx}`}>
                <div className={`p-3 rounded-lg border ${isExtra ? "bg-blue-50 border-blue-200" : "bg-stone-50 border-stone-200"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-stone-700">
                      {isExtra ? `Экстра-слайд` : SLIDE_LABELS[slide.type]}
                    </div>
                    {isExtra && (
                      <button
                        type="button"
                        onClick={() => removeExtra(idx)}
                        className="text-red-500 hover:text-red-700 text-sm"
                        title="Удалить экстра-слайд"
                      >
                        ✕ Удалить
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-4 items-start">
                    <div>
                      <div className="text-xs text-stone-500 mb-1">Картинка</div>
                      {slide.imageUrl ? (
                        <div className="flex items-center gap-2">
                          <img
                            src={getMediaUrl(slide.imageUrl)}
                            alt=""
                            className="max-h-48 max-w-xs w-auto object-contain rounded border border-stone-200 bg-stone-100"
                          />
                          <label className="text-sm text-amber-600 cursor-pointer hover:underline">
                            Заменить
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleSlideImage(idx, e.target.files?.[0])}
                              disabled={uploading !== null}
                            />
                          </label>
                        </div>
                      ) : (
                        <label className="inline-block px-3 py-2 bg-white border border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 text-sm">
                          {uploading === `slide-${idx}` ? "Загрузка…" : "Загрузить"}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => handleSlideImage(idx, e.target.files?.[0])}
                            disabled={uploading !== null}
                          />
                        </label>
                      )}
                    </div>
                    {canHaveVideo && (
                      <div className="flex-1 min-w-[200px]">
                        <div className="text-xs text-stone-500 mb-1">Видео (mp4)</div>
                        {slide.videoUrl ? (
                          <div className="flex items-center gap-2">
                            <video
                              src={getMediaUrl(slide.videoUrl)}
                              controls
                              className="max-h-48 max-w-xs w-auto rounded border border-stone-200 bg-stone-100"
                            />
                            <label className="text-sm text-amber-600 cursor-pointer hover:underline">
                              Заменить
                              <input
                                type="file"
                                accept="video/mp4,video/*"
                                className="hidden"
                                onChange={(e) => handleSlideVideo(idx, e.target.files?.[0])}
                                disabled={uploading !== null}
                              />
                            </label>
                          </div>
                        ) : (
                          <label className="inline-block px-3 py-2 bg-white border border-stone-300 rounded-lg cursor-pointer hover:bg-stone-50 text-sm">
                            {uploading === `video-${idx}` ? "Загрузка…" : "Загрузить видео"}
                            <input
                              type="file"
                              accept="video/mp4,video/*"
                              className="hidden"
                              onChange={(e) => handleSlideVideo(idx, e.target.files?.[0])}
                              disabled={uploading !== null}
                            />
                          </label>
                        )}
                      </div>
                    )}
                  </div>
                  {canHaveVideo && slide.imageUrl && (
                    <div className="mt-3">
                      <div className="text-xs text-stone-500 mb-1">Позиция видео на слайде</div>
                      <VideoLayoutEditor
                        imageUrl={slide.imageUrl}
                        videoUrl={slide.videoUrl}
                        videoLayout={slide.videoLayout}
                        onChange={(layout) => handleVideoLayoutChange(idx, layout)}
                      />
                    </div>
                  )}
                </div>
                {/* Button to add extra slide after this slide */}
                <div className="flex justify-center my-1">
                  <button
                    type="button"
                    onClick={() => addExtraAfter(idx)}
                    className="px-3 py-1 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                  >
                    + Экстра-слайд
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
        >
          {saving ? "Сохранение…" : isNew ? "Добавить вопрос" : "Сохранить"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition"
        >
          Отмена
        </button>
      </div>
    </form>
  );
}
