// ================================================================
//  src/routes/users.js  (admin only)
//  GET   /api/users
//  PATCH /api/users/:id/role
//  PATCH /api/users/:id/suspend
//  PATCH /api/users/:id/activate
// ================================================================
"use strict";

const router = require("express").Router();
const { requireAuth, requireRole }                         = require("../middleware/auth");
const { getAllUsers, updateUserRole, suspendUser, activateUser } = require("../controllers/userController");

router.get("/",              requireAuth, requireRole("admin"), getAllUsers);
router.patch("/:id/role",    requireAuth, requireRole("admin"), updateUserRole);
router.patch("/:id/suspend", requireAuth, requireRole("admin"), suspendUser);
router.patch("/:id/activate",requireAuth, requireRole("admin"), activateUser);

module.exports = router;
