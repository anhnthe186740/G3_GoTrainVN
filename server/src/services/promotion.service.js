import { prisma } from "../config/database.js";

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

/**
 * Validates a voucher code against constraints (active status, validity dates, budget limit, order min).
 */
export async function validateVoucher(voucherCode, subtotal, userId = null) {
  const code = String(voucherCode || "")
    .trim()
    .toUpperCase();
  if (!code) {
    throw httpError(400, "Mã voucher không được để trống.");
  }

  // Guest users are not allowed to use vouchers
  if (!userId) {
    throw httpError(
      403,
      "Khách vãng lai không thể sử dụng mã giảm giá. Vui lòng đăng nhập.",
    );
  }

  const now = new Date();
  const voucher = await prisma.voucher.findUnique({
    where: { voucherCode: code },
  });

  if (!voucher) {
    throw httpError(404, "Mã giảm giá không tồn tại trên hệ thống.");
  }

  if (!voucher.active) {
    throw httpError(400, "Mã giảm giá hiện đang bị vô hiệu hóa.");
  }

  if (voucher.validFrom > now) {
    throw httpError(400, "Mã giảm giá chưa đến thời gian áp dụng.");
  }

  if (voucher.validTo < now) {
    throw httpError(400, "Mã giảm giá đã hết hạn sử dụng.");
  }

  if (
    voucher.maxUsageCount != null &&
    voucher.currentUsageCount >= voucher.maxUsageCount
  ) {
    throw httpError(400, "Mã giảm giá đã hết lượt sử dụng.");
  }

  if (voucher.minBookingAmount != null && subtotal < voucher.minBookingAmount) {
    throw httpError(
      400,
      `Đơn hàng cần tối thiểu ${voucher.minBookingAmount.toLocaleString("vi-VN")} VND để áp dụng mã này.`,
    );
  }

  // Calculate discount value
  let discountAmount = 0;
  if (voucher.discountType === "PERCENTAGE") {
    discountAmount = (subtotal * voucher.discountValue) / 100;
  } else {
    discountAmount = voucher.discountValue;
  }

  // Cap at max discount if defined
  if (voucher.maxDiscountAmount != null) {
    discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
  }

  discountAmount = Math.round(Math.min(discountAmount, subtotal));

  return {
    voucher,
    discountAmount,
  };
}

/**
 * Checks for automatic promotions matching the trainId or routeId of the schedules in a booking session.
 * Automatically picks the best promotion (largest discount) that has enough remaining budget.
 */
export async function findBestPromotion(scheduleIds, subtotal) {
  if (!scheduleIds || scheduleIds.length === 0) {
    return { promotion: null, discountAmount: 0 };
  }

  const now = new Date();

  // 1. Fetch matching schedules
  const schedules = await prisma.schedule.findMany({
    where: { id: { in: scheduleIds } },
    select: { id: true, routeId: true, trainId: true },
  });

  if (schedules.length === 0) {
    return { promotion: null, discountAmount: 0 };
  }

  // 2. Fetch active promotions
  const activePromotions = await prisma.promotion.findMany({
    where: {
      status: "ACTIVE",
      validFrom: { lte: now },
      validTo: { gte: now },
    },
  });

  if (activePromotions.length === 0) {
    return { promotion: null, discountAmount: 0 };
  }

  let bestPromo = null;
  let bestDiscount = 0;

  // 3. Evaluate each promotion
  for (const promo of activePromotions) {
    // Check if promotion budget is exceeded
    if (promo.maxBudget != null && promo.usedBudget >= promo.maxBudget) {
      continue;
    }

    // Check if the promotion matches any of the schedules' routes or trains
    const matches = schedules.some((schedule) => {
      const routeMatch =
        promo.routeIds.length === 0 ||
        promo.routeIds.includes(schedule.routeId);
      const trainMatch =
        promo.trainIds.length === 0 ||
        promo.trainIds.includes(schedule.trainId);
      return routeMatch && trainMatch;
    });

    if (!matches) continue;

    // Calculate discount amount
    let discount = 0;
    if (promo.discountType === "PERCENTAGE") {
      discount = (subtotal * promo.discountValue) / 100;
    } else {
      discount = promo.discountValue;
    }

    // Check if the discount fits in remaining budget
    if (promo.maxBudget != null) {
      const remainingBudget = promo.maxBudget - promo.usedBudget;
      discount = Math.min(discount, remainingBudget);
    }

    discount = Math.round(Math.min(discount, subtotal));

    if (discount > bestDiscount) {
      bestDiscount = discount;
      bestPromo = promo;
    }
  }

  return {
    promotion: bestPromo,
    discountAmount: bestDiscount,
  };
}

