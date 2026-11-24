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

export const studentBankingApi = {
  getOverview: () => api("/banking-awareness/overview"),
  getRates: (params = {}) => api(`/banking-awareness/rates${toQs(params)}`),
  getRateHistory: (rateCode) =>
    api(`/banking-awareness/rates/history/${encodeURIComponent(rateCode)}`),
  getLimits: (params = {}) => api(`/banking-awareness/limits${toQs(params)}`),
  getInstitutions: (params = {}) => api(`/banking-awareness/institutions${toQs(params)}`),
  getRegulatoryBodies: (params = {}) => api(`/banking-awareness/regulatory-bodies${toQs(params)}`),
  getLeaders: (params = {}) => api(`/banking-awareness/leaders${toQs(params)}`),
  getStaticGk: (params = {}) => api(`/banking-awareness/static-gk${toQs(params)}`),
  getTerminology: (params = {}) => api(`/banking-awareness/terminology${toQs(params)}`),
};

export const adminBankingApi = {
  getStats: () => api("/admin/banking-awareness/stats"),
  getAlerts: () => api("/admin/banking-awareness/alerts"),
  list: (entity, params = {}) => api(`/admin/banking-awareness/${entity}${toQs(params)}`),
  create: (entity, payload) =>
    api(`/admin/banking-awareness/${entity}`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (entity, id, payload) =>
    api(`/admin/banking-awareness/${entity}/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  updateStatus: (entity, id, status, markVerified = false) =>
    api(`/admin/banking-awareness/${entity}/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, markVerified }),
    }),
};
