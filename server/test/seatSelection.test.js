import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("confirmSeatSelection")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";
import {
  HOLD_DURATION_MS,
  MAX_SEATS_PER_LEG,
  isSeatConflictError,
  validateSelectionCounts,
} from "../src/services/seatSelection.service.js";

// Helper constants for mocking confirmSeatSelection
const SCHEDULE_ID_1 = "507f1f77bcf86cd799439011";
const SCHEDULE_ID_2 = "507f1f77bcf86cd799439012";
const FROM_STATION_ID = "507f1f77bcf86cd799439022";
const TO_STATION_ID = "507f1f77bcf86cd799439033";
const SEAT_ID_1 = "507f1f77bcf86cd799439044";
const SEAT_ID_2 = "507f1f77bcf86cd799439055";
const CARRIAGE_ID_1 = "507f1f77bcf86cd799439066";
const TRAIN_ID_1 = "507f1f77bcf86cd799439077";
const SESSION_ID = "507f1f77bcf86cd799439099";

function buildConfirmPayload(seatIds = [SEAT_ID_1]) {
  return {
    outbound: {
      scheduleId: SCHEDULE_ID_1,
      fromStationId: FROM_STATION_ID,
      toStationId: TO_STATION_ID,
      seatIds,
    },
  };
}

function mockPricingService(
  t,
  effectiveRules = [
    { carriageType: "NORMAL_SEAT", passengerType: "ADULT", taxPercentage: 10 },
  ],
) {
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: {
      calculateFare: (rule, distance, tax) => ({ finalPrice: 100000 }),
      getConfiguration: async () => ({
        effectiveRules,
      }),
    },
  });
}

function buildSeatSelectionPrismaMock(overrides = {}) {
  const defaultSchedule = {
    id: SCHEDULE_ID_1,
    status: "ACTIVE",
    departureTime: new Date(Date.now() + 24 * 3600 * 1000), // tomorrow
    arrivalTime: new Date(Date.now() + 28 * 3600 * 1000),
    distance: 100,
    duration: 240,
    delayMinutes: 0,
    routeId: "route-1",
    route: {
      routeName: "Hà Nội - Hải Phòng",
      distance: 100,
      stations: [
        { stationId: FROM_STATION_ID, stopOrder: 1 },
        { stationId: TO_STATION_ID, stopOrder: 2 },
      ],
      isActive: true,
      startStation: {
        id: FROM_STATION_ID,
        stationCode: "HN",
        stationName: "Hà Nội",
      },
      endStation: {
        id: TO_STATION_ID,
        stationCode: "HP",
        stationName: "Hải Phòng",
      },
    },
    train: {
      id: TRAIN_ID_1,
      trainCode: "HP1",
      trainName: "Hải Phòng 1",
      trainType: "NORMAL",
      carriages: [
        {
          id: CARRIAGE_ID_1,
          carriageNumber: 1,
          carriageType: "NORMAL_SEAT",
          totalSeats: 40,
          seats: [
            {
              id: SEAT_ID_1,
              seatNumber: "1A",
              seatType: "NORMAL",
              status: "ACTIVE",
              blockReason: null,
              blockUntil: null,
            },
            {
              id: SEAT_ID_2,
              seatNumber: "1B",
              seatType: "NORMAL",
              status: "ACTIVE",
              blockReason: null,
              blockUntil: null,
            },
          ],
        },
      ],
    },
    scheduleStops: [
      {
        stationId: FROM_STATION_ID,
        stopOrder: 1,
        arrivalTime: null,
        departureTime: new Date(Date.now() + 24 * 3600 * 1000),
      },
      {
        stationId: TO_STATION_ID,
        stopOrder: 2,
        arrivalTime: new Date(Date.now() + 28 * 3600 * 1000),
        departureTime: null,
      },
    ],
  };

  const mockTx = {
    booking: {
      findFirst: async () =>
        overrides.bookingFindFirstTx ? overrides.bookingFindFirstTx() : null,
    },
    seatHold: {
      deleteMany: async () => ({ count: 1 }),
      create: async ({ data }) => ({ id: "hold-new", ...data }),
    },
    seatHoldSession: {
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }) => ({ id: SESSION_ID, ...data }),
    },
  };

  return {
    schedule: {
      findUnique: async ({ where }) => {
        if (where && where.id === SCHEDULE_ID_2) {
          return {
            ...defaultSchedule,
            id: SCHEDULE_ID_2,
            route: {
              ...defaultSchedule.route,
              startStation: {
                id: TO_STATION_ID,
                stationCode: "HP",
                stationName: "Hải Phòng",
              },
              endStation: {
                id: FROM_STATION_ID,
                stationCode: "HN",
                stationName: "Hà Nội",
              },
              stations: [
                { stationId: TO_STATION_ID, stopOrder: 1 },
                { stationId: FROM_STATION_ID, stopOrder: 2 },
              ],
            },
            scheduleStops: [
              {
                stationId: TO_STATION_ID,
                stopOrder: 1,
                arrivalTime: null,
                departureTime: new Date(Date.now() + 24 * 3600 * 1000),
              },
              {
                stationId: FROM_STATION_ID,
                stopOrder: 2,
                arrivalTime: new Date(Date.now() + 28 * 3600 * 1000),
                departureTime: null,
              },
            ],
          };
        }
        return defaultSchedule;
      },
    },
    booking: {
      findMany: async () => [],
      findFirst: async () =>
        overrides.bookingFindFirst ? overrides.bookingFindFirst() : null,
    },
    seatHold: {
      findMany: async () => [],
      findFirst: async () =>
        overrides.seatHoldFindFirst ? overrides.seatHoldFindFirst() : null,
      deleteMany: async () => ({ count: 1 }),
    },
    seatHoldSession: {
      findMany: async () =>
        overrides.seatHoldSessionFindMany
          ? overrides.seatHoldSessionFindMany()
          : [],
      updateMany: async () => ({ count: 1 }),
      findFirst: async (args) => ({
        id: args.where.id,
        holds: [
          {
            id: "hold-1",
            seatId: SEAT_ID_1,
            seat: {
              seatNumber: "1A",
              seatType: "NORMAL",
              carriage: { carriageNumber: 1, carriageType: "NORMAL_SEAT" },
            },
          },
        ],
      }),
    },
    $transaction: async (fn) => {
      if (overrides.transaction) return overrides.transaction(mockTx);
      return fn(mockTx);
    },
  };
}

