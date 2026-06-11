import { Router } from "express";
import {
  lookupBooking,
  cancelBooking,
} from "../controllers/booking.controller.js";

export const bookingRoutes = Router();

bookingRoutes.get("/lookup", lookupBooking);
bookingRoutes.post("/:id/cancel", cancelBooking);
