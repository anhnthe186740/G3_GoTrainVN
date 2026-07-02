import { prisma } from "../config/database.js";
import { calculateFare, getConfiguration } from "./pricing.service.js";
import {
  isDepartureWithinRange,
  parseVietnamDateRange,
  resolveJourneySegment,
} from "../utils/journey.js";

const SELLABLE_SCHEDULE_STATUSES = ["ACTIVE", "DELAYED"];
const ACTIVE_BOOKING_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"];

const CARRIAGE_NAMES = {
  NORMAL_SEAT: "Ghế thường",
  AC_SEAT: "Ghế điều hòa",
  SLEEPER_6: "Giường nằm khoang 6",
  SLEEPER_4: "Giường nằm khoang 4",
};

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateSearchInput({
  fromStationId,
  toStationId,
  departureDate,
  returnDate,
}) {
  if (!fromStationId || !toStationId || !departureDate) {
    throw httpError(400, "Vui lòng chọn ga đi, ga đến và ngày đi.");
  }
  if (
    !/^[a-f\d]{24}$/i.test(fromStationId) ||
    !/^[a-f\d]{24}$/i.test(toStationId)
  ) {
    throw httpError(400, "Mã ga không hợp lệ.");
  }
  if (fromStationId === toStationId) {
    throw httpError(400, "Ga đi và ga đến không được trùng nhau.");
  }

  const outboundRange = parseVietnamDateRange(departureDate, "Ngày đi");
  const todayRange = parseVietnamDateRange(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date()),
    "Ngày hiện tại",
  );

  if (outboundRange.start < todayRange.start) {
    throw httpError(400, "Ngày đi không được ở quá khứ.");
  }

  let inboundRange = null;
  if (returnDate) {
    inboundRange = parseVietnamDateRange(returnDate, "Ngày về");
    if (inboundRange.start < outboundRange.start) {
      throw httpError(400, "Ngày về không được trước ngày đi.");
    }
  }

  return { outboundRange, inboundRange };
}

async function ensureStationsExist(fromStationId, toStationId) {
  const stations = await prisma.station.findMany({
    where: {
      id: { in: [fromStationId, toStationId] },
      isActive: true,
    },
    select: {
      id: true,
      stationCode: true,
      stationName: true,
      city: true,
    },
  });

  if (stations.length !== 2) {
    throw httpError(
      404,
      "Ga đi hoặc ga đến không tồn tại hay đã ngừng hoạt động.",
    );
  }

  return new Map(stations.map((station) => [station.id, station]));
}

