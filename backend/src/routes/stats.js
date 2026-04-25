// ================================================================
//  src/routes/stats.js
//  GET /api/stats
// ================================================================
"use strict";

const router    = require("express").Router();
const { requireAuth } = require("../middleware/auth");
const { getStats }    = require("../controllers/statsController");

router.get("/", requireAuth, getStats);

module.exports = router;
