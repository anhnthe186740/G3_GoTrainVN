import { prisma } from "../config/database.js";
import { calculateFare, getConfiguration } from "./pricing.service.js";
import { resolveJourneySegment } from "../utils/journey.js";

export const HOLD_DURATION_MS = 10 * 60 * 1000;
export const MAX_SEATS_PER_LEG = 4;

const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED"];
const SELLABLE_SCHEDULE_STATUSES = ["ACTIVE", "DELAYED"];
const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;

const CARRIAGE_NAMES = {
  NORMAL_SEAT: "Ghế thường",
  AC_SEAT: "Ghế điều hòa",
  SLEEPER_6: "Giường nằm khoang 6",
  SLEEPER_4: "Giường nằm khoang 4",
};

function httpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

export function isSeatConflictError(error) {
  return (
    error?.code === "P2002" ||
    error?.code === "P2034" ||
    /write conflict|deadlock/i.test(String(error?.message))
  );
}

function assertObjectId(value, fieldName) {
  if (!OBJECT_ID_PATTERN.test(String(value))) {
    throw httpError(400, `${fieldName} không hợp lệ.`);
  }
}

function activeBookingWhere(scheduleId, seatId, now) {
  return {
    status: { in: ACTIVE_BOOKING_STATUSES },
    OR: [
      { status: "CONFIRMED" },
      { status: "PENDING", expiresAt: null },
      { status: "PENDING", expiresAt: { gt: now } },
    ],
    AND: [
      {
        OR: [{ scheduleId }, { returnScheduleId: scheduleId }],
      },
      {
        bookingDetails: {
          some: {
            seatId,
            status: { not: "CANCELLED" },
            OR: [{ scheduleId }, { scheduleId: null }],
          },
        },
      },
    ],
  };
}

function journeySelect() {
  return {
    id: true,
    status: true,
    departureTime: true,
    arrivalTime: true,
    distance: true,
    duration: true,
    delayMinutes: true,
    routeId: true,
    route: {
      select: {
        routeName: true,
        distance: true,
        stations: true,
        isActive: true,
        startStation: {
          select: { id: true, stationCode: true, stationName: true },
        },
        endStation: {
          select: { id: true, stationCode: true, stationName: true },
        },
      },
    },
    train: {
      select: {
        id: true,
        trainCode: true,
        trainName: true,
        trainType: true,
        carriages: {
          select: {
            id: true,
            carriageNumber: true,
            carriageType: true,
            totalSeats: true,
            seats: {
              select: {
                id: true,
                seatNumber: true,
                seatType: true,
                status: true,
                blockReason: true,
                blockUntil: true,
              },
              orderBy: { seatNumber: "asc" },
            },
          },
          orderBy: { carriageNumber: "asc" },
        },
      },
    },
    scheduleStops: {
      select: {
        stationId: true,
        stopOrder: true,
        arrivalTime: true,
        departureTime: true,
      },
      orderBy: { stopOrder: "asc" },
    },
  };
}

async function getJourney(scheduleId, fromStationId, toStationId) {
  assertObjectId(scheduleId, "Mã chuyến");
  assertObjectId(fromStationId, "Ga lên tàu");
  assertObjectId(toStationId, "Ga xuống tàu");

  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    select: journeySelect(),
  });

  if (!schedule || !schedule.route.isActive) {
    throw httpError(404, "Không tìm thấy chuyến tàu.");
  }
  if (!SELLABLE_SCHEDULE_STATUSES.includes(schedule.status)) {
    throw httpError(409, "Chuyến tàu không còn mở bán.");
  }

  const segment = resolveJourneySegment(schedule, fromStationId, toStationId);
  if (!segment) {
    throw httpError(400, "Chặng đã chọn không thuộc hành trình của chuyến.");
  }
  if (segment.departureTime <= new Date()) {
    throw httpError(409, "Chuyến tàu đã khởi hành.");
  }

  return { schedule, segment };
}

async function pricingByCarriage(schedule, segment) {
  const configuration = await getConfiguration({
    scopeType: "SCHEDULE",
    scopeId: schedule.id,
    at: segment.departureTime.toISOString(),
  });

  return new Map(
    configuration.effectiveRules
      .filter((rule) => rule.passengerType === "ADULT")
      .map((rule) => [
        rule.carriageType,
        calculateFare(rule, segment.distance, rule.taxPercentage).finalPrice,
      ]),
  );
}

function isPhysicallyBlocked(seat, now) {
  return (
    seat.status === "BLOCKED" &&
    (!seat.blockUntil || new Date(seat.blockUntil) > now)
  );
}

