// ================================================================
//  src/middleware/auth.js
//  JWT token signing, verification, and role-based access control.
// ================================================================
"use strict";

const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "sevasync-dev-secret-CHANGE-IN-PROD";

// Sign a 7-day JWT for a user
function signToken(user) {
  return jwt.sign(
    {
      id:     user.id,
      email:  user.email,
      role:   user.role,
      region: user.region,
      name:   user.name,
    },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// Middleware: verify Bearer token and attach req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token — please log in" });
  }
  try {
    req.user = jwt.verify(header.split(" ")[1], JWT_SECRET);
    next();
  } catch (_) {
    res.status(401).json({ error: "Token invalid or expired — please log in again" });
  }
}

// Middleware factory: restrict to specific roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user?.role)) {
      return res.status(403).json({
        error: `Access denied. This action requires: ${roles.join(" or ")}`,
      });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole };
