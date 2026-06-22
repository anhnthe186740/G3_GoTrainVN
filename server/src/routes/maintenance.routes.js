import { Router } from "express";
import {
  createMaintenance,
  getMaintenanceList,
  updateMaintenanceStatus,
  deleteMaintenance,
  blockSeat,
} from "../controllers/maintenance.controller.js";
import { authMiddleware } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import { staffOrAdmin } from "../middlewares/staffOrAdmin.js";

export const maintenanceRoutes = Router();

// Lấy danh sách bảo trì - Cả Staff và Admin đều xem được
maintenanceRoutes.get("/", authMiddleware, staffOrAdmin, getMaintenanceList);

// Tạo mới, cập nhật trạng thái, xóa kế hoạch bảo trì - Chỉ Admin mới có quyền
maintenanceRoutes.post("/", authMiddleware, adminOnly, createMaintenance);

maintenanceRoutes.put(
  "/:id",
  authMiddleware,
  adminOnly,
  updateMaintenanceStatus,
);

maintenanceRoutes.delete("/:id", authMiddleware, adminOnly, deleteMaintenance);

// Khóa/Mở khóa ghế - Cả Staff (ở hiện trường) và Admin đều làm được
maintenanceRoutes.put(
  "/seats/:id/block",
  authMiddleware,
  staffOrAdmin,
  blockSeat,
);
