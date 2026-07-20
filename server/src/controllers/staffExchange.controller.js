import { confirmStaffExchange } from "../services/staffExchange.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const exchangeTicket = asyncHandler(async (req, res) => {
  const { bookingId, sessionId, paymentMethod, reason } = req.body;
  const result = await confirmStaffExchange({
    bookingId,
    sessionId,
    paymentMethod,
    reason,
    staffId: req.user.id,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
  });
  res.json({ message: "Đổi vé thành công.", ...result });
});
