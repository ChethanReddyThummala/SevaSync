// ================================================================
//  src/controllers/statsController.js
//  Dashboard stats — totals, breakdowns, 7-day daily trend
// ================================================================
"use strict";

const { dbQuery } = require("../config/db");

// GET /api/stats
async function getStats(req, res) {
  try {
    const [surveys, users] = await Promise.all([
      dbQuery("surveys"),
      dbQuery("users"),
    ]);

    const byCategory = {};
    const bySeverity = {};
    const byRegion   = {};
    const byStatus   = {};
    const byLang     = {};

    surveys.forEach(s => {
      byCategory[s.category] = (byCategory[s.category] || 0) + 1;
      bySeverity[s.severity] = (bySeverity[s.severity] || 0) + 1;
      byRegion[s.region]     = (byRegion[s.region]     || 0) + 1;
      byStatus[s.status]     = (byStatus[s.status]     || 0) + 1;
      if (s.lang) byLang[s.lang] = (byLang[s.lang] || 0) + 1;
    });

    // Build 7-day daily trend
    const now = Date.now();
    const dailyTrend = {};
    for (let i = 6; i >= 0; i--) {
      const d   = new Date(now - i * 86400000);
      const key = d.toISOString().split("T")[0];
      dailyTrend[key] = 0;
    }
    surveys.forEach(s => {
      if (!s.createdAt) return;
      let dateStr;
      if (typeof s.createdAt === "string") {
        dateStr = s.createdAt.split("T")[0];
      } else if (s.createdAt.seconds) {
        dateStr = new Date(s.createdAt.seconds * 1000).toISOString().split("T")[0];
      }
      if (dateStr && dateStr in dailyTrend) {
        dailyTrend[dateStr]++;
      }
    });

    res.json({
      total:       surveys.length,
      critical:    surveys.filter(s => s.severity === "Critical").length,
      regions:     Object.keys(byRegion).length,
      workers:     users.filter(u => u.role === "field_worker").length,
      byCategory,
      bySeverity,
      byRegion,
      byStatus,
      byLang,
      dailyTrend,
      lastUpdated: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getStats };
