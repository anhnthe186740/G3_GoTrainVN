import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("checkoutBooking")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";
import {
  calculatePassengerAge,
  normalizeQuotePassenger,
  normalizePassenger,
  validateAccountHolderSelection,
  validatePassengerBusinessRules,
} from "../src/services/bookingCheckout.service.js";
import { calculateFare } from "../src/services/pricing.service.js";

const TODAY = new Date("2026-06-16T12:00:00+07:00");
const FUTURE_TIME = () => new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

// Helper models builder
function adult(overrides = {}) {
  return {
    fullName: "Nguyen Van A",
    dateOfBirth: "1990-01-01",
    passengerType: "ADULT",
    nationalIdType: "CCCD",
    nationalId: "012345678901",
    phoneNumber: "0912345678",
    email: "adult@example.com",
    ...overrides,
  };
}

function makeHold(overrides = {}) {
  return {
    id: "hold-1",
    scheduleId: "schedule-1",
    seatId: "seat-1",
    carriageType: "NORMAL_SEAT",
    seat: {
      seatNumber: "1A",
      carriage: {
        carriageNumber: 1,
        carriageType: "NORMAL_SEAT",
      },
    },
    ...overrides,
  };
}

function makeSession(overrides = {}) {
  return {
    id: "session-1",
    status: "ACTIVE",
    expiresAt: FUTURE_TIME(),
    outboundScheduleId: "schedule-1",
    outboundFromStationId: "station-1",
    outboundToStationId: "station-2",
    bookingType: "ONE_WAY",
    holds: [],
    ...overrides,
  };
}

function mockSeatAndPricing(t, { session }) {
  t.mock.module("../src/services/seatSelection.service.js", {
    namedExports: {
      getSession: async () => session,
      getJourney: async () => ({
        schedule: {
          train: {
            trainType: "NORMAL",
          },
        },
        segment: {
          departureTime: new Date(Date.now() + 24 * 3600 * 1000), // tomorrow
          distance: 100,
        },
      }),
    },
  });

  t.mock.module("../src/services/pricing.service.js", {
    namedExports: {
      calculateFare: (rule, distance, tax) => {
        const base = rule.carriageType === "AC_SEAT" ? 163636.36 : 136363.63;
        return {
          boundedAmount: Math.round(base),
          finalPrice: Math.round(base * 1.1),
        };
      },
      getConfiguration: async () => ({
        effectiveRules: [
          {
            carriageType: "NORMAL_SEAT",
            passengerType: "ADULT",
            taxPercentage: 10,
            basePrice: 150000,
            pricePerKm: 0,
            classSurcharge: 0,
          },
          {
            carriageType: "AC_SEAT",
            passengerType: "ADULT",
            taxPercentage: 10,
            basePrice: 180000,
            pricePerKm: 0,
            classSurcharge: 0,
          },
        ],
      }),
      getEffectiveTicketTypes: async () => [],
    },
  });
}

function mockPromotion(t, overrides = {}) {
  t.mock.module("../src/services/promotion.service.js", {
    namedExports: {
      findBestPromotion: async () => ({
        promotion: overrides.promotion || null,
        discountAmount: overrides.promoDiscount || 0,
      }),
      validateVoucher: async () => ({
        voucher: overrides.voucher || null,
        discountAmount: overrides.voucherDiscount || 0,
      }),
      awardLoyaltyPointsAndCheckTier: async () => ({}),
    },
  });
}

function mockPayos(t, overrides = {}) {
  t.mock.module("../src/services/payos.service.js", {
    namedExports: {
      createPayosPaymentRequest: async () => ({
        paymentLinkId: "pl-mock-1",
        checkoutUrl: "https://pay.payos.vn/checkout",
        qrCode: "qr-data-mock",
        ...overrides,
      }),
      verifyPayosSignature: () => true,
      getPayosPaymentRequest: async () => ({
        id: "pl-mock-1",
        status: "PENDING",
        transactions: [],
      }),
    },
  });
}

let sendEmailCalls = [];
function mockEmailService(t, overrides = {}) {
  sendEmailCalls = [];
  t.mock.module("../src/services/email.service.js", {
    namedExports: {
      sendEmail: async (opts) => {
        sendEmailCalls.push(opts);
        if (overrides.throwError) throw new Error("SMTP down");
        return { success: true };
      },
    },
  });
}

