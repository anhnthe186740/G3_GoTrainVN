import { asyncHandler } from "../utils/asyncHandler.js";
import { getChatbotResponse } from "../services/chatbot.service.js";

export const chat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  if (!message || message.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Vui lòng nhập nội dung tin nhắn.",
    });
  }

  // Lấy thông tin user đăng nhập nếu có để cá nhân hóa lời chào
  const userContext = req.user
    ? {
        name: req.user.fullName || req.user.name,
        role: req.user.role,
      }
    : { role: "GUEST" };

  const reply = await getChatbotResponse(message, userContext);

  return res.status(200).json({
    success: true,
    data: {
      reply,
    },
  });
});
