import { Router } from "express";
import {
  confirmCancellation,
  quoteCancellation,
} from "../controllers/staffCancellation.controller.js";
import { globalStaffSearch } from "../controllers/staffSearch.controller.js";
import {
  checkInTicket,
  undoCheckInTicket,
} from "../controllers/staffCheckIn.controller.js";
import { getStaffStats } from "../controllers/staffStats.controller.js";
import { exchangeTicket } from "../controllers/staffExchange.controller.js";
import { authMiddleware } from "../middlewares/auth.js";
import { staffOrAdmin } from "../middlewares/staffOrAdmin.js";

export const staffRoutes = Router();

staffRoutes.use(authMiddleware, staffOrAdmin);
staffRoutes.get("/search", globalStaffSearch);
staffRoutes.get("/stats", getStaffStats);
staffRoutes.post("/cancellations/quote", quoteCancellation);
staffRoutes.post("/cancellations/confirm", confirmCancellation);
staffRoutes.post("/check-in", checkInTicket);
staffRoutes.post("/check-in/undo", undoCheckInTicket);
staffRoutes.post("/exchange", exchangeTicket);
