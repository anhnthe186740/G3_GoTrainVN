import { Router } from "express";
import {
  lookupBooking,
  cancelBooking,
  getBookingQuote,
  createBookingCheckout,
  confirmBookingQrPayment,
} from "../controllers/booking.controller.js";
import { bookingIdentity } from "../middlewares/bookingIdentity.js";

export const bookingRoutes = Router();

bookingRoutes.get("/lookup", lookupBooking);
bookingRoutes.post("/quote", bookingIdentity, getBookingQuote);
bookingRoutes.post("/checkout", bookingIdentity, createBookingCheckout);
bookingRoutes.post(
  "/:id/confirm-qr-payment",
  bookingIdentity,
  confirmBookingQrPayment,
);
bookingRoutes.post("/:id/cancel", cancelBooking);
