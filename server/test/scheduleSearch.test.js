import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("searchJourneys")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";

const FROM_ID = "aaaaaaaaaaaaaaaaaaaaaaaa";
const TO_ID = "bbbbbbbbbbbbbbbbbbbbbbbb";

function vnDateStr(offsetDays) {
  const d = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function stationFixtures() {
  return [
    { id: FROM_ID, stationCode: "SGN", stationName: "Ga Sài Gòn", city: "HCM" },
    { id: TO_ID, stationCode: "HAN", stationName: "Ga Hà Nội", city: "Hà Nội" },
  ];
}

function scheduleFixture({
  dateStr,
  hour = 10,
  status = "ACTIVE",
  delayMinutes = 0,
  routeActive = true,
  carriages,
  id = "schedule-1",
} = {}) {
  return {
    id,
    trainId: "train-1",
    routeId: "route-1",
    startStationId: FROM_ID,
    endStationId: TO_ID,
    departureTime: `${dateStr}T${String(hour).padStart(2, "0")}:00:00.000+07:00`,
    arrivalTime: `${dateStr}T${String(hour + 4).padStart(2, "0")}:00:00.000+07:00`,
    distance: 1000,
    duration: 240,
    status,
    delayMinutes,
    notes: null,
    route: {
      id: "route-1",
      routeName: "SGN - HAN",
      distance: 1000,
      estimatedDuration: 240,
      stations: [],
      isActive: routeActive,
      startStation: {
        id: FROM_ID,
        stationCode: "SGN",
        stationName: "Ga Sài Gòn",
      },
      endStation: { id: TO_ID, stationCode: "HAN", stationName: "Ga Hà Nội" },
    },
    train: {
      id: "train-1",
      trainCode: "SE1",
      trainName: "Thống Nhất",
      trainType: "SE",
      carriages: carriages || [
        {
          id: "carriage-1",
          carriageType: "NORMAL_SEAT",
          totalSeats: 40,
          seats: Array.from({ length: 40 }, (_, i) => ({
            id: `seat-${i}`,
            status: "AVAILABLE",
          })),
        },
      ],
    },
    scheduleStops: [],
  };
}

function buildPrismaMock({
  stations = stationFixtures(),
  schedules = [],
  bookings = [],
  holds = [],
} = {}) {
  return {
    station: {
      findMany: async () => stations,
    },
    schedule: {
      findMany: async () => schedules,
    },
    booking: {
      findMany: async () => bookings,
    },
    seatHold: {
      findMany: async () => holds,
    },
  };
}

function buildPricingMock({ rules = null, price = 100000 } = {}) {
  const effectiveRules = rules ?? [
    { passengerType: "ADULT", carriageType: "NORMAL_SEAT", taxPercentage: 0 },
  ];
  return {
    getConfiguration: async () => ({ effectiveRules }),
    calculateFare: (rule) => ({ finalPrice: price }),
  };
}

async function loadService() {
  return import(
    `../src/services/scheduleSearch.service.js?case=${Date.now()}-${Math.random()}`
  );
}

function baseParams(overrides = {}) {
  return {
    fromStationId: FROM_ID,
    toStationId: TO_ID,
    departureDate: vnDateStr(1),
    ...overrides,
  };
}

// ---------- Normal ----------

test("searchJourneys - UTCID01: one-way search returns priced and available outbound journeys", async (t) => {
  const dateStr = vnDateStr(1);
  const schedule = scheduleFixture({ dateStr });
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock({ schedules: [schedule] }) },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(baseParams({ departureDate: dateStr }));

  assert.equal(result.outbound.length, 1);
  assert.equal(result.outbound[0].trainCode, "SE1");
  assert.equal(result.outbound[0].pricing[0].price, 100000);
  assert.equal(result.outbound[0].availability[0].availableSeats, 40);
  assert.deepEqual(result.return, []);
  assert.equal(result.query.fromStation.stationName, "Ga Sài Gòn");
});

test("searchJourneys - UTCID02: round trip search returns both outbound and return legs", async (t) => {
  const outDate = vnDateStr(1);
  const backDate = vnDateStr(3);
  const outboundSchedule = scheduleFixture({
    dateStr: outDate,
    id: "sched-out",
  });
  const returnSchedule = scheduleFixture({
    dateStr: backDate,
    id: "sched-back",
  });
  returnSchedule.startStationId = TO_ID;
  returnSchedule.endStationId = FROM_ID;
  returnSchedule.route.startStation = {
    id: TO_ID,
    stationCode: "HAN",
    stationName: "Ga Hà Nội",
  };
  returnSchedule.route.endStation = {
    id: FROM_ID,
    stationCode: "SGN",
    stationName: "Ga Sài Gòn",
  };

  let callCount = 0;
  const prismaMock = buildPrismaMock({ schedules: [] });
  prismaMock.schedule.findMany = async () => {
    callCount += 1;
    return callCount === 1 ? [outboundSchedule] : [returnSchedule];
  };
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: prismaMock },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(
    baseParams({ departureDate: outDate, returnDate: backDate }),
  );

  assert.equal(result.outbound.length, 1);
  assert.equal(result.return.length, 1);
  assert.equal(result.query.returnDate, backDate);
});

test("searchJourneys - UTCID03: a delayed schedule is still found using its shifted departure time", async (t) => {
  const dateStr = vnDateStr(1);
  const schedule = scheduleFixture({
    dateStr,
    hour: 20,
    status: "DELAYED",
    delayMinutes: 90,
  });
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock({ schedules: [schedule] }) },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(baseParams({ departureDate: dateStr }));

  assert.equal(result.outbound.length, 1);
  assert.equal(result.outbound[0].status, "DELAYED");
  assert.equal(result.outbound[0].delayMinutes, 90);
});

test("searchJourneys - UTCID04: booked seats and active holds reduce available seat counts", async (t) => {
  const dateStr = vnDateStr(1);
  const schedule = scheduleFixture({ dateStr, id: "schedule-1" });
  const bookings = [
    {
      scheduleId: "schedule-1",
      status: "CONFIRMED",
      expiresAt: null,
      bookingDetails: [
        {
          seatId: "seat-0",
          seat: { carriage: { carriageType: "NORMAL_SEAT" } },
        },
      ],
    },
  ];
  const holds = [
    { scheduleId: "schedule-1", seatId: "seat-1", carriageType: "NORMAL_SEAT" },
  ];
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildPrismaMock({ schedules: [schedule], bookings, holds }),
    },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(baseParams({ departureDate: dateStr }));

  assert.equal(result.outbound[0].availability[0].bookedSeats, 2);
  assert.equal(result.outbound[0].availability[0].availableSeats, 38);
});

// ---------- Boundary ----------

test("searchJourneys - UTCID05: searching for today (not the past) is accepted even with no candidates", async (t) => {
  const dateStr = vnDateStr(0);
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock({ schedules: [] }) },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(baseParams({ departureDate: dateStr }));

  assert.deepEqual(result.outbound, []);
  assert.equal(result.query.departureDate, dateStr);
});

test("searchJourneys - UTCID06: a matched schedule with no priceable carriage type is excluded from results", async (t) => {
  const dateStr = vnDateStr(1);
  const schedule = scheduleFixture({ dateStr });
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock({ schedules: [schedule] }) },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock({ rules: [] }),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(baseParams({ departureDate: dateStr }));

  assert.deepEqual(result.outbound, []);
});

test("searchJourneys - UTCID07: return date equal to departure date is accepted (same-day round trip)", async (t) => {
  const dateStr = vnDateStr(1);
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock({ schedules: [] }) },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(
    baseParams({ departureDate: dateStr, returnDate: dateStr }),
  );

  assert.deepEqual(result.outbound, []);
  assert.deepEqual(result.return, []);
});

test("searchJourneys - UTCID08: an expired PENDING booking does not count toward booked seats", async (t) => {
  const dateStr = vnDateStr(1);
  const schedule = scheduleFixture({ dateStr, id: "schedule-1" });
  const bookings = [
    {
      scheduleId: "schedule-1",
      status: "PENDING",
      expiresAt: new Date(Date.now() - 60 * 1000),
      bookingDetails: [
        {
          seatId: "seat-0",
          seat: { carriage: { carriageType: "NORMAL_SEAT" } },
        },
      ],
    },
  ];
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildPrismaMock({ schedules: [schedule], bookings }),
    },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });

  const { searchJourneys } = await loadService();
  const result = await searchJourneys(baseParams({ departureDate: dateStr }));

  assert.equal(result.outbound[0].availability[0].bookedSeats, 0);
  assert.equal(result.outbound[0].availability[0].availableSeats, 40);
});

// ---------- Abnormal ----------

test("searchJourneys - UTCID09: rejects a search missing a required field", async (t) => {
  const { prismaMock } = { prismaMock: buildPrismaMock() };
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: prismaMock },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });
  const { searchJourneys } = await loadService();

  await assert.rejects(
    () => searchJourneys(baseParams({ fromStationId: "" })),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Vui lòng chọn ga đi/);
      return true;
    },
  );
});

test("searchJourneys - UTCID10: rejects malformed station ids", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock() },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });
  const { searchJourneys } = await loadService();

  await assert.rejects(
    () => searchJourneys(baseParams({ fromStationId: "not-an-object-id" })),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Mã ga không hợp lệ/);
      return true;
    },
  );
});

test("searchJourneys - UTCID11: rejects identical origin and destination stations", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock() },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });
  const { searchJourneys } = await loadService();

  await assert.rejects(
    () => searchJourneys(baseParams({ toStationId: FROM_ID })),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /không được trùng nhau/);
      return true;
    },
  );
});

test("searchJourneys - UTCID12: rejects an invalid departure date format", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock() },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });
  const { searchJourneys } = await loadService();

  await assert.rejects(
    () => searchJourneys(baseParams({ departureDate: "2026-02-30" })),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Ngày đi không hợp lệ/);
      return true;
    },
  );
});

test("searchJourneys - UTCID13: rejects a departure date in the past", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock() },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });
  const { searchJourneys } = await loadService();

  await assert.rejects(
    () => searchJourneys(baseParams({ departureDate: "2020-01-01" })),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /không được ở quá khứ/);
      return true;
    },
  );
});

test("searchJourneys - UTCID14: rejects a return date earlier than the departure date", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: buildPrismaMock() },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });
  const { searchJourneys } = await loadService();

  await assert.rejects(
    () =>
      searchJourneys(
        baseParams({ departureDate: vnDateStr(3), returnDate: vnDateStr(1) }),
      ),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /Ngày về không được trước ngày đi/);
      return true;
    },
  );
});

test("searchJourneys - UTCID15: rejects a search where a station does not exist or is inactive", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: buildPrismaMock({ stations: [stationFixtures()[0]] }),
    },
  });
  t.mock.module("../src/services/pricing.service.js", {
    namedExports: buildPricingMock(),
  });
  const { searchJourneys } = await loadService();

  await assert.rejects(
    () => searchJourneys(baseParams()),
    (err) => {
      assert.equal(err.statusCode, 404);
      assert.match(err.message, /không tồn tại hay đã ngừng hoạt động/);
      return true;
    },
  );
});
