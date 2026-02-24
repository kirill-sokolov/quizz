import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { quizzesApi, questionsApi, mediaUpload, importApi, gameApi, getMediaUrl } from "../api/client";
import QuestionForm from "../components/QuestionForm";
import ImportPreview from "../components/ImportPreview";

export default function QuizEdit() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [textModel, setTextModel] = useState("GPT-5 mini");
  const [imageModel, setImageModel] = useState("Gemini 3 Flash");
  const zipInputRef = useRef(null);
  const ocrZipInputRef = useRef(null);
  const docxInputRef = useRef(null);
  const [docxResult, setDocxResult] = useState(null);
  const [processingDocx, setProcessingDocx] = useState(false);
  const [ocrResult, setOcrResult] = useState(null);
  const [processingOcr, setProcessingOcr] = useState(false);
  const [useVisionOcr, setUseVisionOcr] = useState(true);
  const [editingSettings, setEditingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [uploadingDemo, setUploadingDemo] = useState(false);
  const [uploadingRules, setUploadingRules] = useState(false);

  const loadQuiz = async () => {
    try {
      const data = await quizzesApi.get(id);
      setQuiz(data);
    } catch (e) {
      setError(e.message || "Квиз не найден");
    }
  };

  const loadQuestions = async () => {
    try {
      const data = await questionsApi.list(id);
      setQuestions(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить вопросы");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      await loadQuiz();
      if (!cancelled) {
        const state = await gameApi.getState(id).catch(() => null);
        setGameState(state);
      }
      if (!cancelled) await loadQuestions();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleSaveQuestion = async (payload) => {
    if (payload.id) {
      const slideUpdates = (payload.slides ?? [])
        .map((s) => ({
          id: s.id != null && Number(s.id) > 0 ? Number(s.id) : null,
          type: s.type,
          imageUrl: s.imageUrl != null ? String(s.imageUrl) : null,
          videoUrl: s.videoUrl != null ? String(s.videoUrl) : null,
          videoLayout: s.videoLayout != null ? s.videoLayout : null,
        }));
      await questionsApi.update(payload.id, {
        text: payload.text,
        options: payload.options,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation ?? null,
        timeLimitSec: payload.timeLimitSec,
        timerPosition: payload.timerPosition,
        questionType: payload.questionType,
        weight: payload.weight,
        orderNum: payload.orderNum,
        ...(slideUpdates.length > 0 && { slides: slideUpdates }),
      });
      setEditingId(null);
    } else {
      await questionsApi.create(id, {
        text: payload.text,
        options: payload.options,
        correctAnswer: payload.correctAnswer,
        explanation: payload.explanation ?? null,
        timeLimitSec: payload.timeLimitSec,
        timerPosition: payload.timerPosition,
        questionType: payload.questionType,
        weight: payload.weight,
      });
      setAdding(false);
    }
    await loadQuestions();
  };

  const handleDelete = async (questionId) => {
    if (!confirm("Удалить этот вопрос?")) return;
    await questionsApi.delete(questionId);
    setEditingId(null);
    await loadQuestions();
  };

  const moveQuestion = async (index, delta) => {
    const newIndex = index + delta;
    if (newIndex < 0 || newIndex >= questions.length) return;
    const a = questions[index];
    const b = questions[newIndex];
    await questionsApi.update(a.id, { orderNum: b.orderNum });
    await questionsApi.update(b.id, { orderNum: a.orderNum });
    await loadQuestions();
  };

  const handleSaveSettings = async (settings) => {
    setSavingSettings(true);
    setError(null);
    try {
      await quizzesApi.update(id, settings);
      await loadQuiz();
      setEditingSettings(false);
    } catch (err) {
      setError(err.body?.error || err.message || "Ошибка сохранения настроек");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadDemo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDemo(true);
    try {
      const result = await mediaUpload(file);
      await handleSaveSettings({ demoImageUrl: result.path });
    } catch (err) {
      setError(err.message || "Ошибка загрузки demo");
    } finally {
      setUploadingDemo(false);
      e.target.value = "";
    }
  };

  const handleUploadRules = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRules(true);
    try {
      const result = await mediaUpload(file);
      await handleSaveSettings({ rulesImageUrl: result.path });
    } catch (err) {
      setError(err.message || "Ошибка загрузки rules");
    } finally {
      setUploadingRules(false);
      e.target.value = "";
    }
  };

  const handleDocxUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingDocx(true);
    setError(null);
    setDocxResult(null);
    try {
      const result = await importApi.uploadDocx(id, file, textModel);
      setDocxResult(result);
    } catch (err) {
      setError(err.body?.error || err.message || "Ошибка обработки DOCX");
    } finally {
      setProcessingDocx(false);
      if (docxInputRef.current) docxInputRef.current.value = "";
    }
  };

  const handleOcrAnalysis = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingOcr(true);
    setError(null);
    setOcrResult(null);
    try {
      const result = await importApi.analyzeZipOcr(id, file, useVisionOcr);
      setOcrResult(result);
    } catch (err) {
      setError(err.body?.error || err.message || "Ошибка OCR анализа");
    } finally {
      setProcessingOcr(false);
      if (ocrZipInputRef.current) ocrZipInputRef.current.value = "";
    }
  };

  const handleZipUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      const result = await importApi.uploadZip(
        id,
        file,
        imageModel,
        null,
        docxResult?.questions || null
      );
      setImportPreview(result);
    } catch (err) {
      setError(err.body?.error || err.message || "Ошибка импорта ZIP");
    } finally {
      setImporting(false);
      if (zipInputRef.current) zipInputRef.current.value = "";
    }
  };

  if (loading) return <p className="text-stone-500">Загрузка…</p>;
  if (error)
    return (
      <div>
        <p className="text-red-600 mb-2">{error}</p>
        <Link to="/admin" className="text-amber-600 hover:underline">← К списку квизов</Link>
      </div>
    );
  if (!quiz)
    return (
      <Link to="/admin" className="text-amber-600 hover:underline">Вернуться к списку</Link>
    );

  if (quiz.status === "finished")
    return (
      <div>
        <p className="text-stone-600 mb-2">Квиз «{quiz.title}» уже завершён и недоступен для редактирования.</p>
        <Link to="/admin" className="text-amber-600 hover:underline">← К списку квизов</Link>
      </div>
    );

  const isGamePlaying = gameState?.status === "playing";
  if (isGamePlaying)
    return (
      <div>
        <p className="text-stone-600 mb-2">
          Квиз «{quiz.title}» сейчас идёт. Редактирование недоступно во время игры.
        </p>
        <p className="text-stone-500 text-sm mb-4">
          Завершите квиз или дождитесь окончания игры, чтобы внести изменения.
        </p>
        <div className="flex gap-3">
          <Link to="/admin" className="text-amber-600 hover:underline">← К списку квизов</Link>
          <Link to={`/admin/game/${id}`} className="text-amber-600 hover:underline">→ Управление игрой</Link>
        </div>
      </div>
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link to="/admin" className="text-amber-600 hover:text-amber-700 font-medium">← Квизы</Link>
        <h1 className="text-2xl font-semibold text-stone-800">Редактор: {quiz.title}</h1>
        <Link
          to={`/admin/game/${id}`}
          className="ml-auto px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
        >
          Перейти к игре
        </Link>
      </div>

      <div className="mb-6 p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-stone-700">Настройки квиза</h2>
          {!editingSettings && (
            <button
              type="button"
              onClick={() => setEditingSettings(true)}
              className="text-amber-600 hover:text-amber-700 font-medium text-sm"
            >
              Редактировать
            </button>
          )}
        </div>

        {editingSettings ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-2">
                Правила (показываются после "Начать")
              </label>
              <div className="flex items-center gap-3">
                {quiz.rulesImageUrl && (
                  <img
                    src={getMediaUrl(quiz.rulesImageUrl)}
                    alt="Rules"
                    className="w-24 h-16 object-cover rounded border"
                  />
                )}
                <label className="cursor-pointer px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg text-sm font-medium transition">
                  {uploadingRules ? "Загрузка..." : quiz.rulesImageUrl ? "Заменить" : "Загрузить"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleUploadRules}
                    disabled={uploadingRules}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingSettings(false)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 rounded-lg font-medium text-sm transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm text-stone-600">
            <div className="flex items-center gap-2">
              <span className="font-medium">Правила:</span>
              {quiz.rulesImageUrl ? (
                <span className="text-green-600">✓ Загружены</span>
              ) : (
                <span className="text-stone-400">Не загружены</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-stone-700">Вопросы</h2>
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
          >
            Добавить вопрос
          </button>
        </div>
      </div>

      {/* Import section */}
      <div className="mb-6 p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-4">
        <h3 className="text-md font-medium text-stone-700">Импорт из DOCX + ZIP</h3>

        {/* OCR Analysis (experimental) */}
        <div className="pb-4 border-b border-stone-300">
          <div className="flex gap-3 items-center flex-wrap">
            <span className="text-sm text-stone-600 font-medium">🔬 Экспериментально - OCR анализ:</span>
            <label className="flex items-center gap-2 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={useVisionOcr}
                onChange={(e) => setUseVisionOcr(e.target.checked)}
                className="rounded border-stone-300"
              />
              Использовать vision модель (распознает картинки вариантов)
            </label>
            <input
              ref={ocrZipInputRef}
              type="file"
              accept=".zip"
              onChange={handleOcrAnalysis}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => ocrZipInputRef.current?.click()}
              disabled={processingOcr}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50"
            >
              {processingOcr ? "Анализ…" : "Проанализировать ZIP"}
            </button>
          </div>
          <p className="text-xs text-stone-500 mt-2">
            OCR распознает текст. Vision модель дополнительно анализирует слайды с малым количеством текста и описывает варианты-картинки
          </p>
          {ocrResult && (
            <details className="mt-3 bg-white rounded-lg border border-stone-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-stone-600 hover:text-stone-800">
                Результат OCR ({ocrResult.totalImages} изображений)
              </summary>
              <pre className="mt-2 text-xs bg-stone-50 p-3 rounded overflow-auto max-h-96">
                {JSON.stringify(ocrResult, null, 2)}
              </pre>
            </details>
          )}
        </div>

        {/* Step 1: DOCX upload */}
        <div className="flex gap-3 items-center">
          <span className="text-sm text-stone-600 font-medium">1. Текст (DOCX):</span>
          <select
            value={textModel}
            onChange={(e) => setTextModel(e.target.value)}
            className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
          >
            <option value="GPT-4o-mini">GPT-4o mini</option>
            <option value="GPT-5 mini">GPT-5 mini</option>
            <option value="Gemini 3 Flash">Gemini 3 Flash</option>
          </select>
          <input
            ref={docxInputRef}
            type="file"
            accept=".docx"
            onChange={handleDocxUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => docxInputRef.current?.click()}
            disabled={processingDocx}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50"
          >
            {processingDocx ? "Обработка…" : "Загрузить DOCX"}
          </button>
          {docxResult && (
            <span className="text-sm text-green-600 font-medium">✓ Готово ({docxResult.questions?.length || 0} вопросов)</span>
          )}
        </div>

        {/* DOCX result viewer */}
        {docxResult && (
          <details className="bg-white rounded-lg border border-stone-200 p-3">
            <summary className="cursor-pointer text-sm font-medium text-stone-600 hover:text-stone-800">
              Просмотр результата DOCX (JSON)
            </summary>
            <pre className="mt-2 text-xs bg-stone-50 p-3 rounded overflow-auto max-h-64">
              {JSON.stringify(docxResult, null, 2)}
            </pre>
          </details>
        )}

        {/* Step 2: ZIP upload (only enabled after DOCX) */}
        <div className="flex gap-3 items-center">
          <span className="text-sm text-stone-600 font-medium">2. Изображения (ZIP):</span>
          <select
            value={imageModel}
            onChange={(e) => setImageModel(e.target.value)}
            disabled={!docxResult}
            className="px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm disabled:opacity-50"
          >
            <option value="Kimi K2.5">Kimi K2.5</option>
            <option value="Grok 4">Grok 4</option>
            <option value="Gemini 3 Flash">Gemini 3 Flash</option>
            <option value="Gemini 3 Pro">Gemini 3 Pro</option>
          </select>
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            onChange={handleZipUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => zipInputRef.current?.click()}
            disabled={importing || !docxResult}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {importing ? "Обработка…" : "Загрузить ZIP"}
          </button>
          {!docxResult && (
            <span className="text-xs text-stone-400">Сначала загрузите DOCX</span>
          )}
        </div>
      </div>

      {importPreview && (
        <div className="mb-6">
          <ImportPreview
            quizId={id}
            data={importPreview}
            onDone={() => {
              setImportPreview(null);
              loadQuestions();
            }}
            onCancel={() => setImportPreview(null)}
          />
        </div>
      )}

      {adding && (
        <div className="mb-6 p-4 bg-white rounded-xl border border-stone-200 shadow-sm">
          <QuestionForm
            question={null}
            onSave={handleSaveQuestion}
            onCancel={() => setAdding(false)}
            onUpload={mediaUpload}
          />
        </div>
      )}

      <ul className="space-y-3">
        {questions.map((q, index) => (
          <li key={q.id} className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
            {editingId === q.id ? (
              <div className="p-4">
                <QuestionForm
                  question={q}
                  onSave={handleSaveQuestion}
                  onCancel={() => setEditingId(null)}
                  onUpload={mediaUpload}
                />
              </div>
            ) : (
              <div className="p-4 flex flex-wrap items-center gap-3">
                <span className="text-stone-400 font-mono w-8">{index + 1}.</span>
                <span className="flex-1 min-w-0 text-stone-800 truncate">{q.text || "(без текста)"}</span>
                <span className="text-sm text-stone-500">Правильный: {q.correctAnswer || "—"}</span>
                <span className="text-sm text-stone-500">{q.timeLimitSec} сек</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, -1)}
                    disabled={index === 0}
                    className="p-1.5 text-stone-500 hover:bg-stone-100 rounded disabled:opacity-40"
                    title="Выше"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveQuestion(index, 1)}
                    disabled={index === questions.length - 1}
                    className="p-1.5 text-stone-500 hover:bg-stone-100 rounded disabled:opacity-40"
                    title="Ниже"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(q.id)}
                    className="px-3 py-1.5 text-amber-600 hover:bg-amber-50 rounded-lg text-sm font-medium"
                  >
                    Редактировать
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(q.id)}
                    className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>

      {questions.length === 0 && !adding && (
        <p className="text-stone-500 py-8 text-center">Пока нет вопросов. Нажмите «Добавить вопрос».</p>
      )}
    </div>
  );
}
