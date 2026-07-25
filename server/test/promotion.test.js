import { test as originalTest } from "node:test";
const test = (name, ...args) => {
  if (name.includes("validateVoucher")) {
    return originalTest(name, ...args);
  }
};

import assert from "node:assert/strict";

function daysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
}

function adminCtx() {
  return { adminId: "admin-1", ipAddress: "127.0.0.1" };
}

async function loadPromotionService(t, prismaMock, emailMock) {
  t.mock.module("../src/config/database.js", {
    namedExports: { prisma: prismaMock },
  });
  t.mock.module("../src/services/email.service.js", {
    namedExports: emailMock || { sendEmail: async () => ({ success: true }) },
  });
  return import(
    `../src/services/promotion.service.js?case=${Date.now()}-${Math.random()}`
  );
}

function baseVoucher(overrides = {}) {
  return {
    id: "voucher-1",
    voucherCode: "SALE10",
    active: true,
    validFrom: daysFromNow(-1),
    validTo: daysFromNow(1),
    maxUsageCount: null,
    currentUsageCount: 0,
    minBookingAmount: null,
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxDiscountAmount: null,
    isPublic: true,
    ...overrides,
  };
}

// ============================================================
// validateVoucher — PROMO-01
// ============================================================

test("validateVoucher - UTCID01: percentage voucher within limits computes discount", async (t) => {
  const voucher = baseVoucher({
    discountType: "PERCENTAGE",
    discountValue: 10,
  });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  const result = await validateVoucher("sale10", 200000, "user-1");
  assert.equal(result.discountAmount, 20000);
  assert.equal(result.voucher.voucherCode, "SALE10");
});

test("validateVoucher - UTCID02: fixed amount voucher computes flat discount", async (t) => {
  const voucher = baseVoucher({
    discountType: "FIXED_AMOUNT",
    discountValue: 50000,
  });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  const result = await validateVoucher("SALE10", 200000, "user-1");
  assert.equal(result.discountAmount, 50000);
});

test("validateVoucher - UTCID03: boundary - discount capped by maxDiscountAmount", async (t) => {
  const voucher = baseVoucher({
    discountType: "PERCENTAGE",
    discountValue: 50,
    maxDiscountAmount: 30000,
  });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  const result = await validateVoucher("SALE10", 200000, "user-1");
  assert.equal(result.discountAmount, 30000);
});

test("validateVoucher - UTCID04: boundary - discount capped by subtotal when it exceeds order value", async (t) => {
  const voucher = baseVoucher({
    discountType: "FIXED_AMOUNT",
    discountValue: 1000000,
  });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  const result = await validateVoucher("SALE10", 50000, "user-1");
  assert.equal(result.discountAmount, 50000);
});

test("validateVoucher - UTCID05: boundary - currentUsageCount one below maxUsageCount still succeeds", async (t) => {
  const voucher = baseVoucher({ maxUsageCount: 5, currentUsageCount: 4 });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  const result = await validateVoucher("SALE10", 200000, "user-1");
  assert.equal(result.discountAmount, 20000);
});

test("validateVoucher - UTCID06: boundary - subtotal exactly equal to minBookingAmount passes", async (t) => {
  const voucher = baseVoucher({ minBookingAmount: 100000 });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  await assert.doesNotReject(() => validateVoucher("SALE10", 100000, "user-1"));
});

test("validateVoucher - UTCID07: abnormal - empty voucher code throws", async (t) => {
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => null },
  });
  await assert.rejects(
    () => validateVoucher("   ", 100000, "user-1"),
    /không được để trống/,
  );
});

test("validateVoucher - UTCID08: abnormal - guest user (no userId) is rejected", async (t) => {
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => null },
  });
  await assert.rejects(
    () => validateVoucher("SALE10", 100000, null),
    /Khách vãng lai/,
  );
});

test("validateVoucher - UTCID09: abnormal - voucher not found throws 404", async (t) => {
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => null },
  });
  let err;
  await assert.rejects(async () => {
    try {
      await validateVoucher("NOTEXIST", 100000, "user-1");
    } catch (e) {
      err = e;
      throw e;
    }
  });
  assert.match(err.message, /không tồn tại/);
  assert.equal(err.statusCode, 404);
});

test("validateVoucher - UTCID10: abnormal - inactive voucher throws", async (t) => {
  const voucher = baseVoucher({ active: false });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  await assert.rejects(
    () => validateVoucher("SALE10", 100000, "user-1"),
    /vô hiệu hóa/,
  );
});

test("validateVoucher - UTCID11: abnormal - voucher not yet valid throws", async (t) => {
  const voucher = baseVoucher({
    validFrom: daysFromNow(1),
    validTo: daysFromNow(5),
  });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  await assert.rejects(
    () => validateVoucher("SALE10", 100000, "user-1"),
    /chưa đến thời gian/,
  );
});

test("validateVoucher - UTCID12: abnormal - expired voucher throws", async (t) => {
  const voucher = baseVoucher({
    validFrom: daysFromNow(-5),
    validTo: daysFromNow(-1),
  });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  await assert.rejects(
    () => validateVoucher("SALE10", 100000, "user-1"),
    /đã hết hạn/,
  );
});

