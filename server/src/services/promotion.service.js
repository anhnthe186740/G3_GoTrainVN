import { prisma } from "../config/database.js";
import { sendEmail } from "./email.service.js";

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
      isPublic: data.isPublic !== false,
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
      isPublic:
        data.isPublic !== undefined
          ? Boolean(data.isPublic)
          : existing.isPublic,
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
        isPublic: true,
        validFrom: { lte: now },
        validTo: { gte: now },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return { promotions, vouchers };
}

/**
 * Admin: Send a private voucher to a specific customer email manually
 */
export async function sendVoucherEmail(voucherId, targetEmail, adminContext) {
  const voucher = await prisma.voucher.findUnique({
    where: { id: voucherId },
  });
  if (!voucher) {
    throw httpError(404, "Không tìm thấy mã voucher.");
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(targetEmail)) {
    throw httpError(400, "Địa chỉ email không hợp lệ.");
  }

  const discountValueStr =
    voucher.discountType === "PERCENTAGE"
      ? `${voucher.discountValue}%`
      : `${voucher.discountValue.toLocaleString("vi-VN")} VND`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 12px; padding: 24px;">
      <h2 style="color: #00629d; text-align: center;">Món Quà Đặc Biệt Dành Riêng Cho Bạn!</h2>
      <p>Xin chào,</p>
      <p>GoTrain xin gửi tặng bạn một mã giảm giá độc quyền dành riêng cho bạn hoặc cho sự kiện đặc biệt của bạn:</p>
      <div style="background-color: #f7fafc; border: 2px dashed #00629d; padding: 16px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; color: #00629d; border-radius: 8px; margin: 20px 0;">
        ${voucher.voucherCode}
      </div>
      <p><b>Thông tin ưu đãi:</b></p>
      <ul>
        <li>Mức giảm giá: <b>${discountValueStr}</b></li>
        ${voucher.minBookingAmount ? `<li>Áp dụng cho đơn hàng tối thiểu từ: <b>${voucher.minBookingAmount.toLocaleString("vi-VN")} VND</b></li>` : ""}
        <li>Hạn sử dụng đến ngày: <b>${new Date(voucher.validTo).toLocaleDateString("vi-VN")}</b></li>
      </ul>
      <p>Hãy truy cập website <a href="http://localhost:5173" style="color: #00629d; text-decoration: none; font-weight: bold;">GoTrain VN</a> và nhập mã giảm giá này tại bước thanh toán để nhận ưu đãi.</p>
      <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
      <p style="font-size: 12px; color: #888; text-align: center;">Đây là email tự động gửi từ hệ thống GoTrain VN.</p>
    </div>
  `;

  await sendEmail({
    to: targetEmail,
    subject: `[GoTrain] Tặng bạn mã giảm giá độc quyền ${voucher.voucherCode}`,
    html,
  });

  await prisma.adminLog.create({
    data: {
      adminId: adminContext.adminId,
      action: "UPDATE",
      entity: "Voucher",
      entityId: voucherId,
      description: `Gửi email voucher ${voucher.voucherCode} tới ${targetEmail}`,
      ipAddress: adminContext.ipAddress,
    },
  });

  return { success: true };
}

/**
 * Marketing Automation: Automatically scan and email Birthday Vouchers to users
 */
export async function triggerBirthdayVouchers() {
  const allUsers = await prisma.user.findMany({
    where: {
      dateOfBirth: { not: null },
      isActive: true,
      deletedAt: null,
    },
  });

  const today = new Date();
  const todayDay = today.getDate();
  const todayMonth = today.getMonth();

  const birthdayUsers = allUsers.filter((u) => {
    const dob = new Date(u.dateOfBirth);
    return dob.getDate() === todayDay && dob.getMonth() === todayMonth;
  });

  const processed = [];

  for (const u of birthdayUsers) {
    // Generate a unique birthday voucher code: BDAY-[Initials/Name]-[Random]
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    const cleanName = u.fullName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const namePart =
      cleanName.length > 5 ? cleanName.substring(0, 5) : cleanName;
    const voucherCode = `BDAY-${namePart}-${randomSuffix}`;

    // Create Birthday Voucher in DB (active: true, isPublic: false, valid for 7 days, discount 50k VND)
    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 7);

    const voucher = await prisma.voucher.create({
      data: {
        voucherCode,
        description: `Món quà sinh nhật chúc mừng tuổi mới của ${u.fullName}!`,
        discountType: "FIXED_AMOUNT",
        discountValue: 50000, // 50k
        minBookingAmount: 100000, // Đơn tối thiểu 100k
        validFrom,
        validTo,
        active: true,
        isPublic: false, // Hidden
      },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fbcfe8; border-radius: 16px; padding: 30px; background-color: #fdf2f8;">
        <div style="text-align: center;">
          <span style="font-size: 50px;">🎂</span>
        </div>
        <h2 style="color: #db2777; text-align: center; margin-top: 10px;">Chúc Mừng Sinh Nhật ${u.fullName}!</h2>
        <p>Thân gửi <b>${u.fullName}</b>,</p>
        <p>GoTrain xin kính chúc bạn đón tuổi mới tràn ngập niềm vui, hạnh phúc và gặt hái được nhiều thành công.</p>
        <p>Để nhân đôi niềm vui trong ngày sinh nhật của bạn, GoTrain xin gửi tặng bạn món quà nhỏ là mã giảm giá trị giá <b>50.000 VND</b> cho hành trình đi lại tiếp theo:</p>
        
        <div style="background-color: #fff; border: 2px dashed #db2777; padding: 16px; text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 2px; color: #db2777; border-radius: 12px; margin: 24px 0; box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
          ${voucherCode}
        </div>
        
        <p><b>Điều kiện sử dụng quà tặng:</b></p>
        <ul>
          <li>Trị giá ưu đãi: <b>50.000 VND</b></li>
          <li>Áp dụng cho đơn hàng từ: <b>100.000 VND</b></li>
          <li>Thời hạn áp dụng: 7 ngày (từ nay đến ngày <b>${validTo.toLocaleDateString("vi-VN")}</b>)</li>
        </ul>
        <p>Hãy điền mã giảm giá này khi đặt vé tàu trên trang web của chúng tôi để được giảm trừ trực tiếp.</p>
        <hr style="border: 0; border-top: 1px dashed #fbcfe8; margin: 25px 0;">
        <p style="font-size: 12px; color: #db2777; text-align: center; font-weight: bold;">Chúc bạn có những chuyến đi thật trọn vẹn và ý nghĩa! 🚂🎉</p>
      </div>
    `;

    await sendEmail({
      to: u.email,
      subject: `[GoTrain] Chúc mừng sinh nhật! Nhận quà tặng mã giảm giá độc quyền từ chúng tôi 🎁`,
      html,
    });

    processed.push({ email: u.email, name: u.fullName, code: voucherCode });
  }

  return {
    success: true,
    processedCount: processed.length,
    processed,
  };
}

