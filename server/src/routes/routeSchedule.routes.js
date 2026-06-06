import { Router } from "express";
import {
  getStations,
  getTrains,
  getRoutes,
  getSchedules,
  generateRoute,
  generateSchedules,
  deleteRoute,
} from "../controllers/routeSchedule.controller.js";

export const routeScheduleRoutes = Router();

// Stations & Trains (reference data)
routeScheduleRoutes.get("/stations", getStations);
routeScheduleRoutes.get("/trains", getTrains);

// Routes
routeScheduleRoutes.get("/routes", getRoutes);
routeScheduleRoutes.post("/routes/auto-generate", generateRoute);
routeScheduleRoutes.delete("/routes/:id", deleteRoute);

// Schedules
routeScheduleRoutes.get("/schedules", getSchedules);
routeScheduleRoutes.post("/schedules/auto-generate", generateSchedules);