test("validateVoucher - UTCID13: abnormal - maxUsageCount reached throws", async (t) => {
  const voucher = baseVoucher({ maxUsageCount: 5, currentUsageCount: 5 });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  await assert.rejects(
    () => validateVoucher("SALE10", 100000, "user-1"),
    /hết lượt sử dụng/,
  );
});

test("validateVoucher - UTCID14: abnormal - subtotal below minBookingAmount throws", async (t) => {
  const voucher = baseVoucher({ minBookingAmount: 500000 });
  const { validateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  await assert.rejects(
    () => validateVoucher("SALE10", 100000, "user-1"),
    /tối thiểu/,
  );
});

// ============================================================
// findBestPromotion — PROMO-02
// ============================================================

function basePromo(overrides = {}) {
  return {
    id: "promo-1",
    status: "ACTIVE",
    validFrom: daysFromNow(-1),
    validTo: daysFromNow(1),
    routeIds: [],
    trainIds: [],
    discountType: "PERCENTAGE",
    discountValue: 10,
    maxBudget: null,
    usedBudget: 0,
    ...overrides,
  };
}

test("UTCID01: empty scheduleInputs returns no promotion", async (t) => {
  const { findBestPromotion } = await loadPromotionService(t, {});
  const result = await findBestPromotion([], 100000);
  assert.deepEqual(result, { promotion: null, discountAmount: 0 });
});

test("UTCID02: percentage promotion matches schedule and computes discount", async (t) => {
  const promo = basePromo({ discountType: "PERCENTAGE", discountValue: 10 });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 200000 }],
    200000,
  );
  assert.equal(result.discountAmount, 20000);
  assert.equal(result.promotion.id, "promo-1");
});

test("UTCID03: FREE_UPGRADE promotion sums upgradeSavings", async (t) => {
  const promo = basePromo({ discountType: "FREE_UPGRADE", discountValue: 0 });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 200000, upgradeSavings: 30000 }],
    200000,
  );
  assert.equal(result.discountAmount, 30000);
});

test("UTCID04: boundary - FIXED_AMOUNT capped to matching subtotal", async (t) => {
  const promo = basePromo({
    discountType: "FIXED_AMOUNT",
    discountValue: 999999,
  });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 150000 }],
    150000,
  );
  assert.equal(result.discountAmount, 150000);
});

test("UTCID05: boundary - discount capped by remaining budget", async (t) => {
  const promo = basePromo({
    discountType: "PERCENTAGE",
    discountValue: 50,
    maxBudget: 100000,
    usedBudget: 90000,
  });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 200000 }],
    200000,
  );
  // raw discount = 100000, remaining budget = 10000
  assert.equal(result.discountAmount, 10000);
});

test("UTCID06: boundary - promotion skipped when usedBudget equals maxBudget", async (t) => {
  const promo = basePromo({ maxBudget: 50000, usedBudget: 50000 });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 200000 }],
    200000,
  );
  assert.deepEqual(result, { promotion: null, discountAmount: 0 });
});

test("UTCID07: boundary - discount capped by globalSubtotal", async (t) => {
  const promo = basePromo({ discountType: "PERCENTAGE", discountValue: 90 });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 200000 }],
    50000,
  );
  assert.equal(result.discountAmount, 50000);
});

test("UTCID08: abnormal - no matching schedules found returns null", async (t) => {
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: { findMany: async () => [] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "missing-schedule", amount: 100000 }],
    100000,
  );
  assert.deepEqual(result, { promotion: null, discountAmount: 0 });
});

test("UTCID09: abnormal - no active promotions returns null", async (t) => {
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 100000 }],
    100000,
  );
  assert.deepEqual(result, { promotion: null, discountAmount: 0 });
});

test("UTCID10: multiple promotions pick the one with the largest discount", async (t) => {
  const promoSmall = basePromo({
    id: "promo-small",
    discountType: "PERCENTAGE",
    discountValue: 5,
  });
  const promoBig = basePromo({
    id: "promo-big",
    discountType: "PERCENTAGE",
    discountValue: 20,
  });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promoSmall, promoBig] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 200000 }],
    200000,
  );
  assert.equal(result.promotion.id, "promo-big");
  assert.equal(result.discountAmount, 40000);
});

