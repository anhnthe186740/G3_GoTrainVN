import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { profile } from "../controllers/user.controller.js";

export const userRoutes = Router();

userRoutes.get("/profile", authMiddleware, profile);
