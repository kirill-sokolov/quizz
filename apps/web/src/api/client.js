const API = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: {
      "Content-Type": "application/json",
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
