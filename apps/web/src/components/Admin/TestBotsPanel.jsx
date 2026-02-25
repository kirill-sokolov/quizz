/**
 * Панель управления тестовыми ботами
 * Изолированный компонент для лёгкого удаления
 */

import { useState } from "react";

export default function TestBotsPanel({ quizId, teams, gameState, onUpdate }) {
  const [count, setCount] = useState(5);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [showOnTv, setShowOnTv] = useState(gameState?.showBotsOnTv ?? true);

  const botCount = teams.filter((t) => t.isBot).length;

  const handleAdd = async () => {
    setAdding(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/test-bots`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ count }),
      });

      if (!res.ok) throw new Error("Failed to add bots");

      await onUpdate();
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm("Удалить всех тест-ботов?")) return;

    setRemoving(true);
    try {
      const res = await fetch(`/api/quizzes/${quizId}/test-bots`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) throw new Error("Failed to remove bots");

      await onUpdate();
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
    } finally {
      setRemoving(false);
    }
  };

  const handleToggleVisibility = async (visible) => {
    setShowOnTv(visible);

    try {
      const res = await fetch(`/api/game/${quizId}/toggle-bots-visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ showBotsOnTv: visible }),
      });

      if (!res.ok) throw new Error("Failed to toggle visibility");
    } catch (err) {
      alert(`Ошибка: ${err.message}`);
      setShowOnTv(!visible); // Revert on error
    }
  };

  return (
    <div className="border-t border-stone-200 pt-4 mt-4">
      <h3 className="text-lg font-bold mb-3 text-stone-700">🤖 Тест-боты</h3>

      {/* Добавление */}
      <div className="flex gap-2 mb-3">
        <input
          type="number"
          min="1"
          max="20"
          value={count}
          onChange={(e) => setCount(Math.min(20, Math.max(1, Number(e.target.value))))}
          className="w-20 px-3 py-2 border border-stone-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleAdd}
          disabled={adding || botCount > 0}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
        >
          {adding ? "⏳" : "➕ Добавить"}
        </button>
      </div>

      {/* Статус */}
      {botCount > 0 && (
        <div className="bg-stone-100 rounded-lg p-3 space-y-3">
          <p className="text-sm text-stone-700">
            Активно ботов: <span className="font-bold text-stone-900">{botCount}</span>
          </p>

          {/* Галочка показа на TV */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showOnTv}
              onChange={(e) => handleToggleVisibility(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-stone-700">Показывать на TV</span>
          </label>

          {/* Удаление */}
          <button
            onClick={handleRemove}
            disabled={removing}
            className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition text-sm font-medium disabled:opacity-50"
          >
            {removing ? "⏳" : "🗑️ Удалить всех ботов"}
          </button>
        </div>
      )}

      <p className="text-xs text-stone-500 mt-2">
        Боты отвечают случайно через 1 сек. Удаляются автоматически при завершении квиза.
      </p>
    </div>
  );
}
