// ================================================================
//  src/middleware/rateLimiter.js
//  Three rate limit tiers: global, auth (strict), AI (cost control)
// ================================================================
"use strict";

const rateLimit = require("express-rate-limit");

// 300 requests per 15 minutes — applied to all routes
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — please slow down." },
});

// 20 attempts per 15 minutes — applied to login/register
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many login attempts — try again in 15 minutes." },
});

// 20 requests per minute — applied to AI routes to control API costs
const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: "AI rate limit reached — please wait 1 minute." },
});

module.exports = { globalLimiter, authLimiter, aiLimiter };