/**
 * Marketing Automation: Calculate loyalty points and automatically award level-up vouchers
 */
export async function awardLoyaltyPointsAndCheckTier(
  tx,
  userId,
  totalAmount,
  bookingId,
) {
  // 1 point per 10,000 VND spent
  const pointsEarned = Math.floor(totalAmount / 10000);
  if (pointsEarned <= 0) return;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { loyaltyPoints: true, email: true, fullName: true },
  });

  if (!user) return;

  const oldPoints = user.loyaltyPoints;
  const newPoints = oldPoints + pointsEarned;

  // Define points tiers
  const getTier = (pts) => {
    if (pts >= 2000) return { name: "Kim Cương (Diamond)", discount: 20 };
    if (pts >= 500) return { name: "Vàng (Gold)", discount: 15 };
    if (pts >= 100) return { name: "Bạc (Silver)", discount: 10 };
    return { name: "Đồng (Bronze)", discount: 0 };
  };

  const oldTier = getTier(oldPoints);
  const newTier = getTier(newPoints);

  // 1. Update user points in DB
  await tx.user.update({
    where: { id: userId },
    data: { loyaltyPoints: newPoints },
  });

  // 2. Log in LoyaltyPoint history
  await tx.loyaltyPoint.create({
    data: {
      userId,
      points: pointsEarned,
      type: "EARNED",
      source: "BOOKING",
      relatedBookingId: bookingId,
    },
  });

  // 3. Check if upgraded
  if (newTier.discount > oldTier.discount) {
    // Upgraded! Generate thăng hạng VIP voucher
    const randomSuffix = Math.random()
      .toString(36)
      .substring(2, 6)
      .toUpperCase();
    const cleanName = user.fullName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase();
    const namePart =
      cleanName.length > 5 ? cleanName.substring(0, 5) : cleanName;
    const voucherCode = `VIP-${newTier.name.split(" ")[0].toUpperCase()}-${namePart}-${randomSuffix}`;

    const validFrom = new Date();
    const validTo = new Date();
    validTo.setDate(validTo.getDate() + 30); // 30 days expiry

    // Create Voucher
    await tx.voucher.create({
      data: {
        voucherCode,
        description: `Quà tặng chúc mừng bạn thăng hạng thành viên lên ${newTier.name}!`,
        discountType: "PERCENTAGE",
        discountValue: newTier.discount,
        minBookingAmount: 0,
        validFrom,
        validTo,
        active: true,
        isPublic: false, // Hidden
      },
    });

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fef08a; border-radius: 16px; padding: 30px; background-color: #fefce8;">
        <div style="text-align: center;">
          <span style="font-size: 50px;">👑</span>
        </div>
        <h2 style="color: #a16207; text-align: center; margin-top: 10px;">Chúc Mừng Bạn Thăng Hạng ${newTier.name}!</h2>
        <p>Chào <b>${user.fullName}</b>,</p>
        <p>GoTrain trân trọng cảm ơn sự đồng hành và gắn bó của bạn cùng chúng tôi trên mỗi hành trình qua các chặng đường sắt.</p>
        <p>Chúng tôi vô cùng vui mừng thông báo rằng tổng số điểm tích lũy của bạn hiện tại đã đạt <b>${newPoints} điểm</b>, chính thức nâng hạng thẻ thành viên của bạn lên hạng <b>${newTier.name}</b>!</p>
        
        <p>Để chào mừng bạn gia nhập câu lạc bộ thành viên VIP của GoTrain, chúng tôi gửi tặng bạn mã giảm giá thăng hạng trị giá <b>giảm ${newTier.discount}%</b> cho hành trình kế tiếp:</p>
        
        <div style="background-color: #fff; border: 2px dashed #a16207; padding: 16px; text-align: center; font-size: 26px; font-weight: bold; letter-spacing: 2px; color: #a16207; border-radius: 12px; margin: 24px 0;">
          ${voucherCode}
        </div>
        
        <p><b>Thông tin chi tiết voucher:</b></p>
        <ul>
          <li>Quyền lợi hạng mới: Giảm <b>${newTier.discount}%</b> giá trị đặt vé</li>
          <li>Thời hạn sử dụng: 30 ngày (đến ngày <b>${validTo.toLocaleDateString("vi-VN")}</b>)</li>
          <li>Min đơn hàng: Không giới hạn</li>
        </ul>
        
        <p>Chúc bạn sẽ có thêm nhiều chuyến đi thoải mái, an toàn và thú vị cùng GoTrain VN!</p>
        <hr style="border: 0; border-top: 1px dashed #fef08a; margin: 25px 0;">
        <p style="font-size: 12px; color: #a16207; text-align: center; font-weight: bold;">Hành trình vạn dặm - Luôn có GoTrain đồng hành! 🛤️✨</p>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: `👑 [GoTrain] Chúc mừng bạn đã thăng hạng thành viên lên ${newTier.name}!`,
      html,
    });
  }
}
