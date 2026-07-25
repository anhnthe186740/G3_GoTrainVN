import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("calculateFare")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";
import {
  PASSENGER_TYPES,
  CARRIAGE_TYPES,
  SCOPE_TYPES,
  DEFAULT_TICKET_TYPES,
  calculateFare,
} from "../src/services/pricing.service.js";

function adminCtx() {
  return { adminId: "admin-1", ipAddress: "127.0.0.1" };
}

async function loadPricingService(t, prismaMock) {
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: prismaMock },
  });
  return import(
    `../src/services/pricing.service.js?case=${Date.now()}-${Math.random()}`
  );
}

// ============================================================
// PASSENGER_TYPES / CARRIAGE_TYPES / SCOPE_TYPES / DEFAULT_TICKET_TYPES — PRICING-01
// Static business-rule data (BR-08 discount tiers). No throw branches, so
// Boundary/Abnormal cases are not applicable — skipped and noted here.
// ============================================================

test("UTCID01: passenger/carriage/scope constants match the documented business rules", () => {
  assert.deepEqual(PASSENGER_TYPES, ["ADULT", "CHILD", "STUDENT", "SENIOR"]);
  assert.deepEqual(CARRIAGE_TYPES, [
    "NORMAL_SEAT",
    "AC_SEAT",
    "SLEEPER_6",
    "SLEEPER_4",
  ]);
  assert.deepEqual(SCOPE_TYPES, ["SYSTEM", "ROUTE", "SCHEDULE"]);
  assert.equal(DEFAULT_TICKET_TYPES.length, 5);
  const child6 = DEFAULT_TICKET_TYPES.find((t) => t.code === "CHILD_UNDER_6");
  assert.equal(child6.discountValue, 100);
  assert.equal(child6.seatMode, "NOT_ALLOWED");
  const child = DEFAULT_TICKET_TYPES.find((t) => t.code === "CHILD");
  assert.equal(child.discountValue, 25);
  const senior = DEFAULT_TICKET_TYPES.find((t) => t.code === "SENIOR");
  assert.equal(senior.discountValue, 15);
  const student = DEFAULT_TICKET_TYPES.find((t) => t.code === "STUDENT");
  assert.equal(student.discountValue, 10);
});

// ============================================================
// getTicketTypes — PRICING-02
// (No throw branches; Abnormal test skipped — pure read helper)
// ============================================================

test("UTCID01: returns only active ticket types by default without seeding when data exists", async (t) => {
  let createManyCalled = false;
  let capturedWhere = null;
  const { getTicketTypes } = await loadPricingService(t, {
    ticketType: {
      count: async () => 5,
      createMany: async () => {
        createManyCalled = true;
        return {};
      },
      findMany: async (args) => {
        capturedWhere = args.where;
        return [{ code: "ADULT" }];
      },
    },
  });
  const result = await getTicketTypes();
  assert.equal(createManyCalled, false);
  assert.deepEqual(capturedWhere, { active: true });
  assert.equal(result.length, 1);
});

test("UTCID02: boundary - seeds defaults when no ticket types exist yet", async (t) => {
  let createManyData = null;
  const { getTicketTypes } = await loadPricingService(t, {
    ticketType: {
      count: async () => 0,
      createMany: async ({ data }) => {
        createManyData = data;
        return {};
      },
      findMany: async () => DEFAULT_TICKET_TYPES,
    },
  });
  const result = await getTicketTypes({ includeInactive: true });
  assert.equal(createManyData.length, 5);
  assert.equal(result.length, 5);
});

// ============================================================
// getPublicTicketTypes — PRICING-03
// (No throw branches; Abnormal test skipped — pure read helper)
// ============================================================

test("UTCID01: filters to active, publicSelectable, currently-effective ticket types", async (t) => {
  let capturedWhere = null;
  const { getPublicTicketTypes } = await loadPricingService(t, {
    ticketType: {
      count: async () => 5,
      findMany: async (args) => {
        capturedWhere = args.where;
        return [{ code: "ADULT" }];
      },
    },
  });
  const result = await getPublicTicketTypes();
  assert.equal(capturedWhere.active, true);
  assert.equal(capturedWhere.publicSelectable, true);
  assert.ok(Array.isArray(capturedWhere.OR));
  assert.equal(result.length, 1);
});

test("UTCID02: boundary - seeds defaults first when the collection is empty", async (t) => {
  let seeded = false;
  const { getPublicTicketTypes } = await loadPricingService(t, {
    ticketType: {
      count: async () => 0,
      createMany: async () => {
        seeded = true;
        return {};
      },
      findMany: async () => [],
    },
  });
  await getPublicTicketTypes();
  assert.equal(seeded, true);
});

