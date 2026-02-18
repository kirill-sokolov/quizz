// В dev можно задать VITE_API_URL (например http://localhost:3000), чтобы браузер ходил в API напрямую и обходить прокси
const API =
  (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") + "/api";

async function request(path, options = {}) {
  const body = options.body;
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    headers: {
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const err = new Error(res.statusText || "API error");
    err.status = res.status;
    err.body = await res.json().catch(() => ({}));
    throw err;
  }
  return res.json();
}

export const quizzesApi = {
  list: () => request("/quizzes"),
  get: (id) => request(`/quizzes/${id}`),
  create: (title) =>
    request("/quizzes", { method: "POST", body: JSON.stringify({ title }) }),
  update: (id, data) =>
    request(`/quizzes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete: (id) => request(`/quizzes/${id}`, { method: "DELETE" }),
};

export const questionsApi = {
  list: (quizId) => request(`/quizzes/${quizId}/questions`),
  create: (quizId, data) =>
    request(`/quizzes/${quizId}/questions`, {
      method: "POST",
      body: JSON.stringify({
        text: data.text ?? "",
        options: data.options ?? ["", "", "", ""],
        correctAnswer: data.correctAnswer ?? "",
        timeLimitSec: data.timeLimitSec ?? 30,
      }),
    }),
  update: (questionId, data) =>
    request(`/questions/${questionId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  delete: (questionId) =>
    request(`/questions/${questionId}`, { method: "DELETE" }),
};

export async function mediaUpload(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/media/upload`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = new Error(res.statusText || "Upload failed");
    err.status = res.status;
    err.body = await res.json().catch(() => ({}));
    throw err;
  }
  return res.json();
}
