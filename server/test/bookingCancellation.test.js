import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("cancelBookingTickets")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";
import {
  cancellationRequesterType,
  normalizeGuestBankInfo,
  normalizeRefundMethod,
  refundPolicy,
} from "../src/services/bookingCancellation.service.js";

const NOW = new Date("2026-06-21T12:00:00+07:00");

originalTest("refund policy rejects departed and near-departure trains", () => {
  assert.equal(refundPolicy("2026-06-21T11:00:00+07:00", NOW).allowed, false);
  assert.equal(refundPolicy("2026-06-21T15:00:00+07:00", NOW).allowed, false);
});

originalTest(
  "cancellation requests are separated by the actual requester type",
  () => {
    assert.equal(
      cancellationRequesterType({
        requesterType: "REGISTERED",
        refundMethod: "BANK_TRANSFER",
        booking: { userId: "user-id" },
      }),
      "REGISTERED",
    );
    assert.equal(
      cancellationRequesterType({
        requesterType: "GUEST",
        booking: { userId: "user-id" },
      }),
      "GUEST",
    );
    assert.equal(
      cancellationRequesterType({
        refundMethod: "BANK_TRANSFER",
        booking: { userId: "user-id" },
      }),
      "GUEST",
    );
  },
);

originalTest("refund policy applies 50 percent and 80 percent windows", () => {
  const sameDay = refundPolicy("2026-06-21T18:00:00+07:00", NOW);
  assert.equal(sameDay.allowed, true);
  assert.equal(sameDay.rate, 0.5);

  const nextDay = refundPolicy("2026-06-23T12:00:00+07:00", NOW);
  assert.equal(nextDay.allowed, true);
  assert.equal(nextDay.rate, 0.8);
});

originalTest(
  "refund method normalizes bank alias and rejects unsupported values",
  () => {
    assert.equal(normalizeRefundMethod("wallet"), "WALLET");
    assert.equal(normalizeRefundMethod("BANK"), "BANK_TRANSFER");
    assert.throws(() => normalizeRefundMethod("CASH"), /không hợp lệ/i);
  },
);

originalTest(
  "guest cancellation requires valid bank transfer information",
  () => {
    assert.deepEqual(
      normalizeGuestBankInfo({
        bankName: " Vietcombank ",
        bankAccount: "123 456 789",
        accountHolder: " NGUYEN VAN A ",
      }),
      {
        bankName: "Vietcombank",
        bankAccount: "123456789",
        accountHolder: "NGUYEN VAN A",
      },
    );
    assert.throws(() => normalizeGuestBankInfo({}), /đầy đủ/i);
    assert.throws(
      () =>
        normalizeGuestBankInfo({
          bankName: "VCB",
          bankAccount: "abc",
          accountHolder: "A",
        }),
      /không hợp lệ/i,
    );
  },
);

// Helper builder for cancelBookingTickets mocks
function buildCancellationPrismaMock(overrides = {}) {
  const defaultBooking = {
    id: "booking-1",
    bookingCode: "GT0001",
    status: "CONFIRMED",
    paymentStatus: "COMPLETED",
    userId: "user-1",
    guestToken: null,
    confirmationEmail: "owner@example.com",
    refundAmount: 0,
    schedule: {
      departureTime: new Date(Date.now() + 30 * 3600 * 1000), // tomorrow (+30 hours)
    },
    passengers: [
      {
        id: "passenger-1",
        userId: "user-1",
        fullName: "Nguyen Van A",
        email: "owner@example.com",
        phoneNumber: "0900000000",
        ticketCode: "T1",
        bookingDetails: [
          { id: "detail-1", status: "CONFIRMED", finalPrice: 100000 },
        ],
      },
    ],
  };

  return {
    booking: {
      findUnique: async () => {
        if (overrides.booking === null) return null;
        return { ...defaultBooking, ...overrides.booking };
      },
    },
    cancellationRequest: {
      findUnique: async () => overrides.cancellationRequest ?? null,
      update: async ({ data }) => ({ id: "request-1", ...data }),
      create: async ({ data }) => ({ id: "request-1", ...data }),
    },
  };
}

