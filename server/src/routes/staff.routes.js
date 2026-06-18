import { Router } from "express";
import {
  confirmCancellation,
  quoteCancellation,
} from "../controllers/staffCancellation.controller.js";
import { globalStaffSearch } from "../controllers/staffSearch.controller.js";
import { authMiddleware } from "../middlewares/auth.js";
import { staffOrAdmin } from "../middlewares/staffOrAdmin.js";

export const staffRoutes = Router();

staffRoutes.use(authMiddleware, staffOrAdmin);
staffRoutes.get("/search", globalStaffSearch);
staffRoutes.post("/cancellations/quote", quoteCancellation);
staffRoutes.post("/cancellations/confirm", confirmCancellation);
