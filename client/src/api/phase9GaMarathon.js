import { api } from "./client";

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      qs.set(k, String(v).trim());
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export const gaMarathonStudentApi = {
  getDashboard: () => api("/api/ga-marathon/dashboard"),
  listTests: (params = {}) => api(`/api/ga-marathon/tests${toQuery(params)}`),
  checkEligibility: (testId) => api(`/api/ga-marathon/tests/${encodeURIComponent(testId)}/eligibility`),
  getAttemptResult: (attemptId) => api(`/api/ga-marathon/attempts/${encodeURIComponent(attemptId)}/result`),
};

export const gaMarathonAdminApi = {
  getMetadata: () => api("/api/admin/ga-marathon/metadata"),
  listTests: () => api("/api/admin/ga-marathon/tests"),
  getTestDetail: (testId) => api(`/api/admin/ga-marathon/tests/${encodeURIComponent(testId)}`),
  createTest: (payload) =>
    api("/api/admin/ga-marathon/tests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  selectQuestions: (testId, payload) =>
    api(`/api/admin/ga-marathon/tests/${encodeURIComponent(testId)}/select-questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  setStatus: (testId, targetStatus) =>
    api(`/api/admin/ga-marathon/tests/${encodeURIComponent(testId)}/status`, {
      method: "POST",
      body: JSON.stringify({ targetStatus }),
    }),
  getAttempts: (testId, page = 1, limit = 25) =>
    api(`/api/admin/ga-marathon/tests/${encodeURIComponent(testId)}/attempts${toQuery({ page, limit })}`),
};
