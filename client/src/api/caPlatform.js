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

async function downloadPdfEndpoint(url, fallbackName) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    let msg = "PDF download failed.";
    try {
      const errJson = await res.json();
      msg = errJson?.error || msg;
    } catch {}
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disp = res.headers.get("content-disposition") || "";
  const match = disp.match(/filename="([^"]+)"/i);
  const fileName = match?.[1] || fallbackName || "hhk-current-affairs.pdf";

  const objUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objUrl);
  return { fileName, sizeBytes: blob.size };
}

export const caStudioAdminApi = {
  getMeta: () => api("/admin/ca-studio/meta"),
  listBatches: () => api("/admin/ca-studio/batches"),
  createBatch: (payload) =>
    api("/admin/ca-studio/batches", { method: "POST", body: JSON.stringify(payload) }),
  deleteBatch: (id) => api(`/admin/ca-studio/batches/${id}`, { method: "DELETE" }),
  analyzeBatch: (id) => api(`/admin/ca-studio/batches/${id}/analyze`, { method: "POST" }),
  listEvents: (params = {}) => api(`/admin/ca-studio/events${toQs(params)}`),
  updateEvent: (id, payload) =>
    api(`/admin/ca-studio/events/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  generateQuestionsForEvent: (eventId, payload) =>
    api(`/admin/ca-studio/events/${eventId}/generate-questions`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  createManualQuestion: (payload) =>
    api("/admin/ca-studio/questions/manual", { method: "POST", body: JSON.stringify(payload) }),
  listQuestions: (params = {}) => api(`/admin/ca-studio/questions${toQs(params)}`),
  updateQuestion: (id, payload) =>
    api(`/admin/ca-studio/questions/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
  reviewQuestion: (id, action, notes = "") =>
    api(`/admin/ca-studio/questions/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ action, notes }),
    }),
  deleteQuestion: (id) => api(`/admin/ca-studio/questions/${id}`, { method: "DELETE" }),
  listPracticeSets: () => api("/admin/ca-studio/practice-sets"),
  createPracticeSet: (payload) =>
    api("/admin/ca-studio/practice-sets", { method: "POST", body: JSON.stringify(payload) }),
  updatePracticeSetStatus: (id, publicationStatus) =>
    api(`/admin/ca-studio/practice-sets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ publicationStatus }),
    }),
  deletePracticeSet: (id) => api(`/admin/ca-studio/practice-sets/${id}`, { method: "DELETE" }),
  downloadAdminPdf: (setId, format) =>
    downloadPdfEndpoint(`/api/admin/ca-studio/practice-sets/${setId}/pdf/${format}`, `hhk-${format}.pdf`),
  listPdfExports: () => api("/admin/ca-studio/pdf-exports"),
  getAnalytics: (params = {}) => api(`/admin/ca-studio/analytics${toQs(params)}`),
  createSource: (payload) =>
    api("/admin/ca-studio/sources", { method: "POST", body: JSON.stringify(payload) }),
  updateAutomationConfig: (payload) =>
    api("/admin/ca-studio/automation-config", { method: "PUT", body: JSON.stringify(payload) }),
  runAutomationFetch: () =>
    api("/admin/ca-studio/automation/run-fetch", { method: "POST" }),
};

export const caPracticeStudentApi = {
  listSets: (scope = "all") => api(`/ca-practice/sets?scope=${encodeURIComponent(scope)}`),
  startAttempt: (setId) =>
    api(`/ca-practice/sets/${setId}/attempts`, { method: "POST" }),
  saveAnswer: (attemptId, payload) =>
    api(`/ca-practice/attempts/${attemptId}/answer`, {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  submitAttempt: (attemptId, payload) =>
    api(`/ca-practice/attempts/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getAttemptResult: (attemptId) => api(`/ca-practice/attempts/${attemptId}/result`),
  downloadPdf: (setId, format) =>
    downloadPdfEndpoint(`/api/ca-practice/sets/${setId}/pdf/${format}`, `hhk-ca-${format}.pdf`),
  getPerformance: () => api("/ca-practice/performance"),
  getRevisionQuestions: () => api("/ca-practice/revision"),
  getDownloadedPdfs: () => api("/ca-practice/pdfs"),
};
