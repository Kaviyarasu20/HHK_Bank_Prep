import { api } from "./client";

function toQuery(params = {}) {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      qs.set(key, String(val).trim());
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export const smartRevisionApi = {
  getDaily: () => api("/api/smart-revision/daily"),
  getWeakTopics: () => api("/api/smart-revision/weak-topics"),
  submitReview: (itemId, outcome) =>
    api(`/api/smart-revision/items/${encodeURIComponent(itemId)}/review`, {
      method: "POST",
      body: JSON.stringify({ outcome }),
    }),
  getHistory: (limit = 30) => api(`/api/smart-revision/history${toQuery({ limit })}`),
  getPreferences: () => api("/api/smart-revision/preferences"),
  updatePreferences: (payload) =>
    api("/api/smart-revision/preferences", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
};

export const monthlyCapsulesStudentApi = {
  list: (params = {}) => api(`/api/monthly-capsules${toQuery(params)}`),
  getDetail: (id) => api(`/api/monthly-capsules/${encodeURIComponent(id)}`),
  updateSectionProgress: (capsuleId, sectionId, isCompleted = true) =>
    api(
      `/api/monthly-capsules/${encodeURIComponent(capsuleId)}/sections/${encodeURIComponent(sectionId)}/progress`,
      {
        method: "POST",
        body: JSON.stringify({ isCompleted }),
      },
    ),
};

export const monthlyCapsulesAdminApi = {
  list: (params = {}) => api(`/api/admin/monthly-capsules${toQuery(params)}`),
  getDetail: (id) => api(`/api/admin/monthly-capsules/${encodeURIComponent(id)}`),
  create: (payload) =>
    api("/api/admin/monthly-capsules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  generateDraft: (payload) =>
    api("/api/admin/monthly-capsules/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id, payload) =>
    api(`/api/admin/monthly-capsules/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  addSection: (id, payload) =>
    api(`/api/admin/monthly-capsules/${encodeURIComponent(id)}/sections`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  reorderSections: (id, orderedSectionIds) =>
    api(`/api/admin/monthly-capsules/${encodeURIComponent(id)}/sections/reorder`, {
      method: "PUT",
      body: JSON.stringify({ orderedSectionIds }),
    }),
  deleteSection: (id, sectionId) =>
    api(
      `/api/admin/monthly-capsules/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}`,
      { method: "DELETE" },
    ),
  addLink: (id, sectionId, payload) =>
    api(
      `/api/admin/monthly-capsules/${encodeURIComponent(id)}/sections/${encodeURIComponent(sectionId)}/links`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    ),
  removeLink: (id, linkId) =>
    api(`/api/admin/monthly-capsules/${encodeURIComponent(id)}/links/${encodeURIComponent(linkId)}`, {
      method: "DELETE",
    }),
  validate: (id) =>
    api(`/api/admin/monthly-capsules/${encodeURIComponent(id)}/validate`, {
      method: "POST",
    }),
  setStatus: (id, targetStatus) =>
    api(`/api/admin/monthly-capsules/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: JSON.stringify({ targetStatus }),
    }),
};