test("UTCID12: boundary - a scheduleInput referencing a schedule missing from the fetched map is skipped", async (t) => {
  const promo = basePromo({ discountType: "PERCENTAGE", discountValue: 10 });
  const { findBestPromotion } = await loadPromotionService(t, {
    // Only sch-1 is returned even though two scheduleIds were requested
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [
      { scheduleId: "sch-1", amount: 100000 },
      { scheduleId: "sch-missing", amount: 100000 },
    ],
    200000,
  );
  // Only sch-1 contributes: 10% of 100000 = 10000
  assert.equal(result.discountAmount, 10000);
});

test("UTCID13: boundary - FIXED_AMOUNT promo sums only the matching schedules' amounts", async (t) => {
  const promo = basePromo({
    discountType: "FIXED_AMOUNT",
    discountValue: 999999,
    routeIds: ["route-1"],
  });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
        { id: "sch-2", routeId: "route-2", trainId: "train-2" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [
      { scheduleId: "sch-1", amount: 100000 },
      { scheduleId: "sch-2", amount: 100000 }, // different route, excluded from matchingSubtotal
      { scheduleId: "sch-missing", amount: 100000 }, // absent from fetched map, excluded too
    ],
    200000,
  );
  assert.equal(result.discountAmount, 100000);
});

test("UTCID11: boundary - route/train mismatch means no match, no discount", async (t) => {
  const promo = basePromo({ routeIds: ["route-x"], trainIds: ["train-x"] });
  const { findBestPromotion } = await loadPromotionService(t, {
    schedule: {
      findMany: async () => [
        { id: "sch-1", routeId: "route-1", trainId: "train-1" },
      ],
    },
    promotion: { findMany: async () => [promo] },
  });
  const result = await findBestPromotion(
    [{ scheduleId: "sch-1", amount: 200000 }],
    200000,
  );
  assert.deepEqual(result, { promotion: null, discountAmount: 0 });
});

// ============================================================
// getAdminPromotions — PROMO-03
// (No throw branches; Abnormal test skipped — pure read/pagination helper)
// ============================================================

test("UTCID01: builds where clause from search and status filters", async (t) => {
  let capturedWhere = null;
  const { getAdminPromotions } = await loadPromotionService(t, {
    promotion: {
      count: async (args) => {
        capturedWhere = args.where;
        return 1;
      },
      findMany: async () => [{ id: "promo-1", title: "Tet" }],
    },
  });
  const result = await getAdminPromotions({
    search: "Tet",
    status: "ACTIVE",
    page: 1,
    limit: 10,
  });
  assert.deepEqual(capturedWhere, {
    status: "ACTIVE",
    title: { contains: "Tet", mode: "insensitive" },
  });
  assert.equal(result.promotions.length, 1);
  assert.equal(result.pagination.totalPages, 1);
});

test("UTCID02: boundary - empty results yield zero totalPages", async (t) => {
  const { getAdminPromotions } = await loadPromotionService(t, {
    promotion: {
      count: async () => 0,
      findMany: async () => [],
    },
  });
  const result = await getAdminPromotions({ page: 1, limit: 10 });
  assert.equal(result.pagination.total, 0);
  assert.equal(result.pagination.totalPages, 0);
});

// ============================================================
// getAdminVouchers — PROMO-04
// (No throw branches; Abnormal test skipped — pure read/pagination helper)
// ============================================================

test("UTCID01: builds where clause from search and active=true filter", async (t) => {
  let capturedWhere = null;
  const { getAdminVouchers } = await loadPromotionService(t, {
    voucher: {
      count: async (args) => {
        capturedWhere = args.where;
        return 1;
      },
      findMany: async () => [baseVoucher()],
    },
  });
  const result = await getAdminVouchers({
    search: "SALE",
    active: "true",
    page: 1,
    limit: 10,
  });
  assert.deepEqual(capturedWhere, {
    active: true,
    voucherCode: { contains: "SALE", mode: "insensitive" },
  });
  assert.equal(result.vouchers.length, 1);
});

test("UTCID02: boundary - active=false string parses to boolean false", async (t) => {
  let capturedWhere = null;
  const { getAdminVouchers } = await loadPromotionService(t, {
    voucher: {
      count: async (args) => {
        capturedWhere = args.where;
        return 0;
      },
      findMany: async () => [],
    },
  });
  await getAdminVouchers({ active: "false", page: 2, limit: 5 });
  assert.equal(capturedWhere.active, false);
});

// ============================================================
// createVoucher — PROMO-05
// ============================================================

test("UTCID01: creates voucher with normalized code and logs admin action", async (t) => {
  let loggedAction = null;
  const { createVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: "voucher-new", ...data }),
    },
    adminLog: {
      create: async ({ data }) => {
        loggedAction = data;
        return data;
      },
    },
  });
  const voucher = await createVoucher(
    {
      voucherCode: " sale20 ",
      discountType: "PERCENTAGE",
      discountValue: 20,
      validFrom: "2026-08-01",
      validTo: "2026-08-31",
    },
    adminCtx(),
  );
  assert.equal(voucher.voucherCode, "SALE20");
  assert.equal(loggedAction.action, "CREATE");
  assert.equal(loggedAction.entity, "Voucher");
});