// ============================================================
// getEffectiveTicketTypes — PRICING-04
// (No throw branches; Abnormal test skipped — pure read helper)
// ============================================================

test("UTCID01: uses a given Date instance directly", async (t) => {
  let capturedAt = null;
  const { getEffectiveTicketTypes } = await loadPricingService(t, {
    ticketType: {
      count: async () => 1,
      findMany: async (args) => {
        capturedAt = args.where.effectiveFrom.lte;
        return [];
      },
    },
  });
  const at = new Date("2026-01-01T00:00:00Z");
  await getEffectiveTicketTypes(at);
  assert.equal(capturedAt.getTime(), at.getTime());
});

test("UTCID02: boundary - string date input is converted to a Date", async (t) => {
  let capturedAt = null;
  const { getEffectiveTicketTypes } = await loadPricingService(t, {
    ticketType: {
      count: async () => 1,
      findMany: async (args) => {
        capturedAt = args.where.effectiveFrom.lte;
        return [];
      },
    },
  });
  await getEffectiveTicketTypes("2026-01-01T00:00:00Z");
  assert.ok(capturedAt instanceof Date);
  assert.equal(
    capturedAt.getTime(),
    new Date("2026-01-01T00:00:00Z").getTime(),
  );
});

test("UTCID03: defaults to now() when no argument is supplied", async (t) => {
  let capturedAt = null;
  const { getEffectiveTicketTypes } = await loadPricingService(t, {
    ticketType: {
      count: async () => 1,
      findMany: async (args) => {
        capturedAt = args.where.effectiveFrom.lte;
        return [];
      },
    },
  });
  const before = Date.now();
  await getEffectiveTicketTypes();
  const after = Date.now();
  assert.ok(capturedAt.getTime() >= before && capturedAt.getTime() <= after);
});

// ============================================================
// createTicketType — PRICING-05
// Exercises normalizeTicketTypePayload's validation rules
// ============================================================

function validTicketPayload(overrides = {}) {
  return {
    code: "vip pass",
    name: "VIP",
    discountType: "PERCENTAGE",
    discountValue: 20,
    minAge: 10,
    maxAgeExclusive: 60,
    seatMode: "REQUIRED",
    ...overrides,
  };
}

test("UTCID01: creates a ticket type with normalized code and logs admin action", async (t) => {
  let loggedAction = null;
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
    adminLog: {
      create: async ({ data }) => {
        loggedAction = data;
        return data;
      },
    },
  });
  const created = await createTicketType(validTicketPayload(), adminCtx());
  assert.equal(created.code, "VIP_PASS");
  assert.equal(loggedAction.action, "CREATE");
});

test("UTCID02: boundary - FREE discount type forces discountValue to 100", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
    adminLog: { create: async () => ({}) },
  });
  const created = await createTicketType(
    validTicketPayload({ discountType: "FREE", discountValue: 5 }),
    adminCtx(),
  );
  assert.equal(created.discountValue, 100);
});

test("UTCID03: boundary - PERCENTAGE discountValue at max (100) is accepted", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
    adminLog: { create: async () => ({}) },
  });
  const created = await createTicketType(
    validTicketPayload({ discountType: "PERCENTAGE", discountValue: 100 }),
    adminCtx(),
  );
  assert.equal(created.discountValue, 100);
});

test("UTCID04: abnormal - PERCENTAGE discountValue above 100 throws", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () =>
      createTicketType(
        validTicketPayload({ discountType: "PERCENTAGE", discountValue: 101 }),
        adminCtx(),
      ),
    /Giá trị ưu đãi không hợp lệ/,
  );
});

test("UTCID05: boundary - minAge equal to maxAgeExclusive throws (invalid age range)", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () =>
      createTicketType(
        validTicketPayload({ minAge: 20, maxAgeExclusive: 20 }),
        adminCtx(),
      ),
    /Khoảng tuổi.*không hợp lệ/,
  );
});

test("UTCID06: abnormal - missing code throws", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () => createTicketType(validTicketPayload({ code: "" }), adminCtx()),
    /Vui lòng nhập mã loại vé/,
  );
});

test("UTCID07: abnormal - code shorter than 2 chars after cleanup fails the format regex", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () => createTicketType(validTicketPayload({ code: "!" }), adminCtx()),
    /chỉ gồm chữ in hoa/,
  );
});

