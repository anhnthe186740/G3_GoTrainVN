import { asyncHandler } from "../utils/asyncHandler.js";
import * as promotionService from "../services/promotion.service.js";

function adminContext(req) {
  return {
    adminId: req.user.id,
    ipAddress: req.ip,
  };
}

export const getActivePromotions = asyncHandler(async (_req, res) => {
  const result = await promotionService.getActivePromotionsAndVouchers();
  res.json(result);
});

export const validateVoucherCode = asyncHandler(async (req, res) => {
  const { voucherCode, subtotal } = req.body;
  const userId = req.user?.id; // will check if user is logged in (guest check)

  const result = await promotionService.validateVoucher(
    voucherCode,
    Number(subtotal),
    userId,
  );

  res.json({
    isValid: true,
    discountAmount: result.discountAmount,
    voucher: {
      voucherCode: result.voucher.voucherCode,
      discountType: result.voucher.discountType,
      discountValue: result.voucher.discountValue,
      minBookingAmount: result.voucher.minBookingAmount,
      maxDiscountAmount: result.voucher.maxDiscountAmount,
    },
  });
});

export const getAdminPromotions = asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 10 } = req.query;
  const result = await promotionService.getAdminPromotions({
    search,
    status,
    page,
    limit,
  });
  res.json(result);
});

export const getAdminVouchers = asyncHandler(async (req, res) => {
  const { search, active, page = 1, limit = 10 } = req.query;
  const result = await promotionService.getAdminVouchers({
    search,
    active,
    page,
    limit,
  });
  res.json(result);
});

export const createVoucher = asyncHandler(async (req, res) => {
  const voucher = await promotionService.createVoucher(
    req.body,
    adminContext(req),
  );
  res.status(201).json({
    message: "Tạo mã voucher mới thành công.",
    voucher,
  });
});

export const updateVoucher = asyncHandler(async (req, res) => {
  const voucher = await promotionService.updateVoucher(
    req.params.id,
    req.body,
    adminContext(req),
  );
  res.json({
    message: "Cập nhật mã voucher thành công.",
    voucher,
  });
});

export const deleteVoucher = asyncHandler(async (req, res) => {
  const result = await promotionService.deleteVoucher(
    req.params.id,
    adminContext(req),
  );
  res.json({
    message: "Xóa mã voucher thành công.",
    ...result,
  });
});

export const createPromotion = asyncHandler(async (req, res) => {
  const promotion = await promotionService.createPromotion(
    req.body,
    adminContext(req),
  );
  res.status(201).json({
    message: "Tạo chương trình khuyến mãi mới thành công.",
    promotion,
  });
});

export const updatePromotion = asyncHandler(async (req, res) => {
  const promotion = await promotionService.updatePromotion(
    req.params.id,
    req.body,
    adminContext(req),
  );
  res.json({
    message: "Cập nhật chương trình khuyến mãi thành công.",
    promotion,
  });
});

export const deletePromotion = asyncHandler(async (req, res) => {
  const result = await promotionService.deletePromotion(
    req.params.id,
    adminContext(req),
  );
  res.json({
    message: "Xóa chương trình khuyến mãi thành công.",
    ...result,
  });
});

export const sendVoucherEmail = asyncHandler(async (req, res) => {
  const { voucherId, email } = req.body;
  await promotionService.sendVoucherEmail(voucherId, email, adminContext(req));
  res.json({
    success: true,
    message: `Đã gửi mã giảm giá thành công tới email ${email}.`,
  });
});

export const triggerBirthdayVouchers = asyncHandler(async (req, res) => {
  const result = await promotionService.triggerBirthdayVouchers();
  res.json({
    success: true,
    message: `Đã hoàn thành quét sinh nhật và gửi quà tặng!`,
    data: result,
  });
});
