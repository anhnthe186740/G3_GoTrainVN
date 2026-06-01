import { Router } from "express";
import { body } from "express-validator";
import { register, login } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";

export const authRoutes = Router();

authRoutes.post(
  "/register",
  [
    body("fullName").trim().notEmpty(),
    body("email").isEmail(),
    body("password").isLength({ min: 8 }),
    body("phoneNumber").trim().notEmpty(),
  ],
  validate,
  register,
);

authRoutes.post(
  "/login",
  [body("email").isEmail(), body("password").notEmpty()],
  validate,
  login,
);