// --- cancelBookingTickets -----------------------------------------------------

test("cancelBookingTickets - UTCID01: Booking CONFIRMED/COMPLETED, departure +30h, single passenger, registered owner", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock(),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await cancelBookingTickets({
    bookingId: "booking-1",
    refundMethod: "WALLET",
    identity: { userId: "user-1" },
  });
  assert.equal(result.refundStatus, "PENDING_APPROVAL");
  assert.equal(result.refundAmount, 80000);
  assert.equal(result.refundPercentage, 80);
  assert.deepEqual(result.requestedPassengerIds, ["passenger-1"]);
});

test("cancelBookingTickets - UTCID02: Same booking fixture as UTCID01, registered owner supplies optional bank info", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock(),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await cancelBookingTickets({
    bookingId: "booking-1",
    refundMethod: "WALLET",
    identity: { userId: "user-1" },
    bankInfo: {
      bankName: "  Vietcombank  ",
      bankAccount: "123 456 789",
      accountHolder: "  NGUYEN VAN A  ",
    },
  });
  assert.equal(result.cancellationRequest.refundBankName, "Vietcombank");
  assert.equal(result.cancellationRequest.refundBankAccount, "123456789");
  assert.equal(result.cancellationRequest.refundAccountHolder, "NGUYEN VAN A");
});

test("cancelBookingTickets - UTCID03: Passenger bookingDetails.finalPrice=-50000 (corrupted data) throws 409", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: {
          passengers: [
            {
              id: "passenger-1",
              userId: "user-1",
              bookingDetails: [
                { id: "detail-1", status: "CONFIRMED", finalPrice: -50000 },
              ],
            },
          ],
        },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
      }),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /Không có số tiền hợp lệ/);
      return true;
    },
  );
});

test('cancelBookingTickets - UTCID04: existingRequest={id:"request-old",status:"REJECTED"}', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        cancellationRequest: { id: "request-old", status: "REJECTED" },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await cancelBookingTickets({
    bookingId: "booking-1",
    refundMethod: "WALLET",
    identity: { userId: "user-1" },
  });
  assert.equal(result.cancellationRequest.status, "PENDING");
});

test("cancelBookingTickets - UTCID05: booking=null (findUnique returns null) throws 404", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({ booking: null }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "missing-id",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
      }),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.match(err.message, /Không tìm thấy/);
      return true;
    },
  );
});

test('cancelBookingTickets - UTCID06: existingRequest={id:"request-old",status:"PENDING"} throws 409', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        cancellationRequest: { id: "request-old", status: "PENDING" },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
      }),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /đang chờ Admin duyệt/);
      return true;
    },
  );
});

test("cancelBookingTickets - UTCID07: Default booking fixture, caller has no matching identity throws 403", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock(),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: {},
        verification: {},
      }),
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    },
  );
});

test('cancelBookingTickets - UTCID08: booking.status="PENDING", paymentStatus="PENDING" throws 409', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: { status: "PENDING", paymentStatus: "PENDING" },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
      }),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /đã xác nhận và đã thanh toán/);
      return true;
    },
  );
});

test("cancelBookingTickets - UTCID09: schedule.departureTime = now + 2h (inside 4h window) throws 400", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: {
          schedule: { departureTime: new Date(Date.now() + 2 * 3600 * 1000) },
        },
        cancellationRequest: null,
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
      }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /trong vòng 4 giờ/);
      return true;
    },
  );
});

test('cancelBookingTickets - UTCID10: booking.userId="user-1", caller is guest with verification', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock(),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await cancelBookingTickets({
    bookingId: "booking-1",
    refundMethod: "BANK",
    identity: { guestToken: "guest-token" },
    verification: { ticketCode: "T1", contactInfo: "owner@example.com" },
    bankInfo: {
      bankName: "Vietcombank",
      bankAccount: "123456789",
      accountHolder: "NGUYEN VAN A",
    },
  });
  assert.equal(result.refundMethod, "BANK_TRANSFER");
  assert.equal(result.cancellationRequest.requesterType, "GUEST");
});

