import {
  confirmStaffCancellation,
  quoteStaffCancellation,
} from "../services/staffCancellation.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const quoteCancellation = asyncHandler(async (req, res) => {
  const quote = await quoteStaffCancellation(req.body);
  res.json({ quote });
});

export const confirmCancellation = asyncHandler(async (req, res) => {
  const result = await confirmStaffCancellation({
    ...req.body,
    staffId: req.user.id,
  });
  res.json({
    message: "Đã hủy vé và xử lý hoàn tiền.",
    ...result,
  });
});
