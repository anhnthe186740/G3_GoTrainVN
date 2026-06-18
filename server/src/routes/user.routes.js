import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import {
  profile,
  searchCustomerForStaff,
  updateProfile,
} from "../controllers/user.controller.js";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getAdminRolesStats,
  getAdminAuditLogs,
  getSecurityLogs,
} from "../controllers/userAdmin.controller.js";
import { staffOrAdmin } from "../middlewares/staffOrAdmin.js";

export const userRoutes = Router();

function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

userRoutes.get("/profile", authMiddleware, profile);
userRoutes.put("/profile", authMiddleware, updateProfile);
userRoutes.get(
  "/staff/search",
  authMiddleware,
  staffOrAdmin,
  searchCustomerForStaff,
);

// Admin user management routes
userRoutes.get("/admin/list", authMiddleware, adminOnly, getAdminUsers);
userRoutes.post("/admin/create", authMiddleware, adminOnly, createAdminUser);
userRoutes.put("/admin/update/:id", authMiddleware, adminOnly, updateAdminUser);
userRoutes.delete(
  "/admin/delete/:id",
  authMiddleware,
  adminOnly,
  deleteAdminUser,
);
userRoutes.get(
  "/admin/roles-stats",
  authMiddleware,
  adminOnly,
  getAdminRolesStats,
);

userRoutes.get(
  "/admin/audit-logs",
  authMiddleware,
  adminOnly,
  getAdminAuditLogs,
);

userRoutes.get(
  "/admin/security-logs",
  authMiddleware,
  adminOnly,
  getSecurityLogs,
);
