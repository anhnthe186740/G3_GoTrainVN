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
} from "../controllers/routeSchedule.controller.js";

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

// Schedules
routeScheduleRoutes.get("/schedules/search", searchSchedules);
routeScheduleRoutes.get("/schedules", getSchedules);
routeScheduleRoutes.post("/schedules/auto-generate", generateSchedules);