/**
 * Admin: Get promotions
 */
export async function getAdminPromotions({
  search,
  status,
  page = 1,
  limit = 10,
}) {
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};
  if (status) where.status = status;
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  const [total, promotions] = await Promise.all([
    prisma.promotion.count({ where }),
    prisma.promotion.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    promotions,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Admin: Get vouchers
 */
export async function getAdminVouchers({
  search,
  active,
  page = 1,
  limit = 10,
}) {
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};
  if (active !== undefined) where.active = active === "true";
  if (search) {
    where.voucherCode = { contains: search, mode: "insensitive" };
  }

  const [total, vouchers] = await Promise.all([
    prisma.voucher.count({ where }),
    prisma.voucher.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    vouchers,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Admin: Create Voucher
 */
export async function createVoucher(data, adminContext) {
  const existing = await prisma.voucher.findUnique({
    where: { voucherCode: data.voucherCode.trim().toUpperCase() },
  });
  if (existing) {
    throw httpError(400, "Mã voucher đã tồn tại.");
  }

  const voucher = await prisma.voucher.create({
    data: {
      voucherCode: data.voucherCode.trim().toUpperCase(),
      description: data.description || null,
      discountType: data.discountType,
      discountValue: Number(data.discountValue),
      maxUsageCount: data.maxUsageCount ? Number(data.maxUsageCount) : null,
      minBookingAmount: data.minBookingAmount
        ? Number(data.minBookingAmount)
        : null,
      maxDiscountAmount: data.maxDiscountAmount
        ? Number(data.maxDiscountAmount)
        : null,
      validFrom: new Date(data.validFrom),
      validTo: new Date(data.validTo),
      active: data.active !== false,
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: adminContext.adminId,
      action: "CREATE",
      entity: "Voucher",
      entityId: voucher.id,
      description: `Tạo mã voucher mới: ${voucher.voucherCode}`,
      ipAddress: adminContext.ipAddress,
    },
  });

  return voucher;
}

/**
 * Admin: Update Voucher
 */
export async function updateVoucher(id, data, adminContext) {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) {
    throw httpError(404, "Không tìm thấy mã voucher.");
  }

  const voucher = await prisma.voucher.update({
    where: { id },
    data: {
      description:
        data.description !== undefined
          ? data.description
          : existing.description,
      discountType:
        data.discountType !== undefined
          ? data.discountType
          : existing.discountType,
      discountValue:
        data.discountValue !== undefined
          ? Number(data.discountValue)
          : existing.discountValue,
      maxUsageCount:
        data.maxUsageCount !== undefined
          ? data.maxUsageCount
            ? Number(data.maxUsageCount)
            : null
          : existing.maxUsageCount,
      minBookingAmount:
        data.minBookingAmount !== undefined
          ? data.minBookingAmount
            ? Number(data.minBookingAmount)
            : null
          : existing.minBookingAmount,
      maxDiscountAmount:
        data.maxDiscountAmount !== undefined
          ? data.maxDiscountAmount
            ? Number(data.maxDiscountAmount)
            : null
          : existing.maxDiscountAmount,
      validFrom: data.validFrom ? new Date(data.validFrom) : existing.validFrom,
      validTo: data.validTo ? new Date(data.validTo) : existing.validTo,
      active:
        data.active !== undefined ? Boolean(data.active) : existing.active,
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: adminContext.adminId,
      action: "UPDATE",
      entity: "Voucher",
      entityId: voucher.id,
      description: `Cập nhật mã voucher: ${voucher.voucherCode}`,
      ipAddress: adminContext.ipAddress,
    },
  });

  return voucher;
}

/**
 * Admin: Delete Voucher
 */
export async function deleteVoucher(id, adminContext) {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) {
    throw httpError(404, "Không tìm thấy mã voucher.");
  }

  await prisma.voucher.delete({ where: { id } });

  await prisma.adminLog.create({
    data: {
      adminId: adminContext.adminId,
      action: "DELETE",
      entity: "Voucher",
      entityId: id,
      description: `Xóa mã voucher: ${existing.voucherCode}`,
      ipAddress: adminContext.ipAddress,
    },
  });

  return { success: true };
}

/**
 * Admin: Create Promotion
 */
export async function createPromotion(data, adminContext) {
  const promotion = await prisma.promotion.create({
    data: {
      title: data.title.trim(),
      description: data.description || null,
      discountType: data.discountType,
      discountValue: Number(data.discountValue),
      routeIds: Array.isArray(data.routeIds) ? data.routeIds : [],
      trainIds: Array.isArray(data.trainIds) ? data.trainIds : [],
      validFrom: new Date(data.validFrom),
      validTo: new Date(data.validTo),
      maxBudget: data.maxBudget ? Number(data.maxBudget) : null,
      status: data.status || "ACTIVE",
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: adminContext.adminId,
      action: "CREATE",
      entity: "Promotion",
      entityId: promotion.id,
      description: `Tạo chương trình khuyến mãi tự động: ${promotion.title}`,
      ipAddress: adminContext.ipAddress,
    },
  });

  return promotion;
}

/**
 * Admin: Update Promotion
 */
export async function updatePromotion(id, data, adminContext) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) {
    throw httpError(404, "Không tìm thấy chương trình khuyến mãi.");
  }

  const promotion = await prisma.promotion.update({
    where: { id },
    data: {
      title: data.title !== undefined ? data.title.trim() : existing.title,
      description:
        data.description !== undefined
          ? data.description
          : existing.description,
      discountType:
        data.discountType !== undefined
          ? data.discountType
          : existing.discountType,
      discountValue:
        data.discountValue !== undefined
          ? Number(data.discountValue)
          : existing.discountValue,
      routeIds: Array.isArray(data.routeIds)
        ? data.routeIds
        : existing.routeIds,
      trainIds: Array.isArray(data.trainIds)
        ? data.trainIds
        : existing.trainIds,
      validFrom: data.validFrom ? new Date(data.validFrom) : existing.validFrom,
      validTo: data.validTo ? new Date(data.validTo) : existing.validTo,
      maxBudget:
        data.maxBudget !== undefined
          ? data.maxBudget
            ? Number(data.maxBudget)
            : null
          : existing.maxBudget,
      status: data.status !== undefined ? data.status : existing.status,
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: adminContext.adminId,
      action: "UPDATE",
      entity: "Promotion",
      entityId: promotion.id,
      description: `Cập nhật chương trình khuyến mãi: ${promotion.title}`,
      ipAddress: adminContext.ipAddress,
    },
  });

  return promotion;
}

/**
 * Admin: Delete Promotion
 */
export async function deletePromotion(id, adminContext) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) {
    throw httpError(404, "Không tìm thấy chương trình khuyến mãi.");
  }

  await prisma.promotion.delete({ where: { id } });

  await prisma.adminLog.create({
    data: {
      adminId: adminContext.adminId,
      action: "DELETE",
      entity: "Promotion",
      entityId: id,
      description: `Xóa chương trình khuyến mãi: ${existing.title}`,
      ipAddress: adminContext.ipAddress,
    },
  });

  return { success: true };
}

/**
 * Public: Get active promotions & vouchers
 */
export async function getActivePromotionsAndVouchers() {
  const now = new Date();

  const [promotions, vouchers] = await Promise.all([
    prisma.promotion.findMany({
      where: {
        status: "ACTIVE",
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.voucher.findMany({
      where: {
        active: true,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { promotions, vouchers };
}
