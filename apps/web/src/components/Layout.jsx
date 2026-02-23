import { Link, Outlet, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "./AuthProvider";
import { quizzesApi } from "../api/client";

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [tvQuizCode, setTvQuizCode] = useState(null);

  useEffect(() => {
    // Загрузить квиз для TV-ссылки (приоритет: draft → active → finished)
    quizzesApi
      .list()
      .then((quizzes) => {
        const quiz = quizzes
          .filter((q) => q.status !== "archived")
          .find((q) => q.status === "draft" || q.status === "active" || q.status === "finished");

        setTvQuizCode(quiz?.joinCode || null);
      })
      .catch((err) => {
        console.error("Failed to load quiz for TV link:", err);
      });
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-amber-800 text-amber-50 shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/admin" className="text-xl font-semibold tracking-tight">
            QuizBot — Админка
          </Link>
          <nav className="flex gap-4 items-center">
            <Link
              to="/admin"
              className="text-amber-100 hover:text-white transition"
            >
              Квизы
            </Link>
            {tvQuizCode ? (
              <a
                href={`/tv/${tvQuizCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-100 hover:text-white transition"
              >
                TV
              </a>
            ) : (
              <span className="text-amber-300 opacity-50 cursor-not-allowed">
                TV
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-amber-100 hover:text-white transition text-sm"
            >
              Выйти
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