function makeTx(overrides = {}) {
  return {
    seatHoldSession: {
      updateMany: async () => ({ count: 1 }),
    },
    booking: {
      create: async ({ data }) => ({
        id: "booking-1",
        bookingCode: "GT0001",
        ...data,
      }),
    },
    passenger: {
      create: async ({ data }) => ({ id: "passenger-1", ...data }),
    },
    bookingDetail: {
      create: async ({ data }) => ({ id: "detail-1", ...data }),
    },
    bookingPaymentHistory: {
      create: async ({ data }) => ({ id: "payhistory-1", ...data }),
    },
    voucher: {
      findUnique: async () => ({
        id: "voucher-1",
        active: true,
        validFrom: new Date(Date.now() - 1000),
        validTo: new Date(Date.now() + 1000),
        currentUsageCount: 0,
        maxUsageCount: 10,
      }),
      update: async () => ({}),
    },
    promotion: {
      findUnique: async () => ({
        id: "promo-1",
        status: "ACTIVE",
        validFrom: new Date(Date.now() - 1000),
        validTo: new Date(Date.now() + 1000),
        usedBudget: 0,
        maxBudget: 100000,
      }),
      update: async () => ({}),
    },
    notification: {
      create: async () => ({}),
    },
    seatHold: {
      deleteMany: async () => ({ count: 1 }),
    },
    wallet: {
      findUnique: async () => ({ id: "wallet-1", balance: 500000 }),
      update: async () => ({}),
    },
    walletTransaction: {
      create: async () => ({}),
    },
    user: {
      findUnique: async () => ({ id: "user-1", loyaltyPoints: 100 }),
      update: async () => ({}),
    },
    loyaltyPoint: {
      create: async () => ({}),
    },
    ...overrides,
  };
}

async function importBookingCheckout() {
  return import(
    `../src/services/bookingCheckout.service.js?case=${Date.now()}-${Math.random()}`
  );
}

originalTest("age calculation respects whether the birthday has passed", () => {
  assert.equal(calculatePassengerAge("2016-06-15", TODAY), 10);
  assert.equal(calculatePassengerAge("2016-06-17", TODAY), 9);
});

originalTest(
  "passengers under 10 are normalized to CHILD with nullable identity fields",
  () => {
    const passenger = normalizePassenger(
      adult({
        fullName: "Be Nguyen",
        dateOfBirth: "2020-01-01",
        passengerType: "ADULT",
      }),
      0,
      TODAY,
    );

    assert.equal(passenger.passengerType, "CHILD");
    assert.equal(passenger.nationalId, null);
    assert.equal(passenger.nationalIdType, null);
    assert.equal(passenger.phoneNumber, null);
    assert.equal(passenger.email, null);
  },
);

originalTest("children only require full name and date of birth", () => {
  const passenger = normalizePassenger(
    {
      fullName: "Be Nguyen",
      dateOfBirth: "2020-01-01",
    },
    0,
    TODAY,
  );
  assert.equal(passenger.passengerType, "CHILD");
  assert.equal(passenger.nationalId, null);
  assert.equal(passenger.phoneNumber, null);
});

originalTest(
  "BR-08 discount policy is applied through normalizePassenger",
  () => {
    // Trẻ dưới 6 tuổi: miễn phí 100%, không cần ghế riêng
    const under6 = normalizePassenger(
      { fullName: "Be Ut", dateOfBirth: "2021-01-01", seatRequired: false },
      0,
      TODAY,
    );
    assert.equal(under6.discountPercentage, 100);
    assert.equal(under6.discountReason, "CHILD_UNDER_6");
    assert.equal(under6.seatRequired, false);

    // Trẻ 6–9 tuổi: giảm 25%
    const child = normalizePassenger(
      { fullName: "Be Lon", dateOfBirth: "2019-01-01" },
      0,
      TODAY,
    );
    assert.equal(child.discountPercentage, 25);
    assert.equal(child.discountReason, "CHILD");
    assert.equal(child.seatRequired, true);

    // Người cao tuổi từ 60 tuổi: giảm 15%
    const senior = normalizePassenger(
      adult({ dateOfBirth: "1966-01-01" }),
      0,
      TODAY,
    );
    assert.equal(senior.discountPercentage, 15);
    assert.equal(senior.passengerType, "SENIOR");

    // Sinh viên: giảm 10%
    const student = normalizePassenger(
      adult({ dateOfBirth: "2005-09-17", passengerType: "STUDENT" }),
      0,
      TODAY,
    );
    assert.equal(student.discountPercentage, 10);
    assert.equal(student.passengerType, "STUDENT");
  },
);

