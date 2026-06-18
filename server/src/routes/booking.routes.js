import { Router } from "express";
import {
  lookupBooking,
  cancelBooking,
  getBookingQuote,
  createBookingCheckout,
  confirmBookingQrPayment,
  getBookingPaymentState,
  receivePayosWebhook,
  getMyBookings,
  getAdminBookings,
  getAdminBookingStats,
  exchangeBooking,
} from "../controllers/booking.controller.js";
import { bookingIdentity } from "../middlewares/bookingIdentity.js";
import { authMiddleware } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/adminOnly.js";

export const bookingRoutes = Router();

bookingRoutes.get("/lookup", lookupBooking);
bookingRoutes.post("/payos/webhook", receivePayosWebhook);

// Customer: view own bookings
bookingRoutes.get("/my", authMiddleware, getMyBookings);

// Admin: view all bookings & stats
bookingRoutes.get(
  "/admin/stats",
  authMiddleware,
  adminOnly,
  getAdminBookingStats,
);
bookingRoutes.get("/admin", authMiddleware, adminOnly, getAdminBookings);

bookingRoutes.post("/quote", bookingIdentity, getBookingQuote);
bookingRoutes.post("/checkout", bookingIdentity, createBookingCheckout);
bookingRoutes.get(
  "/:id/payment-status",
  bookingIdentity,
  getBookingPaymentState,
);
bookingRoutes.post(
  "/:id/confirm-qr-payment",
  bookingIdentity,
  confirmBookingQrPayment,
);
bookingRoutes.post("/:id/exchange", authMiddleware, exchangeBooking);
bookingRoutes.post("/:id/cancel", cancelBooking);