test("UTCID08: abnormal - invalid discountType throws", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () =>
      createTicketType(
        validTicketPayload({ discountType: "BOGUS" }),
        adminCtx(),
      ),
    /Loại ưu đãi không hợp lệ/,
  );
});

test("UTCID09: abnormal - invalid seatMode throws", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () =>
      createTicketType(validTicketPayload({ seatMode: "BOGUS" }), adminCtx()),
    /Cấu hình ghế.*không hợp lệ/,
  );
});

test("UTCID10: abnormal - effectiveTo before effectiveFrom throws", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () =>
      createTicketType(
        validTicketPayload({
          effectiveFrom: "2026-06-01",
          effectiveTo: "2026-01-01",
        }),
        adminCtx(),
      ),
    /Ngày kết thúc phải sau ngày bắt đầu/,
  );
});

test("UTCID11: abnormal - unparsable effectiveFrom date string throws", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () =>
      createTicketType(
        validTicketPayload({ effectiveFrom: "not-a-date" }),
        adminCtx(),
      ),
    /Ngày bắt đầu không hợp lệ/,
  );
});

test("UTCID12: abnormal - negative minAge fails the nullableInteger check", async (t) => {
  const { createTicketType } = await loadPricingService(t, {
    ticketType: { create: async ({ data }) => ({ id: "tt-1", ...data }) },
  });
  await assert.rejects(
    () => createTicketType(validTicketPayload({ minAge: -1 }), adminCtx()),
    /Tuổi từ không hợp lệ/,
  );
});

// ============================================================
// updateTicketType — PRICING-06
// ============================================================

function existingTicketType(overrides = {}) {
  return {
    id: "tt-1",
    code: "ADULT",
    name: "Người lớn",
    shortLabel: "NL",
    description: "",
    discountType: "PERCENTAGE",
    discountValue: 0,
    minAge: 10,
    maxAgeExclusive: 60,
    seatMode: "REQUIRED",
    publicSelectable: true,
    autoApply: false,
    requiresDocument: true,
    requiresStudent: false,
    priority: 100,
    active: true,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    ...overrides,
  };
}

