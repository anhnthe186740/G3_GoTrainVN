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
  activateRoute,
  createTrain,
  deleteTrain,
  triggerAutoGenerateSchedules,
  getRouteTemplates,
  createRouteTemplate,
  updateRouteTemplate,
  deleteRouteTemplate,
  generateSchedulesByRange,
  getScheduleTimeline,
  updateTrainStatus,
  updateScheduleDelay,
  updateScheduleLiveTracking,
  getScheduleLiveTracking,
} from "../controllers/routeSchedule.controller.js";
import { authMiddleware } from "../middlewares/auth.js";
import { adminOnly } from "../middlewares/adminOnly.js";
import { staffOrAdmin } from "../middlewares/staffOrAdmin.js";

export const routeScheduleRoutes = Router();

const adminOnlyRoute = [authMiddleware, adminOnly];

// Stations & Trains (reference data)
routeScheduleRoutes.get("/stations", getStations);
routeScheduleRoutes.get("/trains", getTrains);
routeScheduleRoutes.get("/trains/:id", getTrainById);
routeScheduleRoutes.post("/trains", ...adminOnlyRoute, createTrain);
routeScheduleRoutes.delete("/trains/:id", ...adminOnlyRoute, deleteTrain);

// Routes
routeScheduleRoutes.get("/routes", getRoutes);
routeScheduleRoutes.post(
  "/routes/auto-generate",
  ...adminOnlyRoute,
  generateRoute,
);
routeScheduleRoutes.delete("/routes/:id", ...adminOnlyRoute, deleteRoute);
routeScheduleRoutes.put(
  "/routes/:id/activate",
  ...adminOnlyRoute,
  activateRoute,
);

// Route Templates (Mẫu lịch chạy)
routeScheduleRoutes.get(
  "/route-templates",
  ...adminOnlyRoute,
  getRouteTemplates,
);
routeScheduleRoutes.post(
  "/route-templates",
  ...adminOnlyRoute,
  createRouteTemplate,
);
routeScheduleRoutes.put(
  "/route-templates/:id",
  ...adminOnlyRoute,
  updateRouteTemplate,
);
routeScheduleRoutes.delete(
  "/route-templates/:id",
  ...adminOnlyRoute,
  deleteRouteTemplate,
);

// Schedules
routeScheduleRoutes.get("/schedules/search", searchSchedules);
routeScheduleRoutes.get("/schedules", getSchedules);
routeScheduleRoutes.get("/schedules/:id/timeline", getScheduleTimeline);
routeScheduleRoutes.get(
  "/schedules/:id/live-tracking",
  authMiddleware,
  getScheduleLiveTracking,
);
routeScheduleRoutes.post(
  "/schedules/auto-generate",
  ...adminOnlyRoute,
  generateSchedules,
);
routeScheduleRoutes.post(
  "/schedules/trigger-auto-generate",
  ...adminOnlyRoute,
  triggerAutoGenerateSchedules,
);
routeScheduleRoutes.post(
  "/schedules/generate-range",
  ...adminOnlyRoute,
  generateSchedulesByRange,
);

// Trạng thái vận hành & Cập nhật Delay sự cố
routeScheduleRoutes.put(
  "/trains/:id/status",
  ...adminOnlyRoute,
  updateTrainStatus,
);
routeScheduleRoutes.put(
  "/schedules/:id/delay",
  authMiddleware,
  staffOrAdmin,
  updateScheduleDelay,
);
routeScheduleRoutes.put(
  "/schedules/:id/live-tracking",
  ...adminOnlyRoute,
  updateScheduleLiveTracking,
);
