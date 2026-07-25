import {
  processTicketCheckIn,
  undoTicketCheckIn,
  reportTicketMismatch,
  correctPassengerInfo,
  invalidateTicket,
  exchangeTicketType,
} from "../services/staffCheckIn.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const checkInTicket = asyncHandler(async (req, res) => {
  const { ticketCode } = req.body;
  const staffId = req.user.id;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";

  const ticket = await processTicketCheckIn({ ticketCode, staffId, ipAddress });

  res.json({
    success: true,
    message: "Soát vé và lên tàu thành công.",
    ticket,
  });
});

export const undoCheckInTicket = asyncHandler(async (req, res) => {
  const { ticketCode } = req.body;
  const staffId = req.user.id;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";

  const result = await undoTicketCheckIn({ ticketCode, staffId, ipAddress });

  res.json({
    success: true,
    message: `Đã hoàn tác soát vé cho hành khách ${result.fullName}.`,
    ticketCode: result.ticketCode,
  });
});

// Báo sai lệch thông tin kiểm soát vé (Inspector)
export const reportMismatchTicket = asyncHandler(async (req, res) => {
  const { ticketCode } = req.body;
  const staffId = req.user.id;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";

  const result = await reportTicketMismatch({ ticketCode, staffId, ipAddress });

  res.json({
    success: true,
    message: `Đã từ chối soát vé cho hành khách ${result.fullName} do thông tin sai lệch.`,
    ticketCode: result.ticketCode,
  });
});

// Đính chính thông tin hành khách tại quầy (Situation 2)
export const correctInfo = asyncHandler(async (req, res) => {
  const { ticketCode, fullName, nationalId, dateOfBirth } = req.body;
  const staffId = req.user.id;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";

  const result = await correctPassengerInfo({
    ticketCode,
    fullName,
    nationalId,
    dateOfBirth,
    staffId,
    ipAddress,
  });

  res.json({
    success: true,
    message: `Đã đính chính thông tin cho hành khách ${result.fullName} thành công.`,
    ticketCode: result.ticketCode,
  });
});

// Vô hiệu hóa vé do vi phạm điều khoản vận chuyển (Situation 3)
export const invalidate = asyncHandler(async (req, res) => {
  const { ticketCode, reason } = req.body;
  const staffId = req.user.id;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";

  const result = await invalidateTicket({
    ticketCode,
    reason,
    staffId,
    ipAddress,
  });

  res.json({
    success: true,
    message: `Đã vô hiệu hóa vé ${result.ticketCode} do vi phạm điều khoản vận chuyển.`,
    ticketCode: result.ticketCode,
  });
});

// Thu hồi ưu đãi và nâng cấp loại vé sang ADULT tại quầy (Situation 1)
export const exchangeType = asyncHandler(async (req, res) => {
  const { ticketCode, paymentMethod } = req.body;
  const staffId = req.user.id;
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";

  const result = await exchangeTicketType({
    ticketCode,
    paymentMethod,
    staffId,
    ipAddress,
  });

  res.json({
    success: true,
    message: `Đã thu hồi ưu đãi và nâng cấp vé sang loại Người lớn thành công.`,
    ...result,
  });
});