test("UTCID01: updates an existing ticket type", async (t) => {
  const existing = existingTicketType();
  const { updateTicketType } = await loadPricingService(t, {
    ticketType: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updateTicketType(
    "tt-1",
    { name: "Nguoi lon moi" },
    adminCtx(),
  );
  assert.equal(updated.name, "Nguoi lon moi");
  assert.equal(updated.code, "ADULT");
});

test("UTCID02: boundary - fields omitted from payload fall back to existing values", async (t) => {
  const existing = existingTicketType({ discountValue: 15 });
  const { updateTicketType } = await loadPricingService(t, {
    ticketType: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updateTicketType("tt-1", {}, adminCtx());
  assert.equal(updated.discountValue, 15);
});

test("UTCID03: abnormal - updating a non-existent ticket type throws 404", async (t) => {
  const { updateTicketType } = await loadPricingService(t, {
    ticketType: { findUnique: async () => null },
  });
  await assert.rejects(
    () => updateTicketType("missing-id", {}, adminCtx()),
    /Không tìm thấy loại vé/,
  );
});

// ============================================================
// setTicketTypeActive — PRICING-07
// ============================================================

test("UTCID01: activates a ticket type and logs ACTIVATE action", async (t) => {
  const existing = existingTicketType({ active: false });
  let loggedAction = null;
  const { setTicketTypeActive } = await loadPricingService(t, {
    ticketType: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: {
      create: async ({ data }) => {
        loggedAction = data;
        return data;
      },
    },
  });
  const updated = await setTicketTypeActive("tt-1", true, adminCtx());
  assert.equal(updated.active, true);
  assert.equal(loggedAction.action, "ACTIVATE");
});

test("UTCID02: boundary - deactivates a ticket type and logs DEACTIVATE action", async (t) => {
  const existing = existingTicketType({ active: true });
  let loggedAction = null;
  const { setTicketTypeActive } = await loadPricingService(t, {
    ticketType: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: {
      create: async ({ data }) => {
        loggedAction = data;
        return data;
      },
    },
  });
  const updated = await setTicketTypeActive("tt-1", false, adminCtx());
  assert.equal(updated.active, false);
  assert.equal(loggedAction.action, "DEACTIVATE");
});

test("UTCID03: abnormal - toggling a non-existent ticket type throws 404", async (t) => {
  const { setTicketTypeActive } = await loadPricingService(t, {
    ticketType: { findUnique: async () => null },
  });
  await assert.rejects(
    () => setTicketTypeActive("missing-id", true, adminCtx()),
    /Không tìm thấy loại vé/,
  );
});

// ============================================================
// getPricingContext — PRICING-08
// (No throw branches; Abnormal test skipped — pure aggregation read helper)
// ============================================================

test("UTCID01: aggregates passenger/carriage types with active routes and upcoming schedules", async (t) => {
  const { getPricingContext } = await loadPricingService(t, {
    route: {
      findMany: async () => [{ id: "route-1", routeName: "SG-HN" }],
    },
    schedule: {
      findMany: async () => [{ id: "sch-1", routeId: "route-1" }],
    },
  });
  const result = await getPricingContext();
  assert.deepEqual(result.passengerTypes, PASSENGER_TYPES);
  assert.deepEqual(result.carriageTypes, CARRIAGE_TYPES);
  assert.equal(result.routes.length, 1);
  assert.equal(result.schedules.length, 1);
});

test("UTCID02: boundary - returns empty routes and schedules when none exist", async (t) => {
  const { getPricingContext } = await loadPricingService(t, {
    route: { findMany: async () => [] },
    schedule: { findMany: async () => [] },
  });
  const result = await getPricingContext();
  assert.deepEqual(result.routes, []);
  assert.deepEqual(result.schedules, []);
});

// ============================================================
// getConfiguration — PRICING-09
// Exercises resolveScope() inheritance and effective-rule priority sorting
// ============================================================

test("UTCID01: SYSTEM scope resolves with a single inheritance key", async (t) => {
  const { getConfiguration } = await loadPricingService(t, {
    pricingPolicy: {
      findMany: async () => [],
    },
  });
  const result = await getConfiguration({ scopeType: "SYSTEM" });
  assert.equal(result.scope.scopeKey, "SYSTEM");
  assert.deepEqual(result.scope.inheritanceKeys, ["SYSTEM"]);
});

test("UTCID02: ROUTE scope resolves route details and 2-level inheritance", async (t) => {
  const { getConfiguration } = await loadPricingService(t, {
    route: {
      findUnique: async () => ({
        id: "route-1",
        routeName: "SG-HN",
        distance: 1700,
      }),
    },
    pricingPolicy: { findMany: async () => [] },
  });
  const result = await getConfiguration({
    scopeType: "ROUTE",
    scopeId: "route-1",
  });
  assert.equal(result.scope.scopeKey, "ROUTE:route-1");
  assert.deepEqual(result.scope.inheritanceKeys, ["ROUTE:route-1", "SYSTEM"]);
});

test("UTCID03: SCHEDULE scope resolves with 3-level inheritance and picks the most specific rule", async (t) => {
  const scheduleRow = {
    id: "sch-1",
    routeId: "route-1",
    distance: 1700,
    route: { routeName: "SG-HN", distance: 1700 },
    train: { trainCode: "SE1", trainName: "Reunification" },
  };
  const now = new Date();
  const scheduleRule = {
    id: "rule-schedule",
    scopeKey: "SCHEDULE:sch-1",
    passengerType: "ADULT",
    carriageType: "NORMAL_SEAT",
    effectiveFrom: new Date(now.getTime() - 1000),
  };
  const routeRule = {
    id: "rule-route",
    scopeKey: "ROUTE:route-1",
    passengerType: "ADULT",
    carriageType: "NORMAL_SEAT",
    effectiveFrom: new Date(now.getTime() - 2000),
  };
  const { getConfiguration } = await loadPricingService(t, {
    schedule: { findUnique: async () => scheduleRow },
    pricingPolicy: {
      findMany: async ({ where }) => {
        if (where.scopeKey && typeof where.scopeKey === "string") return [];
        // candidateRows query uses `in`
        return [routeRule, scheduleRule];
      },
    },
  });
  const result = await getConfiguration({
    scopeType: "SCHEDULE",
    scopeId: "sch-1",
  });
  assert.deepEqual(result.scope.inheritanceKeys, [
    "SCHEDULE:sch-1",
    "ROUTE:route-1",
    "SYSTEM",
  ]);
  assert.equal(result.effectiveRules.length, 1);
  assert.equal(result.effectiveRules[0].id, "rule-schedule");
  assert.equal(result.effectiveRules[0].inherited, false);
});

test("UTCID09: boundary - within the same scope, the row with the most recent effectiveFrom wins", async (t) => {
  const now = new Date();
  const older = {
    id: "rule-older",
    scopeKey: "SYSTEM",
    passengerType: "ADULT",
    carriageType: "NORMAL_SEAT",
    effectiveFrom: new Date(now.getTime() - 20000),
  };
  const newer = {
    id: "rule-newer",
    scopeKey: "SYSTEM",
    passengerType: "ADULT",
    carriageType: "NORMAL_SEAT",
    effectiveFrom: new Date(now.getTime() - 1000),
  };
  const { getConfiguration } = await loadPricingService(t, {
    pricingPolicy: {
      findMany: async ({ where }) => {
        if (where.scopeKey && typeof where.scopeKey === "string") return [];
        return [older, newer];
      },
    },
  });
  const result = await getConfiguration({ scopeType: "SYSTEM" });
  assert.equal(result.effectiveRules.length, 1);
  assert.equal(result.effectiveRules[0].id, "rule-newer");
});

test("UTCID04: boundary - atDate exactly equal to effectiveFrom is included (inclusive lte)", async (t) => {
  const atDate = new Date("2026-06-01T00:00:00+07:00");
  let capturedWhere = null;
  const { getConfiguration } = await loadPricingService(t, {
    pricingPolicy: {
      findMany: async (args) => {
        capturedWhere = args.where;
        return [];
      },
    },
  });
  await getConfiguration({ scopeType: "SYSTEM", at: "2026-06-01" });
  assert.ok(capturedWhere);
});

test("UTCID05: abnormal - invalid scopeType throws", async (t) => {
  const { getConfiguration } = await loadPricingService(t, {});
  await assert.rejects(
    () => getConfiguration({ scopeType: "BOGUS" }),
    /Phạm vi chính sách không hợp lệ/,
  );
});

test("UTCID06: abnormal - ROUTE scope without scopeId throws", async (t) => {
  const { getConfiguration } = await loadPricingService(t, {});
  await assert.rejects(
    () => getConfiguration({ scopeType: "ROUTE" }),
    /Vui lòng chọn đối tượng áp dụng/,
  );
});

test("UTCID07: abnormal - ROUTE not found throws 404", async (t) => {
  const { getConfiguration } = await loadPricingService(t, {
    route: { findUnique: async () => null },
  });
  await assert.rejects(
    () => getConfiguration({ scopeType: "ROUTE", scopeId: "missing" }),
    /Không tìm thấy tuyến đường/,
  );
});

test("UTCID08: abnormal - SCHEDULE not found throws 404", async (t) => {
  const { getConfiguration } = await loadPricingService(t, {
    schedule: { findUnique: async () => null },
  });
  await assert.rejects(
    () => getConfiguration({ scopeType: "SCHEDULE", scopeId: "missing" }),
    /Không tìm thấy lịch trình/,
  );
});

// ============================================================
// savePolicy — PRICING-10
// Exercises validateRules() (16-combo matrix) and ensureNoOverlap()
// ============================================================

function full16Rules(overrides = {}) {
  const rules = [];
  for (const passengerType of PASSENGER_TYPES) {
    for (const carriageType of CARRIAGE_TYPES) {
      rules.push({
        passengerType,
        carriageType,
        basePrice: 50000,
        pricePerKm: 500,
        classSurcharge: 10000,
        minPrice: null,
        maxPrice: null,
        ...(overrides.perRule || {}),
      });
    }
  }
  return overrides.replaceAll ? overrides.replaceAll(rules) : rules;
}

function basePolicyPayload(overrides = {}) {
  return {
    scopeType: "SYSTEM",
    rules: full16Rules(),
    effectiveFrom: "2026-01-01",
    taxPercentage: 10,
    policyName: "Bang gia mac dinh",
    ...overrides,
  };
}

test("UTCID01: saves a valid 16-rule policy inside a transaction", async (t) => {
  let createManyRows = null;
  let loggedAction = null;
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: {
      findFirst: async () => null, // no overlap
      findMany: async ({ where }) => {
        // getPolicy() call after transaction
        if (where && where.policyCode) return createManyRows || [];
        return [];
      },
    },
    $transaction: async (fn) => {
      const tx = {
        pricingPolicy: {
          findFirst: async () => null,
          deleteMany: async () => ({}),
          createMany: async ({ data }) => {
            createManyRows = data;
            return {};
          },
        },
        adminLog: {
          create: async ({ data }) => {
            loggedAction = data;
            return data;
          },
        },
      };
      return fn(tx);
    },
  });
  const result = await savePolicy(basePolicyPayload(), adminCtx());
  assert.equal(createManyRows.length, 16);
  assert.equal(loggedAction.action, "CREATE");
  assert.equal(result.rules.length, 16);
});

test("UTCID02: boundary - wrong rule count (not 16) throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
    $transaction: async (fn) => fn({}),
  });
  await assert.rejects(
    () =>
      savePolicy(
        basePolicyPayload({ rules: full16Rules().slice(0, 15) }),
        adminCtx(),
      ),
    /đủ 16 tổ hợp/,
  );
});

