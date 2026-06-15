import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { profile, updateProfile } from "../controllers/user.controller.js";
import {
  getAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  getAdminRolesStats,
} from "../controllers/userAdmin.controller.js";

export const userRoutes = Router();

function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

userRoutes.get("/profile", authMiddleware, profile);
userRoutes.put("/profile", authMiddleware, updateProfile);

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