originalTest(
  "children under 6 are automatically assigned seatRequired=false via CHILD_UNDER_6 ticket type",
  () => {
    // Không cần seatRequired: false rõ ràng — hệ thống tự nhận dạng qua ticketType
    const passenger = normalizePassenger(
      {
        fullName: "Be Nho",
        dateOfBirth: "2022-01-01",
        passengerType: "CHILD",
      },
      0,
      TODAY,
    );
    assert.equal(passenger.passengerType, "CHILD_UNDER_6");
    assert.equal(passenger.seatRequired, false);
    assert.equal(passenger.discountPercentage, 100);
    assert.equal(passenger.discountReason, "CHILD_UNDER_6");
  },
);

originalTest(
  "quote with unknown age keeps requested type without discount",
  () => {
    const passenger = normalizeQuotePassenger(
      { passengerType: "ADULT", dateOfBirth: "" },
      0,
      TODAY,
    );
    assert.equal(passenger.passengerType, "ADULT");
    assert.equal(passenger.discountPercentage, 0);
  },
);

originalTest("quote rejects shared-seat passengers who are not under 6", () => {
  assert.throws(
    () =>
      normalizeQuotePassenger(
        {
          dateOfBirth: "2005-09-17",
          passengerType: "ADULT",
          seatRequired: false,
        },
        0,
        TODAY,
      ),
    /chỉ trẻ dưới 6 tuổi/,
  );
});

originalTest(
  "age based categories normalize senior while preserving valid student choice",
  () => {
    assert.equal(
      normalizePassenger(
        adult({ dateOfBirth: "1960-01-01", passengerType: "ADULT" }),
        0,
        TODAY,
      ).passengerType,
      "SENIOR",
    );
  },
);

originalTest(
  "BR-07 requires a companion when the booking contains children",
  () => {
    const child = normalizePassenger(
      {
        fullName: "Be Nguyen",
        dateOfBirth: "2020-01-01",
        passengerType: "CHILD",
      },
      0,
      TODAY,
    );
    assert.throws(
      () => validatePassengerBusinessRules([child]),
      /phải đi cùng/,
    );
    assert.doesNotThrow(() =>
      validatePassengerBusinessRules([
        child,
        normalizePassenger(adult(), 1, TODAY),
      ]),
    );
  },
);

originalTest("each seat can be shared with only one child under 6", () => {
  const lapChild = (fullName) =>
    normalizePassenger(
      {
        fullName,
        dateOfBirth: "2022-01-01",
        passengerType: "CHILD",
        seatRequired: false,
      },
      0,
      TODAY,
    );
  const seatedChild = normalizePassenger(
    {
      fullName: "Be Co Ghe",
      dateOfBirth: "2018-01-01",
      passengerType: "CHILD",
    },
    0,
    TODAY,
  );

  assert.throws(
    () =>
      validatePassengerBusinessRules([
        normalizePassenger(adult(), 0, TODAY),
        lapChild("Be Mot"),
        lapChild("Be Hai"),
      ]),
    /Mỗi ghế chỉ được xếp tối đa/,
  );
});

originalTest("BR-06 rejects more than four passengers", () => {
  assert.throws(
    () =>
      validatePassengerBusinessRules([
        adult(),
        adult(),
        adult(),
        adult(),
        adult(),
      ]),
    /tối đa 4/,
  );
});

originalTest(
  "identity documents must be unique inside one booking session",
  () => {
    assert.throws(
      () =>
        validatePassengerBusinessRules([
          normalizePassenger(adult(), 0, TODAY),
          normalizePassenger(adult({ fullName: "Nguyen Van B" }), 1, TODAY),
        ]),
      /bị trùng/,
    );
  },
);

originalTest("only one ticket can be assigned to the account holder", () => {
  assert.throws(
    () =>
      validateAccountHolderSelection(
        [{ isAccountHolder: true }, { isAccountHolder: true }],
        { userId: "user-1" },
      ),
    /chỉ được chọn cho một vé/,
  );
});

// --- checkoutBooking ----------------------------------------------------------

test("checkoutBooking - UTCID01: checkoutBooking creates a CONFIRMED booking for immediate CASH payment by a logged-in user", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "AC_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "CASH",
    },
  );

  assert.equal(result.booking.status, "CONFIRMED");
  assert.equal(result.booking.paymentStatus, "COMPLETED");
  assert.equal(result.booking.totalAmount, 180000);
  assert.equal(result.passengers.length, 1);
  assert.equal(result.qrPayload, null);
  assert.equal(result.payos, null);
});

