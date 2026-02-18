import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { quizzesApi } from "../api/client";

const STATUS_LABEL = {
  draft: "Черновик",
  active: "Идёт",
  finished: "Завершён",
};

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function Home() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const loadQuizzes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await quizzesApi.list();
      setQuizzes(data);
    } catch (e) {
      setError(e.message || "Не удалось загрузить квизы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQuizzes();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      await quizzesApi.create(newTitle.trim());
      setNewTitle("");
      setCreateOpen(false);
      await loadQuizzes();
    } catch (e) {
      const msg = e.body?.error || e.message || "Не удалось создать квиз";
      setError(msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-stone-800">Квизы</h1>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition font-medium"
        >
          Создать квиз
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-stone-500">Загрузка…</p>
      ) : quizzes.length === 0 ? (
        <p className="text-stone-500">
          Пока нет квизов. Нажмите «Создать квиз», чтобы добавить первый.
        </p>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                <th className="text-left py-3 px-4 font-medium text-stone-600">
                  Название
                </th>
                <th className="text-left py-3 px-4 font-medium text-stone-600">
                  Статус
                </th>
                <th className="text-left py-3 px-4 font-medium text-stone-600">
                  Дата
                </th>
                <th className="text-right py-3 px-4 font-medium text-stone-600">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody>
              {quizzes.map((q) => (
                <tr
                  key={q.id}
                  className="border-b border-stone-100 last:border-0 hover:bg-stone-50/50"
                >
                  <td className="py-3 px-4 font-medium text-stone-800">
                    {q.title}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-sm ${
                        q.status === "active"
                          ? "bg-green-100 text-green-800"
                          : q.status === "finished"
                            ? "bg-stone-200 text-stone-700"
                            : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {STATUS_LABEL[q.status] ?? q.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-stone-600">
                    {formatDate(q.createdAt)}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex gap-2 justify-end">
                      <Link
                        to={`/quiz/${q.id}/edit`}
                        className="inline-flex px-3 py-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition text-sm font-medium"
                      >
                        Редактировать
                      </Link>
                      <Link
                        to={`/game/${q.id}`}
                        className="inline-flex px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition text-sm font-medium"
                      >
                        Начать
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-10 p-4"
          onClick={() => !creating && setCreateOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-xl shadow-lg max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-stone-800 mb-4">
              Новый квиз
            </h2>
            <form onSubmit={handleCreate}>
              <label className="block text-sm font-medium text-stone-600 mb-2">
                Название
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Например: Свадьба Анны и Ивана"
                className="w-full px-3 py-2 border border-stone-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
                autoFocus
              />
              <div className="flex gap-2 mt-4 justify-end">
                <button
                  type="button"
                  onClick={() => !creating && setCreateOpen(false)}
                  className="px-4 py-2 text-stone-600 hover:bg-stone-100 rounded-lg transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {creating ? "Создаём…" : "Создать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
