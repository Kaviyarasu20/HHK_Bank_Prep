import { Router } from "express";
import { pool } from "../db.js";
import { requireAuth } from "../middleware.js";
import { getStudentPerformanceAnalytics } from "../services/studentPerformanceService.js";

export const studentPerformanceRouter = Router();
studentPerformanceRouter.use(requireAuth);

studentPerformanceRouter.get("/", async (req, res, next) => {
  try {
    const analytics = await getStudentPerformanceAnalytics(req.session.userId, pool);
    res.json({ success: true, analytics });
  } catch (err) {
    next(err);
  }
});