test("checkoutBooking - UTCID02: checkoutBooking rejects more than the 8 total-passenger limit", async (t) => {
  t.mock.module("../src/config/database.js", { namedExports: { prisma: {} } });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: "session-1",
          passengers: new Array(9).fill({}),
          paymentMethod: "CASH",
        },
      ),
    (err) => {
      assert.match(err.message, /Danh sách hành khách không hợp lệ/);
      assert.equal(err.statusCode, 400);
      return true;
    },
  );
});

test("checkoutBooking - UTCID03: checkoutBooking rejects WALLET payment when the wallet balance is insufficient", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "AC_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);

  const tx = makeTx({
    wallet: {
      findUnique: async () => ({ id: "wallet-1", balance: 1000 }),
      update: async () => ({}),
    },
  });
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "WALLET",
        },
      ),
    (err) => {
      assert.match(err.message, /Số dư ví không đủ/);
      assert.equal(err.statusCode, 422);
      return true;
    },
  );
});

test("checkoutBooking - UTCID04: checkoutBooking rejects checkout once the seat-hold session has expired", async (t) => {
  const session = makeSession({ expiresAt: new Date(Date.now() - 1000) });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  t.mock.module("../src/config/database.js", { namedExports: { prisma: {} } });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "CASH",
        },
      ),
    (err) => {
      assert.match(err.message, /hết hạn/);
      assert.equal(err.statusCode, 409);
      return true;
    },
  );
});

test("checkoutBooking - UTCID05: checkoutBooking creates a PENDING booking with a PayOS QR payload for BANK_QR payment", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockPayos(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: null, guestToken: "guest-token-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "BANK_QR",
    },
  );

  assert.equal(result.booking.status, "PENDING");
  assert.equal(result.booking.paymentStatus, "PENDING");
  assert.equal(result.qrPayload, "qr-data-mock");
  assert.equal(result.payos.paymentLinkId, "pl-mock-1");
  assert.equal(typeof result.payos.orderCode, "number");
});

test("checkoutBooking - UTCID06: checkoutBooking blocks guests from paying with WALLET", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  t.mock.module("../src/config/database.js", { namedExports: { prisma: {} } });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: null, guestToken: "guest-token-2" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "WALLET",
        },
      ),
    (err) => {
      assert.match(err.message, /Khách vãng lai không thể thanh toán bằng ví/);
      assert.equal(err.statusCode, 403);
      return true;
    },
  );
});

test("checkoutBooking - UTCID07: salesChannel=STAFF_COUNTER, user.findMany matches customer by nationalId", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: {
          findFirst: async () => null,
          findMany: async () => [
            {
              id: "customer-1",
              nationalId: "012345678901",
              userType: "CUSTOMER",
              isActive: true,
            },
          ],
        },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "staff-1", role: "STAFF" },
    {
      sessionId: session.id,
      passengers: [adult({ email: "" })],
      paymentMethod: "CASH",
      salesChannel: "STAFF_COUNTER",
    },
  );
  assert.equal(result.booking.userId, "customer-1");
});

test("checkoutBooking - UTCID08: salesChannel=STAFF_COUNTER only allows CASH/BANK_QR payment methods", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  t.mock.module("../src/config/database.js", { namedExports: { prisma: {} } });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "staff-1", role: "STAFF" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "WALLET",
          salesChannel: "STAFF_COUNTER",
        },
      ),
    (err) => {
      assert.match(
        err.message,
        /chỉ hỗ trợ thanh toán tiền mặt hoặc chuyển khoản/,
      );
      assert.equal(err.statusCode, 400);
      return true;
    },
  );
});

test("checkoutBooking - UTCID09: checkoutBooking throws when customerUserId is missing/invalid in DB", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        user: { findFirst: async () => null },
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "staff-1", role: "STAFF" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "CASH",
          customerUserId: "missing-customer",
        },
      ),
    (err) => {
      assert.match(err.message, /Không tìm thấy thành viên hợp lệ/);
      assert.equal(err.statusCode, 400);
      return true;
    },
  );
});

test("checkoutBooking - UTCID10: checkoutBooking links customerUserId correctly if found", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => ({ id: "customer-9" }) },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "staff-1", role: "STAFF" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "CASH",
      customerUserId: "customer-9",
    },
  );
  assert.equal(result.booking.userId, "customer-9");
});

