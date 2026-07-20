import { Router } from "express";
import {
  getActivePromotions,
  validateVoucherCode,
  getAdminPromotions,
  getAdminVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher,
  createPromotion,
  updatePromotion,
  deletePromotion,
  sendVoucherEmail,
  triggerBirthdayVouchers,
} from "../controllers/promotion.controller.js";
import { bookingIdentity } from "../middlewares/bookingIdentity.js";
import { authMiddleware } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/adminOnly.js";

export const promotionRoutes = Router();

// Public routes
promotionRoutes.get("/", getActivePromotions);
promotionRoutes.post("/validate", bookingIdentity, validateVoucherCode);

// Admin routes
promotionRoutes.get(
  "/admin/promotions",
  authMiddleware,
  adminOnly,
  getAdminPromotions,
);
promotionRoutes.get(
  "/admin/vouchers",
  authMiddleware,
  adminOnly,
  getAdminVouchers,
);

promotionRoutes.post(
  "/admin/vouchers",
  authMiddleware,
  adminOnly,
  createVoucher,
);
promotionRoutes.put(
  "/admin/vouchers/:id",
  authMiddleware,
  adminOnly,
  updateVoucher,
);
promotionRoutes.delete(
  "/admin/vouchers/:id",
  authMiddleware,
  adminOnly,
  deleteVoucher,
);

promotionRoutes.post(
  "/admin/promotions",
  authMiddleware,
  adminOnly,
  createPromotion,
);
promotionRoutes.put(
  "/admin/promotions/:id",
  authMiddleware,
  adminOnly,
  updatePromotion,
);
promotionRoutes.delete(
  "/admin/promotions/:id",
  authMiddleware,
  adminOnly,
  deletePromotion,
);

promotionRoutes.post(
  "/admin/vouchers/send-email",
  authMiddleware,
  adminOnly,
  sendVoucherEmail,
);

promotionRoutes.post(
  "/admin/vouchers/trigger-birthdays",
  authMiddleware,
  adminOnly,
  triggerBirthdayVouchers,
);