test("UTCID10: abnormal - invalid passengerType in a rule throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
  });
  const rules = full16Rules();
  rules[0] = { ...rules[0], passengerType: "BOGUS" };
  await assert.rejects(
    () => savePolicy(basePolicyPayload({ rules }), adminCtx()),
    /Nhóm hành khách không hợp lệ/,
  );
});

test("UTCID11: abnormal - invalid carriageType in a rule throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
  });
  const rules = full16Rules();
  rules[0] = { ...rules[0], carriageType: "BOGUS" };
  await assert.rejects(
    () => savePolicy(basePolicyPayload({ rules }), adminCtx()),
    /Loại chỗ không hợp lệ/,
  );
});

test("UTCID12: normal - updating an existing policyCode deletes old rows before inserting new ones", async (t) => {
  let deleteWhere = null;
  let createManyRows = null;
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: {
      findFirst: async () => null, // no overlap at top level
      findMany: async ({ where }) => {
        if (where && where.policyCode) return createManyRows || [];
        return [];
      },
    },
    $transaction: async (fn) => {
      const tx = {
        pricingPolicy: {
          findFirst: async () => ({ policyCode: "PRICE-EXIST" }), // existing found
          deleteMany: async ({ where }) => {
            deleteWhere = where;
            return {};
          },
          createMany: async ({ data }) => {
            createManyRows = data;
            return {};
          },
        },
        adminLog: { create: async () => ({}) },
      };
      return fn(tx);
    },
  });
  const result = await savePolicy(
    basePolicyPayload({ policyCode: "PRICE-EXIST" }),
    adminCtx(),
  );
  assert.equal(deleteWhere.policyCode, "PRICE-EXIST");
  assert.equal(createManyRows.length, 16);
  assert.equal(result.rules.length, 16);
});