test("checkoutBooking - UTCID11: tx.seatHoldSession.updateMany returns count=0 (session already claimed or expired)", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);

  const tx = makeTx({
    seatHoldSession: {
      updateMany: async () => ({ count: 0 }),
    },
  });
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "CASH",
        },
      ),
    (err) => {
      assert.match(
        err.message,
        /Phiên giữ ghế đã được sử dụng hoặc đã hết hạn/,
      );
      assert.equal(err.statusCode, 409);
      return true;
    },
  );
});

test("checkoutBooking - UTCID12: tx.wallet.findUnique returns sufficient balance", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx({
    wallet: {
      findUnique: async () => ({ id: "wallet-1", balance: 500000 }),
      update: async () => ({}),
    },
  });
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "WALLET",
    },
  );
  assert.equal(result.booking.paymentStatus, "COMPLETED");
});

test("checkoutBooking - UTCID13: voucherCode is SAVE10, approved by mock validateVoucher, but inside transaction it has active=false", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t, {
    voucher: { id: "voucher-1", voucherCode: "SAVE10" },
    voucherDiscount: 10000,
  });

  const tx = makeTx({
    voucher: {
      findUnique: async () => ({ id: "voucher-1", active: false }),
    },
  });
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "CASH",
          voucherCode: "SAVE10",
        },
      ),
    (err) => {
      assert.match(err.message, /Mã giảm giá vừa hết hiệu lực hoặc hết lượt/);
      assert.equal(err.statusCode, 409);
      return true;
    },
  );
});

test("checkoutBooking - UTCID14: voucherCode is SAVE10, voucher still valid", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t, {
    voucher: { id: "voucher-1", voucherCode: "SAVE10" },
    voucherDiscount: 10000,
  });
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "CASH",
      voucherCode: "SAVE10",
    },
  );
  assert.equal(result.booking.totalAmount, 140000); // 150000 - 10000
});

test("checkoutBooking - UTCID15: findBestPromotion matched, but inside transaction it returns usedBudget=maxBudget", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t, {
    promotion: { id: "promo-1", title: "Discount" },
    promoDiscount: 5000,
  });

  const tx = makeTx({
    promotion: {
      findUnique: async () => ({
        id: "promo-1",
        status: "ACTIVE",
        maxBudget: 10000,
        usedBudget: 10000,
      }),
    },
  });
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "CASH",
        },
      ),
    (err) => {
      assert.match(
        err.message,
        /Chương trình khuyến mãi vừa kết thúc hoặc hết ngân sách/,
      );
      assert.equal(err.statusCode, 409);
      return true;
    },
  );
});

test("checkoutBooking - UTCID16: findBestPromotion matched, promotion still valid", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t, {
    promotion: { id: "promo-1", title: "Discount" },
    promoDiscount: 5000,
  });
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "CASH",
    },
  );
  assert.equal(result.booking.totalAmount, 145000); // 150000 - 5000
});

test("checkoutBooking - UTCID17: identity={userId:user-1}, paymentMethod=BANK_QR status is PENDING", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockPayos(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "BANK_QR",
    },
  );
  assert.equal(result.booking.status, "PENDING");
  assert.equal(result.booking.paymentStatus, "PENDING");
});

test("checkoutBooking - UTCID18: paymentMethod=CRYPTO (unrecognized) throws 400", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  t.mock.module("../src/config/database.js", { namedExports: { prisma: {} } });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "CRYPTO",
        },
      ),
    (err) => {
      assert.match(err.message, /Phương thức thanh toán chưa hợp lệ/);
      assert.equal(err.statusCode, 400);
      return true;
    },
  );
});

test("checkoutBooking - UTCID19: prisma.booking.findFirst always returns existing row (payosOrderCode collision) throws 500", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => ({ id: "existing-order-code" }) },
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "BANK_QR",
        },
      ),
    (err) => {
      assert.match(err.message, /Không thể tạo mã thanh toán PayOS duy nhất/);
      assert.equal(err.statusCode, 500);
      return true;
    },
  );
});

