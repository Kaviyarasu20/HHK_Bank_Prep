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

export const adminCaAiApi = {
  getStatistics: () => api("/admin/current-affairs/ai/statistics"),
  processArticle: (articleId, force = false) =>
    api(`/admin/current-affairs/ai/process/${articleId}`, {
      method: "POST",
      body: JSON.stringify({ force }),
    }),
  processBulk: (articleIds, force = false) =>
    api("/admin/current-affairs/ai/process-bulk", {
      method: "POST",
      body: JSON.stringify({ articleIds, force }),
    }),
  listResults: (params = {}) =>
    api(`/admin/current-affairs/ai/results${toQs(params)}`),
  getResult: (id) => api(`/admin/current-affairs/ai/results/${id}`),
  regenerate: (id) =>
    api(`/admin/current-affairs/ai/results/${id}/regenerate`, {
      method: "POST",
    }),
  updateResult: (id, payload) =>
    api(`/admin/current-affairs/ai/results/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  approve: (id, adminFeedback = "") =>
    api(`/admin/current-affairs/ai/results/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ adminFeedback }),
    }),
  reject: (id, adminFeedback) =>
    api(`/admin/current-affairs/ai/results/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ adminFeedback }),
    }),
  getHistory: (id) => api(`/admin/current-affairs/ai/results/${id}/history`),
};
