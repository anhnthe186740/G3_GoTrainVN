import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { logger } from "./middlewares/logger.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { notFound } from "./middlewares/notFound.js";
import { authRoutes } from "./routes/auth.routes.js";
import { userRoutes } from "./routes/user.routes.js";
import { routeScheduleRoutes } from "./routes/routeSchedule.routes.js";
import { walletRoutes } from "./routes/wallet.routes.js";
import { bookingRoutes } from "./routes/booking.routes.js";
import { pricingRoutes } from "./routes/pricing.routes.js";
import { seatSelectionRoutes } from "./routes/seatSelection.routes.js";

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(logger);

app.get("/api/v1/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1", routeScheduleRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/pricing", pricingRoutes);
app.use("/api/v1", seatSelectionRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
