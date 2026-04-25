// ================================================================
//  src/controllers/userController.js  (admin only)
//  getAllUsers, updateUserRole, suspendUser, activateUser
// ================================================================
"use strict";

const { dbQuery, dbUpdate } = require("../config/db");
const { VALID_ROLES }       = require("../middleware/validate");

// GET /api/users
async function getAllUsers(req, res) {
  try {
    const users = await dbQuery("users");
    res.json({
      total: users.length,
      users: users.map(({ password: _, ...u }) => u),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/users/:id/role
async function updateUserRole(req, res) {
  try {
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `role must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }
    // Prevent admin from removing their own admin role
    if (req.params.id === req.user.id && role !== "admin") {
      return res.status(400).json({ error: "You cannot change your own admin role" });
    }
    const ok = await dbUpdate("users", req.params.id, { role });
    if (!ok) return res.status(404).json({ error: "User not found" });
    res.json({ message: `Role updated to ${role}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/users/:id/suspend
async function suspendUser(req, res) {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You cannot suspend your own account" });
    }
    const ok = await dbUpdate("users", req.params.id, { status: "suspended" });
    if (!ok) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User suspended" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PATCH /api/users/:id/activate
async function activateUser(req, res) {
  try {
    const ok = await dbUpdate("users", req.params.id, { status: "active" });
    if (!ok) return res.status(404).json({ error: "User not found" });
    res.json({ message: "User activated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = { getAllUsers, updateUserRole, suspendUser, activateUser };
