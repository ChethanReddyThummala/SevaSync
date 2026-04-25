// ================================================================
//  src/routes/surveys.js
//  POST   /api/surveys
//  GET    /api/surveys
//  GET    /api/surveys/:id
//  PATCH  /api/surveys/:id/status
//  DELETE /api/surveys/:id
//  POST   /api/surveys/sync/offline
// ================================================================
"use strict";

const router = require("express").Router();
const { requireAuth, requireRole } = require("../middleware/auth");
const { validateSurvey }           = require("../middleware/validate");
const {
  createSurvey,
  getSurveys,
  getSurveyById,
  updateSurveyStatus,
  deleteSurvey,
  syncOfflineSurveys,
} = require("../controllers/surveyController");

// Offline sync — must be before /:id to avoid route conflict
router.post("/sync/offline", requireAuth, syncOfflineSurveys);

router.post("/",             requireAuth, validateSurvey, createSurvey);
router.get("/",              requireAuth, getSurveys);
router.get("/:id",           requireAuth, getSurveyById);
router.patch("/:id/status",  requireAuth, requireRole("admin", "analyst"), updateSurveyStatus);
router.delete("/:id",        requireAuth, requireRole("admin"), deleteSurvey);

module.exports = router;
