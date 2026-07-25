import { Router } from "express";
import jwt from "jsonwebtoken";
import { chat } from "../controllers/chatbot.controller.js";

const chatbotRoutes = Router();

// Middleware giải mã token tùy chọn (Optional auth)
const optionalAuth = (req, res, next) => {
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      // Bỏ qua lỗi token hết hạn/không hợp lệ, tiếp tục xử lý với vai trò GUEST
    }
  }
  next();
};

chatbotRoutes.post("/", optionalAuth, chat);

export default chatbotRoutes;
