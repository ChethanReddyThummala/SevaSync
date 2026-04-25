// ================================================================
//  src/controllers/aiController.js
//  AI ask, pattern insights, report generation and retrieval
// ================================================================
"use strict";

const { askAI, generateFieldReport, detectPatterns } = require("../services/aiService");
const { dbAdd, dbGet, dbQuery }                      = require("../config/db");

// POST /api/ai/ask
async function aiAsk(req, res) {
  try {
    const { message, history = [] } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: "message field is required" });
    }
    const result = await askAI(message.trim(), history);
    res.json(result);
  } catch (err) {
    console.error("AI ask error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/ai/insights  — free, rule-based, no AI cost
async function aiInsights(req, res) {
  try {
    const insights = await detectPatterns();
    res.json({ insights, generatedAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/ai/reports/generate
async function generateReport(req, res) {
  try {
    const { type = "weekly", region = "All" } = req.body;
    const validTypes = ["weekly", "monthly", "emergency", "quarterly"];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `type must be one of: ${validTypes.join(", ")}`,
      });
    }

    const content = await generateFieldReport(type, region);

    const report = await dbAdd("reports", {
      type,
      region,
      content,
      generatedBy:   req.user.id,
      generatorName: req.user.name,
    });

    res.json({
      message: "Report generated successfully",
      report:  {
        id:          report.id,
        type,
        region,
        content,
        generatedAt: report.createdAt,
      },
    });
  } catch (err) {
    console.error("Report generation error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/ai/reports  — list with preview (first 150 chars)
async function getReports(req, res) {
  try {
    const reports = await dbQuery("reports");
    res.json({
      total:   reports.length,
      reports: reports.map(r => ({
        ...r,
        content: r.content ? r.content.slice(0, 150) + "..." : "",
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/ai/reports/:id  — full report
async function getReportById(req, res) {
  try {
    const report = await dbGet("reports", req.params.id);
    if (!report) return res.status(404).json({ error: "Report not found" });
    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { aiAsk, aiInsights, generateReport, getReports, getReportById };
