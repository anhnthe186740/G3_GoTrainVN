import { Router } from "express";
import {
  lookupBooking,
  cancelBooking,
  getBookingQuote,
  createBookingCheckout,
  confirmBookingQrPayment,
  getBookingPaymentState,
  receivePayosWebhook,
} from "../controllers/booking.controller.js";
import { bookingIdentity } from "../middlewares/bookingIdentity.js";

export const bookingRoutes = Router();

bookingRoutes.get("/lookup", lookupBooking);
bookingRoutes.post("/payos/webhook", receivePayosWebhook);
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
bookingRoutes.post("/:id/cancel", cancelBooking);