test("checkoutBooking - UTCID20: custom ADULT ticketType with requiresDocument=false (email/phone omitted on passenger)", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  t.mock.module("../src/services/seatSelection.service.js", {
    namedExports: {
      getSession: async () => session,
      getJourney: async () => ({
        schedule: {
          train: {
            trainType: "NORMAL",
          },
        },
        segment: {
          departureTime: new Date(Date.now() + 24 * 3600 * 1000),
          distance: 100,
        },
      }),
    },
  });

  t.mock.module("../src/services/pricing.service.js", {
    namedExports: {
      calculateFare: (rule, distance, tax) => ({
        boundedAmount: 150000,
        finalPrice: 150000,
      }),
      getConfiguration: async () => ({
        effectiveRules: [
          {
            carriageType: "NORMAL_SEAT",
            passengerType: "ADULT",
            taxPercentage: 10,
            basePrice: 150000,
            pricePerKm: 0,
            classSurcharge: 0,
          },
        ],
      }),
      getEffectiveTicketTypes: async () => [
        {
          code: "ADULT",
          discountType: "PERCENTAGE",
          discountValue: 0,
          minAge: 10,
          maxAgeExclusive: null,
          seatMode: "REQUIRED",
          autoApply: false,
          requiresDocument: false,
          requiresStudent: false,
        },
      ],
    },
  });

  mockPromotion(t);
  mockPayos(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: null, guestToken: "guest" },
    {
      sessionId: session.id,
      passengers: [{ fullName: "Nguyen Van A", dateOfBirth: "1990-01-01" }],
      paymentMethod: "BANK_QR",
    },
  );
  assert.equal(result.booking.status, "PENDING");
});

test("checkoutBooking - UTCID21: 1 seated adult + 1 lap child (seatRequired=false)", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [
        adult(),
        {
          fullName: "Be Nho",
          dateOfBirth: "2023-01-01",
          passengerType: "CHILD",
          seatRequired: false,
        },
      ],
      paymentMethod: "CASH",
    },
  );
  assert.equal(result.passengers.length, 2);
});

test("checkoutBooking - UTCID22: prisma.booking.findUnique (email lookup) returns joined booking; email sent once with SUCCESS template", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const bookingData = {
    id: "booking-1",
    bookingCode: "GT0001",
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    confirmationEmail: "owner@example.com",
    schedule: { train: { trainCode: "SE1" } },
    fromStation: { stationName: "HN" },
    toStation: { stationName: "DN" },
    passengers: [
      {
        id: "p1",
        email: "owner@example.com",
        seat: {
          seatNumber: "1A",
          carriage: { carriageNumber: 1, carriageType: "NORMAL_SEAT" },
        },
      },
    ],
  };

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: {
          findFirst: async () => null,
          findUnique: async () => bookingData,
        },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult({ email: "owner@example.com" })],
      paymentMethod: "CASH",
    },
  );

  // Wait a small bit for async fire-and-forget sendEmail to resolve
  await new Promise((r) => setTimeout(r, 100));

  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0].to, "owner@example.com");
  assert.match(sendEmailCalls[0].subject, /Xác nhận thanh toán & Vé điện tử/);
});

test("checkoutBooking - UTCID23: confirmationEmail=null, user.email set, email sent once with PENDING template", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockPayos(t);
  mockEmailService(t);

  const bookingData = {
    id: "booking-1",
    bookingCode: "GT0001",
    status: "PENDING",
    paymentStatus: "PENDING",
    confirmationEmail: null,
    user: { email: "user@example.com" },
    schedule: { train: { trainCode: "SE1" } },
    fromStation: { stationName: "HN" },
    toStation: { stationName: "DN" },
    passengers: [
      {
        id: "p1",
        email: null,
        seat: {
          seatNumber: "1A",
          carriage: { carriageNumber: 1, carriageType: "NORMAL_SEAT" },
        },
      },
    ],
  };

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: {
          findFirst: async () => null,
          findUnique: async () => bookingData,
        },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "BANK_QR",
    },
  );

  await new Promise((r) => setTimeout(r, 100));

  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0].to, "user@example.com");
  assert.match(sendEmailCalls[0].subject, /Đặt chỗ thành công/);
});

test("checkoutBooking - UTCID24: confirmationEmail=null, user=null, passengers=[] early returns", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const bookingData = {
    id: "booking-1",
    bookingCode: "GT0001",
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    confirmationEmail: null,
    user: null,
    schedule: { train: { trainCode: "SE1" } },
    fromStation: { stationName: "HN" },
    toStation: { stationName: "DN" },
    passengers: [],
  };

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: {
          findFirst: async () => null,
          findUnique: async () => bookingData,
        },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "CASH",
    },
  );

  await new Promise((r) => setTimeout(r, 100));

  assert.equal(sendEmailCalls.length, 0); // Early returned on missing email
});

test("checkoutBooking - UTCID25: booking findUnique returns null, early returns from email helper", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: {
          findFirst: async () => null,
          findUnique: async () => null, // not found
        },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "CASH",
    },
  );

  await new Promise((r) => setTimeout(r, 100));

  assert.equal(sendEmailCalls.length, 0);
});