async function getCandidateSchedules(range) {
  const delayedCandidateStart = new Date(
    range.start.getTime() - 24 * 60 * 60 * 1000,
  );
  return prisma.schedule.findMany({
    where: {
      status: { in: SELLABLE_SCHEDULE_STATUSES },
      departureTime: { lt: range.end },
      arrivalTime: { gte: delayedCandidateStart },
    },
    select: {
      id: true,
      trainId: true,
      routeId: true,
      startStationId: true,
      endStationId: true,
      departureTime: true,
      arrivalTime: true,
      distance: true,
      duration: true,
      status: true,
      delayMinutes: true,
      notes: true,
      route: {
        select: {
          id: true,
          routeName: true,
          distance: true,
          estimatedDuration: true,
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
              carriageType: true,
              totalSeats: true,
              seats: {
                select: { id: true, status: true },
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
    },
    orderBy: { departureTime: "asc" },
    take: 250,
  });
}

/**
 * P1 — Lấy các ghế đã bán theo chặng cho từng schedule.
 * scheduleSegments: Array<{scheduleId, fromStopOrder, toStopOrder}>
 * Trả về: Map<scheduleId, Map<carriageType, Set<seatId>>> —
 *   chỉ gồm các ghế có chặng đã bán OVERLAP với chặng được yêu cầu.
 */
async function getBookedSeatsBySchedule(scheduleSegments, now) {
  if (scheduleSegments.length === 0) return new Map();

  const scheduleIds = scheduleSegments.map((s) => s.scheduleId);
  const segmentBySchedule = new Map(
    scheduleSegments.map((s) => [s.scheduleId, s]),
  );

  const [bookings, activeHolds] = await Promise.all([
    prisma.booking.findMany({
      where: {
        scheduleId: { in: scheduleIds },
        status: { in: ACTIVE_BOOKING_STATUSES },
      },
      select: {
        scheduleId: true,
        status: true,
        expiresAt: true,
        bookingDetails: {
          where: { status: { not: "CANCELLED" } },
          select: {
            seatId: true,
            fromStopOrder: true, // P1
            toStopOrder: true, // P1
            seat: {
              select: {
                carriage: { select: { carriageType: true } },
              },
            },
          },
        },
      },
    }),
    prisma.seatHold.findMany({
      where: {
        scheduleId: { in: scheduleIds },
        expiresAt: { gt: now },
      },
      select: {
        scheduleId: true,
        seatId: true,
        carriageType: true,
        fromStopOrder: true, // P1
        toStopOrder: true, // P1
      },
    }),
  ]);

  const bookedBySchedule = new Map();

  for (const booking of bookings) {
    if (
      booking.status === "PENDING" &&
      booking.expiresAt &&
      new Date(booking.expiresAt) <= now
    ) {
      continue;
    }

    const reqSeg = segmentBySchedule.get(booking.scheduleId);
    if (!reqSeg) continue;

    if (!bookedBySchedule.has(booking.scheduleId)) {
      bookedBySchedule.set(booking.scheduleId, new Map());
    }
    const byType = bookedBySchedule.get(booking.scheduleId);

    for (const detail of booking.bookingDetails) {
      // P1: chỉ đếm ghế này nếu chặng đã bán OVERLAP với chặng đang tìm kiếm
      const detailFrom = detail.fromStopOrder ?? 0;
      const detailTo = detail.toStopOrder ?? 9999;
      const overlapWithRequest =
        reqSeg.fromStopOrder < detailTo && reqSeg.toStopOrder > detailFrom;
      if (!overlapWithRequest) continue;

      const carriageType = detail.seat.carriage.carriageType;
      if (!byType.has(carriageType)) byType.set(carriageType, new Set());
      byType.get(carriageType).add(detail.seatId);
    }
  }

  for (const hold of activeHolds) {
    const reqSeg = segmentBySchedule.get(hold.scheduleId);
    if (!reqSeg) continue;

    // P1: chỉ tính hold trùng chặng
    const holdFrom = hold.fromStopOrder ?? 0;
    const holdTo = hold.toStopOrder ?? 9999;
    const overlapWithRequest =
      reqSeg.fromStopOrder < holdTo && reqSeg.toStopOrder > holdFrom;
    if (!overlapWithRequest) continue;

    if (!bookedBySchedule.has(hold.scheduleId)) {
      bookedBySchedule.set(hold.scheduleId, new Map());
    }
    const byType = bookedBySchedule.get(hold.scheduleId);
    if (!byType.has(hold.carriageType)) {
      byType.set(hold.carriageType, new Set());
    }
    byType.get(hold.carriageType).add(hold.seatId);
  }

  return bookedBySchedule;
}

function buildAvailability(schedule, bookedByType = new Map()) {
  const availability = new Map();

  for (const carriage of schedule.train.carriages) {
    if (!availability.has(carriage.carriageType)) {
      availability.set(carriage.carriageType, {
        carriageType: carriage.carriageType,
        totalSeats: 0,
        bookedSeats: 0,
      });
    }

    const entry = availability.get(carriage.carriageType);
    const usableSeats = carriage.seats.filter(
      (seat) => seat.status !== "BLOCKED",
    ).length;
    entry.totalSeats +=
      carriage.seats.length > 0 ? usableSeats : carriage.totalSeats;
  }

  for (const [carriageType, entry] of availability) {
    entry.bookedSeats = bookedByType.get(carriageType)?.size || 0;
    entry.availableSeats = Math.max(0, entry.totalSeats - entry.bookedSeats);
    entry.occupancyPercentage =
      entry.totalSeats === 0
        ? 0
        : Math.round((entry.bookedSeats / entry.totalSeats) * 10000) / 100;
  }

  return [...availability.values()];
}

async function buildPricing(schedule, distance, at, availability) {
  const configuration = await getConfiguration({
    scopeType: "SCHEDULE",
    scopeId: schedule.id,
    at: at.toISOString(),
  });
  const availableTypes = new Set(
    availability
      .filter((entry) => entry.availableSeats > 0)
      .map((entry) => entry.carriageType),
  );

  return configuration.effectiveRules
    .filter(
      (rule) =>
        rule.passengerType === "ADULT" && availableTypes.has(rule.carriageType),
    )
    .map((rule) => ({
      carriageType: rule.carriageType,
      carriageTypeName: CARRIAGE_NAMES[rule.carriageType] || rule.carriageType,
      price: calculateFare(rule, distance, rule.taxPercentage).finalPrice,
    }))
    .sort((a, b) => a.price - b.price);
}

async function searchLeg({ fromStationId, toStationId, range, now }) {
  const candidates = await getCandidateSchedules(range);
  const matched = candidates
    .filter((schedule) => schedule.route.isActive)
    .map((schedule) => ({
      schedule,
      segment: resolveJourneySegment(schedule, fromStationId, toStationId),
    }))
    .filter(
      ({ segment }) => segment && isDepartureWithinRange(segment, range, now),
    );

  const bookedSeats = await getBookedSeatsBySchedule(
    // P1: truyền segment của từng schedule để đếm ghế trùng chặng
    matched.map(({ schedule, segment }) => ({
      scheduleId: schedule.id,
      fromStopOrder: segment.origin.order,
      toStopOrder: segment.destination.order,
    })),
    now,
  );

  const results = await Promise.all(
    matched.map(async ({ schedule, segment }) => {
      const availability = buildAvailability(
        schedule,
        bookedSeats.get(schedule.id),
      );
      const pricing = await buildPricing(
        schedule,
        segment.distance,
        segment.departureTime,
        availability,
      );

      if (pricing.length === 0) return null;

      return {
        id: schedule.id,
        status: schedule.status,
        delayMinutes: schedule.delayMinutes,
        trainCode: schedule.train.trainCode,
        trainName: schedule.train.trainName,
        trainType: schedule.train.trainType,
        routeId: schedule.routeId,
        routeName: schedule.route.routeName,
        fromStation: {
          id: segment.origin.stationId,
          name: segment.origin.stationName,
        },
        toStation: {
          id: segment.destination.stationId,
          name: segment.destination.stationName,
        },
        departureTime: segment.departureTime,
        arrivalTime: segment.arrivalTime,
        duration: segment.duration,
        distance: segment.distance,
        intermediateStops: segment.stops.map((stop) => ({
          stationId: stop.stationId,
          stationName: stop.stationName,
          arrivalTime: stop.arrivalTime,
          departureTime: stop.departureTime,
        })),
        pricing,
        availability,
      };
    }),
  );

  return results
    .filter(Boolean)
    .sort((a, b) => new Date(a.departureTime) - new Date(b.departureTime));
}

export async function searchJourneys(params) {
  const { fromStationId, toStationId, departureDate, returnDate } = params;
  const { outboundRange, inboundRange } = validateSearchInput(params);
  const stations = await ensureStationsExist(fromStationId, toStationId);
  const now = new Date();

  const [outbound, inbound] = await Promise.all([
    searchLeg({
      fromStationId,
      toStationId,
      range: outboundRange,
      now,
    }),
    inboundRange
      ? searchLeg({
          fromStationId: toStationId,
          toStationId: fromStationId,
          range: inboundRange,
          now,
        })
      : Promise.resolve([]),
  ]);

  return {
    query: {
      fromStation: stations.get(fromStationId),
      toStation: stations.get(toStationId),
      departureDate,
      returnDate: returnDate || null,
    },
    outbound,
    return: inbound,
  };
}
