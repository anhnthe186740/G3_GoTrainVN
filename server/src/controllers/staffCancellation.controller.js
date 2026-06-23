import {
  confirmStaffCancellation,
  quoteStaffCancellation,
} from "../services/staffCancellation.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const quoteCancellation = asyncHandler(async (req, res) => {
  const { bookingId, passengerIds } = req.body;
  const quote = await quoteStaffCancellation({ bookingId, passengerIds });
  res.json({ quote });
});

export const confirmCancellation = asyncHandler(async (req, res) => {
  const { bookingId, passengerIds, refundMethod, reason } = req.body;
  const result = await confirmStaffCancellation({
    bookingId,
    passengerIds,
    refundMethod,
    reason,
    staffId: req.user.id,
    ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
  });
  res.json({
    message: "Đã hủy vé và xử lý hoàn tiền.",
    ...result,
  });
});