test("checkoutBooking - UTCID26: sendEmail mock throws error, checkoutBooking still succeeds", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t, { throwError: true });

  const bookingData = {
    id: "booking-1",
    bookingCode: "GT0001",
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    confirmationEmail: "owner@example.com",
    schedule: { train: { trainCode: "SE1" } },
    fromStation: { stationName: "HN" },
    toStation: { stationName: "DN" },
    passengers: [
      {
        id: "p1",
        email: "owner@example.com",
        seat: {
          seatNumber: "1A",
          carriage: { carriageNumber: 1, carriageType: "NORMAL_SEAT" },
        },
      },
    ],
  };

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: {
          findFirst: async () => null,
          findUnique: async () => bookingData,
        },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [adult()],
      paymentMethod: "CASH",
    },
  );
  assert.equal(result.booking.status, "CONFIRMED");
});

test("checkoutBooking - UTCID27: paymentMethod key entirely omitted from payload throws 400", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  t.mock.module("../src/config/database.js", { namedExports: { prisma: {} } });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
        },
      ),
    (err) => {
      assert.match(err.message, /Phương thức thanh toán chưa hợp lệ/);
      assert.equal(err.statusCode, 400);
      return true;
    },
  );
});

test("checkoutBooking - UTCID28: salesChannel=STAFF_COUNTER, user.findMany returns matched customer by nationalId (name omitted), both passenger records get matched userId", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: {
          findFirst: async () => null,
          findMany: async () => [
            {
              id: "customer-1",
              nationalId: "012345678901",
              userType: "CUSTOMER",
              isActive: true,
            },
          ],
        },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "staff-1", role: "STAFF" },
    {
      sessionId: session.id,
      passengers: [
        adult({ email: "" }),
        {
          fullName: "Be Nho",
          dateOfBirth: "2023-01-01",
          passengerType: "CHILD",
          seatRequired: false,
        },
      ],
      paymentMethod: "CASH",
      salesChannel: "STAFF_COUNTER",
    },
  );
  assert.equal(result.booking.userId, "customer-1");
});

test("checkoutBooking - UTCID29: salesChannel=STAFF_COUNTER, ADULT requiresDocument=false, booking.userId=null", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  t.mock.module("../src/services/seatSelection.service.js", {
    namedExports: {
      getSession: async () => session,
      getJourney: async () => ({
        schedule: {
          train: {
            trainType: "NORMAL",
          },
        },
        segment: {
          departureTime: new Date(Date.now() + 24 * 3600 * 1000),
          distance: 100,
        },
      }),
    },
  });

  t.mock.module("../src/services/pricing.service.js", {
    namedExports: {
      calculateFare: (rule, distance, tax) => ({
        boundedAmount: 150000,
        finalPrice: 150000,
      }),
      getConfiguration: async () => ({
        effectiveRules: [
          {
            carriageType: "NORMAL_SEAT",
            passengerType: "ADULT",
            taxPercentage: 10,
            basePrice: 150000,
            pricePerKm: 0,
            classSurcharge: 0,
          },
        ],
      }),
      getEffectiveTicketTypes: async () => [
        {
          code: "ADULT",
          discountType: "PERCENTAGE",
          discountValue: 0,
          minAge: 10,
          maxAgeExclusive: null,
          seatMode: "REQUIRED",
          autoApply: false,
          requiresDocument: false,
          requiresStudent: false,
        },
      ],
    },
  });

  mockPromotion(t);
  mockEmailService(t);

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null, findMany: async () => [] },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  const result = await checkoutBooking(
    { userId: "staff-1", role: "STAFF" },
    {
      sessionId: session.id,
      passengers: [{ fullName: "Nguyen Van A", dateOfBirth: "1990-01-01" }],
      paymentMethod: "CASH",
      salesChannel: "STAFF_COUNTER",
    },
  );
  assert.equal(result.booking.userId, null);
});

test("checkoutBooking - UTCID30: voucherCode=SAVE10, active=true but currentUsageCount=maxUsageCount=5 throws 409", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t, {
    voucher: { id: "voucher-1", voucherCode: "SAVE10" },
    voucherDiscount: 10000,
  });

  const tx = makeTx({
    voucher: {
      findUnique: async () => ({
        id: "voucher-1",
        active: true,
        validFrom: new Date(Date.now() - 1000),
        validTo: new Date(Date.now() + 1000),
        currentUsageCount: 5,
        maxUsageCount: 5,
      }),
    },
  });
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await assert.rejects(
    () =>
      checkoutBooking(
        { userId: "user-1" },
        {
          sessionId: session.id,
          passengers: [adult()],
          paymentMethod: "CASH",
          voucherCode: "SAVE10",
        },
      ),
    (err) => {
      assert.match(err.message, /Mã giảm giá vừa hết hiệu lực hoặc hết lượt/);
      assert.equal(err.statusCode, 409);
      return true;
    },
  );
});

