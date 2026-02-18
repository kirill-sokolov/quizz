import { useParams, Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { quizzesApi } from "../api/client";

export default function Game() {
  const { id } = useParams();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    quizzesApi
      .get(id)
      .then((data) => {
        if (!cancelled) setQuiz(data);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Квиз не найден");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <p className="text-stone-500">Загрузка…</p>;
  if (error)
    return (
      <div>
        <p className="text-red-600 mb-2">{error}</p>
        <Link to="/" className="text-amber-600 hover:underline">
          ← К списку квизов
        </Link>
      </div>
    );
  if (!quiz)
    return (
      <p className="text-stone-500">
        <Link to="/" className="text-amber-600 hover:underline">
          Вернуться к списку
        </Link>
      </p>
    );

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <Link
          to="/"
          className="text-amber-600 hover:text-amber-700 font-medium"
        >
          ← Квизы
        </Link>
        <h1 className="text-xl font-semibold text-stone-800">
          Управление игрой: {quiz.title}
        </h1>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center text-stone-600">
        Экран ведущего (слайды, таймер, статус команд) будет реализован в
        следующей части.
      </div>
    </div>
  );
}
