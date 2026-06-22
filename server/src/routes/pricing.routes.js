import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import {
  createTicketType,
  getPricingConfiguration,
  getPricingContext,
  getPublicTicketTypes,
  getTicketTypes,
  previewFare,
  savePricingPolicy,
  setPricingPolicyActive,
  setTicketTypeActive,
  updateTicketType,
} from "../controllers/pricing.controller.js";

export const pricingRoutes = Router();

pricingRoutes.get("/ticket-types/public", getPublicTicketTypes);

pricingRoutes.use(authMiddleware, adminOnly);
pricingRoutes.get("/context", getPricingContext);
pricingRoutes.get("/configuration", getPricingConfiguration);
pricingRoutes.get("/ticket-types", getTicketTypes);
pricingRoutes.post("/ticket-types", createTicketType);
pricingRoutes.patch("/ticket-types/:id", updateTicketType);
pricingRoutes.patch("/ticket-types/:id/active", setTicketTypeActive);
pricingRoutes.post("/preview", previewFare);
pricingRoutes.post("/policies", savePricingPolicy);
pricingRoutes.patch("/policies/:policyCode/active", setPricingPolicyActive);
