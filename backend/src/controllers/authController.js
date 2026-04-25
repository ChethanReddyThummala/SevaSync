// ================================================================
//  src/controllers/authController.js
//  register, login, getMe
// ================================================================
"use strict";

const bcrypt                      = require("bcryptjs");
const { dbAdd, dbGet, dbQuery }   = require("../config/db");
const { signToken }               = require("../middleware/auth");
const { VALID_ROLES }             = require("../middleware/validate");

// POST /api/auth/register
async function register(req, res) {
  try {
    const {
      name, email, password,
      role   = "field_worker",
      region = "All",
      lang   = "English",
    } = req.body;

    // Check duplicate email
    const all = await dbQuery("users");
    if (all.find(u => u.email === email)) {
      return res.status(409).json({ error: "Email is already registered" });
    }

    const user = await dbAdd("users", {
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role:     VALID_ROLES.includes(role) ? role : "field_worker",
      region,
      lang,
      status:   "active",
    });

    const { password: _, ...safe } = user;
    res.status(201).json({
      message: "Account created successfully",
      user:    safe,
      token:   signToken(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/auth/login
async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const users = await dbQuery("users");
    const user  = users.find(u => u.email === email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (user.status === "suspended") {
      return res.status(403).json({ error: "Account suspended — contact your admin" });
    }

    const { password: _, ...safe } = user;
    res.json({
      message: "Login successful",
      user:    safe,
      token:   signToken(user),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/auth/me
async function getMe(req, res) {
  try {
    const user = await dbGet("users", req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    const { password: _, ...safe } = user;
    res.json(safe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { register, login, getMe };