async function bookedSeatIds(scheduleId, now) {
  const bookings = await prisma.booking.findMany({
    where: {
      status: { in: ACTIVE_BOOKING_STATUSES },
      OR: [
        { status: "CONFIRMED" },
        { status: "PENDING", expiresAt: null },
        { status: "PENDING", expiresAt: { gt: now } },
      ],
      AND: [{ OR: [{ scheduleId }, { returnScheduleId: scheduleId }] }],
    },
    select: {
      bookingDetails: {
        where: {
          status: { not: "CANCELLED" },
          OR: [{ scheduleId }, { scheduleId: null }],
        },
        select: { seatId: true },
      },
    },
  });

  return new Set(
    bookings.flatMap((booking) =>
      booking.bookingDetails.map((detail) => detail.seatId),
    ),
  );
}

export async function cleanupExpiredHolds(now = new Date()) {
  const expiredHolds = await prisma.seatHold.findMany({
    where: { expiresAt: { lte: now } },
    select: {
      id: true,
      scheduleId: true,
      seatId: true,
      session: { select: { id: true, userId: true } },
    },
  });

  if (expiredHolds.length > 0) {
    await prisma.seatHold.deleteMany({
      where: { id: { in: expiredHolds.map((hold) => hold.id) } },
    });
  }

  const expiredSessions = await prisma.seatHoldSession.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    select: { id: true, userId: true },
  });
  if (expiredSessions.length > 0) {
    await prisma.seatHoldSession.updateMany({
      where: { id: { in: expiredSessions.map((session) => session.id) } },
      data: { status: "EXPIRED" },
    });
  }

  return { expiredHolds, expiredSessions };
}

export function validateSelectionCounts(outboundSeatIds, returnSeatIds = null) {
  if (!Array.isArray(outboundSeatIds) || outboundSeatIds.length === 0) {
    throw httpError(400, "Vui lòng chọn ít nhất một ghế.");
  }
  if (outboundSeatIds.length > MAX_SEATS_PER_LEG) {
    throw httpError(
      400,
      `Mỗi lượt chỉ được chọn tối đa ${MAX_SEATS_PER_LEG} ghế.`,
    );
  }
  if (new Set(outboundSeatIds).size !== outboundSeatIds.length) {
    throw httpError(400, "Danh sách ghế lượt đi bị trùng.");
  }

  if (returnSeatIds) {
    if (!Array.isArray(returnSeatIds) || returnSeatIds.length === 0) {
      throw httpError(400, "Vui lòng chọn ghế cho lượt về.");
    }
    if (returnSeatIds.length > MAX_SEATS_PER_LEG) {
      throw httpError(
        400,
        `Mỗi lượt chỉ được chọn tối đa ${MAX_SEATS_PER_LEG} ghế.`,
      );
    }
    if (new Set(returnSeatIds).size !== returnSeatIds.length) {
      throw httpError(400, "Danh sách ghế lượt về bị trùng.");
    }
    if (outboundSeatIds.length !== returnSeatIds.length) {
      throw httpError(400, "Số ghế lượt đi và lượt về phải bằng nhau.");
    }
  }
}

function normalizeSelectionPayload(payload) {
  const outbound = payload.outbound || {};
  const inbound = payload.return || null;

  assertObjectId(outbound.scheduleId, "Chuyến lượt đi");
  assertObjectId(outbound.fromStationId, "Ga đi");
  assertObjectId(outbound.toStationId, "Ga đến");
  validateSelectionCounts(outbound.seatIds, inbound?.seatIds);
  outbound.seatIds.forEach((seatId) => assertObjectId(seatId, "Ghế lượt đi"));

  if (inbound) {
    assertObjectId(inbound.scheduleId, "Chuyến lượt về");
    assertObjectId(inbound.fromStationId, "Ga về");
    assertObjectId(inbound.toStationId, "Ga kết thúc");
    inbound.seatIds.forEach((seatId) => assertObjectId(seatId, "Ghế lượt về"));
  }

  return { outbound, inbound };
}

function flattenSeats(schedule) {
  return schedule.train.carriages.flatMap((carriage) =>
    carriage.seats.map((seat) => ({
      ...seat,
      carriageType: carriage.carriageType,
    })),
  );
}

