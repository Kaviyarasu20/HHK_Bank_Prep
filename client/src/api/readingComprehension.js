import { api } from "./client";

function toQueryString(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && String(val).trim() !== "" && val !== "all") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export const rcAdminApi = {
  getMeta: () => api("/admin/reading-comprehension/meta"),
  listPassages: (filters = {}) =>
    api(`/admin/reading-comprehension/passages${toQueryString(filters)}`),
  getPassage: (id) => api(`/admin/reading-comprehension/passages/${id}`),
  generate: (payload) =>
    api("/admin/reading-comprehension/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  regeneratePassage: (id) =>
    api(`/admin/reading-comprehension/passages/${id}/regenerate-passage`, {
      method: "POST",
    }),
  generateQuestions: (id, payload) =>
    api(`/admin/reading-comprehension/passages/${id}/generate-questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updatePassage: (id, payload) =>
    api(`/admin/reading-comprehension/passages/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateStatus: (id, status) =>
    api(`/admin/reading-comprehension/passages/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deletePassage: (id) =>
    api(`/admin/reading-comprehension/passages/${id}`, {
      method: "DELETE",
    }),
  addQuestion: (passageId, payload) =>
    api(`/admin/reading-comprehension/passages/${passageId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateQuestion: (questionId, payload) =>
    api(`/admin/reading-comprehension/questions/${questionId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  regenerateQuestion: (questionId, payload = {}) =>
    api(`/admin/reading-comprehension/questions/${questionId}/regenerate`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteQuestion: (questionId) =>
    api(`/admin/reading-comprehension/questions/${questionId}`, {
      method: "DELETE",
    }),
  getPdfUrl: (id, format = "practice") =>
    `/api/admin/reading-comprehension/passages/${id}/pdf?format=${encodeURIComponent(format)}`,
};

export const rcStudentApi = {
  getMeta: () => api("/reading-comprehension/meta"),
  listPassages: (filters = {}) =>
    api(`/reading-comprehension/passages${toQueryString(filters)}`),
  startAttempt: (passageId, restart = false) =>
    api(`/reading-comprehension/passages/${passageId}/attempts`, {
      method: "POST",
      body: JSON.stringify({ restart }),
    }),
  saveProgress: (attemptId, payload) =>
    api(`/reading-comprehension/attempts/${attemptId}/progress`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  submitAttempt: (attemptId, payload) =>
    api(`/reading-comprehension/attempts/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getResult: (attemptId) => api(`/reading-comprehension/attempts/${attemptId}/result`),
  getPdfUrl: (passageId, format = "practice") =>
    `/api/reading-comprehension/passages/${passageId}/pdf?format=${encodeURIComponent(format)}`,
};
