import { useState, useEffect } from "react";

const OPTION_LETTERS = ["A", "B", "C", "D"];
const SLIDE_LABELS = { question: "Слайд: вопрос", timer: "Слайд: таймер", answer: "Слайд: ответ" };

function ensureFourOptions(options) {
  const arr = Array.isArray(options) ? [...options] : [];
  while (arr.length < 4) arr.push("");
  return arr.slice(0, 4);
}

function getSlides(question) {
  if (!question?.slides?.length) {
    return [
      { id: null, type: "question", imageUrl: null, videoUrl: null },
      { id: null, type: "timer", imageUrl: null, videoUrl: null },
      { id: null, type: "answer", imageUrl: null, videoUrl: null },
    ];
  }
  const byType = {};
  for (const s of question.slides) byType[s.type] = s;
  return ["question", "timer", "answer"].map((type) => ({
    id: byType[type]?.id ?? null,
    type,
    imageUrl: byType[type]?.imageUrl ?? null,
    videoUrl: byType[type]?.videoUrl ?? null,
  }));
}

export default function QuestionForm({ question, onSave, onCancel, onUpload }) {
  const isNew = !question?.id;
  const [text, setText] = useState(question?.text ?? "");
  const [options, setOptions] = useState(ensureFourOptions(question?.options));
  const [correctAnswer, setCorrectAnswer] = useState(question?.correctAnswer ?? "A");
  const [timeLimitSec, setTimeLimitSec] = useState(question?.timeLimitSec ?? 30);
  const [slides, setSlides] = useState(() => getSlides(question));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);

  useEffect(() => {
    if (!question) return;
    setText(question.text ?? "");
    setOptions(ensureFourOptions(question.options));
    setCorrectAnswer(question.correctAnswer ?? "A");
    setTimeLimitSec(question.timeLimitSec ?? 30);
    setSlides(getSlides(question));
  }, [question?.id]);

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

  const handleSlideVideo = (slideIndex, value) => {
    setSlides((prev) => {
      const next = [...prev];
      next[slideIndex] = { ...next[slideIndex], videoUrl: value || null };
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
        options,
        correctAnswer,
        timeLimitSec,
        orderNum: question?.orderNum,
        slides: slides.map((s) => ({
          id: s.id,
          imageUrl: s.imageUrl || null,
          videoUrl: s.videoUrl || null,
        })),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
            min={10}
            max={120}
            value={timeLimitSec}
            onChange={(e) => setTimeLimitSec(Number(e.target.value) || 30)}
            className="w-24 px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-600 mb-2">Слайды (картинки и видео)</label>
        <div className="space-y-4">
          {slides.map((slide, idx) => (
            <div key={slide.type} className="p-3 bg-stone-50 rounded-lg border border-stone-200">
              <div className="font-medium text-stone-700 mb-2">{SLIDE_LABELS[slide.type]}</div>
              <div className="flex flex-wrap gap-4 items-start">
                <div>
                  <div className="text-xs text-stone-500 mb-1">Картинка</div>
                  {slide.imageUrl ? (
                    <div className="flex items-center gap-2">
                      <img src={slide.imageUrl} alt="" className="h-20 w-auto object-contain rounded border border-stone-200" />
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
                <div className="flex-1 min-w-[200px]">
                  <div className="text-xs text-stone-500 mb-1">YouTube (ссылка)</div>
                  <input
                    type="url"
                    value={slide.videoUrl ?? ""}
                    onChange={(e) => handleSlideVideo(idx, e.target.value)}
                    placeholder="https://www.youtube.com/..."
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  />
                </div>
              </div>
            </div>
          ))}
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