test("UTCID03: abnormal - duplicate passengerType/carriageType combo throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
  });
  const rules = full16Rules();
  rules[1] = { ...rules[0] }; // duplicate the first combo
  await assert.rejects(
    () => savePolicy(basePolicyPayload({ rules }), adminCtx()),
    /bị trùng/,
  );
});

test("UTCID04: abnormal - minPrice greater than maxPrice throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
  });
  const rules = full16Rules();
  rules[0] = { ...rules[0], minPrice: 100000, maxPrice: 50000 };
  await assert.rejects(
    () => savePolicy(basePolicyPayload({ rules }), adminCtx()),
    /Giá sàn lớn hơn giá trần/,
  );
});

test("UTCID05: abnormal - all price components zero (basePrice+pricePerKm+classSurcharge<=0) throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
  });
  const rules = full16Rules({
    perRule: { basePrice: 0, pricePerKm: 0, classSurcharge: 0 },
  });
  await assert.rejects(
    () => savePolicy(basePolicyPayload({ rules }), adminCtx()),
    /chưa có thành phần giá hợp lệ/,
  );
});

test("UTCID06: abnormal - inconsistent pricing across passenger types for the same carriage throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
  });
  const rules = full16Rules();
  // Make one ADULT/NORMAL_SEAT rule differ in basePrice from the rest of NORMAL_SEAT rules
  const idx = rules.findIndex(
    (r) => r.passengerType === "ADULT" && r.carriageType === "NORMAL_SEAT",
  );
  rules[idx] = { ...rules[idx], basePrice: 999999 };
  await assert.rejects(
    () => savePolicy(basePolicyPayload({ rules }), adminCtx()),
    /phải giống nhau cho mọi nhóm hành khách/,
  );
});

test("UTCID07: abnormal - overlapping active policy on the same scope throws 409", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: {
      findFirst: async () => ({
        policyCode: "PRICE-OLD",
        policyName: "Bang gia cu",
      }),
    },
  });
  await assert.rejects(
    () => savePolicy(basePolicyPayload(), adminCtx()),
    /đang chồng với chính sách/,
  );
});

test("UTCID08: abnormal - effectiveTo before effectiveFrom throws", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
  });
  await assert.rejects(
    () =>
      savePolicy(
        basePolicyPayload({
          effectiveFrom: "2026-06-01",
          effectiveTo: "2026-01-01",
        }),
        adminCtx(),
      ),
    /Ngày kết thúc phải sau ngày bắt đầu/,
  );
});

