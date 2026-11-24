import { api } from "./client";

function toQueryString(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      qs.set(k, String(v).trim());
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// --- Student Current Affairs API ---
export const studentCaApi = {
  getCategories: () => api("/current-affairs/categories"),
  listArticles: (params = {}, init = {}) =>
    api(`/current-affairs${toQueryString(params)}`, init),
  getArticle: (id) => api(`/current-affairs/${id}`),
  updateState: (id, patch) =>
    api(`/current-affairs/${id}/state`, {
      method: "POST",
      body: JSON.stringify(patch),
    }),
  getArticleQuiz: (id) => api(`/current-affairs/${id}/quiz`),
  getCombinedQuiz: (params = {}) =>
    api(`/current-affairs/quiz/combined${toQueryString(params)}`),
  submitAnswer: (affairId, questionId, answer) =>
    api(`/current-affairs/${affairId}/quiz/${questionId}/answer`, {
      method: "POST",
      body: JSON.stringify({ answer }),
    }),
};

// --- Admin Current Affairs API ---
export const adminCaApi = {
  getStats: () => api("/admin/current-affairs/stats"),
  listArticles: (params = {}) =>
    api(`/admin/current-affairs${toQueryString(params)}`),
  getArticle: (id) => api(`/admin/current-affairs/${id}`),
  createArticle: (payload) =>
    api("/admin/current-affairs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateArticle: (id, payload) =>
    api(`/admin/current-affairs/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateArticleStatus: (id, status) =>
    api(`/admin/current-affairs/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  deleteArticle: (id) =>
    api(`/admin/current-affairs/${id}`, {
      method: "DELETE",
    }),
  // MCQs
  listQuestions: (affairId) =>
    api(`/admin/current-affairs/${affairId}/questions`),
  createQuestion: (affairId, payload) =>
    api(`/admin/current-affairs/${affairId}/questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateQuestion: (affairId, questionId, payload) =>
    api(`/admin/current-affairs/${affairId}/questions/${questionId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  deleteQuestion: (affairId, questionId) =>
    api(`/admin/current-affairs/${affairId}/questions/${questionId}`, {
      method: "DELETE",
    }),
  // Categories
  listCategories: () => api("/admin/current-affairs/categories"),
  createCategory: (payload) =>
    api("/admin/current-affairs/categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateCategory: (categoryId, payload) =>
    api(`/admin/current-affairs/categories/${categoryId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  toggleCategoryActive: (categoryId, isActive) =>
    api(`/admin/current-affairs/categories/${categoryId}/active`, {
      method: "PATCH",
      body: JSON.stringify({ isActive }),
    }),
  deleteCategory: (categoryId) =>
    api(`/admin/current-affairs/categories/${categoryId}`, {
      method: "DELETE",
    }),
  // Ingestion
  fetchFeeds: (payload) =>
    api("/admin/current-affairs/fetch-feeds", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  bulkImport: (payload) =>
    api("/admin/current-affairs/bulk-import", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
