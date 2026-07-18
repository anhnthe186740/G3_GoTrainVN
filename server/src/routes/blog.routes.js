import { Router } from "express";
import { getBlogs, createBlog } from "../controllers/blog.controller.js";
import { authMiddleware } from "../middlewares/auth.js";

export const blogRoutes = Router();

blogRoutes.get("/", getBlogs);
blogRoutes.post("/", authMiddleware, createBlog);
