import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { quizzesApi, questionsApi, mediaUpload } from "../api/client";
import QuestionForm from "../components/QuestionForm";

export default function QuizEdit() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [adding, setAdding] = useState(false);

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
      if (!cancelled) await loadQuestions();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  const handleSaveQuestion = async (payload) => {
    if (payload.id) {
      await questionsApi.update(payload.id, {
        text: payload.text,
        options: payload.options,
        correctAnswer: payload.correctAnswer,
        timeLimitSec: payload.timeLimitSec,
        orderNum: payload.orderNum,
        slides: payload.slides?.map((s) => ({
          id: s.id,
          imageUrl: s.imageUrl || null,
          videoUrl: s.videoUrl || null,
        })),
      });
      setEditingId(null);
    } else {
      await questionsApi.create(id, {
        text: payload.text,
        options: payload.options,
        correctAnswer: payload.correctAnswer,
        timeLimitSec: payload.timeLimitSec,
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

  if (loading) return <p className="text-stone-500">Загрузка…</p>;
  if (error)
    return (
      <div>
        <p className="text-red-600 mb-2">{error}</p>
        <Link to="/" className="text-amber-600 hover:underline">← К списку квизов</Link>
      </div>
    );
  if (!quiz)
    return (
      <Link to="/" className="text-amber-600 hover:underline">Вернуться к списку</Link>
    );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <Link to="/" className="text-amber-600 hover:text-amber-700 font-medium">← Квизы</Link>
        <h1 className="text-2xl font-semibold text-stone-800">Редактор: {quiz.title}</h1>
        <Link
          to={`/game/${id}`}
          className="ml-auto px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
        >
          Перейти к игре
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-stone-700">Вопросы</h2>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
        >
          Добавить вопрос
        </button>
      </div>

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
