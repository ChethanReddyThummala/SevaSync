// ================================================================
//  src/server.js — SevaSync API  (Entry Point)
//
//  HOW TO START:
//    npm install
//    cp .env.example .env       <-- fill in ANTHROPIC_API_KEY
//    npm start                  <-- production
//    npm run dev                <-- development (auto-reload)
//
//  Demo mode (no Firebase needed):
//    Just set ANTHROPIC_API_KEY and run — uses in-memory storage.
//    Login: admin@sevasync.org / admin123
//
//  Production (with Firestore):
//    Also set FIREBASE_SERVICE_ACCOUNT or drop serviceAccountKey.json
//    in the project root, then restart.
// ================================================================
"use strict";

require("dotenv").config();

const express = require("express");
const cors    = require("cors");
const helmet  = require("helmet");
const morgan  = require("morgan");

const { initFirebase, isFirestoreConnected } = require("./config/db");
const { globalLimiter }                      = require("./middleware/rateLimiter");

// Route modules
const authRoutes   = require("./routes/auth");
const surveyRoutes = require("./routes/surveys");
const aiRoutes     = require("./routes/ai");
const statsRoutes  = require("./routes/stats");
const userRoutes   = require("./routes/users");

const app  = express();
const PORT = process.env.PORT || 8080;

// ── Database ──────────────────────────────────────────────────
initFirebase();

// ── Security & parsing middleware ─────────────────────────────
app.use(helmet({ contentSecurityPolicy: false }));

app.use(cors({
  origin:         process.env.FRONTEND_URL || "*",
  methods:        ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials:    true,
}));

app.use(express.json({ limit: "10mb" }));   // 10 MB supports base64 photo uploads
app.use(morgan("dev"));
app.use(globalLimiter);

// ── Health check ──────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    app:     "SevaSync API",
    version: "2.0.0",
    status:  "running",
    db:      isFirestoreConnected() ? "firestore" : "in-memory-demo",
    ai:      process.env.ANTHROPIC_API_KEY ? "ready" : "no-api-key",
    endpoints: {
      auth: [
        "POST /api/auth/register",
        "POST /api/auth/login",
        "GET  /api/auth/me",
      ],
      surveys: [
        "POST   /api/surveys",
        "GET    /api/surveys",
        "GET    /api/surveys/:id",
        "PATCH  /api/surveys/:id/status",
        "DELETE /api/surveys/:id",
        "POST   /api/surveys/sync/offline",
      ],
      ai: [
        "POST /api/ai/ask",
        "GET  /api/ai/insights",
        "POST /api/ai/reports/generate",
        "GET  /api/ai/reports",
        "GET  /api/ai/reports/:id",
      ],
      stats: ["GET /api/stats"],
      users: [
        "GET   /api/users",
        "PATCH /api/users/:id/role",
        "PATCH /api/users/:id/suspend",
        "PATCH /api/users/:id/activate",
      ],
    },
  });
});

// ── Mount all routes ──────────────────────────────────────────
app.use("/api/auth",    authRoutes);
app.use("/api/surveys", surveyRoutes);
app.use("/api/ai",      aiRoutes);
app.use("/api/stats",   statsRoutes);
app.use("/api/users",   userRoutes);

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  res.status(500).json({ error: "Internal server error", detail: err.message });
});

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  const dbMode  = isFirestoreConnected() ? "Firebase Firestore  " : "In-Memory (demo)    ";
  const aiMode  = process.env.ANTHROPIC_API_KEY ? "Claude ready        " : "No key — set env var";

  console.log("");
  console.log("  +----------------------------------------------+");
  console.log("  |   SevaSync API  v2.0.0                       |");
  console.log(`  |   http://localhost:${PORT}                       |`);
  console.log(`  |   DB : ${dbMode}              |`);
  console.log(`  |   AI : ${aiMode}              |`);
  console.log("  +----------------------------------------------+");
  console.log("");
  console.log("  Demo login  =>  admin@sevasync.org / admin123");
  console.log("");
});

module.exports = app;
