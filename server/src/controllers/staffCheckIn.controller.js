import { processTicketCheckIn } from "../services/staffCheckIn.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const checkInTicket = asyncHandler(async (req, res) => {
  const { ticketCode } = req.body;
  const staffId = req.user.id;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";

  const ticket = await processTicketCheckIn({
    ticketCode,
    staffId,
    ipAddress,
  });

  res.json({
    success: true,
    message: "Soát vé và lên tàu thành công.",
    ticket,
  });
});
