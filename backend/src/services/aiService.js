// ================================================================
//  src/services/aiService.js
//  All AI logic: context building, Claude prompts, pattern detection.
//  Pattern detection is rule-based (free). Claude is used for
//  natural language queries and automated report generation.
// ================================================================
"use strict";

const { dbQuery }   = require("../config/db");
const { getClient } = require("../config/anthropic");

const AI_MODEL     = "claude-opus-4-5";
const MAX_ASK_TOKENS    = 700;
const MAX_REPORT_TOKENS = 1000;

// ----------------------------------------------------------------
//  BUILD LIVE CONTEXT FROM DATABASE
// ----------------------------------------------------------------
async function buildContext() {
  const surveys = await dbQuery("surveys");

  const total    = surveys.length;
  const critical = surveys.filter(s => s.severity === "Critical").length;

  const catMap = {}, sevMap = {}, regMap = {};
  surveys.forEach(s => {
    catMap[s.category] = (catMap[s.category] || 0) + 1;
    sevMap[s.severity] = (sevMap[s.severity] || 0) + 1;
    regMap[s.region]   = (regMap[s.region]   || 0) + 1;
  });

  const regions     = Object.keys(regMap).filter(Boolean).join(", ") || "None yet";
  const catSummary  = Object.entries(catMap).map(([k, v]) => `${k}:${v}`).join(", ") || "None";
  const topRegions  = Object.entries(regMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([r, c]) => `${r}(${c} reports)`)
    .join(", ");

  const recentNotes = surveys
    .slice(0, 10)
    .map(s => `  [${s.category} | ${s.severity} | ${s.region}] ${s.notes || "No notes"}`)
    .join("\n");

  return { total, critical, regions, catSummary, topRegions, recentNotes, catMap, sevMap, regMap };
}

// ----------------------------------------------------------------
//  SYSTEM PROMPT WITH LIVE DATA INJECTED
// ----------------------------------------------------------------
function buildSystemPrompt(ctx) {
  return [
    "You are SevaSync's AI humanitarian analyst supporting NGO field operations across South India.",
    "",
    "LIVE DATABASE SNAPSHOT:",
    `  Total surveys submitted : ${ctx.total}`,
    `  Critical issues flagged  : ${ctx.critical}`,
    `  Active regions           : ${ctx.regions}`,
    `  Category breakdown       : ${ctx.catSummary}`,
    `  Top active regions       : ${ctx.topRegions}`,
    "  Recent field notes:",
    ctx.recentNotes || "  (no surveys yet)",
    "",
    "YOUR ROLE:",
    "  - Detect patterns: outbreak clusters, rising trends, geographic hotspots",
    "  - Give specific, actionable recommendations (region + category + urgency)",
    "  - Prioritise: Critical > High > Medium > Low",
    "  - Format: clear bullet points, bold key findings, max 5 bullets",
    "  - Prefix genuine emergencies with URGENT:",
    "  - If no survey data exists yet, encourage field workers to start collecting",
  ].join("\n");
}

// ----------------------------------------------------------------
//  ASK AI — natural language query against live data
// ----------------------------------------------------------------
async function askAI(message, history = []) {
  const ai = getClient();
  if (!ai) throw new Error("ANTHROPIC_API_KEY is not set on the server");

  const ctx = await buildContext();

  const messages = [
    ...history.slice(-8),          // last 4 turns (user + assistant each)
    { role: "user", content: message },
  ];

  const response = await ai.messages.create({
    model:      AI_MODEL,
    max_tokens: MAX_ASK_TOKENS,
    system:     buildSystemPrompt(ctx),
    messages,
  });

  const reply = response.content
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("\n");

  return {
    reply,
    surveysAnalyzed: ctx.total,
    criticalCount:   ctx.critical,
    usage:           response.usage,
  };
}

