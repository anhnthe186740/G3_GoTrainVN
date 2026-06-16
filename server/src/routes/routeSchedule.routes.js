import { Router } from "express";
import {
  getStations,
  getTrains,
  getTrainById,
  getRoutes,
  getSchedules,
  searchSchedules,
  generateRoute,
  generateSchedules,
  deleteRoute,
  createTrain,
  deleteTrain,
  triggerAutoGenerateSchedules,
  getRouteTemplates,
  createRouteTemplate,
  updateRouteTemplate,
  deleteRouteTemplate,
  generateSchedulesByRange,
  getScheduleTimeline,
} from "../controllers/routeSchedule.controller.js";
import { authMiddleware } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/adminOnly.js";

export const routeScheduleRoutes = Router();

// Stations & Trains (reference data)
routeScheduleRoutes.get("/stations", getStations);
routeScheduleRoutes.get("/trains", getTrains);
routeScheduleRoutes.get("/trains/:id", getTrainById);
routeScheduleRoutes.post("/trains", createTrain);
routeScheduleRoutes.delete("/trains/:id", deleteTrain);

// Routes
routeScheduleRoutes.get("/routes", getRoutes);
routeScheduleRoutes.post("/routes/auto-generate", generateRoute);
routeScheduleRoutes.delete("/routes/:id", deleteRoute);

// Route Templates (Mẫu lịch chạy)
routeScheduleRoutes.get(
  "/route-templates",
  authMiddleware,
  adminOnly,
  getRouteTemplates,
);
routeScheduleRoutes.post(
  "/route-templates",
  authMiddleware,
  adminOnly,
  createRouteTemplate,
);
routeScheduleRoutes.put(
  "/route-templates/:id",
  authMiddleware,
  adminOnly,
  updateRouteTemplate,
);
routeScheduleRoutes.delete(
  "/route-templates/:id",
  authMiddleware,
  adminOnly,
  deleteRouteTemplate,
);

// Schedules
routeScheduleRoutes.get("/schedules/search", searchSchedules);
routeScheduleRoutes.get("/schedules", getSchedules);
routeScheduleRoutes.get("/schedules/:id/timeline", getScheduleTimeline);
routeScheduleRoutes.post("/schedules/auto-generate", generateSchedules);
routeScheduleRoutes.post(
  "/schedules/trigger-auto-generate",
  authMiddleware,
  adminOnly,
  triggerAutoGenerateSchedules,
);
routeScheduleRoutes.post(
  "/schedules/generate-range",
  authMiddleware,
  adminOnly,
  generateSchedulesByRange,
);