async function prepareLegSelection(leg, now) {
  const { schedule, segment } = await getJourney(
    leg.scheduleId,
    leg.fromStationId,
    leg.toStationId,
  );
  const seats = new Map(flattenSeats(schedule).map((seat) => [seat.id, seat]));
  const prices = await pricingByCarriage(schedule, segment);

  return leg.seatIds.map((seatId) => {
    const seat = seats.get(seatId);
    if (!seat) {
      throw httpError(404, "Có ghế không thuộc đoàn tàu của chuyến.");
    }
    if (isPhysicallyBlocked(seat, now)) {
      throw httpError(409, "Có ghế đang bị khóa vận hành.", {
        conflictSeatIds: [seatId],
      });
    }
    const price = prices.get(seat.carriageType);
    if (price == null) {
      throw httpError(409, "Có loại ghế chưa có bảng giá hiệu lực.", {
        conflictSeatIds: [seatId],
      });
    }

    return {
      scheduleId: leg.scheduleId,
      seatId,
      carriageType: seat.carriageType,
      priceSnapshot: price,
    };
  });
}

async function findConflictSeatIds(requests, now) {
  const conflicts = await Promise.all(
    requests.map(async ({ scheduleId, seatId }) => {
      const [hold, booking] = await Promise.all([
        prisma.seatHold.findFirst({
          where: { scheduleId, seatId, expiresAt: { gt: now } },
          select: { id: true },
        }),
        prisma.booking.findFirst({
          where: activeBookingWhere(scheduleId, seatId, now),
          select: { id: true },
        }),
      ]);
      return hold || booking ? seatId : null;
    }),
  );
  return conflicts.filter(Boolean);
}

export async function confirmSeatSelection(userId, payload) {
  const { outbound, inbound } = normalizeSelectionPayload(payload);
  const now = new Date();
  await cleanupExpiredHolds(now);

  const [outboundRequests, returnRequests] = await Promise.all([
    prepareLegSelection(outbound, now),
    inbound ? prepareLegSelection(inbound, now) : Promise.resolve([]),
  ]);
  const requests = [...outboundRequests, ...returnRequests];
  const initialConflicts = await findConflictSeatIds(requests, now);
  if (initialConflicts.length > 0) {
    throw httpError(
      409,
      "Một hoặc nhiều ghế vừa được người khác giữ. Vui lòng chọn lại.",
      { conflictSeatIds: initialConflicts },
    );
  }

  const existingSessions = await prisma.seatHoldSession.findMany({
    where: { userId, status: "ACTIVE", expiresAt: { gt: now } },
    include: { holds: true },
  });
  const releasedHolds = existingSessions.flatMap((session) =>
    session.holds.map((hold) => ({
      scheduleId: hold.scheduleId,
      seatId: hold.seatId,
    })),
  );
  const expiresAt = new Date(now.getTime() + HOLD_DURATION_MS);

  try {
    const sessionId = await prisma.$transaction(async (tx) => {
      for (const request of requests) {
        const sold = await tx.booking.findFirst({
          where: activeBookingWhere(request.scheduleId, request.seatId, now),
          select: { id: true },
        });
        if (sold) {
          throw httpError(
            409,
            "Một hoặc nhiều ghế đã được bán. Vui lòng chọn lại.",
            { conflictSeatIds: [request.seatId] },
          );
        }
      }

      if (existingSessions.length > 0) {
        const oldSessionIds = existingSessions.map((session) => session.id);
        await tx.seatHold.deleteMany({
          where: { sessionId: { in: oldSessionIds } },
        });
        await tx.seatHoldSession.updateMany({
          where: { id: { in: oldSessionIds } },
          data: { status: "RELEASED" },
        });
      }

      const session = await tx.seatHoldSession.create({
        data: {
          userId,
          bookingType: inbound ? "ROUND_TRIP" : "ONE_WAY",
          outboundScheduleId: outbound.scheduleId,
          outboundFromStationId: outbound.fromStationId,
          outboundToStationId: outbound.toStationId,
          returnScheduleId: inbound?.scheduleId,
          returnFromStationId: inbound?.fromStationId,
          returnToStationId: inbound?.toStationId,
          expiresAt,
        },
      });

      for (const request of requests) {
        await tx.seatHold.create({
          data: {
            sessionId: session.id,
            userId,
            ...request,
            expiresAt,
          },
        });
      }
      return session.id;
    });

    return {
      session: await getSession(userId, sessionId),
      releasedHolds,
    };
  } catch (error) {
    if (error.statusCode) throw error;
    if (isSeatConflictError(error)) {
      const conflictSeatIds = await findConflictSeatIds(requests, now);
      throw httpError(
        409,
        "Một hoặc nhiều ghế vừa được người khác giữ. Vui lòng chọn lại.",
        {
          conflictSeatIds:
            conflictSeatIds.length > 0
              ? conflictSeatIds
              : requests.map((request) => request.seatId),
        },
      );
    }
    throw error;
  }
}

