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

export const adminCaQuestionsApi = {
  getStatistics: () => api("/admin/current-affairs/questions/statistics"),
  generate: (payload) =>
    api("/admin/current-affairs/questions/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  generateBulk: (payload) =>
    api("/admin/current-affairs/questions/generate-bulk", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  listBatches: (params = {}) =>
    api(`/admin/current-affairs/questions/batches${toQs(params)}`),
  getBatch: (id) => api(`/admin/current-affairs/questions/batches/${id}`),
  listQuestions: (params = {}) =>
    api(`/admin/current-affairs/questions${toQs(params)}`),
  getQuestion: (id) => api(`/admin/current-affairs/questions/${id}`),
  updateQuestion: (id, payload) =>
    api(`/admin/current-affairs/questions/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  validateQuestion: (id) =>
    api(`/admin/current-affairs/questions/${id}/validate`, { method: "POST" }),
  regenerateQuestion: (id) =>
    api(`/admin/current-affairs/questions/${id}/regenerate`, { method: "POST" }),
  approveQuestion: (id, payload = {}) =>
    api(`/admin/current-affairs/questions/${id}/approve`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  rejectQuestion: (id, adminFeedback) =>
    api(`/admin/current-affairs/questions/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ adminFeedback }),
    }),
  getHistory: (id) => api(`/admin/current-affairs/questions/${id}/history`),
  checkDuplicates: (payload) =>
    api("/admin/current-affairs/questions/check-duplicates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
