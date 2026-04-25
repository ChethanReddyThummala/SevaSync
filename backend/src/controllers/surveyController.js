// ================================================================
//  src/controllers/surveyController.js
//  createSurvey, getSurveys, getSurveyById,
//  updateSurveyStatus, deleteSurvey, syncOfflineSurveys
// ================================================================
"use strict";

const { dbAdd, dbGet, dbQuery, dbUpdate, dbDelete } = require("../config/db");
const { VALID_STATUSES } = require("../middleware/validate");

// POST /api/surveys
async function createSurvey(req, res) {
  try {
    const {
      category, severity, region,
      notes, photo, location, lang, offlineId,
    } = req.body;

    const survey = await dbAdd("surveys", {
      worker:     req.user.id,
      workerName: req.user.name || req.user.email,
      region,
      category,
      severity,
      notes:     notes     || "",
      photo:     photo     || null,   // base64 string or external URL
      location:  location  || null,   // { lat, lng, accuracy }
      lang:      lang      || req.user.lang || "English",
      status:    "Submitted",
      offlineId: offlineId || null,   // client-side temp ID for dedup
    });

    console.log(`Survey #${survey.id} | ${category}/${severity} | ${region} | by ${req.user.name}`);
    res.status(201).json({ message: "Survey submitted successfully", survey });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/surveys  ?region=&category=&severity=&status=
async function getSurveys(req, res) {
  try {
    const { region, category, severity, status } = req.query;
    const filters = {};

    // Field workers only see their own surveys — enforced here
    if (req.user.role === "field_worker") {
      filters.worker = req.user.id;
    }
    if (region)   filters.region   = region;
    if (category) filters.category = category;
    if (severity) filters.severity = severity;
    if (status)   filters.status   = status;

    const surveys = await dbQuery("surveys", filters);
    res.json({ total: surveys.length, surveys });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/surveys/:id
async function getSurveyById(req, res) {
  try {
    const survey = await dbGet("surveys", req.params.id);
    if (!survey) return res.status(404).json({ error: "Survey not found" });

    // Field workers can only view their own surveys
    if (req.user.role === "field_worker" && survey.worker !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    res.json(survey);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/surveys/:id/status  (admin, analyst only)
async function updateSurveyStatus(req, res) {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `status must be one of: ${VALID_STATUSES.join(", ")}`,
      });
    }

    const ok = await dbUpdate("surveys", req.params.id, {
      status,
      reviewedBy:   req.user.id,
      reviewerName: req.user.name,
    });

    if (!ok) return res.status(404).json({ error: "Survey not found" });
    res.json({ message: `Survey status updated to: ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/surveys/:id  (admin only)
async function deleteSurvey(req, res) {
  try {
    const ok = await dbDelete("surveys", req.params.id);
    if (!ok) return res.status(404).json({ error: "Survey not found" });
    res.json({ message: "Survey deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/surveys/sync/offline  — batch upload from offline queue
async function syncOfflineSurveys(req, res) {
  try {
    const { surveys: batch } = req.body;
    if (!Array.isArray(batch) || batch.length === 0) {
      return res.status(400).json({ error: "surveys[] array is required" });
    }

    const existing = await dbQuery("surveys");
    const synced   = [];
    const skipped  = [];

    for (const s of batch) {
      // Skip duplicates using the client-side offlineId
      if (s.offlineId && existing.find(r => r.offlineId === s.offlineId)) {
        skipped.push(s.offlineId);
        continue;
      }
      const saved = await dbAdd("surveys", {
        ...s,
        worker:     req.user.id,
        workerName: req.user.name || req.user.email,
        status:     "Submitted",
        syncedAt:   new Date().toISOString(),
      });
      synced.push(saved.id);
    }

    res.json({
      message: `Synced ${synced.length} surveys, skipped ${skipped.length} duplicates`,
      synced,
      skipped,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  createSurvey,
  getSurveys,
  getSurveyById,
  updateSurveyStatus,
  deleteSurvey,
  syncOfflineSurveys,
};
