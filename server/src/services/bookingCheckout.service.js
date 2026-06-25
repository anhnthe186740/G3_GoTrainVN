import { randomInt, randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import {
  calculateFare,
  getConfiguration,
  getEffectiveTicketTypes,
} from "./pricing.service.js";
import { getJourney, getSession } from "./seatSelection.service.js";
import {
  createPayosPaymentRequest,
  verifyPayosSignature,
} from "./payos.service.js";
import { awardLoyaltyPointsAndCheckTier } from "./promotion.service.js";
import { sendEmail } from "./email.service.js";
import {
  getBookingPendingEmailTemplate,
  getPaymentSuccessEmailTemplate,
} from "../utils/emailTemplates.js";

const PASSENGER_TYPES = ["ADULT", "CHILD", "STUDENT", "SENIOR"];
const DOCUMENT_TYPES = ["CCCD", "HCDC"];
const PAYMENT_METHODS = ["BANK_QR", "WALLET", "CASH"];

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

function passengerTypeForAge(age, requestedType, passenger = {}) {
  if (age == null) return requestedType;
  if (age < 10) return "CHILD";
  if (age >= 60) return "SENIOR";
  if (
    requestedType === "STUDENT" &&
    String(passenger.studentLevel || "").toUpperCase() !== "POSTGRADUATE" &&
    passenger.isPostgraduate !== true
  ) {
    return "STUDENT";
  }
  return "ADULT";
}

function fallbackTicketTypes() {
  return [
    {
      code: "ADULT",
      discountType: "PERCENTAGE",
      discountValue: 0,
      minAge: 10,
      maxAgeExclusive: 60,
      seatMode: "REQUIRED",
      autoApply: false,
      requiresDocument: true,
      requiresStudent: false,
    },
    {
      code: "CHILD_UNDER_6",
      discountType: "FREE",
      discountValue: 100,
      minAge: 0,
      maxAgeExclusive: 6,
      seatMode: "NOT_ALLOWED",
      autoApply: true,
      requiresDocument: false,
      requiresStudent: false,
    },
    {
      code: "CHILD",
      discountType: "PERCENTAGE",
      discountValue: 25,
      minAge: 6,
      maxAgeExclusive: 10,
      seatMode: "REQUIRED",
      autoApply: true,
      requiresDocument: false,
      requiresStudent: false,
    },
    {
      code: "SENIOR",
      discountType: "PERCENTAGE",
      discountValue: 15,
      minAge: 60,
      maxAgeExclusive: null,
      seatMode: "REQUIRED",
      autoApply: true,
      requiresDocument: true,
      requiresStudent: false,
    },
    {
      code: "STUDENT",
      discountType: "PERCENTAGE",
      discountValue: 10,
      minAge: 10,
      maxAgeExclusive: null,
      seatMode: "REQUIRED",
      autoApply: false,
      requiresDocument: true,
      requiresStudent: true,
    },
  ];
}

function ageMatchesTicketType(ticketType, age) {
  if (age == null) return false;
  if (ticketType.minAge != null && age < ticketType.minAge) return false;
  if (ticketType.maxAgeExclusive != null && age >= ticketType.maxAgeExclusive) {
    return false;
  }
  return true;
}

function discountPolicyFromTicketType(ticketType) {
  const discountType = String(
    ticketType.discountType || "PERCENTAGE",
  ).toUpperCase();
  const discountValue = Number(ticketType.discountValue || 0);
  const discountPercentage =
    discountType === "FREE"
      ? 100
      : discountType === "PERCENTAGE"
        ? discountValue
        : 0;
  return {
    discountType,
    discountValue: discountType === "FREE" ? 100 : discountValue,
    discountPercentage,
    discountReason: ticketType.code,
    seatRequired: ticketType.seatMode !== "NOT_ALLOWED",
  };
}

function resolveTicketType(
  age,
  requestedType,
  passenger = {},
  ticketTypes = [],
) {
  const available = ticketTypes.length ? ticketTypes : fallbackTicketTypes();
  const byCode = new Map(available.map((type) => [type.code, type]));
  const requestedCode = String(requestedType || "ADULT").toUpperCase();
  // Auto-apply theo tuổi chỉ khi đã biết tuổi hành khách
  const autoMatch =
    age != null &&
    available.find((type) => type.autoApply && ageMatchesTicketType(type, age));
  if (autoMatch) return autoMatch;

  const requested = byCode.get(requestedCode);
  if (
    requested &&
    (age == null ||
      (requested.minAge == null && requested.maxAgeExclusive == null) ||
      ageMatchesTicketType(requested, age))
  ) {
    if (
      requested.requiresStudent &&
      (String(passenger.studentLevel || "").toUpperCase() === "POSTGRADUATE" ||
        passenger.isPostgraduate === true)
    ) {
      return byCode.get("ADULT") || fallbackTicketTypes()[0];
    }
    return requested;
  }

  if (PASSENGER_TYPES.includes(requestedCode)) {
    const legacyType = passengerTypeForAge(age, requestedCode, passenger);
    return (
      byCode.get(legacyType) || byCode.get("ADULT") || fallbackTicketTypes()[0]
    );
  }
  return byCode.get("ADULT") || fallbackTicketTypes()[0];
}

export function normalizePassenger(
  passenger,
  index,
  today = new Date(),
  { requireEmail = true, ticketTypes = [] } = {},
) {
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
  const knownTypes = new Set([
    ...PASSENGER_TYPES,
    ...ticketTypes.map((type) => type.code),
  ]);
  if (requestedTypeValue && !knownTypes.has(requestedTypeValue)) {
    throw httpError(400, `${label}: loại hành khách chưa hợp lệ.`);
  }

  const requestedType = requestedTypeValue || "ADULT";
  const ticketType = resolveTicketType(
    age,
    requestedType,
    passenger,
    ticketTypes,
  );
  const passengerType = ticketType.code;
  const discountPolicy = discountPolicyFromTicketType(ticketType);
  const seatRequired =
    ticketType.seatMode === "NOT_ALLOWED"
      ? false
      : age < 6
        ? !(passenger.seatRequired === false || passenger.sharingSeat === true)
        : true;
  if (!ticketType.requiresDocument) {
    if (ticketType.seatMode === "NOT_ALLOWED" && seatRequired) {
      throw httpError(
        400,
        `${label}: trẻ dưới 6 tuổi được miễn phí khi ngồi chung ghế với người đi kèm, không đặt ghế riêng.`,
      );
    }
    return {
      fullName,
      nationalId: null,
      nationalIdType: null,
      phoneNumber: null,
      email: null,
      dateOfBirth,
      passengerType,
      seatRequired,
      discountType: discountPolicy.discountType,
      discountValue: discountPolicy.discountValue,
      discountPercentage: discountPolicy.discountPercentage,
      discountReason: discountPolicy.discountReason,
      ageAtDeparture: age,
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
  if (requireEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw httpError(400, `${label}: email chưa hợp lệ.`);
  }

  return {
    fullName,
    nationalId,
    nationalIdType,
    phoneNumber,
    email: email || null,
    dateOfBirth,
    passengerType,
    seatRequired: true,
    discountType: discountPolicy.discountType,
    discountValue: discountPolicy.discountValue,
    discountPercentage: discountPolicy.discountPercentage,
    discountReason: discountPolicy.discountReason,
    ageAtDeparture: age,
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
    (passenger) =>
      passenger.ageAtDeparture != null && passenger.ageAtDeparture < 10,
  );
  const hasCompanion = passengers.some(
    (passenger) =>
      passenger.seatRequired !== false &&
      !(passenger.ageAtDeparture != null && passenger.ageAtDeparture < 10),
  );
  if (hasChild && !hasCompanion) {
    throw httpError(
      400,
      "Trẻ em dưới 10 tuổi phải đi cùng ít nhất một hành khách ADULT, STUDENT hoặc SENIOR.",
    );
  }

  const lapChildCount = passengers.filter(
    (passenger) => passenger.seatRequired === false,
  ).length;
  const seatedPassengerCount = passengers.filter(
    (passenger) => passenger.seatRequired !== false,
  ).length;
  if (lapChildCount > seatedPassengerCount) {
    throw httpError(
      400,
      "Mỗi ghế chỉ được xếp tối đa một hành khách có ghế và một trẻ dưới 6 tuổi ngồi chung.",
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

async function departureReferenceForSession(session) {
  const { segment } = await getJourney(
    session.outboundScheduleId,
    session.outboundFromStationId,
    session.outboundToStationId,
  );
  return segment.departureTime;
}

export function normalizeQuotePassenger(
  passenger,
  index,
  referenceDate,
  ticketTypes = [],
) {
  const requestedTypeValue = String(
    passenger.passengerType || "ADULT",
  ).toUpperCase();
  const knownTypes = new Set([
    ...PASSENGER_TYPES,
    ...ticketTypes.map((type) => type.code),
  ]);
  const requestedType = knownTypes.has(requestedTypeValue)
    ? requestedTypeValue
    : "ADULT";
  const age = passenger.dateOfBirth
    ? calculatePassengerAge(passenger.dateOfBirth, referenceDate)
    : null;
  const ticketType = resolveTicketType(
    age,
    requestedType,
    passenger,
    ticketTypes,
  );
  const passengerType = ticketType.code;
  const policy = discountPolicyFromTicketType(ticketType);
  const requestsSharedSeat =
    passenger.seatRequired === false || passenger.sharingSeat === true;
  if (requestsSharedSeat && (age == null || age >= 6)) {
    throw httpError(
      400,
      `Hành khách ${index + 1}: chỉ trẻ dưới 6 tuổi mới được đi kèm không chọn ghế riêng.`,
    );
  }
  const seatRequired = requestsSharedSeat
    ? false
    : ticketType.seatMode === "NOT_ALLOWED"
      ? false
      : true;

  return {
    passengerIndex: index,
    passengerType,
    ageAtDeparture: age,
    seatRequired,
    discountType: policy.discountType,
    discountValue: policy.discountValue,
    discountPercentage: policy.discountPercentage,
    discountReason: policy.discountReason,
  };
}

function quotePassengersFromPayload(payload, referenceDate, ticketTypes = []) {
  if (Array.isArray(payload.passengers)) {
    return payload.passengers.map((passenger, index) =>
      normalizeQuotePassenger(passenger, index, referenceDate, ticketTypes),
    );
  }

  return (payload.passengerTypes || []).map((passengerType, index) => {
    const normalizedType = String(passengerType || "").toUpperCase();
    const ticketType = resolveTicketType(null, normalizedType, {}, ticketTypes);
    if (!ticketType) return null;
    const policy = discountPolicyFromTicketType(ticketType);
    return {
      passengerIndex: index,
      passengerType: ticketType.code,
      ageAtDeparture: null,
      seatRequired: true,
      discountType: policy.discountType,
      discountValue: policy.discountValue,
      discountPercentage: policy.discountPercentage,
      discountReason: policy.discountReason,
    };
  });
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

function getDowngradedCarriageType(carriageType) {
  if (carriageType === "AC_SEAT") return "NORMAL_SEAT";
  if (carriageType === "SLEEPER_6") return "AC_SEAT";
  if (carriageType === "SLEEPER_4") return "SLEEPER_6";
  return carriageType;
}

export async function quoteBooking(
  identity,
  { sessionId, passengerTypes, passengers, voucherCode },
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
  const departureReference = await departureReferenceForSession(session);
  const ticketTypes = await getEffectiveTicketTypes(departureReference);
  const quotePassengers = quotePassengersFromPayload(
    { passengerTypes, passengers },
    departureReference,
    ticketTypes,
  );
  const seatedPassengers = quotePassengers.filter(
    (passenger) => passenger && passenger.seatRequired !== false,
  );
  if (
    quotePassengers.some((passenger) => !passenger) ||
    seatedPassengers.length !== outboundHolds.length
  ) {
    throw httpError(400, "Danh sách loại hành khách chưa hợp lệ.");
  }

  const [outboundPricing, returnPricing] = await Promise.all([
    fareRulesForLeg(session, "outbound"),
    session.returnScheduleId
      ? fareRulesForLeg(session, "return")
      : Promise.resolve(null),
  ]);

  let seatIndex = 0;
  const items = quotePassengers.map((passenger) => {
    if (passenger.seatRequired === false) {
      return {
        passengerIndex: passenger.passengerIndex,
        passengerType: passenger.passengerType,
        ageAtDeparture: passenger.ageAtDeparture,
        seatRequired: false,
        discountPercentage: passenger.discountPercentage,
        discountReason: passenger.discountReason,
        legs: [],
        total: 0,
      };
    }

    const currentSeatIndex = seatIndex;
    seatIndex += 1;
    const legs = [
      {
        leg: "outbound",
        hold: outboundHolds[currentSeatIndex],
        pricing: outboundPricing,
      },
      ...(returnHolds[currentSeatIndex]
        ? [
            {
              leg: "return",
              hold: returnHolds[currentSeatIndex],
              pricing: returnPricing,
            },
          ]
        : []),
    ].map(({ leg, hold, pricing }) => {
      const rule =
        pricing.rules.get(`ADULT:${hold.carriageType}`) ||
        pricing.rules.get(`${passenger.passengerType}:${hold.carriageType}`);
      if (!rule) {
        throw httpError(
          409,
          "Chưa có chính sách giá cho loại hành khách đã chọn.",
        );
      }
      const fare = calculateFare(
        { ...rule, discountPercentage: 0 },
        pricing.distance,
        rule.taxPercentage,
      );
      const discountAmount = Math.round(
        passenger.discountType === "FIXED_AMOUNT"
          ? Math.min(fare.boundedAmount, Number(passenger.discountValue || 0))
          : fare.boundedAmount * (passenger.discountPercentage / 100),
      );
      const afterDiscount = Math.max(0, fare.boundedAmount - discountAmount);
      const taxAmount = Math.round(
        afterDiscount * (Number(rule.taxPercentage || 0) / 100),
      );
      const finalPrice = afterDiscount + taxAmount;

      // Upgrade logic: calculate target carriage class price if upgraded
      const downgradedType = getDowngradedCarriageType(hold.carriageType);
      let upgradeSavings = 0;
      if (downgradedType !== hold.carriageType) {
        const upgradedRule =
          pricing.rules.get(`ADULT:${downgradedType}`) ||
          pricing.rules.get(`${passenger.passengerType}:${downgradedType}`);
        if (upgradedRule) {
          const upgradedFare = calculateFare(
            { ...upgradedRule, discountPercentage: 0 },
            pricing.distance,
            upgradedRule.taxPercentage,
          );
          const upgradedDiscountAmount = Math.round(
            passenger.discountType === "FIXED_AMOUNT"
              ? Math.min(
                  upgradedFare.boundedAmount,
                  Number(passenger.discountValue || 0),
                )
              : upgradedFare.boundedAmount *
                  (passenger.discountPercentage / 100),
          );
          const upgradedAfterDiscount = Math.max(
            0,
            upgradedFare.boundedAmount - upgradedDiscountAmount,
          );
          const upgradedTaxAmount = Math.round(
            upgradedAfterDiscount *
              (Number(upgradedRule.taxPercentage || 0) / 100),
          );
          const upgradedFinalPrice = upgradedAfterDiscount + upgradedTaxAmount;
          upgradeSavings = Math.max(0, finalPrice - upgradedFinalPrice);
        }
      }

      return {
        leg,
        holdId: hold.id,
        scheduleId: hold.scheduleId,
        seatId: hold.seatId,
        carriageType: hold.carriageType,
        carriageNumber: hold.seat.carriage.carriageNumber,
        seatNumber: hold.seat.seatNumber,
        basePrice: fare.boundedAmount,
        discountAmount,
        taxAmount,
        finalPrice,
        upgradeSavings,
      };
    });
    return {
      passengerIndex: passenger.passengerIndex,
      passengerType: passenger.passengerType,
      ageAtDeparture: passenger.ageAtDeparture,
      seatRequired: true,
      discountPercentage: passenger.discountPercentage,
      discountReason: passenger.discountReason,
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

  // Group inputs by schedule for automatic promotion search
  const scheduleAmounts = new Map();
  for (const item of items) {
    for (const leg of item.legs) {
      const current = scheduleAmounts.get(leg.scheduleId) || {
        amount: 0,
        upgradeSavings: 0,
      };
      current.amount += leg.finalPrice;
      current.upgradeSavings += leg.upgradeSavings || 0;
      scheduleAmounts.set(leg.scheduleId, current);
    }
  }
  const scheduleInputs = Array.from(scheduleAmounts.entries()).map(
    ([scheduleId, data]) => ({
      scheduleId,
      amount: data.amount,
      upgradeSavings: data.upgradeSavings,
    }),
  );

  const { findBestPromotion, validateVoucher } =
    await import("./promotion.service.js");

  const { promotion: autoPromo, discountAmount: autoPromoDiscount } =
    await findBestPromotion(scheduleInputs, beforeVoucher);

  const beforeVoucherWithPromo = Math.max(0, beforeVoucher - autoPromoDiscount);

  let voucher = null;
  let voucherDiscount = 0;
  if (voucherCode) {
    const result = await validateVoucher(
      voucherCode,
      beforeVoucherWithPromo,
      identity.userId,
    );
    voucher = result.voucher;
    voucherDiscount = result.discountAmount;
  }

  return {
    session,
    items,
    voucher: voucher ? { id: voucher.id, code: voucher.voucherCode } : null,
    promotion: autoPromo ? { id: autoPromo.id, title: autoPromo.title } : null,
    subtotal,
    passengerDiscount,
    promotionDiscount: autoPromoDiscount,
    voucherDiscount,
    totalAmount: Math.max(0, beforeVoucherWithPromo - voucherDiscount),
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
  throw httpError(500, "Không thể tạo mã thanh toán PayOS duy nhất.");
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

function normalizePhoneNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function phoneVariants(value) {
  const normalized = normalizePhoneNumber(value);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (normalized.startsWith("0")) {
    variants.add(`84${normalized.slice(1)}`);
    variants.add(`+84${normalized.slice(1)}`);
  }
  return [...variants];
}

function normalizePersonName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

async function matchCustomerUsers(passengers) {
  const nationalIds = [
    ...new Set(passengers.map((p) => p.nationalId).filter(Boolean)),
  ];
  const phoneNumbers = [
    ...new Set(passengers.flatMap((p) => phoneVariants(p.phoneNumber))),
  ];
  if (nationalIds.length === 0 && phoneNumbers.length === 0) {
    return new Map();
  }

  const users = await prisma.user.findMany({
    where: {
      userType: "CUSTOMER",
      isActive: true,
      deletedAt: null,
      OR: [
        nationalIds.length ? { nationalId: { in: nationalIds } } : null,
        phoneNumbers.length ? { phoneNumber: { in: phoneNumbers } } : null,
      ].filter(Boolean),
    },
    select: {
      id: true,
      fullName: true,
      phoneNumber: true,
      nationalId: true,
    },
  });

  const byNationalId = new Map(
    users
      .filter((user) => user.nationalId)
      .map((user) => [user.nationalId, user]),
  );
  const byPhoneAndName = new Map(
    users
      .filter((user) => user.phoneNumber)
      .map((user) => [
        `${normalizePhoneNumber(user.phoneNumber)}:${normalizePersonName(user.fullName)}`,
        user,
      ]),
  );

  return new Map(
    passengers
      .map((passenger, index) => {
        const byId = passenger.nationalId
          ? byNationalId.get(passenger.nationalId)
          : null;
        const byContact = byPhoneAndName.get(
          `${normalizePhoneNumber(passenger.phoneNumber)}:${normalizePersonName(passenger.fullName)}`,
        );
        const matchedUser = byId || byContact;
        return matchedUser ? [index, matchedUser.id] : null;
      })
      .filter(Boolean),
  );
}

export async function checkoutBooking(identity, payload) {
  const isStaffCounter = payload.salesChannel === "STAFF_COUNTER";
  if (
    !Array.isArray(payload.passengers) ||
    payload.passengers.length < 1 ||
    payload.passengers.length > 4
  ) {
    throw httpError(400, "Mỗi giao dịch chỉ được đặt từ 1 đến 4 hành khách.");
  }
  validateAccountHolderSelection(payload.passengers, identity);
  const session = await getSession(identity, payload.sessionId);
  if (
    session.status !== "ACTIVE" ||
    new Date(session.expiresAt).getTime() <= Date.now()
  ) {
    throw httpError(
      409,
      "PhiÃªn giá»¯ gháº¿ Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng chá»n láº¡i gháº¿.",
    );
  }
  const departureReference = await departureReferenceForSession(session);
  const ticketTypes = await getEffectiveTicketTypes(departureReference);
  const passengers = payload.passengers.map((passenger, index) =>
    normalizePassenger(passenger, index, departureReference, {
      requireEmail: !isStaffCounter,
      ticketTypes,
    }),
  );
  validatePassengerBusinessRules(passengers);
  const paymentMethod = String(payload.paymentMethod || "").toUpperCase();
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    throw httpError(400, "Phương thức thanh toán chưa hợp lệ.");
  }
  if (isStaffCounter && !["CASH", "BANK_QR"].includes(paymentMethod)) {
    throw httpError(
      400,
      "Đặt vé tại quầy chỉ hỗ trợ thanh toán tiền mặt hoặc chuyển khoản.",
    );
  }
  if (!identity.userId && paymentMethod === "WALLET") {
    throw httpError(403, "Khách vãng lai không thể thanh toán bằng ví.");
  }
  const matchedCustomerUsers = isStaffCounter
    ? await matchCustomerUsers(passengers)
    : new Map();
  let customerUserId = null;
  if (payload.customerUserId) {
    const customer = await prisma.user.findFirst({
      where: {
        id: payload.customerUserId,
        userType: "CUSTOMER",
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });
    if (!customer) {
      throw httpError(400, "Không tìm thấy thành viên hợp lệ để gắn đơn vé.");
    }
    customerUserId = customer.id;
  } else if (isStaffCounter) {
    customerUserId = matchedCustomerUsers.values().next().value || null;
  }

  const quote = await quoteBooking(identity, {
    sessionId: payload.sessionId,
    passengers,
    voucherCode: payload.voucherCode,
  });
  if (passengers.length !== quote.items.length) {
    throw httpError(400, "Số hành khách không khớp với số ghế đã giữ.");
  }

  const immediatePayment =
    paymentMethod === "WALLET" || paymentMethod === "CASH";
  const bookingOwner = isStaffCounter
    ? { userId: customerUserId, guestToken: null }
    : customerUserId
      ? { userId: customerUserId, guestToken: null }
      : ownerData(identity);
  const passengerUserIds = passengers.map((_, index) =>
    isStaffCounter
      ? matchedCustomerUsers.get(index) || customerUserId || null
      : customerUserId || identity.userId,
  );
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
    if (paymentMethod === "WALLET") {
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
        ...bookingOwner,
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
        discountAmount:
          quote.passengerDiscount +
          quote.promotionDiscount +
          quote.voucherDiscount,
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
        paidAt: immediatePayment ? now : null,
      },
    });

    const createdPassengers = [];
    for (const [index, passenger] of passengers.entries()) {
      const primaryLeg = quote.items[index].legs[0];
      const { discountReason } = passenger;
      const passengerData = { ...passenger };
      delete passengerData.seatRequired;
      delete passengerData.ageAtDeparture;
      delete passengerData.discountReason;
      delete passengerData.discountType;
      delete passengerData.discountValue;
      const created = await tx.passenger.create({
        data: {
          bookingId: booking.id,
          userId: passengerUserIds[index],
          ...passengerData,
          ticketCode: ticketCode(),
          seatId: primaryLeg?.seatId ?? null,
          carriageNumber: primaryLeg?.carriageNumber ?? null,
          discountPercentage:
            primaryLeg?.basePrice > 0
              ? Math.round(
                  (primaryLeg.discountAmount / primaryLeg.basePrice) * 100,
                )
              : quote.items[index].discountPercentage,
          discountReason,
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
        transactionId: immediatePayment
          ? `${paymentMethod}-${randomUUID()}`
          : null,
        attemptNumber: 1,
      },
    });

    if (paymentMethod === "WALLET") {
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
    if (quote.promotion && quote.promotionDiscount > 0) {
      const promotion = await tx.promotion.findUnique({
        where: { id: quote.promotion.id },
      });
      if (
        !promotion ||
        promotion.status !== "ACTIVE" ||
        promotion.validFrom > now ||
        promotion.validTo < now ||
        (promotion.maxBudget != null &&
          promotion.usedBudget >= promotion.maxBudget)
      ) {
        throw httpError(
          409,
          "Chương trình khuyến mãi vừa kết thúc hoặc hết ngân sách.",
        );
      }
      await tx.promotion.update({
        where: { id: quote.promotion.id },
        data: { usedBudget: { increment: quote.promotionDiscount } },
      });
    }
    if (booking.userId) {
      if (immediatePayment) {
        await awardLoyaltyPointsAndCheckTier(
          tx,
          booking.userId,
          quote.totalAmount,
          booking.id,
        );
      }
      await tx.notification.create({
        data: {
          userId: booking.userId,
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

  // Gửi email không đồng bộ (asynchronously) tùy theo trạng thái thanh toán
  if (immediatePayment) {
    sendBookingEmail(result.booking.id, "SUCCESS");
  } else {
    sendBookingEmail(result.booking.id, "PENDING");
  }

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
  const privileged = ["STAFF", "ADMIN"].includes(identity.role);
  const booking = await prisma.booking.findFirst({
    where: privileged
      ? { id: bookingId }
      : { id: bookingId, ...ownerWhere(identity) },
    include: { passengers: true },
  });
  if (!booking) throw httpError(404, "Không tìm thấy đơn đặt vé.");
  if (booking.paymentMethod !== "BANK_QR") {
    throw httpError(400, "Đơn hàng không sử dụng thanh toán QR.");
  }
  if (booking.paymentStatus === "COMPLETED") return booking;
  if (
    booking.status !== "PENDING" ||
    (booking.expiresAt && booking.expiresAt <= new Date())
  ) {
    throw httpError(409, "Thời gian thanh toán đã kết thúc.");
  }

  const result = await prisma.$transaction(async (tx) => {
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
    if (booking.userId) {
      await tx.notification.create({
        data: {
          userId: booking.userId,
          type: "BOOKING_CONFIRMED",
          title: "Thanh toán thành công",
          message: `Vé điện tử của đơn ${booking.bookingCode} đang được gửi đến ${booking.confirmationEmail}.`,
          relatedBookingId: booking.id,
          deliveryMethod: ["IN_APP", "EMAIL"],
          deliveryStatus: "PENDING",
        },
      });

      await awardLoyaltyPointsAndCheckTier(
        tx,
        booking.userId,
        booking.totalAmount,
        booking.id,
      );
    }
    return completed;
  });

  // Gửi email vé điện tử thành công
  sendBookingEmail(result.id, "SUCCESS");

  return result;
}

export async function getBookingPaymentStatus(identity, bookingId) {
  const privileged = ["STAFF", "ADMIN"].includes(identity.role);
  const booking = await prisma.booking.findFirst({
    where: privileged
      ? { id: bookingId }
      : { id: bookingId, ...ownerWhere(identity) },
    include: { passengers: true },
  });
  if (!booking) throw httpError(404, "Không tìm thấy đơn đặt vé.");
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
    await awardLoyaltyPointsAndCheckTier(
      tx,
      booking.userId,
      booking.totalAmount,
      booking.id,
    );
    await tx.notification.create({
      data: {
        userId: booking.userId,
        type: "BOOKING_CONFIRMED",
        title: "Thanh toán thành công",
        message: `Vé điện tử của đơn ${booking.bookingCode} đang được gửi đến ${booking.confirmationEmail}.`,
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
    throw httpError(400, "Chữ ký webhook PayOS không hợp lệ.");
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

  // Chỉ gửi email nếu trước đó trạng thái là PENDING và hiện tại đã hoàn thành thanh toán
  if (
    booking.paymentStatus === "PENDING" &&
    completed?.paymentStatus === "COMPLETED"
  ) {
    sendBookingEmail(completed.id, "SUCCESS");
  }

  return { ignored: false, booking: completed };
}

/**
 * Helper function to send booking notifications via email
 */
async function sendBookingEmail(bookingId, type) {
  try {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        user: true,
        schedule: {
          include: {
            train: true,
          },
        },
        fromStation: true,
        toStation: true,
        passengers: {
          include: {
            seat: true,
          },
        },
      },
    });

    if (!booking) {
      console.error(`❌ Không tìm thấy booking ${bookingId} để gửi email.`);
      return;
    }

    const toEmail =
      booking.confirmationEmail ||
      booking.user?.email ||
      booking.passengers.find((p) => p.email)?.email;

    if (!toEmail) {
      console.warn(
        `⚠️ Không tìm thấy địa chỉ email nhận cho booking ${booking.bookingCode}.`,
      );
      return;
    }

    let subject = "";
    let html = "";

    if (type === "PENDING") {
      subject = `[GoTrain VN] Đặt chỗ thành công - Mã đặt chỗ: ${booking.bookingCode}`;
      html = getBookingPendingEmailTemplate(booking);
    } else if (type === "SUCCESS") {
      subject = `[GoTrain VN] Xác nhận thanh toán & Vé điện tử - Mã đặt chỗ: ${booking.bookingCode}`;
      html = getPaymentSuccessEmailTemplate(booking);
    }

    await sendEmail({ to: toEmail, subject, html });
  } catch (err) {
    console.error(`❌ Gửi email booking (${type}) thất bại:`, err.message);
  }
}

export async function cleanupExpiredBookings(now = new Date()) {
  const expired = await prisma.booking.findMany({
    where: {
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: { id: true, bookingCode: true },
  });

  if (expired.length === 0) return [];

  await prisma.booking.updateMany({
    where: { id: { in: expired.map((b) => b.id) }, status: "PENDING" },
    data: {
      status: "CANCELLED",
      paymentStatus: "FAILED",
      cancelReason: "Hết thời gian thanh toán",
      cancelledAt: now,
      expiresAt: null,
    },
  });

  return expired;
}
