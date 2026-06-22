import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";

export const PASSENGER_TYPES = ["ADULT", "CHILD", "STUDENT", "SENIOR"];
export const CARRIAGE_TYPES = [
  "NORMAL_SEAT",
  "AC_SEAT",
  "SLEEPER_6",
  "SLEEPER_4",
];
export const SCOPE_TYPES = ["SYSTEM", "ROUTE", "SCHEDULE"];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function parseDate(value, fieldName, endOfDay = false) {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(String(value));
  const date = dateOnly
    ? new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}+07:00`)
    : new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    throw httpError(400, `${fieldName} không hợp lệ.`);
  }
  return date;
}

function finiteNumber(value, fieldName, { min = 0, max } = {}) {
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    number < min ||
    (max != null && number > max)
  ) {
    throw httpError(400, `${fieldName} không hợp lệ.`);
  }
  return number;
}

async function resolveScope(scopeType, scopeId) {
  if (!SCOPE_TYPES.includes(scopeType)) {
    throw httpError(400, "Phạm vi chính sách không hợp lệ.");
  }

  if (scopeType === "SYSTEM") {
    return {
      scopeType,
      scopeKey: "SYSTEM",
      routeId: null,
      scheduleId: null,
      label: "Toàn hệ thống",
      distance: null,
      inheritanceKeys: ["SYSTEM"],
    };
  }

  if (!scopeId) {
    throw httpError(400, "Vui lòng chọn đối tượng áp dụng chính sách.");
  }

  if (scopeType === "ROUTE") {
    const route = await prisma.route.findUnique({
      where: { id: scopeId },
      include: {
        startStation: { select: { stationName: true } },
        endStation: { select: { stationName: true } },
      },
    });
    if (!route) throw httpError(404, "Không tìm thấy tuyến đường.");

    return {
      scopeType,
      scopeKey: `ROUTE:${route.id}`,
      routeId: route.id,
      scheduleId: null,
      label: route.routeName,
      distance: route.distance,
      inheritanceKeys: [`ROUTE:${route.id}`, "SYSTEM"],
    };
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id: scopeId },
    select: {
      id: true,
      routeId: true,
      distance: true,
      route: { select: { routeName: true, distance: true } },
      train: { select: { trainCode: true, trainName: true } },
    },
  });
  if (!schedule) throw httpError(404, "Không tìm thấy lịch trình.");

  return {
    scopeType,
    scopeKey: `SCHEDULE:${schedule.id}`,
    routeId: schedule.routeId,
    scheduleId: schedule.id,
    label: `${schedule.train.trainCode} · ${schedule.route.routeName}`,
    distance: schedule.distance ?? schedule.route.distance,
    inheritanceKeys: [
      `SCHEDULE:${schedule.id}`,
      `ROUTE:${schedule.routeId}`,
      "SYSTEM",
    ],
  };
}

function validateRules(rules) {
  if (
    !Array.isArray(rules) ||
    rules.length !== PASSENGER_TYPES.length * CARRIAGE_TYPES.length
  ) {
    throw httpError(
      400,
      "Ma trận giá phải có đủ 16 tổ hợp hành khách và loại chỗ.",
    );
  }

  const seen = new Set();
  const normalized = rules.map((rule) => {
    if (!PASSENGER_TYPES.includes(rule.passengerType)) {
      throw httpError(400, "Nhóm hành khách không hợp lệ.");
    }
    if (!CARRIAGE_TYPES.includes(rule.carriageType)) {
      throw httpError(400, "Loại chỗ không hợp lệ.");
    }

    const key = `${rule.passengerType}:${rule.carriageType}`;
    if (seen.has(key)) throw httpError(400, `Tổ hợp ${key} bị trùng.`);
    seen.add(key);

    const minPrice =
      rule.minPrice === "" || rule.minPrice == null
        ? null
        : finiteNumber(rule.minPrice, "Giá sàn");
    const maxPrice =
      rule.maxPrice === "" || rule.maxPrice == null
        ? null
        : finiteNumber(rule.maxPrice, "Giá trần");

    if (minPrice != null && maxPrice != null && minPrice > maxPrice) {
      throw httpError(400, `Giá sàn lớn hơn giá trần tại tổ hợp ${key}.`);
    }

    const basePrice = finiteNumber(rule.basePrice, "Giá mở cửa");
    const pricePerKm = finiteNumber(rule.pricePerKm, "Đơn giá theo km");
    const classSurcharge = finiteNumber(
      rule.classSurcharge,
      "Phụ thu loại chỗ",
    );
    if (basePrice + pricePerKm + classSurcharge <= 0) {
      throw httpError(
        400,
        `Loại chỗ ${rule.carriageType} chưa có thành phần giá hợp lệ.`,
      );
    }

    return {
      passengerType: rule.passengerType,
      carriageType: rule.carriageType,
      basePrice,
      pricePerKm,
      classSurcharge,
      discountPercentage: 0,
      minPrice,
      maxPrice,
    };
  });

  for (const carriageType of CARRIAGE_TYPES) {
    const carriageRules = normalized.filter(
      (rule) => rule.carriageType === carriageType,
    );
    const reference = carriageRules[0];
    const fareFields = [
      "basePrice",
      "pricePerKm",
      "classSurcharge",
      "minPrice",
      "maxPrice",
    ];
    const inconsistent = carriageRules.some((rule) =>
      fareFields.some((field) => rule[field] !== reference[field]),
    );
    if (inconsistent) {
      throw httpError(
        400,
        `Cấu hình giá của ${carriageType} phải giống nhau cho mọi nhóm hành khách.`,
      );
    }
  }

  for (const passengerType of PASSENGER_TYPES) {
    const passengerRules = normalized.filter(
      (rule) => rule.passengerType === passengerType,
    );
    const referenceDiscount = passengerRules[0].discountPercentage;
    if (
      passengerRules.some(
        (rule) => rule.discountPercentage !== referenceDiscount,
      )
    ) {
      throw httpError(
        400,
        `Chiết khấu của ${passengerType} phải đồng nhất trên mọi loại chỗ.`,
      );
    }
  }

  return normalized;
}

async function ensureNoOverlap({
  scopeKey,
  effectiveFrom,
  effectiveTo,
  excludePolicyCode,
}) {
  const overlapping = await prisma.pricingPolicy.findFirst({
    where: {
      scopeKey,
      active: true,
      policyCode: excludePolicyCode
        ? { not: excludePolicyCode }
        : { not: null },
      effectiveFrom: {
        lte: effectiveTo ?? new Date("9999-12-31T23:59:59.999Z"),
      },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
    },
    select: { policyCode: true, policyName: true },
  });

  if (overlapping) {
    throw httpError(
      409,
      `Khoảng hiệu lực đang chồng với chính sách "${overlapping.policyName || overlapping.policyCode}".`,
    );
  }
}

function groupPolicyRows(rows) {
  const groups = new Map();
  for (const row of rows) {
    if (!row.policyCode) continue;
    if (!groups.has(row.policyCode)) {
      groups.set(row.policyCode, {
        policyCode: row.policyCode,
        policyName: row.policyName,
        scopeType: row.scopeType,
        scopeKey: row.scopeKey,
        routeId: row.routeId,
        scheduleId: row.scheduleId,
        taxPercentage: row.taxPercentage,
        active: row.active,
        effectiveFrom: row.effectiveFrom,
        effectiveTo: row.effectiveTo,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        rules: [],
      });
    }
    groups.get(row.policyCode).rules.push({
      id: row.id,
      passengerType: row.passengerType,
      carriageType: row.carriageType,
      basePrice: row.basePrice,
      pricePerKm: row.pricePerKm ?? 0,
      classSurcharge: row.classSurcharge,
      discountPercentage: row.discountPercentage,
      minPrice: row.minPrice,
      maxPrice: row.maxPrice,
    });
  }
  return [...groups.values()].sort(
    (a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom),
  );
}

export async function getPricingContext() {
  const [routes, schedules] = await Promise.all([
    prisma.route.findMany({
      where: { isActive: true },
      include: {
        startStation: { select: { stationName: true } },
        endStation: { select: { stationName: true } },
      },
      orderBy: { routeName: "asc" },
    }),
    prisma.schedule.findMany({
      where: {
        status: { in: ["ACTIVE", "DELAYED"] },
        departureTime: { gte: new Date() },
      },
      select: {
        id: true,
        routeId: true,
        departureTime: true,
        distance: true,
        status: true,
        route: { select: { routeName: true, distance: true } },
        train: { select: { trainCode: true, trainName: true } },
      },
      orderBy: { departureTime: "asc" },
      take: 250,
    }),
  ]);

  return {
    passengerTypes: PASSENGER_TYPES,
    carriageTypes: CARRIAGE_TYPES,
    routes,
    schedules,
  };
}

export async function getConfiguration({ scopeType, scopeId, at }) {
  const scope = await resolveScope(scopeType, scopeId);
  const atDate = at ? parseDate(at, "Ngày xem trước") : new Date();

  const [scopeRows, candidateRows] = await Promise.all([
    prisma.pricingPolicy.findMany({
      where: { scopeKey: scope.scopeKey, policyCode: { not: null } },
      orderBy: { effectiveFrom: "desc" },
    }),
    prisma.pricingPolicy.findMany({
      where: {
        scopeKey: { in: scope.inheritanceKeys },
        active: true,
        policyCode: { not: null },
        effectiveFrom: { lte: atDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: atDate } }],
      },
      orderBy: { effectiveFrom: "desc" },
    }),
  ]);

  const priority = new Map(
    scope.inheritanceKeys.map((key, index) => [key, index]),
  );
  candidateRows.sort((a, b) => {
    const scopeDifference =
      (priority.get(a.scopeKey) ?? 99) - (priority.get(b.scopeKey) ?? 99);
    if (scopeDifference !== 0) return scopeDifference;
    return new Date(b.effectiveFrom) - new Date(a.effectiveFrom);
  });

  const effectiveRules = new Map();
  for (const row of candidateRows) {
    const key = `${row.passengerType}:${row.carriageType}`;
    if (!effectiveRules.has(key)) {
      effectiveRules.set(key, {
        ...row,
        inherited: row.scopeKey !== scope.scopeKey,
      });
    }
  }

  return {
    scope,
    policies: groupPolicyRows(scopeRows),
    effectiveRules: [...effectiveRules.values()],
    effectiveAt: atDate,
  };
}

export async function savePolicy(payload, adminContext) {
  const scope = await resolveScope(payload.scopeType, payload.scopeId);
  const rules = validateRules(payload.rules);
  const effectiveFrom = parseDate(payload.effectiveFrom, "Ngày bắt đầu");
  const effectiveTo = payload.effectiveTo
    ? parseDate(payload.effectiveTo, "Ngày kết thúc", true)
    : null;
  if (effectiveTo && effectiveTo < effectiveFrom) {
    throw httpError(400, "Ngày kết thúc phải sau ngày bắt đầu.");
  }

  const taxPercentage = finiteNumber(payload.taxPercentage, "Thuế suất", {
    max: 100,
  });
  const policyCode =
    payload.policyCode || `PRICE-${randomUUID().slice(0, 8).toUpperCase()}`;
  const policyName = String(payload.policyName || "").trim();
  if (!policyName) throw httpError(400, "Vui lòng nhập tên chính sách.");

  if (payload.active !== false) {
    await ensureNoOverlap({
      scopeKey: scope.scopeKey,
      effectiveFrom,
      effectiveTo,
      excludePolicyCode: payload.policyCode,
    });
  }

  const rows = rules.map((rule) => ({
    ...rule,
    policyCode,
    policyName,
    scopeType: scope.scopeType,
    scopeKey: scope.scopeKey,
    routeId: scope.routeId,
    scheduleId: scope.scheduleId,
    taxPercentage,
    active: payload.active !== false,
    effectiveFrom,
    effectiveTo,
  }));

  await prisma.$transaction(async (tx) => {
    if (payload.policyCode) {
      const existing = await tx.pricingPolicy.findFirst({
        where: { policyCode: payload.policyCode },
        select: { policyCode: true },
      });
      if (!existing)
        throw httpError(404, "Không tìm thấy chính sách cần cập nhật.");
      await tx.pricingPolicy.deleteMany({
        where: { policyCode: payload.policyCode },
      });
    }

    await tx.pricingPolicy.createMany({ data: rows });
    await tx.adminLog.create({
      data: {
        adminId: adminContext.adminId,
        action: payload.policyCode ? "UPDATE" : "CREATE",
        entity: "PricingPolicy",
        changes: JSON.stringify({
          policyCode,
          policyName,
          scopeKey: scope.scopeKey,
          effectiveFrom,
          effectiveTo,
        }),
        description: `${payload.policyCode ? "Cập nhật" : "Tạo"} ma trận giá ${policyName}`,
        ipAddress: adminContext.ipAddress,
      },
    });
  });

  return getPolicy(policyCode);
}

export async function getPolicy(policyCode) {
  const rows = await prisma.pricingPolicy.findMany({
    where: { policyCode },
    orderBy: [{ passengerType: "asc" }, { carriageType: "asc" }],
  });
  if (rows.length === 0) throw httpError(404, "Không tìm thấy chính sách giá.");
  return groupPolicyRows(rows)[0];
}

export async function setPolicyActive(policyCode, active, adminContext) {
  const rows = await prisma.pricingPolicy.findMany({ where: { policyCode } });
  if (rows.length === 0) throw httpError(404, "Không tìm thấy chính sách giá.");

  if (active) {
    await ensureNoOverlap({
      scopeKey: rows[0].scopeKey,
      effectiveFrom: rows[0].effectiveFrom,
      effectiveTo: rows[0].effectiveTo,
      excludePolicyCode: policyCode,
    });
  }

  await prisma.$transaction([
    prisma.pricingPolicy.updateMany({
      where: { policyCode },
      data: { active: Boolean(active) },
    }),
    prisma.adminLog.create({
      data: {
        adminId: adminContext.adminId,
        action: active ? "ACTIVATE" : "DEACTIVATE",
        entity: "PricingPolicy",
        changes: JSON.stringify({ policyCode, active: Boolean(active) }),
        description: `${active ? "Kích hoạt" : "Tạm dừng"} chính sách ${rows[0].policyName}`,
        ipAddress: adminContext.ipAddress,
      },
    }),
  ]);

  return getPolicy(policyCode);
}

export function calculateFare(rule, distance, taxPercentage = 0) {
  const kilometers = finiteNumber(distance, "Cự ly", { min: 1 });
  const base =
    finiteNumber(rule.basePrice, "Giá mở cửa") +
    finiteNumber(rule.pricePerKm, "Đơn giá theo km") * kilometers +
    finiteNumber(rule.classSurcharge, "Phụ thu loại chỗ");
  const withFloor =
    rule.minPrice == null ? base : Math.max(base, Number(rule.minPrice));
  const bounded =
    rule.maxPrice == null
      ? withFloor
      : Math.min(withFloor, Number(rule.maxPrice));
  const afterDiscount =
    bounded * (1 - Number(rule.discountPercentage || 0) / 100);
  const finalPrice = afterDiscount * (1 + Number(taxPercentage || 0) / 100);

  return {
    distance: kilometers,
    baseAmount: Math.round(base),
    boundedAmount: Math.round(bounded),
    discountAmount: Math.round(bounded - afterDiscount),
    taxAmount: Math.round(finalPrice - afterDiscount),
    finalPrice: Math.round(finalPrice),
  };
}
