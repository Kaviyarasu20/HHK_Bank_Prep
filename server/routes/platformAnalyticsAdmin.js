import { Router } from "express";
import { pool } from "../db.js";
import { requireAdmin } from "../middleware.js";
import { getAdminPlatformAnalytics } from "../services/platformAnalyticsService.js";
import { platformSafeCache } from "../services/safeCacheService.js";

export const platformAnalyticsAdminRouter = Router();
platformAnalyticsAdminRouter.use(requireAdmin);

platformAnalyticsAdminRouter.get("/overview", async (req, res, next) => {
  try {
    const days = req.query.days ? Number(req.query.days) : 30;
    const refresh = String(req.query.refresh || "").toLowerCase() === "true";
    const analytics = await getAdminPlatformAnalytics({
      days,
      dbPool: pool,
      useCache: !refresh,
    });
    res.json({ success: true, analytics });
  } catch (err) {
    next(err);
  }
});

platformAnalyticsAdminRouter.post("/cache/invalidate", (_req, res) => {
  platformSafeCache.invalidatePrefix("admin:analytics:");
  res.json({ success: true, message: "Analytics aggregate cache cleared." });
});
