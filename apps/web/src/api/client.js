// В dev можно задать VITE_API_URL (например http://localhost:3000), чтобы браузер ходил в API напрямую
const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "") || "";
const API = API_BASE ? API_BASE + "/api" : "/api";

export function getWsUrl() {
  if (API_BASE) {
    return API_BASE.replace(/^http/, "ws") + "/ws";
  }
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

async function request(path, options = {}) {
  const body = options.body;
  const isFormData = body instanceof FormData;
  const needsJson = body && !isFormData;

  const res = await fetch(`${API}${path}`, {
    credentials: "include",
    headers: {
      ...(needsJson ? { "Content-Type": "application/json" } : {}),
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

/** URL для медиа (картинки): если API на другом хосте — нужен полный путь */
export function getMediaUrl(path) {
  if (!path || typeof path !== "string") return "";
  if (path.startsWith("http")) return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return (API_BASE || "") + p;
}

export const quizzesApi = {
  list: () => request("/quizzes"),
  get: (id) => request(`/quizzes/${id}`),
  getActive: () => request("/quizzes/active"),
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

export const gameApi = {
  getState: (quizId) => request(`/game/state/${quizId}`),
  start: (quizId) =>
    request("/game/start", {
      method: "POST",
      body: JSON.stringify({ quizId: Number(quizId) }),
    }),
  openRegistration: (quizId) =>
    request("/game/open-registration", {
      method: "POST",
      body: JSON.stringify({ quizId: Number(quizId) }),
    }),
  begin: (quizId) =>
    request("/game/begin", {
      method: "POST",
      body: JSON.stringify({ quizId: Number(quizId) }),
    }),
  nextQuestion: (quizId) =>
    request("/game/next-question", {
      method: "POST",
      body: JSON.stringify({ quizId: Number(quizId) }),
    }),
  setSlide: (quizId, slide) =>
    request("/game/set-slide", {
      method: "POST",
      body: JSON.stringify({
        quizId: Number(quizId),
        slide,
      }),
    }),
  remind: (quizId, teamId) =>
    request("/game/remind", {
      method: "POST",
      body: JSON.stringify({
        quizId: Number(quizId),
        ...(teamId != null ? { teamId: Number(teamId) } : {}),
      }),
    }),
  finish: (quizId) =>
    request("/game/finish", {
      method: "POST",
      body: JSON.stringify({ quizId: Number(quizId) }),
    }),
  resetToFirst: (quizId) =>
    request("/game/reset-to-first", {
      method: "POST",
      body: JSON.stringify({ quizId: Number(quizId) }),
    }),
  getResults: (quizId) => request(`/game/results/${quizId}`),
};

export const teamsApi = {
  list: (quizId, all = false) =>
    request(`/quizzes/${quizId}/teams${all ? "?all=true" : ""}`),
  kick: (teamId) => request(`/teams/${teamId}`, { method: "DELETE" }),
};

export const answersApi = {
  list: (questionId) => request(`/questions/${questionId}/answers`),
};

export const importApi = {
  uploadZip: async (quizId, file) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${API}/quizzes/${quizId}/import-zip`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    if (!res.ok) {
      const err = new Error(res.statusText || "Import failed");
      err.status = res.status;
      err.body = await res.json().catch(() => ({}));
      throw err;
    }
    return res.json();
  },
  save: (quizId, questions) =>
    request(`/quizzes/${quizId}/import-save`, {
      method: "POST",
      body: JSON.stringify({ questions }),
    }),
};

export async function mediaUpload(file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API}/media/upload`, {
    method: "POST",
    credentials: "include",
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

export const authApi = {
  login: (username, password) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  verify: () =>
    request("/auth/verify", {
      method: "POST",
    }).catch(() => ({ valid: false })),
  logout: () =>
    request("/auth/logout", {
      method: "POST",
    }),
};
