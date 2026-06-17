import { randomInt, randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import { calculateFare, getConfiguration } from "./pricing.service.js";
import { getJourney, getSession } from "./seatSelection.service.js";
import {
  createPayosPaymentRequest,
  verifyPayosSignature,
} from "./payos.service.js";

const PASSENGER_TYPES = ["ADULT", "CHILD", "STUDENT", "SENIOR"];
const DOCUMENT_TYPES = ["CCCD", "HCDC"];
const PAYMENT_METHODS = ["BANK_QR", "WALLET"];

function httpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

function ownerWhere(identity) {
  const owners = [
    identity.userId ? { userId: identity.userId } : null,
    identity.guestToken ? { guestToken: identity.guestToken } : null,
  ].filter(Boolean);
  return owners.length === 1 ? owners[0] : { OR: owners };
}

function ownerData(identity) {
  return identity.userId
    ? { userId: identity.userId, guestToken: null }
    : { userId: null, guestToken: identity.guestToken };
}

export function calculatePassengerAge(dateOfBirth, today = new Date()) {
  const birthDate =
    dateOfBirth instanceof Date
      ? dateOfBirth
      : new Date(`${dateOfBirth}T00:00:00+07:00`);
  if (
    Number.isNaN(birthDate.getTime()) ||
    birthDate >= today ||
    birthDate.getFullYear() < 1900
  ) {
    return null;
  }
  let age = today.getFullYear() - birthDate.getFullYear();
  const birthdayPassed =
    today.getMonth() > birthDate.getMonth() ||
    (today.getMonth() === birthDate.getMonth() &&
      today.getDate() >= birthDate.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

function passengerTypeForAge(age, requestedType) {
  if (age < 10) return "CHILD";
  if (age >= 60) return "SENIOR";
  return requestedType === "STUDENT" ? "STUDENT" : "ADULT";
}

export function normalizePassenger(passenger, index, today = new Date()) {
  const label = `Hành khách ${index + 1}`;
  const fullName = String(passenger.fullName || "").trim();
  const requestedTypeValue = String(
    passenger.passengerType || "",
  ).toUpperCase();
  const dateOfBirth = new Date(`${passenger.dateOfBirth}T00:00:00+07:00`);
  const age = calculatePassengerAge(dateOfBirth, today);

  if (fullName.length < 2) {
    throw httpError(400, `${label}: họ và tên chưa hợp lệ.`);
  }
  if (age == null) {
    throw httpError(400, `${label}: ngày sinh chưa hợp lệ.`);
  }
  if (requestedTypeValue && !PASSENGER_TYPES.includes(requestedTypeValue)) {
    throw httpError(400, `${label}: loại hành khách chưa hợp lệ.`);
  }

  const requestedType = requestedTypeValue || "ADULT";
  const passengerType = passengerTypeForAge(age, requestedType);
  if (passengerType === "CHILD") {
    return {
      fullName,
      nationalId: null,
      nationalIdType: null,
      phoneNumber: null,
      email: null,
      dateOfBirth,
      passengerType,
    };
  }

  const nationalId = String(passenger.nationalId || "")
    .trim()
    .toUpperCase();
  const nationalIdType = String(passenger.nationalIdType || "").toUpperCase();
  const phoneNumber = String(passenger.phoneNumber || "").replace(/\s/g, "");
  const email = String(passenger.email || "")
    .trim()
    .toLowerCase();

  if (!DOCUMENT_TYPES.includes(nationalIdType)) {
    throw httpError(400, `${label}: loại giấy tờ chưa hợp lệ.`);
  }
  if (
    (nationalIdType === "CCCD" && !/^\d{12}$/.test(nationalId)) ||
    (nationalIdType === "HCDC" && !/^[A-Z0-9]{6,12}$/.test(nationalId))
  ) {
    throw httpError(400, `${label}: số CCCD/Hộ chiếu chưa hợp lệ.`);
  }
  if (!/^(0|\+84)\d{9,10}$/.test(phoneNumber)) {
    throw httpError(400, `${label}: số điện thoại chưa hợp lệ.`);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, `${label}: email chưa hợp lệ.`);
  }

  return {
    fullName,
    nationalId,
    nationalIdType,
    phoneNumber,
    email,
    dateOfBirth,
    passengerType,
  };
}

export function validatePassengerBusinessRules(passengers) {
  if (!Array.isArray(passengers) || passengers.length < 1) {
    throw httpError(400, "Đơn hàng phải có ít nhất một hành khách.");
  }
  if (passengers.length > 4) {
    throw httpError(400, "Mỗi giao dịch chỉ được đặt tối đa 4 hành khách.");
  }
  const hasChild = passengers.some(
    (passenger) => passenger.passengerType === "CHILD",
  );
  const hasCompanion = passengers.some((passenger) =>
    ["ADULT", "STUDENT", "SENIOR"].includes(passenger.passengerType),
  );
  if (hasChild && !hasCompanion) {
    throw httpError(
      400,
      "Trẻ em dưới 10 tuổi phải đi cùng ít nhất một hành khách ADULT, STUDENT hoặc SENIOR.",
    );
  }

  const documentOwners = new Map();
  passengers.forEach((passenger, index) => {
    if (!passenger.nationalId) return;
    const key = `${passenger.nationalIdType}:${passenger.nationalId}`;
    const existingIndex = documentOwners.get(key);
    if (existingIndex != null) {
      throw httpError(
        400,
        `Giấy tờ của hành khách ${index + 1} bị trùng với hành khách ${existingIndex + 1}.`,
      );
    }
    documentOwners.set(key, index);
  });
}

export function validateAccountHolderSelection(passengers, identity) {
  const accountHolderCount = passengers.filter(
    (passenger) => passenger.isAccountHolder === true,
  ).length;
  if (accountHolderCount > 1) {
    throw httpError(
      400,
      "Chủ tài khoản chỉ được chọn cho một vé trong cùng phiên đặt.",
    );
  }
  if (accountHolderCount === 1 && !identity.userId) {
    throw httpError(
      400,
      "Khách vãng lai không thể chọn mục đặt vé cho chủ tài khoản.",
    );
  }
}

async function fareRulesForLeg(session, leg) {
  const scheduleId =
    leg === "outbound" ? session.outboundScheduleId : session.returnScheduleId;
  const fromStationId =
    leg === "outbound"
      ? session.outboundFromStationId
      : session.returnFromStationId;
  const toStationId =
    leg === "outbound"
      ? session.outboundToStationId
      : session.returnToStationId;
  const { segment } = await getJourney(scheduleId, fromStationId, toStationId);
  const configuration = await getConfiguration({
    scopeType: "SCHEDULE",
    scopeId: scheduleId,
    at: segment.departureTime.toISOString(),
  });
  return {
    distance: segment.distance,
    rules: new Map(
      configuration.effectiveRules.map((rule) => [
        `${rule.passengerType}:${rule.carriageType}`,
        rule,
      ]),
    ),
  };
}

async function resolveVoucher(voucherCode, subtotal, identity) {
  const code = String(voucherCode || "")
    .trim()
    .toUpperCase();
  if (!code) return { voucher: null, discountAmount: 0 };
  if (!identity.userId) {
    throw httpError(403, "Khách vãng lai không thể sử dụng mã giảm giá.");
  }

  const now = new Date();
  const voucher = await prisma.voucher.findUnique({
    where: { voucherCode: code },
  });
  if (
    !voucher ||
    !voucher.active ||
    voucher.validFrom > now ||
    voucher.validTo < now
  ) {
    throw httpError(400, "Mã giảm giá không tồn tại hoặc đã hết hạn.");
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
      `Đơn hàng cần tối thiểu ${voucher.minBookingAmount.toLocaleString("vi-VN")}đ để dùng mã này.`,
    );
  }

  const rawDiscount =
    voucher.discountType === "PERCENTAGE"
      ? (subtotal * voucher.discountValue) / 100
      : voucher.discountValue;
  return {
    voucher,
    discountAmount: Math.round(
      Math.min(rawDiscount, voucher.maxDiscountAmount ?? rawDiscount, subtotal),
    ),
  };
}

export async function quoteBooking(
  identity,
  { sessionId, passengerTypes, voucherCode },
) {
  const session = await getSession(identity, sessionId);
  if (
    session.status !== "ACTIVE" ||
    new Date(session.expiresAt).getTime() <= Date.now()
  ) {
    throw httpError(409, "Phiên giữ ghế đã hết hạn. Vui lòng chọn lại ghế.");
  }

  const outboundHolds = session.holds.filter(
    (hold) => hold.scheduleId === session.outboundScheduleId,
  );
  const returnHolds = session.returnScheduleId
    ? session.holds.filter(
        (hold) => hold.scheduleId === session.returnScheduleId,
      )
    : [];
  if (
    !Array.isArray(passengerTypes) ||
    passengerTypes.length !== outboundHolds.length ||
    passengerTypes.some((type) => !PASSENGER_TYPES.includes(type))
  ) {
    throw httpError(400, "Danh sách loại hành khách chưa hợp lệ.");
  }

  const [outboundPricing, returnPricing] = await Promise.all([
    fareRulesForLeg(session, "outbound"),
    session.returnScheduleId
      ? fareRulesForLeg(session, "return")
      : Promise.resolve(null),
  ]);

  const items = passengerTypes.map((passengerType, index) => {
    const legs = [
      {
        leg: "outbound",
        hold: outboundHolds[index],
        pricing: outboundPricing,
      },
      ...(returnHolds[index]
        ? [
            {
              leg: "return",
              hold: returnHolds[index],
              pricing: returnPricing,
            },
          ]
        : []),
    ].map(({ leg, hold, pricing }) => {
      const rule = pricing.rules.get(`${passengerType}:${hold.carriageType}`);
      if (!rule) {
        throw httpError(
          409,
          "Chưa có chính sách giá cho loại hành khách đã chọn.",
        );
      }
      const fare = calculateFare(rule, pricing.distance, rule.taxPercentage);
      return {
        leg,
        holdId: hold.id,
        scheduleId: hold.scheduleId,
        seatId: hold.seatId,
        carriageType: hold.carriageType,
        carriageNumber: hold.seat.carriage.carriageNumber,
        seatNumber: hold.seat.seatNumber,
        basePrice: fare.boundedAmount,
        discountAmount: fare.discountAmount,
        taxAmount: fare.taxAmount,
        finalPrice: fare.finalPrice,
      };
    });
    return {
      passengerIndex: index,
      passengerType,
      legs,
      total: legs.reduce((sum, leg) => sum + leg.finalPrice, 0),
    };
  });

  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      item.legs.reduce(
        (legSum, leg) => legSum + leg.basePrice + leg.taxAmount,
        0,
      ),
    0,
  );
  const passengerDiscount = items.reduce(
    (sum, item) =>
      sum + item.legs.reduce((legSum, leg) => legSum + leg.discountAmount, 0),
    0,
  );
  const beforeVoucher = items.reduce((sum, item) => sum + item.total, 0);
  const { voucher, discountAmount: voucherDiscount } = await resolveVoucher(
    voucherCode,
    beforeVoucher,
    identity,
  );

  return {
    session,
    items,
    voucher: voucher ? { id: voucher.id, code: voucher.voucherCode } : null,
    subtotal,
    passengerDiscount,
    voucherDiscount,
    totalAmount: Math.max(0, beforeVoucher - voucherDiscount),
  };
}

