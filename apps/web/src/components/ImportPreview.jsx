import { useState } from "react";
import { importApi, getMediaUrl } from "../api/client";
import { ALL_SLIDE_TYPES, SLIDE_LABELS } from "../constants/slides";

const ANSWER_LABELS = ["A", "B", "C", "D"];
const TIMER_POSITIONS = [
  { value: "center", label: "Центр" },
  { value: "top", label: "Верх" },
  { value: "bottom", label: "Низ" },
  { value: "left", label: "Лево" },
  { value: "right", label: "Право" },
  { value: "top-left", label: "Верх-лево" },
  { value: "top-right", label: "Верх-право" },
  { value: "bottom-left", label: "Низ-лево" },
  { value: "bottom-right", label: "Низ-право" },
];

export default function ImportPreview({ quizId, data: initial, onDone, onCancel }) {
  const [items, setItems] = useState(initial.questions);
  const [demoImageUrl, setDemoImageUrl] = useState(initial.demoImageUrl || null);
  const [rulesImageUrl, setRulesImageUrl] = useState(initial.rulesImageUrl || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const update = (index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const updateOption = (qIndex, optIndex, value) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== qIndex) return item;
        const options = [...item.options];
        options[optIndex] = value;
        return { ...item, options };
      })
    );
  };

  const removeQuestion = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (items.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await importApi.save(quizId, {
        questions: items,
        demoImageUrl,
        rulesImageUrl,
      });
      onDone();
    } catch (e) {
      setError(e.message || "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-stone-800">
          Предпросмотр импорта ({items.length} вопросов)
        </h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-stone-300 text-stone-600 rounded-lg hover:bg-stone-50 transition font-medium"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || items.length === 0}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
          >
            {saving ? "Сохранение…" : "Сохранить квиз"}
          </button>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {/* Demo and Rules slides */}
      {(demoImageUrl || rulesImageUrl) && (
        <div className="bg-stone-50 rounded-xl border border-stone-200 p-4 space-y-3">
          <h4 className="font-medium text-stone-700">Дополнительные слайды</h4>
          <div className="grid grid-cols-2 gap-4">
            {demoImageUrl && (
              <div>
                <label className="block text-sm text-stone-600 mb-2">Заставка / Демо</label>
                <img
                  src={getMediaUrl(demoImageUrl)}
                  alt="Demo"
                  className="w-full h-32 object-cover rounded border border-stone-200"
                />
              </div>
            )}
            {rulesImageUrl && (
              <div>
                <label className="block text-sm text-stone-600 mb-2">Правила</label>
                <img
                  src={getMediaUrl(rulesImageUrl)}
                  alt="Rules"
                  className="w-full h-32 object-cover rounded border border-stone-200"
                />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item, qi) => (
          <div key={qi} className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-stone-400 font-mono mt-2 w-8 shrink-0">{qi + 1}.</span>
              <div className="flex-1 space-y-3">
                {/* Question text */}
                <textarea
                  value={item.text}
                  onChange={(e) => update(qi, "text", e.target.value)}
                  rows={2}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Текст вопроса"
                />

                {/* Options */}
                <div className="grid grid-cols-2 gap-2">
                  {item.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-500 w-5">{ANSWER_LABELS[oi]}</span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => updateOption(qi, oi, e.target.value)}
                        className="flex-1 border border-stone-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                        placeholder={`Вариант ${ANSWER_LABELS[oi]}`}
                      />
                    </div>
                  ))}
                </div>

                {/* Correct answer, time, timer position */}
                <div className="flex flex-wrap gap-4 items-center">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-stone-600">Правильный:</span>
                    <select
                      value={item.correctAnswer}
                      onChange={(e) => update(qi, "correctAnswer", e.target.value)}
                      className="border border-stone-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {ANSWER_LABELS.map((l) => (
                        <option key={l} value={l}>{l}</option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-stone-600">Время (сек):</span>
                    <input
                      type="number"
                      min={3}
                      max={120}
                      value={item.timeLimitSec}
                      onChange={(e) => update(qi, "timeLimitSec", Number(e.target.value))}
                      className="w-20 border border-stone-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-stone-600">Таймер:</span>
                    <select
                      value={item.timerPosition || "center"}
                      onChange={(e) => update(qi, "timerPosition", e.target.value)}
                      className="border border-stone-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                    >
                      {TIMER_POSITIONS.map((tp) => (
                        <option key={tp.value} value={tp.value}>{tp.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {/* Explanation */}
                <textarea
                  value={item.explanation || ""}
                  onChange={(e) => update(qi, "explanation", e.target.value || null)}
                  rows={1}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Объяснение (опционально)"
                />

                {/* Slide previews */}
                <div className="flex gap-3 flex-wrap">
                  {ALL_SLIDE_TYPES.map((type) => {
                    const url = item.slides[type];
                    return (
                      <div key={type} className="text-center">
                        <p className="text-xs text-stone-400 mb-1">{SLIDE_LABELS[type]}</p>
                        {url ? (
                          <img
                            src={getMediaUrl(url)}
                            alt={type}
                            className="w-28 h-20 object-cover rounded border border-stone-200"
                          />
                        ) : (
                          <div className="w-28 h-20 bg-stone-100 rounded border border-stone-200 flex items-center justify-center text-xs text-stone-400">
                            Нет
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Extra slides (humor, timers, etc.) */}
                {item.extraSlides && item.extraSlides.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-stone-200">
                    <p className="text-xs text-stone-500 mb-2">Дополнительные слайды (юмор, таймеры):</p>
                    <div className="flex gap-3 flex-wrap">
                      {item.extraSlides.map((url, ei) => (
                        <div key={ei} className="text-center">
                          <img
                            src={getMediaUrl(url)}
                            alt={`Extra ${ei + 1}`}
                            className="w-28 h-20 object-cover rounded border border-stone-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => removeQuestion(qi)}
                className="text-red-500 hover:text-red-700 text-sm mt-2 shrink-0"
                title="Удалить вопрос"
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length === 0 && (
        <p className="text-stone-500 text-center py-6">Все вопросы удалены. Нажмите «Отмена» для возврата.</p>
      )}
    </div>
  );
}