test("checkoutBooking - UTCID31: confirmationEmail=null, user=null, passenger[1] has email, sends to passenger[1]", async (t) => {
  const session = makeSession({
    holds: [
      makeHold({ carriageType: "NORMAL_SEAT" }),
      makeHold({ carriageType: "NORMAL_SEAT", seatId: "seat-2" }),
    ],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  const bookingData = {
    id: "booking-1",
    bookingCode: "GT0001",
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    confirmationEmail: null,
    user: null,
    schedule: { train: { trainCode: "SE1" } },
    fromStation: { stationName: "HN" },
    toStation: { stationName: "DN" },
    passengers: [
      {
        id: "p1",
        email: null,
        seat: {
          seatNumber: "1A",
          carriage: { carriageNumber: 1, carriageType: "NORMAL_SEAT" },
        },
      },
      {
        id: "p2",
        email: "passenger2@example.com",
        seat: {
          seatNumber: "1B",
          carriage: { carriageNumber: 1, carriageType: "NORMAL_SEAT" },
        },
      },
    ],
  };

  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: {
          findFirst: async () => null,
          findUnique: async () => bookingData,
        },
        user: { findFirst: async () => null },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await checkoutBooking(
    { userId: "user-1" },
    {
      sessionId: session.id,
      passengers: [
        adult(),
        adult({ email: "passenger2@example.com", nationalId: "012345678902" }),
      ],
      paymentMethod: "CASH",
    },
  );

  await new Promise((r) => setTimeout(r, 100));

  assert.equal(sendEmailCalls.length, 1);
  assert.equal(sendEmailCalls[0].to, "passenger2@example.com");
});

test("checkoutBooking - UTCID32: salesChannel=STAFF_COUNTER, search captures international phone variants", async (t) => {
  const session = makeSession({
    holds: [makeHold({ carriageType: "NORMAL_SEAT" })],
  });
  mockSeatAndPricing(t, { session });
  mockPromotion(t);
  mockEmailService(t);

  let capturedWhere = null;
  const tx = makeTx();
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        booking: { findFirst: async () => null, findUnique: async () => null },
        user: {
          findFirst: async () => null,
          findMany: async (args) => {
            capturedWhere = args.where;
            return [];
          },
        },
        $transaction: async (fn) => fn(tx),
      },
    },
  });

  const { checkoutBooking } = await importBookingCheckout();
  await checkoutBooking(
    { userId: "staff-1", role: "STAFF" },
    {
      sessionId: session.id,
      passengers: [adult({ phoneNumber: "+84912345678", email: "" })],
      paymentMethod: "CASH",
      salesChannel: "STAFF_COUNTER",
    },
  );

  assert.ok(capturedWhere);
  const phonesList =
    capturedWhere.OR.find((o) => o.phoneNumber)?.phoneNumber?.in || [];
  assert.ok(phonesList.includes("0912345678"));
});

originalTest("calculateFare respects train type price factor", () => {
  const rule = {
    basePrice: 50000,
    pricePerKm: 1000,
    classSurcharge: 10000,
    minPrice: null,
    maxPrice: null,
    discountPercentage: 0,
    scopeType: "SYSTEM",
  };

  // Default price factor (1.0): 50k + 10k + 10 * 1k = 70k
  const fareDefault = calculateFare(rule, 10, 0);
  assert.equal(fareDefault.finalPrice, 70000);

  // TN train type factor (0.85): 70k * 0.85 = 59.5k
  const fareTN = calculateFare(rule, 10, 0, 0.85);
  assert.equal(fareTN.finalPrice, 59500);

  // HL train type factor (1.30): 70k * 1.30 = 91k
  const fareHL = calculateFare(rule, 10, 0, 1.3);
  assert.equal(fareHL.finalPrice, 91000);

  // Direct schedule policy (scopeType = SCHEDULE) ignores the train-type priceFactor
  const scheduleRule = {
    ...rule,
    scopeType: "SCHEDULE",
  };
  const fareScheduleTN = calculateFare(scheduleRule, 10, 0, 0.85);
  assert.equal(fareScheduleTN.finalPrice, 70000);
});