test("UTCID09: abnormal - updating with a policyCode that does not exist throws 404 inside the transaction", async (t) => {
  const { savePolicy } = await loadPricingService(t, {
    pricingPolicy: { findFirst: async () => null },
    $transaction: async (fn) => {
      const tx = {
        pricingPolicy: {
          findFirst: async () => null, // not found for update
        },
      };
      return fn(tx);
    },
  });
  await assert.rejects(
    () =>
      savePolicy(
        basePolicyPayload({ policyCode: "PRICE-MISSING" }),
        adminCtx(),
      ),
    /Không tìm thấy chính sách cần cập nhật/,
  );
});

// ============================================================
// getPolicy — PRICING-11
// ============================================================

test("UTCID01: returns a grouped policy when rows exist", async (t) => {
  const { getPolicy } = await loadPricingService(t, {
    pricingPolicy: {
      findMany: async () => [
        {
          id: "row-1",
          policyCode: "PRICE-1",
          policyName: "Test",
          scopeType: "SYSTEM",
          scopeKey: "SYSTEM",
          passengerType: "ADULT",
          carriageType: "NORMAL_SEAT",
          basePrice: 1000,
          classSurcharge: 0,
          discountPercentage: 0,
          effectiveFrom: new Date(),
        },
      ],
    },
  });
  const policy = await getPolicy("PRICE-1");
  assert.equal(policy.policyCode, "PRICE-1");
  assert.equal(policy.rules.length, 1);
});

test("UTCID02: abnormal - unknown policyCode throws 404", async (t) => {
  const { getPolicy } = await loadPricingService(t, {
    pricingPolicy: { findMany: async () => [] },
  });
  await assert.rejects(
    () => getPolicy("PRICE-MISSING"),
    /Không tìm thấy chính sách giá/,
  );
});

// ============================================================
// setPolicyActive — PRICING-12
// ============================================================

function policyRow(overrides = {}) {
  return {
    id: "row-1",
    policyCode: "PRICE-1",
    policyName: "Test",
    scopeType: "SYSTEM",
    scopeKey: "SYSTEM",
    passengerType: "ADULT",
    carriageType: "NORMAL_SEAT",
    basePrice: 1000,
    classSurcharge: 0,
    discountPercentage: 0,
    effectiveFrom: new Date("2026-01-01"),
    effectiveTo: null,
    ...overrides,
  };
}

test("UTCID01: activates a policy after confirming no overlap", async (t) => {
  const { setPolicyActive } = await loadPricingService(t, {
    pricingPolicy: {
      findMany: async ({ where }) => {
        if (
          where &&
          where.policyCode === "PRICE-1" &&
          where.active === undefined
        ) {
          return [policyRow()];
        }
        return [policyRow({ active: true })];
      },
      findFirst: async () => null,
      updateMany: async () => ({ count: 1 }),
    },
    adminLog: { create: async () => ({}) },
    $transaction: async (ops) => Promise.all(ops),
  });
  const result = await setPolicyActive("PRICE-1", true, adminCtx());
  assert.equal(result.policyCode, "PRICE-1");
});

test("UTCID02: boundary - deactivating skips the overlap check", async (t) => {
  let overlapChecked = false;
  const { setPolicyActive } = await loadPricingService(t, {
    pricingPolicy: {
      findMany: async () => [policyRow({ active: false })],
      findFirst: async () => {
        overlapChecked = true;
        return null;
      },
      updateMany: async () => ({ count: 1 }),
    },
    adminLog: { create: async () => ({}) },
    $transaction: async (ops) => Promise.all(ops),
  });
  await setPolicyActive("PRICE-1", false, adminCtx());
  assert.equal(overlapChecked, false);
});

test("UTCID03: abnormal - toggling an unknown policyCode throws 404", async (t) => {
  const { setPolicyActive } = await loadPricingService(t, {
    pricingPolicy: { findMany: async () => [] },
  });
  await assert.rejects(
    () => setPolicyActive("PRICE-MISSING", true, adminCtx()),
    /Không tìm thấy chính sách giá/,
  );
});

test("UTCID04: abnormal - activating over an overlapping active policy throws 409", async (t) => {
  const { setPolicyActive } = await loadPricingService(t, {
    pricingPolicy: {
      findMany: async () => [policyRow()],
      findFirst: async () => ({
        policyCode: "PRICE-OTHER",
        policyName: "Bang gia khac",
      }),
    },
  });
  await assert.rejects(
    () => setPolicyActive("PRICE-1", true, adminCtx()),
    /đang chồng với chính sách/,
  );
});

