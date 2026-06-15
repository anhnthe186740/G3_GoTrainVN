import { Router } from "express";
import { bookingIdentity } from "../middlewares/bookingIdentity.js";
import {
  confirmSeatHolds,
  deleteSeatSession,
  getScheduleSeatMap,
  getSeatSession,
} from "../controllers/seatSelection.controller.js";

export const seatSelectionRoutes = Router();

seatSelectionRoutes.use(bookingIdentity);
seatSelectionRoutes.post("/seat-holds/confirm", confirmSeatHolds);
seatSelectionRoutes.get("/seat-sessions/:sessionId", getSeatSession);
seatSelectionRoutes.delete("/seat-sessions/:sessionId", deleteSeatSession);
seatSelectionRoutes.get("/schedules/:scheduleId/seat-map", getScheduleSeatMap);
