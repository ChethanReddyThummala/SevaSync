// ================================================================
//  src/routes/ai.js
//  POST /api/ai/ask
//  GET  /api/ai/insights
//  POST /api/ai/reports/generate
//  GET  /api/ai/reports
//  GET  /api/ai/reports/:id
// ================================================================
"use strict";

const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { aiLimiter }                = require("../middleware/rateLimiter");
const {
  aiAsk,
  aiInsights,
  generateReport,
  getReports,
  getReportById,
} = require("../controllers/aiController");

// All authenticated users can ask AI and view insights
router.post("/ask",      requireAuth, aiLimiter, aiAsk);
router.get("/insights",  requireAuth, aiInsights);

// Reports: admin, analyst, ngo only
router.post("/reports/generate", requireAuth, requireRole("admin", "analyst", "ngo"), aiLimiter, generateReport);
router.get("/reports",           requireAuth, requireRole("admin", "analyst", "ngo"), getReports);
router.get("/reports/:id",       requireAuth, requireRole("admin", "analyst", "ngo"), getReportById);

module.exports = router;