export async function getSession(userId, sessionId) {
  assertObjectId(sessionId, "Phiên giữ chỗ");
  await cleanupExpiredHolds();

  const session = await prisma.seatHoldSession.findFirst({
    where: { id: sessionId, userId },
    include: {
      holds: {
        include: {
          seat: {
            select: {
              seatNumber: true,
              seatType: true,
              carriage: {
                select: { carriageNumber: true, carriageType: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) throw httpError(404, "Không tìm thấy phiên giữ chỗ.");
  return session;
}

export async function getSeatMap({
  userId,
  sessionId,
  scheduleId,
  fromStationId,
  toStationId,
}) {
  const now = new Date();
  await cleanupExpiredHolds(now);
  const [{ schedule, segment }, bookedSeats, activeHolds] = await Promise.all([
    getJourney(scheduleId, fromStationId, toStationId),
    bookedSeatIds(scheduleId, now),
    prisma.seatHold.findMany({
      where: { scheduleId, expiresAt: { gt: now } },
      select: {
        seatId: true,
        sessionId: true,
        userId: true,
        expiresAt: true,
      },
    }),
  ]);
  const prices = await pricingByCarriage(schedule, segment);
  const holdBySeat = new Map(activeHolds.map((hold) => [hold.seatId, hold]));

  const carriages = schedule.train.carriages.map((carriage) => {
    const price = prices.get(carriage.carriageType);
    let availableSeats = 0;
    let heldSeats = 0;
    let soldSeats = 0;
    let blockedSeats = 0;

    const seats = carriage.seats
      .map((seat) => {
        const hold = holdBySeat.get(seat.id);
        let state = "AVAILABLE";
        if (isPhysicallyBlocked(seat, now)) state = "BLOCKED";
        else if (bookedSeats.has(seat.id)) state = "SOLD";
        else if (hold) {
          state =
            hold.sessionId === sessionId && hold.userId === userId
              ? "SELECTED"
              : "LOCKED";
        }

        if (state === "AVAILABLE") availableSeats += 1;
        if (state === "SELECTED" || state === "LOCKED") heldSeats += 1;
        if (state === "SOLD") soldSeats += 1;
        if (state === "BLOCKED") blockedSeats += 1;

        return {
          id: seat.id,
          seatNumber: seat.seatNumber,
          seatType: seat.seatType,
          state: price == null && state === "AVAILABLE" ? "UNPRICED" : state,
          price: price ?? null,
          blockReason: state === "BLOCKED" ? seat.blockReason : null,
          amenities:
            carriage.carriageType === "NORMAL_SEAT"
              ? ["Kệ hành lý"]
              : ["Ổ cắm điện", "Kệ hành lý"],
        };
      })
      .sort((a, b) =>
        a.seatNumber.localeCompare(b.seatNumber, undefined, { numeric: true }),
      );

    const totalSellable = Math.max(0, seats.length - blockedSeats);
    return {
      id: carriage.id,
      carriageNumber: carriage.carriageNumber,
      carriageType: carriage.carriageType,
      carriageTypeName:
        CARRIAGE_NAMES[carriage.carriageType] || carriage.carriageType,
      price: price ?? null,
      availableSeats,
      heldSeats,
      soldSeats,
      blockedSeats,
      occupancyPercentage:
        totalSellable === 0
          ? 100
          : Math.round(((heldSeats + soldSeats) / totalSellable) * 10000) / 100,
      seats,
    };
  });

  return {
    schedule: {
      id: schedule.id,
      trainCode: schedule.train.trainCode,
      trainName: schedule.train.trainName,
      routeName: schedule.route.routeName,
      departureTime: segment.departureTime,
      arrivalTime: segment.arrivalTime,
      duration: segment.duration,
      distance: segment.distance,
      fromStation: {
        id: segment.origin.stationId,
        name: segment.origin.stationName,
      },
      toStation: {
        id: segment.destination.stationId,
        name: segment.destination.stationName,
      },
    },
    carriages,
  };
}

export async function releaseSession(userId, sessionId) {
  const session = await getSession(userId, sessionId);
  const holds = session.holds.map((hold) => ({
    scheduleId: hold.scheduleId,
    seatId: hold.seatId,
  }));

  await prisma.$transaction([
    prisma.seatHold.deleteMany({ where: { sessionId, userId } }),
    prisma.seatHoldSession.update({
      where: { id: sessionId },
      data: { status: "RELEASED" },
    }),
  ]);

  return { sessionId, holds };
}
