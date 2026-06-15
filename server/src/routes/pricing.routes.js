import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import {
  getPricingConfiguration,
  getPricingContext,
  previewFare,
  savePricingPolicy,
  setPricingPolicyActive,
} from "../controllers/pricing.controller.js";

export const pricingRoutes = Router();

pricingRoutes.use(authMiddleware, adminOnly);
pricingRoutes.get("/context", getPricingContext);
pricingRoutes.get("/configuration", getPricingConfiguration);
pricingRoutes.post("/preview", previewFare);
pricingRoutes.post("/policies", savePricingPolicy);
pricingRoutes.patch("/policies/:policyCode/active", setPricingPolicyActive);
