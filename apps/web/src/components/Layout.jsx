import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";

export default function Layout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

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
            <a
              href="/tv"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-100 hover:text-white transition"
            >
              TV
            </a>
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