function bookingCode() {
  return `GT${new Date().getFullYear()}${randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase()}`;
}

function ticketCode() {
  return `VE${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;
}

async function payosOrderCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = Number(`${Date.now()}${randomInt(10, 99)}`);
    const existing = await prisma.booking.findFirst({
      where: { payosOrderCode: String(candidate) },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw httpError(500, "Khong the tao ma thanh toan PayOS duy nhat.");
}

function payosDescription(orderCode) {
  return `GT${String(orderCode).slice(-7)}`;
}

function buyerFromPassengers(passengers) {
  const contact =
    passengers.find((passenger) => passenger.email || passenger.phoneNumber) ||
    passengers[0];
  return {
    name: contact?.fullName,
    email: contact?.email,
    phone: contact?.phoneNumber,
  };
}

export async function checkoutBooking(identity, payload) {
  if (
    !Array.isArray(payload.passengers) ||
    payload.passengers.length < 1 ||
    payload.passengers.length > 4
  ) {
    throw httpError(400, "Mỗi giao dịch chỉ được đặt từ 1 đến 4 hành khách.");
  }
  validateAccountHolderSelection(payload.passengers, identity);
  const passengers = payload.passengers.map((passenger, index) =>
    normalizePassenger(passenger, index),
  );
  validatePassengerBusinessRules(passengers);
  const paymentMethod = String(payload.paymentMethod || "").toUpperCase();
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw httpError(400, "Phương thức thanh toán chưa hợp lệ.");
  }
  if (!identity.userId && paymentMethod === "WALLET") {
    throw httpError(403, "Khách vãng lai không thể thanh toán bằng ví.");
  }

  const quote = await quoteBooking(identity, {
    sessionId: payload.sessionId,
    passengerTypes: passengers.map((passenger) => passenger.passengerType),
    voucherCode: payload.voucherCode,
  });
  if (passengers.length !== quote.items.length) {
    throw httpError(400, "Số hành khách không khớp với số ghế đã giữ.");
  }

  const immediatePayment = paymentMethod === "WALLET";
  const now = new Date();
  const code = bookingCode();
  let payosPayment = null;
  let payosOrderCodeValue = null;
  let payosDescriptionValue = null;
  if (paymentMethod === "BANK_QR") {
    payosOrderCodeValue = await payosOrderCode();
    payosDescriptionValue = payosDescription(payosOrderCodeValue);
    payosPayment = await createPayosPaymentRequest({
      orderCode: payosOrderCodeValue,
      amount: quote.totalAmount,
      description: payosDescriptionValue,
      expiresAt: quote.session.expiresAt,
      buyer: buyerFromPassengers(passengers),
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const claimedSession = await tx.seatHoldSession.updateMany({
      where: {
        id: quote.session.id,
        ...ownerWhere(identity),
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      data: { status: "CONVERTED" },
    });
    if (claimedSession.count !== 1) {
      throw httpError(409, "Phiên giữ ghế đã được sử dụng hoặc đã hết hạn.");
    }

    let wallet = null;
    if (immediatePayment) {
      wallet = await tx.wallet.findUnique({
        where: { userId: identity.userId },
      });
      if (!wallet || wallet.balance < quote.totalAmount) {
        throw httpError(422, "Số dư ví không đủ để thanh toán đơn hàng.");
      }
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: quote.totalAmount } },
      });
    }

    const booking = await tx.booking.create({
      data: {
        bookingCode: code,
        ...ownerData(identity),
        scheduleId: quote.session.outboundScheduleId,
        fromStationId: quote.session.outboundFromStationId,
        toStationId: quote.session.outboundToStationId,
        returnScheduleId: quote.session.returnScheduleId,
        returnFromStationId: quote.session.returnFromStationId ?? null,
        returnToStationId: quote.session.returnToStationId ?? null,
        bookingType: quote.session.bookingType,
        voucherId: quote.voucher?.id,
        totalPassengers: passengers.length,
        subtotal: quote.subtotal,
        discountAmount: quote.passengerDiscount + quote.voucherDiscount,
        taxAmount: quote.items.reduce(
          (sum, item) =>
            sum + item.legs.reduce((legSum, leg) => legSum + leg.taxAmount, 0),
          0,
        ),
        totalAmount: quote.totalAmount,
        paymentMethod,
        paymentStatus: immediatePayment ? "COMPLETED" : "PENDING",
        paymentId: immediatePayment ? null : payosPayment?.paymentLinkId,
        payosOrderCode: payosOrderCodeValue
          ? String(payosOrderCodeValue)
          : null,
        payosPaymentLinkId: payosPayment?.paymentLinkId || null,
        payosCheckoutUrl: payosPayment?.checkoutUrl || null,
        payosQrCode: payosPayment?.qrCode || null,
        status: immediatePayment ? "CONFIRMED" : "PENDING",
        confirmationEmail:
          passengers.find((passenger) => passenger.email)?.email || null,
        expiresAt: immediatePayment ? null : quote.session.expiresAt,
      },
    });

    const createdPassengers = [];
    for (const [index, passenger] of passengers.entries()) {
      const primaryLeg = quote.items[index].legs[0];
      const created = await tx.passenger.create({
        data: {
          bookingId: booking.id,
          userId: identity.userId,
          ...passenger,
          ticketCode: ticketCode(),
          seatId: primaryLeg.seatId,
          carriageNumber: primaryLeg.carriageNumber,
          discountPercentage:
            primaryLeg.basePrice > 0
              ? Math.round(
                  (primaryLeg.discountAmount / primaryLeg.basePrice) * 100,
                )
              : 0,
        },
      });
      createdPassengers.push(created);

      for (const leg of quote.items[index].legs) {
        await tx.bookingDetail.create({
          data: {
            bookingId: booking.id,
            passengerId: created.id,
            seatId: leg.seatId,
            scheduleId: leg.scheduleId,
            carriageType: leg.carriageType,
            basePrice: leg.basePrice,
            discountAmount: leg.discountAmount,
            finalPrice: leg.finalPrice,
            status: immediatePayment ? "CONFIRMED" : "PENDING",
          },
        });
      }
    }

    await tx.bookingPaymentHistory.create({
      data: {
        bookingId: booking.id,
        paymentMethod,
        amount: quote.totalAmount,
        status: immediatePayment ? "SUCCESS" : "PENDING",
        transactionId: immediatePayment ? `WALLET-${randomUUID()}` : null,
        attemptNumber: 1,
      },
    });

    if (immediatePayment) {
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "PAYMENT",
          amount: quote.totalAmount,
          description: `Thanh toán vé ${code}`,
          relatedBookingId: booking.id,
          status: "COMPLETED",
        },
      });
    }
    if (quote.voucher) {
      const voucher = await tx.voucher.findUnique({
        where: { id: quote.voucher.id },
      });
      if (
        !voucher ||
        !voucher.active ||
        voucher.validFrom > now ||
        voucher.validTo < now ||
        (voucher.maxUsageCount != null &&
          voucher.currentUsageCount >= voucher.maxUsageCount)
      ) {
        throw httpError(409, "Mã giảm giá vừa hết hiệu lực hoặc hết lượt.");
      }
      await tx.voucher.update({
        where: { id: quote.voucher.id },
        data: { currentUsageCount: { increment: 1 } },
      });
    }
    if (identity.userId) {
      await tx.notification.create({
        data: {
          userId: identity.userId,
          type: immediatePayment ? "BOOKING_CONFIRMED" : "PAYMENT_PENDING",
          title: immediatePayment
            ? "Đặt vé thành công"
            : "Đang chờ xác nhận thanh toán",
          message: `Đơn ${code} có tổng tiền ${quote.totalAmount.toLocaleString("vi-VN")}đ.`,
          relatedBookingId: booking.id,
          deliveryMethod: ["IN_APP", "EMAIL"],
          deliveryStatus: "PENDING",
        },
      });
    }

    await tx.seatHold.deleteMany({
      where: { sessionId: quote.session.id },
    });
    return { booking, passengers: createdPassengers };
  });

  return {
    ...result,
    qrPayload: paymentMethod === "BANK_QR" ? payosPayment?.qrCode : null,
    payos: payosPayment
      ? {
          orderCode: payosOrderCodeValue,
          description: payosDescriptionValue,
          paymentLinkId: payosPayment.paymentLinkId,
          checkoutUrl: payosPayment.checkoutUrl,
          qrCode: payosPayment.qrCode,
          accountNumber: payosPayment.accountNumber,
          accountName: payosPayment.accountName,
          bin: payosPayment.bin,
        }
      : null,
    paymentExpiresAt: result.booking.expiresAt,
    emailQueued: immediatePayment,
  };
}

export async function confirmQrPayment(identity, bookingId) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...ownerWhere(identity) },
    include: { passengers: true },
  });
  if (!booking) throw httpError(404, "Không tìm thấy đơn đặt vé.");
  if (booking.paymentMethod !== "BANK_QR") {
    throw httpError(400, "Đơn hàng không sử dụng thanh toán QR.");
  }
  if (booking.paymentStatus === "COMPLETED") return booking;
  if (booking.paymentStatus !== "COMPLETED") {
    throw httpError(
      409,
      "Thanh toan QR dang cho PayOS xac nhan. Ve chi duoc phat hanh sau webhook hop le.",
    );
  }
  if (
    booking.status !== "PENDING" ||
    (booking.expiresAt && booking.expiresAt <= new Date())
  ) {
    throw httpError(409, "Thời gian thanh toán đã kết thúc.");
  }

  return prisma.$transaction(async (tx) => {
    const completed = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: "CONFIRMED",
        paymentStatus: "COMPLETED",
        paymentId: `QR-DEMO-${randomUUID()}`,
        expiresAt: null,
      },
    });
    await tx.bookingDetail.updateMany({
      where: { bookingId: booking.id },
      data: { status: "CONFIRMED" },
    });
    await tx.bookingPaymentHistory.updateMany({
      where: { bookingId: booking.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        transactionId: `QR-DEMO-${randomUUID()}`,
      },
    });
    if (identity.userId) {
      await tx.notification.create({
        data: {
          userId: identity.userId,
          type: "BOOKING_CONFIRMED",
          title: "Thanh toán thành công",
          message: `Vé điện tử của đơn ${booking.bookingCode} đang được gửi đến ${booking.confirmationEmail}.`,
          relatedBookingId: booking.id,
          deliveryMethod: ["IN_APP", "EMAIL"],
          deliveryStatus: "PENDING",
        },
      });
    }
    return completed;
  });
}

export async function getBookingPaymentStatus(identity, bookingId) {
  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, ...ownerWhere(identity) },
    include: { passengers: true },
  });
  if (!booking) throw httpError(404, "Khong tim thay don dat ve.");
  return booking;
}

async function completePayosBooking(tx, booking, webhookData) {
  const updated = await tx.booking.updateMany({
    where: {
      id: booking.id,
      paymentStatus: "PENDING",
      status: "PENDING",
    },
    data: {
      status: "CONFIRMED",
      paymentStatus: "COMPLETED",
      paymentId: webhookData.paymentLinkId,
      payosPaymentLinkId: webhookData.paymentLinkId,
      payosReference: webhookData.reference,
      paidAt: new Date(),
      expiresAt: null,
    },
  });
  if (updated.count !== 1) {
    return tx.booking.findUnique({
      where: { id: booking.id },
      include: { passengers: true },
    });
  }

  await tx.bookingDetail.updateMany({
    where: { bookingId: booking.id },
    data: { status: "CONFIRMED" },
  });
  await tx.bookingPaymentHistory.updateMany({
    where: { bookingId: booking.id, status: "PENDING" },
    data: {
      status: "SUCCESS",
      transactionId: webhookData.reference || webhookData.paymentLinkId,
    },
  });
  if (booking.userId) {
    await tx.notification.create({
      data: {
        userId: booking.userId,
        type: "BOOKING_CONFIRMED",
        title: "Thanh toan thanh cong",
        message: `Ve dien tu cua don ${booking.bookingCode} dang duoc gui den ${booking.confirmationEmail}.`,
        relatedBookingId: booking.id,
        deliveryMethod: ["IN_APP", "EMAIL"],
        deliveryStatus: "PENDING",
      },
    });
  }

  return tx.booking.findUnique({
    where: { id: booking.id },
    include: { passengers: true },
  });
}

async function markPayosPaymentMismatch(booking, reason) {
  await prisma.bookingPaymentHistory.updateMany({
    where: { bookingId: booking.id, status: "PENDING" },
    data: {
      status: "FAILED",
      failureReason: reason,
    },
  });
}

export async function handlePayosWebhook(payload) {
  if (
    !payload?.data ||
    !verifyPayosSignature(payload.data, payload.signature)
  ) {
    throw httpError(400, "Chu ky webhook PayOS khong hop le.");
  }

  const data = payload.data;
  if (!payload.success || payload.code !== "00" || data.code !== "00") {
    return { ignored: true, reason: "payment_not_success", data };
  }

  const orderCode = data.orderCode != null ? String(data.orderCode) : null;
  const paymentMatchers = [
    orderCode ? { payosOrderCode: orderCode } : null,
    data.paymentLinkId ? { payosPaymentLinkId: data.paymentLinkId } : null,
  ].filter(Boolean);
  if (paymentMatchers.length === 0) {
    return { ignored: true, reason: "missing_payment_identity", data };
  }
  const booking = await prisma.booking.findFirst({
    where: {
      paymentMethod: "BANK_QR",
      OR: paymentMatchers,
    },
    include: { passengers: true },
  });

  if (!booking) {
    return { ignored: true, reason: "booking_not_found", data };
  }
  if (booking.paymentStatus === "COMPLETED") {
    return { ignored: false, duplicate: true, booking };
  }
  if (Math.round(booking.totalAmount) !== Math.round(Number(data.amount))) {
    await markPayosPaymentMismatch(booking, "PAYOS_AMOUNT_MISMATCH");
    return { ignored: true, reason: "amount_mismatch", booking };
  }
  if (
    booking.status !== "PENDING" ||
    (booking.expiresAt && booking.expiresAt <= new Date())
  ) {
    await markPayosPaymentMismatch(booking, "PAYOS_PAYMENT_EXPIRED");
    return { ignored: true, reason: "booking_not_payable", booking };
  }

  const completed = await prisma.$transaction((tx) =>
    completePayosBooking(tx, booking, data),
  );
  return { ignored: false, booking: completed };
}