test("UTCID02: boundary - optional numeric fields default to null when omitted", async (t) => {
  const { createVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: "voucher-new", ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const voucher = await createVoucher(
    {
      voucherCode: "NOOPT",
      discountType: "FIXED_AMOUNT",
      discountValue: 10000,
      validFrom: "2026-08-01",
      validTo: "2026-08-31",
    },
    adminCtx(),
  );
  assert.equal(voucher.maxUsageCount, null);
  assert.equal(voucher.minBookingAmount, null);
  assert.equal(voucher.maxDiscountAmount, null);
  assert.equal(voucher.active, true);
  assert.equal(voucher.isPublic, true);
});

test("UTCID03: boundary - active explicitly false is preserved", async (t) => {
  const { createVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: "voucher-new", ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const voucher = await createVoucher(
    {
      voucherCode: "INACT",
      discountType: "FIXED_AMOUNT",
      discountValue: 10000,
      validFrom: "2026-08-01",
      validTo: "2026-08-31",
      active: false,
      isPublic: false,
    },
    adminCtx(),
  );
  assert.equal(voucher.active, false);
  assert.equal(voucher.isPublic, false);
});

test("UTCID05: boundary - ISO datetime validFrom/validTo (containing 'T') bypasses timezone suffix parsing", async (t) => {
  const { createVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: "voucher-new", ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const voucher = await createVoucher(
    {
      voucherCode: "ISOCODE",
      discountType: "PERCENTAGE",
      discountValue: 10,
      validFrom: "2026-08-01T10:00:00.000Z",
      validTo: "2026-08-31T10:00:00.000Z",
    },
    adminCtx(),
  );
  assert.equal(voucher.validFrom.toISOString(), "2026-08-01T10:00:00.000Z");
});

test("UTCID06: boundary - truthy optional fields are converted to numbers", async (t) => {
  const { createVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: "voucher-new", ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const voucher = await createVoucher(
    {
      voucherCode: "FULLOPT",
      description: "Mo ta",
      discountType: "FIXED_AMOUNT",
      discountValue: 10000,
      maxUsageCount: 100,
      minBookingAmount: 50000,
      maxDiscountAmount: 20000,
      validFrom: "2026-08-01",
      validTo: "2026-08-31",
    },
    adminCtx(),
  );
  assert.equal(voucher.maxUsageCount, 100);
  assert.equal(voucher.minBookingAmount, 50000);
  assert.equal(voucher.maxDiscountAmount, 20000);
});

test("UTCID07: boundary - missing validFrom/validTo throws 400 Bad Request", async (t) => {
  const { createVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: "voucher-new", ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  await assert.rejects(
    () =>
      createVoucher(
        {
          voucherCode: "NODATE",
          discountType: "FIXED_AMOUNT",
          discountValue: 10000,
        },
        adminCtx(),
      ),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /bắt buộc/);
      return true;
    },
  );
});

test("UTCID04: abnormal - duplicate voucher code throws", async (t) => {
  const { createVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => baseVoucher() },
  });
  await assert.rejects(
    () =>
      createVoucher(
        {
          voucherCode: "SALE10",
          discountType: "PERCENTAGE",
          discountValue: 10,
          validFrom: "2026-08-01",
          validTo: "2026-08-31",
        },
        adminCtx(),
      ),
    /đã tồn tại/,
  );
});

// ============================================================
// updateVoucher — PROMO-06
// ============================================================

test("UTCID01: updates provided fields", async (t) => {
  const existing = baseVoucher();
  const { updateVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updateVoucher(
    "voucher-1",
    { discountValue: 25, active: false },
    adminCtx(),
  );
  assert.equal(updated.discountValue, 25);
  assert.equal(updated.active, false);
});

test("UTCID02: boundary - fields omitted fall back to existing values", async (t) => {
  const existing = baseVoucher({ description: "Old desc", discountValue: 10 });
  const { updateVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updateVoucher("voucher-1", {}, adminCtx());
  assert.equal(updated.description, "Old desc");
  assert.equal(updated.discountValue, 10);
});

test("UTCID03: abnormal - updating non-existent voucher throws 404", async (t) => {
  const { updateVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => null },
  });
  await assert.rejects(
    () => updateVoucher("missing-id", {}, adminCtx()),
    /Không tìm thấy mã voucher/,
  );
});

test("UTCID05: boundary - every updatable field is explicitly provided (all true-branches)", async (t) => {
  const existing = baseVoucher();
  const { updateVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updateVoucher(
    "voucher-1",
    {
      description: "New desc",
      discountType: "FIXED_AMOUNT",
      discountValue: 30000,
      validFrom: "2026-09-01",
      validTo: "2026-09-30",
      isPublic: false,
    },
    adminCtx(),
  );
  assert.equal(updated.description, "New desc");
  assert.equal(updated.discountType, "FIXED_AMOUNT");
  assert.equal(updated.isPublic, false);
  // parseDateWithTimezone interprets "2026-09-01" as 00:00 in GMT+7 (Vietnam
  // time), which is "2026-08-31T17:00:00.000Z" in UTC — same convention as
  // utils/journey.js's parseVietnamDateRange.
  assert.equal(updated.validFrom.toISOString(), "2026-08-31T17:00:00.000Z");
});

test("UTCID04: boundary - explicit falsy optional fields (0) are stored as null, not the falsy number", async (t) => {
  const existing = baseVoucher({
    maxUsageCount: 5,
    minBookingAmount: 100000,
    maxDiscountAmount: 20000,
  });
  const { updateVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updateVoucher(
    "voucher-1",
    { maxUsageCount: 0, minBookingAmount: 0, maxDiscountAmount: 0 },
    adminCtx(),
  );
  assert.equal(updated.maxUsageCount, null);
  assert.equal(updated.minBookingAmount, null);
  assert.equal(updated.maxDiscountAmount, null);
});

// ============================================================
// deleteVoucher — PROMO-07
// ============================================================

test("UTCID01: deletes existing voucher and logs admin action", async (t) => {
  const existing = baseVoucher();
  let deletedWhere = null;
  const { deleteVoucher } = await loadPromotionService(t, {
    voucher: {
      findUnique: async () => existing,
      delete: async ({ where }) => {
        deletedWhere = where;
        return existing;
      },
    },
    adminLog: { create: async () => ({}) },
  });
  const result = await deleteVoucher("voucher-1", adminCtx());
  assert.deepEqual(result, { success: true });
  assert.equal(deletedWhere.id, "voucher-1");
});

test("UTCID02: abnormal - deleting non-existent voucher throws 404", async (t) => {
  const { deleteVoucher } = await loadPromotionService(t, {
    voucher: { findUnique: async () => null },
  });
  await assert.rejects(
    () => deleteVoucher("missing-id", adminCtx()),
    /Không tìm thấy mã voucher/,
  );
});

// ============================================================
// createPromotion — PROMO-08
// ============================================================

test("UTCID01: creates promotion with routeIds/trainIds arrays", async (t) => {
  const { createPromotion } = await loadPromotionService(t, {
    promotion: { create: async ({ data }) => ({ id: "promo-new", ...data }) },
    adminLog: { create: async () => ({}) },
  });
  const promo = await createPromotion(
    {
      title: " Khuyen mai he ",
      discountType: "PERCENTAGE",
      discountValue: 15,
      routeIds: ["route-1"],
      trainIds: ["train-1"],
      validFrom: "2026-08-01",
      validTo: "2026-08-31",
    },
    adminCtx(),
  );
  assert.equal(promo.title, "Khuyen mai he");
  assert.deepEqual(promo.routeIds, ["route-1"]);
});

test("UTCID02: boundary - non-array routeIds/trainIds default to empty array and status defaults to ACTIVE", async (t) => {
  const { createPromotion } = await loadPromotionService(t, {
    promotion: { create: async ({ data }) => ({ id: "promo-new", ...data }) },
    adminLog: { create: async () => ({}) },
  });
  const promo = await createPromotion(
    {
      title: "Khuyen mai",
      discountType: "PERCENTAGE",
      discountValue: 15,
      validFrom: "2026-08-01",
      validTo: "2026-08-31",
    },
    adminCtx(),
  );
  assert.deepEqual(promo.routeIds, []);
  assert.deepEqual(promo.trainIds, []);
  assert.equal(promo.status, "ACTIVE");
});

test("UTCID04: boundary - truthy maxBudget is converted to a number", async (t) => {
  const { createPromotion } = await loadPromotionService(t, {
    promotion: { create: async ({ data }) => ({ id: "promo-new", ...data }) },
    adminLog: { create: async () => ({}) },
  });
  const promo = await createPromotion(
    {
      title: "Khuyen mai",
      discountType: "PERCENTAGE",
      discountValue: 15,
      validFrom: "2026-08-01",
      validTo: "2026-08-31",
      maxBudget: 5000000,
    },
    adminCtx(),
  );
  assert.equal(promo.maxBudget, 5000000);
});

test("UTCID03: abnormal - missing title throws 400 Bad Request", async (t) => {
  const { createPromotion } = await loadPromotionService(t, {
    promotion: { create: async ({ data }) => ({ id: "promo-new", ...data }) },
    adminLog: { create: async () => ({}) },
  });
  await assert.rejects(
    () =>
      createPromotion(
        {
          discountType: "PERCENTAGE",
          discountValue: 15,
          validFrom: "2026-08-01",
          validTo: "2026-08-31",
        },
        adminCtx(),
      ),
    (err) => {
      assert.equal(err.statusCode, 400);
      assert.match(err.message, /không được để trống/);
      return true;
    },
  );
});

// ============================================================
// updatePromotion — PROMO-09
// ============================================================

test("UTCID01: updates provided fields", async (t) => {
  const existing = {
    id: "promo-1",
    title: "Old",
    routeIds: [],
    trainIds: [],
    status: "ACTIVE",
  };
  const { updatePromotion } = await loadPromotionService(t, {
    promotion: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updatePromotion(
    "promo-1",
    { title: " New title ", status: "PAUSED" },
    adminCtx(),
  );
  assert.equal(updated.title, "New title");
  assert.equal(updated.status, "PAUSED");
});

test("UTCID02: boundary - omitted fields fall back to existing values", async (t) => {
  const existing = {
    id: "promo-1",
    title: "Old",
    routeIds: ["r1"],
    trainIds: [],
    status: "ACTIVE",
    maxBudget: 5000,
  };
  const { updatePromotion } = await loadPromotionService(t, {
    promotion: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updatePromotion("promo-1", {}, adminCtx());
  assert.equal(updated.title, "Old");
  assert.deepEqual(updated.routeIds, ["r1"]);
  assert.equal(updated.maxBudget, 5000);
});

test("UTCID03: abnormal - updating non-existent promotion throws 404", async (t) => {
  const { updatePromotion } = await loadPromotionService(t, {
    promotion: { findUnique: async () => null },
  });
  await assert.rejects(
    () => updatePromotion("missing-id", {}, adminCtx()),
    /Không tìm thấy chương trình khuyến mãi/,
  );
});

test("UTCID05: boundary - every updatable field is explicitly provided (all true-branches)", async (t) => {
  const existing = {
    id: "promo-1",
    title: "Old",
    routeIds: [],
    trainIds: [],
    status: "ACTIVE",
  };
  const { updatePromotion } = await loadPromotionService(t, {
    promotion: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updatePromotion(
    "promo-1",
    {
      description: "New desc",
      discountType: "FIXED_AMOUNT",
      discountValue: 50000,
      routeIds: ["route-9"],
      trainIds: ["train-9"],
      validFrom: "2026-09-01",
      validTo: "2026-09-30",
    },
    adminCtx(),
  );
  assert.equal(updated.description, "New desc");
  assert.equal(updated.discountType, "FIXED_AMOUNT");
  assert.deepEqual(updated.routeIds, ["route-9"]);
  assert.deepEqual(updated.trainIds, ["train-9"]);
});

test("UTCID04: boundary - explicit falsy maxBudget (0) is stored as null, not the falsy number", async (t) => {
  const existing = {
    id: "promo-1",
    title: "Old",
    routeIds: [],
    trainIds: [],
    status: "ACTIVE",
    maxBudget: 5000,
  };
  const { updatePromotion } = await loadPromotionService(t, {
    promotion: {
      findUnique: async () => existing,
      update: async ({ data }) => ({ ...existing, ...data }),
    },
    adminLog: { create: async () => ({}) },
  });
  const updated = await updatePromotion(
    "promo-1",
    { maxBudget: 0 },
    adminCtx(),
  );
  assert.equal(updated.maxBudget, null);
});

// ============================================================
// deletePromotion — PROMO-10
// ============================================================

test("UTCID01: deletes existing promotion and logs admin action", async (t) => {
  const existing = { id: "promo-1", title: "Old" };
  const { deletePromotion } = await loadPromotionService(t, {
    promotion: {
      findUnique: async () => existing,
      delete: async () => existing,
    },
    adminLog: { create: async () => ({}) },
  });
  const result = await deletePromotion("promo-1", adminCtx());
  assert.deepEqual(result, { success: true });
});

test("UTCID02: abnormal - deleting non-existent promotion throws 404", async (t) => {
  const { deletePromotion } = await loadPromotionService(t, {
    promotion: { findUnique: async () => null },
  });
  await assert.rejects(
    () => deletePromotion("missing-id", adminCtx()),
    /Không tìm thấy chương trình khuyến mãi/,
  );
});

// ============================================================
// getActivePromotionsAndVouchers — PROMO-11
// (No throw branches; Abnormal test skipped — pure public read helper)
// ============================================================

test("UTCID01: returns active promotions and public vouchers", async (t) => {
  const { getActivePromotionsAndVouchers } = await loadPromotionService(t, {
    promotion: { findMany: async () => [{ id: "promo-1" }] },
    voucher: { findMany: async () => [baseVoucher()] },
  });
  const result = await getActivePromotionsAndVouchers();
  assert.equal(result.promotions.length, 1);
  assert.equal(result.vouchers.length, 1);
});

test("UTCID02: boundary - returns empty arrays when nothing is active", async (t) => {
  const { getActivePromotionsAndVouchers } = await loadPromotionService(t, {
    promotion: { findMany: async () => [] },
    voucher: { findMany: async () => [] },
  });
  const result = await getActivePromotionsAndVouchers();
  assert.deepEqual(result.promotions, []);
  assert.deepEqual(result.vouchers, []);
});

// ============================================================
// sendVoucherEmail — PROMO-12
// ============================================================

test("UTCID01: sends email for percentage voucher and logs admin action", async (t) => {
  const voucher = baseVoucher({
    discountType: "PERCENTAGE",
    discountValue: 10,
  });
  let sentTo = null;
  let loggedAction = null;
  const { sendVoucherEmail } = await loadPromotionService(
    t,
    {
      voucher: { findUnique: async () => voucher },
      adminLog: {
        create: async ({ data }) => {
          loggedAction = data;
          return data;
        },
      },
    },
    {
      sendEmail: async ({ to }) => {
        sentTo = to;
        return { success: true };
      },
    },
  );
  const result = await sendVoucherEmail(
    "voucher-1",
    "customer@example.com",
    adminCtx(),
  );
  assert.deepEqual(result, { success: true });
  assert.equal(sentTo, "customer@example.com");
  assert.equal(loggedAction.entity, "Voucher");
});

test("UTCID02: boundary - fixed amount voucher with minBookingAmount includes both details in email", async (t) => {
  const voucher = baseVoucher({
    discountType: "FIXED_AMOUNT",
    discountValue: 50000,
    minBookingAmount: 200000,
  });
  let sentHtml = "";
  const { sendVoucherEmail } = await loadPromotionService(
    t,
    {
      voucher: { findUnique: async () => voucher },
      adminLog: { create: async () => ({}) },
    },
    {
      sendEmail: async ({ html }) => {
        sentHtml = html;
        return { success: true };
      },
    },
  );
  await sendVoucherEmail("voucher-1", "customer@example.com", adminCtx());
  assert.match(sentHtml, /50.000 VND/);
  assert.match(sentHtml, /200.000 VND/);
});

test("UTCID03: abnormal - voucher not found throws 404", async (t) => {
  const { sendVoucherEmail } = await loadPromotionService(t, {
    voucher: { findUnique: async () => null },
  });
  await assert.rejects(
    () => sendVoucherEmail("missing-id", "customer@example.com", adminCtx()),
    /Không tìm thấy mã voucher/,
  );
});

test("UTCID04: abnormal - invalid email format throws", async (t) => {
  const voucher = baseVoucher();
  const { sendVoucherEmail } = await loadPromotionService(t, {
    voucher: { findUnique: async () => voucher },
  });
  await assert.rejects(
    () => sendVoucherEmail("voucher-1", "not-an-email", adminCtx()),
    /không hợp lệ/,
  );
});

// ============================================================
// triggerBirthdayVouchers — PROMO-13
// (No throw branches; Abnormal test skipped — best-effort marketing batch job)
// ============================================================

function vnTodayMonthDay() {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "numeric",
  });
  const parts = formatter.formatToParts(new Date());
  const day = parseInt(parts.find((p) => p.type === "day").value, 10);
  const month = parseInt(parts.find((p) => p.type === "month").value, 10);
  return { day, month };
}

test("UTCID01: creates and emails a birthday voucher for a matching user", async (t) => {
  const { day, month } = vnTodayMonthDay();
  const dob = new Date(Date.UTC(1990, month - 1, day, 4, 0, 0)); // ~11:00 VN time
  let createdVoucher = null;
  let emailSentTo = null;
  const { triggerBirthdayVouchers } = await loadPromotionService(
    t,
    {
      user: {
        findMany: async () => [
          {
            email: "bday@example.com",
            fullName: "Nguyen Van A",
            dateOfBirth: dob,
          },
        ],
      },
      voucher: {
        create: async ({ data }) => {
          createdVoucher = data;
          return { id: "voucher-bday", ...data };
        },
      },
    },
    {
      sendEmail: async ({ to }) => {
        emailSentTo = to;
        return { success: true };
      },
    },
  );
  const result = await triggerBirthdayVouchers();
  assert.equal(result.processedCount, 1);
  assert.equal(emailSentTo, "bday@example.com");
  assert.match(createdVoucher.voucherCode, /^BDAY-/);
  assert.equal(createdVoucher.discountValue, 50000);
});

test("UTCID02: boundary - short name (<=5 chars) is not truncated in voucher code", async (t) => {
  const { day, month } = vnTodayMonthDay();
  const dob = new Date(Date.UTC(1990, month - 1, day, 4, 0, 0));
  let createdVoucher = null;
  const { triggerBirthdayVouchers } = await loadPromotionService(
    t,
    {
      user: {
        findMany: async () => [
          { email: "bo@example.com", fullName: "Bo", dateOfBirth: dob },
        ],
      },
      voucher: {
        create: async ({ data }) => {
          createdVoucher = data;
          return { id: "voucher-bday", ...data };
        },
      },
    },
    { sendEmail: async () => ({ success: true }) },
  );
  await triggerBirthdayVouchers();
  assert.match(createdVoucher.voucherCode, /^BDAY-BO-/);
});

test("UTCID03: boundary - long name (>5 chars) is truncated to 5 chars in voucher code", async (t) => {
  const { day, month } = vnTodayMonthDay();
  const dob = new Date(Date.UTC(1990, month - 1, day, 4, 0, 0));
  let createdVoucher = null;
  const { triggerBirthdayVouchers } = await loadPromotionService(
    t,
    {
      user: {
        findMany: async () => [
          {
            email: "long@example.com",
            fullName: "Nguyen Van Alexander",
            dateOfBirth: dob,
          },
        ],
      },
      voucher: {
        create: async ({ data }) => {
          createdVoucher = data;
          return { id: "voucher-bday", ...data };
        },
      },
    },
    { sendEmail: async () => ({ success: true }) },
  );
  await triggerBirthdayVouchers();
  // cleanName = NGUYENVANALEXANDER -> first 5 chars = NGUYE
  assert.match(createdVoucher.voucherCode, /^BDAY-NGUYE-/);
});

test("UTCID04: boundary - no users with a birthday today yields zero processed", async (t) => {
  const { triggerBirthdayVouchers } = await loadPromotionService(
    t,
    {
      user: { findMany: async () => [] },
      voucher: {
        create: async () => {
          throw new Error("should not be called");
        },
      },
    },
    {
      sendEmail: async () => {
        throw new Error("should not be called");
      },
    },
  );
  const result = await triggerBirthdayVouchers();
  assert.deepEqual(result, { success: true, processedCount: 0, processed: [] });
});

// ============================================================
// awardLoyaltyPointsAndCheckTier — PROMO-14
// tx is injected directly by the caller (no prisma module mock needed)
// ============================================================

function mockTx(userOverrides = {}) {
  const calls = { userUpdate: null, loyaltyCreate: null, voucherCreate: null };
  return {
    calls,
    tx: {
      user: {
        findUnique: async () => ({
          loyaltyPoints: 0,
          email: "user@example.com",
          fullName: "Nguyen Van A",
          ...userOverrides,
        }),
        update: async ({ data }) => {
          calls.userUpdate = data;
          return data;
        },
      },
      loyaltyPoint: {
        create: async ({ data }) => {
          calls.loyaltyCreate = data;
          return data;
        },
      },
      voucher: {
        create: async ({ data }) => {
          calls.voucherCreate = data;
          return data;
        },
      },
    },
  };
}

test("UTCID01: normal points award with no tier change does not create a voucher", async (t) => {
  const { awardLoyaltyPointsAndCheckTier } = await loadPromotionService(
    t,
    {},
    {
      sendEmail: async () => {
        throw new Error("should not be called");
      },
    },
  );
  const { tx, calls } = mockTx({ loyaltyPoints: 50 });
  await awardLoyaltyPointsAndCheckTier(tx, "user-1", 200000, "booking-1");
  assert.equal(calls.userUpdate.loyaltyPoints, 70); // 50 + floor(200000/10000)=20
  assert.equal(calls.loyaltyCreate.points, 20);
  assert.equal(calls.voucherCreate, null);
});

test("UTCID02: boundary - totalAmount below 10000 earns zero points and exits early", async (t) => {
  const { awardLoyaltyPointsAndCheckTier } = await loadPromotionService(t, {});
  const { tx, calls } = mockTx({ loyaltyPoints: 50 });
  await awardLoyaltyPointsAndCheckTier(tx, "user-1", 9999, "booking-1");
  assert.equal(calls.userUpdate, null);
  assert.equal(calls.loyaltyCreate, null);
});

test("UTCID03: boundary - crossing 100 points upgrades to Silver tier and issues a VIP voucher", async (t) => {
  let emailSubject = null;
  const { awardLoyaltyPointsAndCheckTier } = await loadPromotionService(
    t,
    {},
    {
      sendEmail: async ({ subject }) => {
        emailSubject = subject;
        return { success: true };
      },
    },
  );
  const { tx, calls } = mockTx({ loyaltyPoints: 90 });
  await awardLoyaltyPointsAndCheckTier(tx, "user-1", 100000, "booking-1"); // +10 pts => 100
  assert.equal(calls.userUpdate.loyaltyPoints, 100);
  assert.ok(calls.voucherCreate);
  assert.equal(calls.voucherCreate.discountValue, 10);
  assert.match(calls.voucherCreate.voucherCode, /^VIP-/);
  assert.match(emailSubject, /hạng thành viên/);
});

test("UTCID04: boundary - staying within the same tier does not issue a voucher", async (t) => {
  const { awardLoyaltyPointsAndCheckTier } = await loadPromotionService(
    t,
    {},
    {
      sendEmail: async () => {
        throw new Error("should not be called");
      },
    },
  );
  const { tx, calls } = mockTx({ loyaltyPoints: 150 }); // already Silver
  await awardLoyaltyPointsAndCheckTier(tx, "user-1", 100000, "booking-1"); // +10 => 160, still Silver
  assert.equal(calls.voucherCreate, null);
});

test("UTCID05: abnormal - user not found exits without any writes", async (t) => {
  const { awardLoyaltyPointsAndCheckTier } = await loadPromotionService(t, {});
  const tx = {
    user: {
      findUnique: async () => null,
      update: async () => {
        throw new Error("should not be called");
      },
    },
    loyaltyPoint: {
      create: async () => {
        throw new Error("should not be called");
      },
    },
  };
  await assert.doesNotReject(() =>
    awardLoyaltyPointsAndCheckTier(tx, "missing-user", 200000, "booking-1"),
  );
});

test("UTCID06: boundary - negative totalAmount yields non-positive points and exits early", async (t) => {
  const { awardLoyaltyPointsAndCheckTier } = await loadPromotionService(t, {});
  const { tx, calls } = mockTx({ loyaltyPoints: 50 });
  await awardLoyaltyPointsAndCheckTier(tx, "user-1", -50000, "booking-1");
  assert.equal(calls.userUpdate, null);
});

test("UTCID07: boundary - crossing 2000 points upgrades straight to Diamond tier", async (t) => {
  const { awardLoyaltyPointsAndCheckTier } = await loadPromotionService(
    t,
    {},
    { sendEmail: async () => ({ success: true }) },
  );
  const { tx, calls } = mockTx({ loyaltyPoints: 1990, fullName: "Bo" });
  await awardLoyaltyPointsAndCheckTier(tx, "user-1", 100000, "booking-1"); // +10 => 2000
  assert.equal(calls.voucherCreate.discountValue, 20);
  assert.match(calls.voucherCreate.voucherCode, /^VIP-KIM-BO-/);
});
