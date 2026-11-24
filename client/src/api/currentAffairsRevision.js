import { api } from "./client";

function toQs(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      qs.set(k, String(v).trim());
    }
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const studentOneLinersApi = {
  list: (params = {}) => api(`/current-affairs/one-liners${toQs(params)}`),
  getDaily: () => api("/current-affairs/one-liners/daily"),
  getMonthly: () => api("/current-affairs/one-liners/monthly"),
  getTopics: () => api("/current-affairs/one-liners/topics"),
  setReviewStatus: (id, reviewStatus) =>
    api(`/current-affairs/one-liners/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ reviewStatus }),
    }),
  setBookmark: (id, isBookmarked) =>
    api(`/current-affairs/one-liners/${id}/bookmark`, {
      method: "POST",
      body: JSON.stringify({ isBookmarked }),
    }),
};

export const adminOneLinersApi = {
  getStatistics: () => api("/admin/current-affairs/one-liners/statistics"),
  generate: (payload) =>
    api("/admin/current-affairs/one-liners/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  generateBulk: (payload) =>
    api("/admin/current-affairs/one-liners/generate-bulk", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  list: (params = {}) => api(`/admin/current-affairs/one-liners${toQs(params)}`),
  update: (id, payload) =>
    api(`/admin/current-affairs/one-liners/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  approve: (id) => api(`/admin/current-affairs/one-liners/${id}/approve`, { method: "POST" }),
  reject: (id) => api(`/admin/current-affairs/one-liners/${id}/reject`, { method: "POST" }),
};

export const studentFlashcardsApi = {
  getProgress: () => api("/current-affairs/flashcards/progress"),
  listDecks: (params = {}) => api(`/current-affairs/flashcards/decks${toQs(params)}`),
  getDeck: (id) => api(`/current-affairs/flashcards/decks/${id}`),
  getDueQueue: (mode = "due") => api(`/current-affairs/flashcards/review/due?mode=${encodeURIComponent(mode)}`),
  submitReview: (id, response) =>
    api(`/current-affairs/flashcards/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ response }),
    }),
  setBookmark: (id, isBookmarked) =>
    api(`/current-affairs/flashcards/${id}/bookmark`, {
      method: "POST",
      body: JSON.stringify({ isBookmarked }),
    }),
};

export const adminFlashcardsApi = {
  getStatistics: () => api("/admin/current-affairs/flashcards/statistics"),
  listDecks: () => api("/admin/current-affairs/flashcards/decks"),
  createDeck: (payload) =>
    api("/admin/current-affairs/flashcards/decks", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateDeck: (id, payload) =>
    api(`/admin/current-affairs/flashcards/decks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  generate: (payload) =>
    api("/admin/current-affairs/flashcards/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listCards: (params = {}) => api(`/admin/current-affairs/flashcards${toQs(params)}`),
  updateCard: (id, payload) =>
    api(`/admin/current-affairs/flashcards/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  approveCard: (id) => api(`/admin/current-affairs/flashcards/${id}/approve`, { method: "POST" }),
  rejectCard: (id) => api(`/admin/current-affairs/flashcards/${id}/reject`, { method: "POST" }),
};