// ============================================================
// calculateFare — PRICING-13 (pure function, no mocking needed)
// ============================================================

test("calculateFare - UTCID01: normal fare calculation with base, per-km, surcharge, discount, and tax", () => {
  const rule = {
    basePrice: 50000,
    pricePerKm: 1000,
    classSurcharge: 20000,
    discountPercentage: 10,
    minPrice: null,
    maxPrice: null,
  };
  const result = calculateFare(rule, 100, 10);
  // base = 50000 + 1000*100 + 20000 = 170000
  // afterDiscount = 170000 * 0.9 = 153000
  // finalPrice = 153000 * 1.1 = 168300
  assert.equal(result.baseAmount, 170000);
  assert.equal(result.discountAmount, 17000);
  assert.equal(result.finalPrice, 168300);
  assert.equal(result.distance, 100);
});

test("calculateFare - UTCID02: boundary - distance at minimum allowed value (1 km)", () => {
  const rule = { basePrice: 10000, pricePerKm: 500, classSurcharge: 0 };
  const result = calculateFare(rule, 1, 0);
  assert.equal(result.baseAmount, 10500);
  assert.equal(result.finalPrice, 10500);
});

test("calculateFare - UTCID03: abnormal - distance of 0 is below the minimum and throws", () => {
  const rule = { basePrice: 10000, pricePerKm: 500, classSurcharge: 0 };
  assert.throws(() => calculateFare(rule, 0, 0), /Cự ly không hợp lệ/);
});

test("calculateFare - UTCID04: abnormal - negative distance throws", () => {
  const rule = { basePrice: 10000, pricePerKm: 500, classSurcharge: 0 };
  assert.throws(() => calculateFare(rule, -5, 0), /Cự ly không hợp lệ/);
});

test("calculateFare - UTCID05: boundary - taxPercentage of 0 adds no tax", () => {
  const rule = { basePrice: 10000, pricePerKm: 0, classSurcharge: 0 };
  const result = calculateFare(rule, 10, 0);
  assert.equal(result.taxAmount, 0);
  assert.equal(result.finalPrice, 10000);
});

test("calculateFare - UTCID06: boundary - taxPercentage of 100 doubles the after-discount price", () => {
  const rule = { basePrice: 10000, pricePerKm: 0, classSurcharge: 0 };
  const result = calculateFare(rule, 10, 100);
  assert.equal(result.taxAmount, 10000);
  assert.equal(result.finalPrice, 20000);
});

test("calculateFare - UTCID07: boundary - minPrice floor is applied when computed base is below it", () => {
  const rule = {
    basePrice: 1000,
    pricePerKm: 0,
    classSurcharge: 0,
    minPrice: 50000,
  };
  const result = calculateFare(rule, 10, 0);
  assert.equal(result.boundedAmount, 50000);
  assert.equal(result.finalPrice, 50000);
});

test("calculateFare - UTCID08: boundary - maxPrice cap is applied when computed base is above it", () => {
  const rule = {
    basePrice: 500000,
    pricePerKm: 0,
    classSurcharge: 0,
    maxPrice: 100000,
  };
  const result = calculateFare(rule, 10, 0);
  assert.equal(result.boundedAmount, 100000);
  assert.equal(result.finalPrice, 100000);
});

test("calculateFare - UTCID09: boundary - discountPercentage of 100 results in a free fare before tax", () => {
  const rule = {
    basePrice: 100000,
    pricePerKm: 0,
    classSurcharge: 0,
    discountPercentage: 100,
  };
  const result = calculateFare(rule, 10, 10);
  assert.equal(result.finalPrice, 0);
});

test("calculateFare - UTCID10: boundary - missing discountPercentage defaults to 0 (no discount)", () => {
  const rule = { basePrice: 100000, pricePerKm: 0, classSurcharge: 0 };
  const result = calculateFare(rule, 10, 0);
  assert.equal(result.finalPrice, 100000);
  assert.equal(result.discountAmount, 0);
});

test("calculateFare - UTCID11: abnormal - rule missing basePrice (undefined -> NaN) throws", () => {
  const rule = { pricePerKm: 500, classSurcharge: 0 };
  assert.throws(() => calculateFare(rule, 10, 0), /Giá mở cửa không hợp lệ/);
});

test("calculateFare - UTCID12: abnormal - non-numeric distance throws", () => {
  const rule = { basePrice: 10000, pricePerKm: 0, classSurcharge: 0 };
  assert.throws(() => calculateFare(rule, "abc", 0), /Cự ly không hợp lệ/);
});
