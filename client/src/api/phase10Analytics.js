import { api } from "./client";

export const phase10AnalyticsApi = {
  getAdminOverview: ({ days = 30, refresh = false } = {}) =>
    api(`/api/admin/analytics/overview?days=${encodeURIComponent(days)}&refresh=${refresh ? "true" : "false"}`),
  invalidateAdminCache: () =>
    api("/api/admin/analytics/cache/invalidate", { method: "POST" }),
  getStudentPerformance: () => api("/api/student/performance-analytics"),
};