test('cancelBookingTickets - UTCID11: Default booking fixture with passenger-1 only, passengerIds=["not-a-real-passenger"] throws 400', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock(),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
        passengerIds: ["not-a-real-passenger"],
      }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /không thuộc booking/);
      return true;
    },
  );
});

test('cancelBookingTickets - UTCID12: All bookingDetails.status="CANCELLED", passengerIds=undefined throws 400', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: {
          passengers: [
            {
              id: "passenger-1",
              userId: "user-1",
              bookingDetails: [
                { id: "detail-1", status: "CANCELLED", finalPrice: 100000 },
              ],
            },
          ],
        },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
      }),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /ít nhất một vé còn hiệu lực/);
      return true;
    },
  );
});

test('cancelBookingTickets - UTCID13: passenger-1.bookingDetails.status="CANCELLED", explicitly selected throws 409', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: {
          passengers: [
            {
              id: "passenger-1",
              userId: "user-1",
              bookingDetails: [
                { id: "detail-1", status: "CANCELLED", finalPrice: 100000 },
              ],
            },
          ],
        },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: { userId: "user-1" },
        passengerIds: ["passenger-1"],
      }),
    (err) => {
      assert.equal(err.statusCode, 409);
      assert.match(err.message, /đã được hủy trước đó/);
      return true;
    },
  );
});

test('cancelBookingTickets - UTCID14: booking.userId="someone-else" (not caller), caller has STAFF role', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: { userId: "someone-else" },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await cancelBookingTickets({
    bookingId: "booking-1",
    refundMethod: "WALLET",
    identity: { role: "STAFF", userId: "staff-1" },
  });
  assert.equal(result.cancellationRequest.status, "PENDING");
});

test('cancelBookingTickets - UTCID15: booking.userId="primary-owner", passenger.userId="co-passenger-user" differs from booking owner', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: {
          userId: "primary-owner",
          passengers: [
            {
              id: "passenger-1",
              userId: "co-passenger-user",
              bookingDetails: [
                { id: "detail-1", status: "CONFIRMED", finalPrice: 100000 },
              ],
            },
          ],
        },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await cancelBookingTickets({
    bookingId: "booking-1",
    refundMethod: "WALLET",
    identity: { userId: "co-passenger-user" },
  });
  assert.equal(result.cancellationRequest.status, "PENDING");
});

test('cancelBookingTickets - UTCID16: booking.userId="someone-else", passenger phone matches contact', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: {
          userId: "someone-else",
          passengers: [
            {
              id: "passenger-1",
              email: "passenger@example.com",
              phoneNumber: "0900000000",
              ticketCode: "T1",
              bookingDetails: [
                { id: "detail-1", status: "CONFIRMED", finalPrice: 100000 },
              ],
            },
          ],
        },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await cancelBookingTickets({
    bookingId: "booking-1",
    refundMethod: "BANK",
    identity: {},
    verification: { ticketCode: "T1", contactInfo: "0900000000" },
    bankInfo: {
      bankName: "Vietcombank",
      bankAccount: "123456789",
      accountHolder: "NGUYEN VAN A",
    },
  });
  assert.equal(result.cancellationRequest.status, "PENDING");
});

test('cancelBookingTickets - UTCID17: booking.userId="someone-else", verification contact does not match any passenger throws 403', async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildCancellationPrismaMock({
        booking: { userId: "someone-else" },
      }),
    },
  });
  const { cancelBookingTickets } = await import(
    `../src/services/bookingCancellation.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      cancelBookingTickets({
        bookingId: "booking-1",
        refundMethod: "WALLET",
        identity: {},
        verification: { ticketCode: "T1", contactInfo: "wrong@example.com" },
      }),
    (err) => {
      assert.equal(err.statusCode, 403);
      return true;
    },
  );
});
