// ================================================================
//  src/routes/auth.js
//  POST /api/auth/register
//  POST /api/auth/login
//  GET  /api/auth/me
// ================================================================
"use strict";

const router = require("express").Router();
const { register, login, getMe } = require("../controllers/authController");
const { requireAuth }            = require("../middleware/auth");
const { authLimiter }            = require("../middleware/rateLimiter");
const { validateRegister }       = require("../middleware/validate");

router.post("/register", authLimiter, validateRegister, register);
router.post("/login",    authLimiter, login);
router.get("/me",        requireAuth, getMe);

module.exports = router;