// ----------------------------------------------------------------
//  GENERATE FIELD REPORT — structured AI-written report
// ----------------------------------------------------------------
async function generateFieldReport(type = "weekly", region = "All") {
  const ai = getClient();
  if (!ai) throw new Error("ANTHROPIC_API_KEY is not set on the server");

  const ctx = await buildContext();

  const prompt = [
    `Write a professional ${type} SevaSync humanitarian field report`,
    region !== "All" ? `specifically for the ${region} region.` : "covering all regions.",
    "",
    "LIVE DATA:",
    `  Total surveys  : ${ctx.total}`,
    `  Critical issues: ${ctx.critical}`,
    `  Regions covered: ${ctx.regions}`,
    `  Category data  : ${ctx.catSummary}`,
    "  Recent field notes:",
    ctx.recentNotes || "  (no data yet — encourage survey submission)",
    "",
    "REQUIRED FORMAT (use these exact headings):",
    "1. EXECUTIVE SUMMARY",
    "   2-3 sentences covering the overall situation.",
    "2. TOP PRIORITY ISSUES",
    "   List the top 3 issues with: Region, Category, Severity, Recommended Action.",
    "3. TRENDS AND PATTERNS",
    "   3 bullet points on what is rising, stable, or improving.",
    "4. RECOMMENDED INTERVENTIONS",
    "   3 concrete next steps, each with a responsible party named.",
    "5. DATA QUALITY NOTE",
    "   Brief note on coverage gaps or data reliability.",
    "",
    "Audience: NGO partners and government officials.",
    "Tone: Professional, factual, and actionable. No filler.",
  ].join("\n");

  const response = await ai.messages.create({
    model:      AI_MODEL,
    max_tokens: MAX_REPORT_TOKENS,
    messages:   [{ role: "user", content: prompt }],
  });

  return response.content.map(b => b.text || "").join("\n");
}

// ----------------------------------------------------------------
//  DETECT PATTERNS — rule-based, free, instant (no AI cost)
// ----------------------------------------------------------------
async function detectPatterns() {
  const surveys  = await dbQuery("surveys");
  const insights = [];

  const byGroup = (cat, sev) =>
    surveys.filter(s => s.category === cat && s.severity === sev);

  const regionList = arr =>
    [...new Set(arr.map(s => s.region).filter(Boolean))].join(", ");

  // --- Health outbreak cluster
  const critHealth = byGroup("Health", "Critical");
  if (critHealth.length >= 2) {
    insights.push({
      type:   "critical",
      icon:   "RED_CIRCLE",
      title:  "Health Outbreak Cluster Detected",
      desc:   `${critHealth.length} critical health reports in: ${regionList(critHealth)}`,
      action: "Deploy Medical Team",
      affectedRegions: regionList(critHealth),
    });
  }

  // --- Water contamination cluster
  const waterIssues = surveys.filter(
    s => s.category === "Water" && ["Critical", "High"].includes(s.severity)
  );
  if (waterIssues.length >= 2) {
    insights.push({
      type:   "high",
      icon:   "ORANGE_CIRCLE",
      title:  "Water Safety Crisis Cluster",
      desc:   `${waterIssues.length} water safety reports in: ${regionList(waterIssues)}`,
      action: "Alert WASH Unit",
      affectedRegions: regionList(waterIssues),
    });
  }

  // --- Food insecurity
  const foodIssues = surveys.filter(s => s.category === "Food");
  if (foodIssues.length >= 3) {
    insights.push({
      type:   "medium",
      icon:   "YELLOW_CIRCLE",
      title:  "Food Insecurity Pattern",
      desc:   `${foodIssues.length} food shortage reports across ${new Set(foodIssues.map(s => s.region)).size} regions`,
      action: "Coordinate Food Banks",
    });
  }

  // --- Sanitation risk
  const sanitIssues = surveys.filter(s => s.category === "Sanitation");
  if (sanitIssues.length >= 3) {
    insights.push({
      type:   "medium",
      icon:   "YELLOW_CIRCLE",
      title:  "Sanitation Risk Rising",
      desc:   `${sanitIssues.length} sanitation reports — disease risk if unaddressed`,
      action: "Deploy Sanitation Teams",
    });
  }

  // --- Education trend
  const eduIssues = surveys.filter(s => s.category === "Education");
  if (eduIssues.length >= 2) {
    insights.push({
      type:   "low",
      icon:   "GREEN_CIRCLE",
      title:  "Education Trend Detected",
      desc:   `${eduIssues.length} education issues reported — possible seasonal pattern`,
      action: "Schedule Community Outreach",
    });
  }

  // --- No patterns yet
  if (insights.length === 0) {
    insights.push({
      type:   "info",
      icon:   "INFO",
      title:  surveys.length === 0 ? "No Data Yet" : "Collecting Data",
      desc:   surveys.length === 0
        ? "No surveys submitted yet. Ask field workers to start collecting data."
        : `${surveys.length} surveys collected. More data is needed to detect patterns.`,
      action: surveys.length === 0 ? "Submit First Survey" : "Continue Data Collection",
    });
  }

  return insights;
}

module.exports = { askAI, generateFieldReport, detectPatterns, buildContext };