originalTest("seat hold business constants match the booking rules", () => {
  assert.equal(HOLD_DURATION_MS, 10 * 60 * 1000);
  assert.equal(MAX_SEATS_PER_LEG, 4);
});

originalTest(
  "Prisma unique and Mongo write conflicts become seat conflicts",
  () => {
    assert.equal(isSeatConflictError({ code: "P2002" }), true);
    assert.equal(isSeatConflictError({ code: "P2034" }), true);
    assert.equal(
      isSeatConflictError({
        message: "Transaction failed due to a write conflict or a deadlock",
      }),
      true,
    );
    assert.equal(isSeatConflictError({ code: "P2025" }), false);
  },
);

originalTest(
  "draft selection requires one to four unique seats per leg",
  () => {
    assert.doesNotThrow(() => validateSelectionCounts(["seat-1"]));
    assert.doesNotThrow(() =>
      validateSelectionCounts(["seat-1", "seat-2"], ["seat-3", "seat-4"]),
    );
    assert.throws(() => validateSelectionCounts([]), /ít nhất một ghế/);
    assert.throws(
      () => validateSelectionCounts(["1", "2", "3", "4", "5"]),
      /tối đa 4 ghế/,
    );
    assert.throws(
      () => validateSelectionCounts(["seat-1", "seat-1"]),
      /bị trùng/,
    );
  },
);

originalTest("round trips require the same seat count on both legs", () => {
  assert.throws(
    () => validateSelectionCounts(["seat-1", "seat-2"], ["seat-3"]),
    /phải bằng nhau/,
  );
});

// --- confirmSeatSelection -----------------------------------------------------

test("confirmSeatSelection - UTCID01: No existing hold/booking on the seat, valid pricing rule for NORMAL_SEAT", async (t) => {
  mockPricingService(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock(),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await confirmSeatSelection(
    { userId: "user-1" },
    buildConfirmPayload(),
  );
  assert.equal(result.session.id, SESSION_ID);
  assert.equal(result.releasedHolds.length, 0);
});

test("confirmSeatSelection - UTCID02: Caller already has an ACTIVE session (oldSession) holding SEAT_ID_2", async (t) => {
  mockPricingService(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock({
        seatHoldSessionFindMany: async () => [
          {
            id: SESSION_ID,
            status: "ACTIVE",
            holds: [
              { id: "hold-old", scheduleId: SCHEDULE_ID_1, seatId: SEAT_ID_2 },
            ],
          },
        ],
      }),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await confirmSeatSelection(
    { userId: "user-1" },
    buildConfirmPayload(),
  );
  assert.equal(result.session.id, SESSION_ID);
  assert.deepEqual(result.releasedHolds, [
    { scheduleId: SCHEDULE_ID_1, seatId: SEAT_ID_2 },
  ]);
});

test("confirmSeatSelection - UTCID03: seatHold.findFirst returns an existing hold from another caller", async (t) => {
  mockPricingService(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock({
        seatHoldFindFirst: async () => ({ id: "other-hold" }),
      }),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => confirmSeatSelection({ userId: "user-1" }, buildConfirmPayload()),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.details.conflictSeatIds, [SEAT_ID_1]);
      return true;
    },
  );
});

