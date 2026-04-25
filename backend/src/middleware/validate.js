// ================================================================
//  src/middleware/validate.js
//  Input validation middleware for surveys and auth routes.
// ================================================================
"use strict";

const VALID_SEVERITY = ["Critical", "High", "Medium", "Low"];
const VALID_ROLES    = ["admin", "field_worker", "ngo", "analyst"];
const VALID_STATUSES = ["Submitted", "Under Review", "Resolved", "Escalated"];
const VALID_CATS     = ["Health", "Water", "Food", "Education", "Shelter", "Sanitation"];
const VALID_LANGS    = ["English", "Telugu", "Hindi", "Urdu", "Tamil", "Kannada", "Malayalam"];

function validateSurvey(req, res, next) {
  const { category, severity, region } = req.body;
  if (!category || !severity || !region) {
    return res.status(400).json({ error: "category, severity, and region are required" });
  }
  if (!VALID_SEVERITY.includes(severity)) {
    return res.status(400).json({ error: `severity must be one of: ${VALID_SEVERITY.join(", ")}` });
  }
  if (!VALID_CATS.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATS.join(", ")}` });
  }
  next();
}

function validateRegister(req, res, next) {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }
  next();
}

module.exports = {
  validateSurvey,
  validateRegister,
  VALID_SEVERITY,
  VALID_ROLES,
  VALID_STATUSES,
  VALID_CATS,
  VALID_LANGS,
};
