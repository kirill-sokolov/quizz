import { Link, Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-amber-800 text-amber-50 shadow">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            QuizBot — Админка
          </Link>
          <nav className="flex gap-4">
            <Link
              to="/"
              className="text-amber-100 hover:text-white transition"
            >
              Квизы
            </Link>
            <a
              href="/tv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-100 hover:text-white transition"
            >
              TV
            </a>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