test("confirmSeatSelection - UTCID04: Both outbound and return legs resolvable with equal seat counts (1 seat each)", async (t) => {
  mockPricingService(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock(),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  const payload = {
    outbound: {
      scheduleId: SCHEDULE_ID_1,
      fromStationId: FROM_STATION_ID,
      toStationId: TO_STATION_ID,
      seatIds: [SEAT_ID_1],
    },
    return: {
      scheduleId: SCHEDULE_ID_2,
      fromStationId: TO_STATION_ID,
      toStationId: FROM_STATION_ID,
      seatIds: [SEAT_ID_2],
    },
  };
  const result = await confirmSeatSelection({ userId: "user-1" }, payload);
  assert.equal(result.session.id, SESSION_ID);
});

test("confirmSeatSelection - UTCID05: Requested seat id not present on the schedule's train", async (t) => {
  mockPricingService(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock(),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () =>
      confirmSeatSelection(
        { userId: "user-1" },
        buildConfirmPayload(["507f1f77bcf86cd799439099"]),
      ),
    (error) => {
      assert.equal(error.statusCode, 404);
      return true;
    },
  );
});

test('confirmSeatSelection - UTCID06: Seat status="BLOCKED", blockReason="Bảo trì", blockUntil=null', async (t) => {
  mockPricingService(t);
  const prismaMock = buildSeatSelectionPrismaMock();
  prismaMock.schedule.findUnique = async () => {
    return {
      id: SCHEDULE_ID_1,
      status: "ACTIVE",
      departureTime: new Date(Date.now() + 24 * 3600 * 1000),
      arrivalTime: new Date(Date.now() + 28 * 3600 * 1000),
      distance: 100,
      duration: 240,
      delayMinutes: 0,
      routeId: "route-1",
      route: {
        routeName: "Hà Nội - Hải Phòng",
        distance: 100,
        stations: [
          { stationId: FROM_STATION_ID, stopOrder: 1 },
          { stationId: TO_STATION_ID, stopOrder: 2 },
        ],
        isActive: true,
        startStation: {
          id: FROM_STATION_ID,
          stationCode: "HN",
          stationName: "Hà Nội",
        },
        endStation: {
          id: TO_STATION_ID,
          stationCode: "HP",
          stationName: "Hải Phòng",
        },
      },
      train: {
        id: TRAIN_ID_1,
        trainCode: "HP1",
        trainName: "Hải Phòng 1",
        trainType: "NORMAL",
        carriages: [
          {
            id: CARRIAGE_ID_1,
            carriageNumber: 1,
            carriageType: "NORMAL_SEAT",
            totalSeats: 40,
            seats: [
              {
                id: SEAT_ID_1,
                seatNumber: "1A",
                seatType: "NORMAL",
                status: "BLOCKED",
                blockReason: "Bảo trì",
                blockUntil: null,
              },
            ],
          },
        ],
      },
      scheduleStops: [
        {
          stationId: FROM_STATION_ID,
          stopOrder: 1,
          arrivalTime: null,
          departureTime: new Date(Date.now() + 24 * 3600 * 1000),
        },
        {
          stationId: TO_STATION_ID,
          stopOrder: 2,
          arrivalTime: new Date(Date.now() + 28 * 3600 * 1000),
          departureTime: null,
        },
      ],
    };
  };
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: prismaMock,
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => confirmSeatSelection({ userId: "user-1" }, buildConfirmPayload()),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.details.conflictSeatIds, [SEAT_ID_1]);
      return true;
    },
  );
});

test("confirmSeatSelection - UTCID07: pricing.getConfiguration returns effectiveRules=[] (no rule for carriage type)", async (t) => {
  mockPricingService(t, []);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock(),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => confirmSeatSelection({ userId: "user-1" }, buildConfirmPayload()),
    (error) => {
      assert.equal(error.statusCode, 409);
      return true;
    },
  );
});

test("confirmSeatSelection - UTCID08: No existing hold/booking on the seat (guest user)", async (t) => {
  mockPricingService(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock(),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await confirmSeatSelection(
    { guestToken: "guest-token-1" },
    buildConfirmPayload(),
  );
  assert.equal(result.session.id, SESSION_ID);
});

test("confirmSeatSelection - UTCID09: tx.booking.findFirst (inside transaction) returns a sold booking for the seat", async (t) => {
  mockPricingService(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock({
        bookingFindFirstTx: () => ({ id: "sold-booking" }),
      }),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => confirmSeatSelection({ userId: "user-1" }, buildConfirmPayload()),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.details.conflictSeatIds, [SEAT_ID_1]);
      return true;
    },
  );
});

test("confirmSeatSelection - UTCID10: confirmSeatSelection re-checks and reports the real conflicting seats when the transaction itself fails on a unique constraint (abnormal)", async (t) => {
  mockPricingService(t);
  let seatHoldFindFirstCalls = 0;
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildSeatSelectionPrismaMock({
        seatHoldFindFirst: async () => {
          seatHoldFindFirstCalls += 1;
          return seatHoldFindFirstCalls > 1 ? { id: "hold-raced-in" } : null;
        },
        transaction: async () => {
          const err = new Error("Unique constraint failed");
          err.code = "P2002";
          throw err;
        },
      }),
    },
  });
  const { confirmSeatSelection } = await import(
    `../src/services/seatSelection.service.js?case=${Date.now()}-${Math.random()}`
  );

  await assert.rejects(
    () => confirmSeatSelection({ userId: "user-1" }, buildConfirmPayload()),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.deepEqual(error.details.conflictSeatIds, [SEAT_ID_1]);
      return true;
    },
  );
});
