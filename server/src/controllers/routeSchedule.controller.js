import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { searchJourneys } from "../services/scheduleSearch.service.js";
import { notifyScheduleChange } from "../services/scheduleNotification.service.js";
import { emitLiveTrackingUpdate } from "../realtime/seatRealtime.js";
import {
  buildCarriageConfigs,
  createTrainInventory,
} from "../utils/trainInventory.js";
import {
  generateSchedulesForDay30,
  generateSchedulesForRange,
} from "../services/autoSchedule.service.js";
import {
  validateSameDirectionGap,
  validateOpposingDirectionConflict,
  validateStopTimeSequence,
  validateSingleStopSequence,
} from "../utils/singleTrackValidator.js";

// ============================================================
// GET /api/v1/stations - Lấy danh sách tất cả ga tàu
// ============================================================
export const getStations = asyncHandler(async (_req, res) => {
  const stations = await prisma.station.findMany({
    where: { isActive: true },
    orderBy: { stationName: "asc" },
  });
  res.json({ stations });
});

// ============================================================
// GET /api/v1/trains - Lấy danh sách tàu hỏa
// ============================================================
export const getTrains = asyncHandler(async (_req, res) => {
  const trains = await prisma.train.findMany({
    select: {
      id: true,
      trainName: true,
      trainCode: true,
      trainType: true,
      operatingCompany: true,
      totalCarriages: true,
      totalCapacity: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      maintenance: {
        select: {
          id: true,
          maintenanceType: true,
          startDate: true,
          endDate: true,
          status: true,
        },
      },
      schedules: {
        select: {
          id: true,
          status: true,
          departureTime: true,
          route: {
            select: { routeName: true },
          },
        },
      },
    },
    orderBy: { trainName: "asc" },
  });
  res.json({ trains });
});

export const getTrainById = asyncHandler(async (req, res) => {
  const train = await prisma.train.findUnique({
    where: { id: req.params.id },
    include: {
      carriages: {
        include: {
          seats: {
            orderBy: { seatNumber: "asc" },
          },
        },
        orderBy: { carriageNumber: "asc" },
      },
      maintenance: true,
      schedules: {
        include: {
          route: { select: { routeName: true } },
        },
        orderBy: { departureTime: "desc" },
        take: 20,
      },
    },
  });

  if (!train) {
    return res.status(404).json({ message: "Không tìm thấy đoàn tàu." });
  }

  res.json({ train });
});

// ============================================================
// GET /api/v1/routes - Lấy danh sách tuyến đường
// ============================================================
export const getRoutes = asyncHandler(async (_req, res) => {
  const routes = await prisma.route.findMany({
    include: {
      startStation: { select: { stationName: true, city: true } },
      endStation: { select: { stationName: true, city: true } },
      stations: true,
      _count: { select: { schedules: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ routes });
});

// ============================================================
// GET /api/v1/schedules - Lấy danh sách lịch trình
// ============================================================
export const getSchedules = asyncHandler(async (_req, res) => {
  const schedules = await prisma.schedule.findMany({
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
      createdAt: true,
      route: {
        select: {
          routeName: true,
          stations: true,
          startStation: {
            select: { stationName: true, latitude: true, longitude: true },
          },
          endStation: {
            select: { stationName: true, latitude: true, longitude: true },
          },
        },
      },
      train: { select: { trainName: true, trainCode: true } },
    },
    orderBy: { departureTime: "asc" },
  });

  res.json({ schedules });
});

export const searchSchedules = asyncHandler(async (req, res) => {
  const result = await searchJourneys({
    fromStationId: req.query.fromStationId,
    toStationId: req.query.toStationId,
    departureDate: req.query.departureDate,
    returnDate: req.query.returnDate,
  });
  res.json(result);
});

// ============================================================
// POST /api/v1/routes/auto-generate - Tự động tạo tuyến đường mới
// ============================================================

// ── Haversine (server-side) ──────────────────────────────────
const RAIL_FACTOR_SRV = 1.45;
const DETOUR_THRESHOLD_SRV = 1.5;

function haversineKmSrv(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(
    R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * RAIL_FACTOR_SRV,
  );
}

// ── Bearing Deviation (server-side) ───────────────────────────
function bearingDegSrv(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angleDiffSrv(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

const MAX_BEARING_DEV_SRV = 45;

export const generateRoute = asyncHandler(async (req, res) => {
  const {
    routeName,
    startStationId,
    endStationId,
    distance,
    estimatedDuration,
    stations = [],
  } = req.body;

  // 1. Validate required fields
  if (
    !routeName ||
    !startStationId ||
    !endStationId ||
    !distance ||
    !estimatedDuration
  ) {
    return res.status(400).json({
      message:
        "Thiếu thông tin bắt buộc: tên tuyến, ga đi, ga đến, khoảng cách, thời gian ước tính.",
    });
  }

  // 2. Fetch start & end station coordinates
  const [startStation, endStation] = await Promise.all([
    prisma.station.findUnique({ where: { id: startStationId } }),
    prisma.station.findUnique({ where: { id: endStationId } }),
  ]);

  if (!startStation || !endStation) {
    return res
      .status(404)
      .json({ message: "Ga khởi hành hoặc ga kết thúc không tồn tại." });
  }

  // 3. Validate intermediate stops are geographically on route
  if (stations.length > 0 && startStation.latitude && endStation.latitude) {
    const offRouteStops = [];
    for (const stop of stations) {
      if (!stop.stationId) continue;
      const stopStation = await prisma.station.findUnique({
        where: { id: stop.stationId },
      });
      if (!stopStation?.latitude) continue;

      // Kiểm tra 1: Từ ga đầu, nhìn về ga trung gian phải cùng hướng với nhìn về ga cuối
      const bStartEnd = bearingDegSrv(
        startStation.latitude,
        startStation.longitude,
        endStation.latitude,
        endStation.longitude,
      );
      const bStartStop = bearingDegSrv(
        startStation.latitude,
        startStation.longitude,
        stopStation.latitude,
        stopStation.longitude,
      );
      if (angleDiffSrv(bStartStop, bStartEnd) > MAX_BEARING_DEV_SRV) {
        offRouteStops.push(stopStation.stationName);
        continue;
      }

      // Kiểm tra 2: Từ ga cuối, nhìn về ga trung gian phải cùng hướng với nhìn về ga đầu
      const bEndStart = bearingDegSrv(
        endStation.latitude,
        endStation.longitude,
        startStation.latitude,
        startStation.longitude,
      );
      const bEndStop = bearingDegSrv(
        endStation.latitude,
        endStation.longitude,
        stopStation.latitude,
        stopStation.longitude,
      );
      if (angleDiffSrv(bEndStop, bEndStart) > MAX_BEARING_DEV_SRV) {
        offRouteStops.push(stopStation.stationName);
      }
    }

    if (offRouteStops.length > 0) {
      return res.status(422).json({
        message: `Ga trung gian không nằm trên tuyến đường (lệch hướng > ${MAX_BEARING_DEV_SRV}°): ${offRouteStops.join(", ")}. Vui lòng chọn ga phù hợp với lộ trình.`,
        offRouteStops,
      });
    }
  }

  // 4. Check if route already exists
  const existing = await prisma.route.findFirst({
    where: { startStationId, endStationId },
  });
  if (existing) {
    return res.status(409).json({
      message: `Tuyến đường từ ga khởi hành đến ga kết thúc đã tồn tại: "${existing.routeName}". Hãy chọn cặp ga khác.`,
    });
  }

  // 5. Sort intermediate stops and create route
  const sortedStations = [...stations].sort(
    (a, b) => a.stopOrder - b.stopOrder,
  );

  const route = await prisma.route.create({
    data: {
      routeName,
      startStationId,
      endStationId,
      distance: parseInt(distance),
      estimatedDuration: parseInt(estimatedDuration),
      stations: sortedStations.map((s) => ({
        stationId: s.stationId,
        stationName: s.stationName,
        stopOrder: parseInt(s.stopOrder),
        distanceFromStart: parseInt(s.distanceFromStart),
      })),
    },
    include: {
      startStation: { select: { stationName: true } },
      endStation: { select: { stationName: true } },
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "CREATE",
      entity: "Route",
      entityId: route.id,
      description: `Tạo tuyến đường mới: ${route.routeName} (${route.startStation.stationName} → ${route.endStation.stationName}), khoảng cách ${distance} km`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res
    .status(201)
    .json({ message: "Tuyến đường đã được tạo thành công!", route });
});

// ============================================================
// POST /api/v1/schedules/auto-generate - Tự động tạo lịch trình hàng loạt
// ============================================================
export const generateSchedules = asyncHandler(async (req, res) => {
  const {
    routeId,
    trainId,
    startDate, // ISO string: "2024-10-12"
    endDate, // ISO string: "2024-10-18"
    departureTimes, // Array of "HH:MM" strings per day e.g. ["08:00", "14:30"]
    bufferMinutes = 60, // Min gap between consecutive trips of same train
  } = req.body;

  if (
    !routeId ||
    !trainId ||
    !startDate ||
    !endDate ||
    !departureTimes?.length
  ) {
    return res.status(400).json({
      message:
        "Thiếu thông tin: routeId, trainId, ngày bắt đầu, ngày kết thúc, giờ xuất phát.",
    });
  }

  // 1. Fetch route for duration info
  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route)
    return res.status(404).json({ message: "Không tìm thấy tuyến đường." });

  if (!route.isActive) {
    return res.status(400).json({
      message: "Tuyến đường đã bị vô hiệu hóa. Không thể tạo lịch trình.",
    });
  }

  const train = await prisma.train.findUnique({
    where: { id: trainId },
    select: {
      id: true,
      trainCode: true,
      status: true,
      carriages: {
        select: {
          id: true,
          totalSeats: true,
          seats: {
            where: { status: { not: "BLOCKED" } },
            select: { id: true },
          },
        },
      },
    },
  });

  // [G12] Validate tàu không đang trong bảo trì
  if (train) {
    const now = new Date();
    const activeMaintenance = await prisma.vehicleMaintenance.findFirst({
      where: {
        trainId,
        status: "SCHEDULED",
        startDate: { lte: new Date(endDate || startDate) },
        endDate: { gte: new Date(startDate) },
      },
    });
    if (activeMaintenance) {
      return res.status(400).json({
        message: `Tàu ${train.trainCode} đang có lịch bảo trì trong khoảng thời gian này (từ ${new Date(activeMaintenance.startDate).toLocaleDateString("vi-VN")} đến ${new Date(activeMaintenance.endDate).toLocaleDateString("vi-VN")}). Không thể tạo lịch trình.`,
      });
    }
  }
  if (!train) {
    return res.status(404).json({ message: "Không tìm thấy đoàn tàu." });
  }

  const sellableSeatCount = train.carriages.reduce(
    (total, carriage) =>
      total +
      (carriage.seats.length > 0 ? carriage.seats.length : carriage.totalSeats),
    0,
  );
  if (train.carriages.length === 0 || sellableSeatCount === 0) {
    return res.status(422).json({
      message: `Tàu ${train.trainCode} chưa được cấu hình toa và ghế nên không thể tạo lịch bán vé.`,
    });
  }

  const bufferMins = parseInt(bufferMinutes) || 60;
  const numStops = route.stations ? route.stations.length : 0;
  const totalDurationMins = route.estimatedDuration + numStops * bufferMins;

  const durationMs = totalDurationMins * 60 * 1000;
  const bufferMs = bufferMins * 60 * 1000;

  // 2. Generate all proposed (departure, arrival) pairs for each day in range
  const proposed = [];
  const start = new Date(startDate);
  const end = new Date(endDate);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    for (const timeStr of departureTimes) {
      const [hours, minutes] = timeStr.split(":").map(Number);
      const departure = new Date(d);
      departure.setHours(hours, minutes, 0, 0);
      const arrival = new Date(departure.getTime() + durationMs);
      proposed.push({ departure, arrival });
    }
  }

  // 3. Fetch all existing schedules for this train in the date range
  const existingSchedules = await prisma.schedule.findMany({
    where: {
      trainId,
      departureTime: {
        gte: start,
        lte: new Date(end.getTime() + 24 * 3600 * 1000),
      },
    },
    select: { id: true, departureTime: true, arrivalTime: true },
  });

  // 4. Conflict detection algorithm
  const conflicts = [];
  const valid = [];

  for (const trip of proposed) {
    // Kiểm tra thời gian thực (Real-time Validation): Giờ khởi hành của lịch trình mới phải nằm ở tương lai
    if (trip.departure.getTime() <= Date.now()) {
      conflicts.push({
        proposedDeparture: trip.departure.toISOString(),
        proposedArrival: trip.arrival.toISOString(),
        message: "Giờ khởi hành đã trôi qua so với thời điểm hiện tại.",
      });
      continue;
    }

    // Check overlap: new trip window [departure - buffer, arrival + buffer]
    const windowStart = trip.departure.getTime() - bufferMs;
    const windowEnd = trip.arrival.getTime() + bufferMs;

    const conflictingTrip = existingSchedules.find((existing) => {
      const eStart = new Date(existing.departureTime).getTime();
      const eEnd = new Date(existing.arrivalTime).getTime();
      // Overlap if window overlaps existing trip
      return windowStart < eEnd && windowEnd > eStart;
    });

    if (conflictingTrip) {
      conflicts.push({
        proposedDeparture: trip.departure.toISOString(),
        proposedArrival: trip.arrival.toISOString(),
        conflictingScheduleId: conflictingTrip.id,
        conflictingDeparture: conflictingTrip.departureTime,
        conflictingArrival: conflictingTrip.arrivalTime,
      });
    } else {
      valid.push(trip);
    }
  }

  // 5. If ALL proposed trips conflict, return error without inserting anything
  if (valid.length === 0) {
    return res.status(409).json({
      message:
        "Tất cả lịch trình đề xuất đều bị xung đột với lịch chạy hiện tại của tàu này.",
      conflicts,
    });
  }

  // 6. Bulk insert valid schedules one by one (transaction), skip any that hit DB unique constraint
  const routeWithStations = await prisma.route.findUnique({
    where: { id: routeId },
    include: { startStation: true, endStation: true },
  });

  let insertedCount = 0;
  let dbConflictCount = 0;

  for (const trip of valid) {
    try {
      await prisma.$transaction(async (tx) => {
        const schedule = await tx.schedule.create({
          data: {
            trainId,
            routeId,
            startStationId: routeWithStations.startStationId,
            endStationId: routeWithStations.endStationId,
            departureTime: trip.departure,
            arrivalTime: trip.arrival,
            distance: routeWithStations.distance,
            duration: totalDurationMins,
            status: "ACTIVE",
          },
        });

        if (routeWithStations.stations.length > 0) {
          const sortedStations = [...routeWithStations.stations].sort(
            (a, b) => a.stopOrder - b.stopOrder,
          );
          await tx.scheduleStop.createMany({
            data: sortedStations.map((stop, index) => {
              const progress =
                routeWithStations.distance > 0
                  ? Math.min(
                      1,
                      Math.max(
                        0,
                        stop.distanceFromStart / routeWithStations.distance,
                      ),
                    )
                  : 0;
              const movingTimeMs =
                routeWithStations.estimatedDuration * progress * 60 * 1000;
              const restingTimeMs = index * bufferMins * 60 * 1000;
              const stopArrivalTime = new Date(
                trip.departure.getTime() + movingTimeMs + restingTimeMs,
              );
              const stopDepartureTime = new Date(
                stopArrivalTime.getTime() + bufferMins * 60 * 1000,
              );

              return {
                scheduleId: schedule.id,
                stationId: stop.stationId,
                stopOrder: stop.stopOrder,
                arrivalTime: stopArrivalTime,
                departureTime: stopDepartureTime,
              };
            }),
          });
        }
      });
      insertedCount++;
    } catch (dbErr) {
      // P2002 = unique constraint violation (race condition or duplicate)
      if (dbErr.code === "P2002") {
        dbConflictCount++;
      } else {
        throw dbErr;
      }
    }
  }

  const totalSkipped = conflicts.length + dbConflictCount;

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "CREATE",
      entity: "Schedule",
      description: `Tự động tạo ${insertedCount} lịch trình chạy tàu cho tuyến đường ID ${routeId} và tàu ID ${trainId}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.status(201).json({
    message: `Đã tạo thành công ${insertedCount} lịch trình.${totalSkipped > 0 ? ` Bỏ qua ${totalSkipped} lịch trình bị xung đột.` : ""}`,
    created: insertedCount,
    skipped: totalSkipped,
    conflicts,
  });
});

// ============================================================
// DELETE /api/v1/routes/:id
// ============================================================
export const deleteRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const now = new Date();
  // Safe validation (BR-30): Check if there is any active or delayed train currently running on this route
  const runningSchedule = await prisma.schedule.findFirst({
    where: {
      routeId: id,
      status: { in: ["ACTIVE", "DELAYED"] },
      departureTime: { lte: now },
      arrivalTime: { gte: now },
    },
    include: {
      train: { select: { trainName: true } },
    },
  });

  if (runningSchedule) {
    return res.status(422).json({
      message: `Ràng buộc an toàn (BR-30): Không thể vô hiệu hóa tuyến đường vì có tàu đang chạy trên tuyến này (${runningSchedule.train?.trainName || "Tàu"}).`,
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Update Route isActive status
    const route = await tx.route.update({
      where: { id },
      data: { isActive: false },
    });

    // 2. Fetch active/delayed future schedules for this route to cancel them
    const futureSchedules = await tx.schedule.findMany({
      where: {
        routeId: id,
        status: { in: ["ACTIVE", "DELAYED"] },
        arrivalTime: { gte: new Date() },
      },
      select: { id: true },
    });

    const futureScheduleIds = futureSchedules.map((s) => s.id);
    let confirmedBookings = [];

    if (futureScheduleIds.length > 0) {
      // 3. Update schedules status to CANCELLED
      await tx.schedule.updateMany({
        where: { id: { in: futureScheduleIds } },
        data: {
          status: "CANCELLED",
          notes: `Hủy chuyến do tuyến đường bị vô hiệu hóa (${route.routeName})`,
        },
      });

      // 4. Decline any pending bookings on these schedules
      const pendingBookings = await tx.booking.findMany({
        where: {
          scheduleId: { in: futureScheduleIds },
          status: "PENDING",
        },
      });

      if (pendingBookings.length > 0) {
        const pendingBookingIds = pendingBookings.map((b) => b.id);
        await tx.booking.updateMany({
          where: { id: { in: pendingBookingIds } },
          data: {
            status: "CANCELLED",
            cancelReason: "Tuyến đường ngưng hoạt động",
          },
        });

        for (const booking of pendingBookings) {
          await tx.bookingPaymentHistory.create({
            data: {
              bookingId: booking.id,
              paymentMethod: booking.paymentMethod || "UNKNOWN",
              amount: booking.totalAmount,
              status: "FAILED",
              failureReason: "Tuyến đường ngưng hoạt động",
              attemptNumber: 1,
            },
          });

          if (booking.userId) {
            await tx.notification.create({
              data: {
                userId: booking.userId,
                type: "BOOKING_CANCELLED",
                title: "Đơn đặt vé bị hủy bỏ",
                message: `Rất tiếc, đơn đặt vé ${booking.bookingCode} của bạn đã bị hủy do tuyến đường ngưng hoạt động. Lý do: Dịch vụ hiện không khả dụng.`,
                relatedBookingId: booking.id,
                deliveryMethod: ["IN_APP"],
                deliveryStatus: "SENT",
              },
            });
          }
        }
      }

      // 4b. Cancel and auto-refund any CONFIRMED bookings on these schedules
      confirmedBookings = await tx.booking.findMany({
        where: {
          scheduleId: { in: futureScheduleIds },
          status: "CONFIRMED",
        },
        include: {
          user: {
            select: { email: true, fullName: true },
          },
          schedule: {
            include: {
              train: { select: { trainCode: true, trainName: true } },
              route: {
                include: {
                  startStation: { select: { stationName: true } },
                  endStation: { select: { stationName: true } },
                },
              },
            },
          },
          fromStation: { select: { stationName: true } },
          toStation: { select: { stationName: true } },
          passengers: {
            select: { fullName: true, email: true },
          },
        },
      });

      if (confirmedBookings.length > 0) {
        const confirmedBookingIds = confirmedBookings.map((b) => b.id);

        // Update all booking details to CANCELLED
        await tx.bookingDetail.updateMany({
          where: {
            bookingId: { in: confirmedBookingIds },
            status: { in: ["CONFIRMED", "PENDING"] },
          },
          data: { status: "CANCELLED" },
        });

        const now = new Date();

        for (const booking of confirmedBookings) {
          const method = String(
            booking.paymentMethod || "WALLET",
          ).toUpperCase();
          const isWallet = method === "WALLET";
          const refundStatus = isWallet ? "COMPLETED" : "PENDING";
          const paymentMethod = `REFUND_${isWallet ? "WALLET" : "BANK_TRANSFER"}`;

          // Update booking status
          await tx.booking.update({
            where: { id: booking.id },
            data: {
              status: "CANCELLED",
              paymentStatus: isWallet ? "REFUNDED" : booking.paymentStatus,
              refundAmount: booking.totalAmount,
              cancelReason: "Tuyến đường ngưng hoạt động",
              cancelledAt: now,
            },
          });

          // Create payment history record
          await tx.bookingPaymentHistory.create({
            data: {
              bookingId: booking.id,
              paymentMethod,
              amount: booking.totalAmount,
              status: refundStatus === "COMPLETED" ? "SUCCESS" : "PENDING",
              transactionId:
                refundStatus === "COMPLETED"
                  ? `REFUND-WALLET-AUTO-${randomUUID()}`
                  : null,
              attemptNumber: 1,
            },
          });

          // Create refund tracking record
          await tx.refund.create({
            data: {
              bookingId: booking.id,
              refundAmount: booking.totalAmount,
              refundMethod: isWallet ? "WALLET" : "BANK_TRANSFER",
              status: refundStatus,
              reason: "Tuyến đường ngưng hoạt động",
              processedAt: refundStatus === "COMPLETED" ? now : null,
            },
          });

          // If payment was via wallet, refund to customer's wallet
          if (isWallet && booking.userId) {
            const wallet = await tx.wallet.upsert({
              where: { userId: booking.userId },
              update: {},
              create: { userId: booking.userId, balance: 0, currency: "VND" },
            });
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { balance: { increment: booking.totalAmount } },
            });
            await tx.walletTransaction.create({
              data: {
                walletId: wallet.id,
                type: "REFUND",
                amount: booking.totalAmount,
                description: `Hoàn tiền vé ${booking.bookingCode} (Tuyến đường bị vô hiệu hóa)`,
                relatedBookingId: booking.id,
                status: "COMPLETED",
              },
            });
          }

          // Create in-app notification
          if (booking.userId) {
            await tx.notification.create({
              data: {
                userId: booking.userId,
                type: "BOOKING_CANCELLED",
                title: "Chuyến tàu bị hủy khẩn cấp và Hoàn tiền",
                message: `Chuyến tàu của đơn đặt vé ${booking.bookingCode} đã bị hủy do tuyến đường ngừng hoạt động. Hệ thống đã ${isWallet ? "hoàn trả 100% số tiền vào ví của bạn" : "tạo yêu cầu hoàn tiền chờ chuyển khoản"}.`,
                relatedBookingId: booking.id,
                deliveryMethod: ["IN_APP"],
                deliveryStatus: "SENT",
              },
            });
          }
        }
      }
    }

    // 5. Create admin log
    await tx.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "DELETE",
        entity: "Route",
        entityId: id,
        description: `Vô hiệu hóa tuyến đường: ${route.routeName} và tự động hủy ${futureScheduleIds.length} lịch trình tương ứng.`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    return { route, futureScheduleIds, confirmedBookings };
  });

  // 6. Notify passengers outside transaction to avoid blocking it with email sending
  if (result.confirmedBookings && result.confirmedBookings.length > 0) {
    try {
      notifyScheduleChange(result.confirmedBookings, "CANCELLED", {
        notes: `Hủy chuyến do tuyến đường bị vô hiệu hóa (${result.route.routeName})`,
      });
    } catch (err) {
      console.error("Error notifying schedule change:", err);
    }
  }

  res.json({
    message: `Tuyến đường đã được vô hiệu hóa và tự động hủy ${result.futureScheduleIds.length} lịch trình tương ứng.`,
  });
});

// ============================================================
// PUT /api/v1/routes/:id/activate
// ============================================================
export const activateRoute = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await prisma.route.update({ where: { id }, data: { isActive: true } });
  res.json({ message: "Tuyến đường đã được kích hoạt lại." });
});

// ============================================================
// POST /api/v1/trains - Tạo tàu và sinh ghế
// ============================================================
export const createTrain = asyncHandler(async (req, res) => {
  const {
    trainName,
    trainCode,
    trainType,
    operatingCompany = "GoTrain VN",
    carriages,
  } = req.body;

  if (
    !trainName ||
    !trainCode ||
    !trainType ||
    !carriages ||
    !Array.isArray(carriages) ||
    carriages.length !== 5
  ) {
    return res.status(400).json({
      message: "Thông tin tàu không hợp lệ. Cần nhập đầy đủ và cấu hình 5 toa.",
    });
  }

  // Check unique constraints
  const existingName = await prisma.train.findFirst({
    where: { OR: [{ trainName }, { trainCode }] },
  });
  if (existingName) {
    return res
      .status(400)
      .json({ message: "Số hiệu tàu hoặc mã tàu đã tồn tại trên hệ thống." });
  }

  const carriageConfigs = buildCarriageConfigs(carriages);
  const totalCapacity = carriageConfigs.reduce(
    (total, carriage) => total + carriage.totalSeats,
    0,
  );

  // Start a transaction
  const train = await prisma.$transaction(async (tx) => {
    // 1. Create train
    const newTrain = await tx.train.create({
      data: {
        trainName,
        trainCode,
        trainType,
        operatingCompany,
        totalCarriages: 5,
        totalCapacity,
      },
    });

    await createTrainInventory(tx, newTrain.id, carriages);

    await tx.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "CREATE",
        entity: "Train",
        entityId: newTrain.id,
        description: `Tạo đoàn tàu mới: ${trainName} (${trainCode}) với 5 toa, tổng công suất ${totalCapacity} ghế`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    return newTrain;
  });

  res
    .status(201)
    .json({ message: "Đoàn tàu đã được tạo và sinh ghế thành công!", train });
});

// ============================================================
// DELETE /api/v1/trains/:id - Xóa đoàn tàu
// ============================================================
export const deleteTrain = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const train = await prisma.train.findUnique({ where: { id } });
  if (train) {
    await prisma.train.delete({
      where: { id },
    });
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "DELETE",
        entity: "Train",
        entityId: id,
        description: `Xóa đoàn tàu: ${train.trainName} (${train.trainCode})`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });
  }
  res.json({ message: "Đoàn tàu đã được xóa thành công." });
});

// ============================================================
// POST /api/v1/schedules/trigger-auto-generate - Kích hoạt thủ công tạo lịch trình ngày thứ 30
// ============================================================
export const triggerAutoGenerateSchedules = asyncHandler(async (req, res) => {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const formatLocal = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const result = await generateSchedulesForRange(
    formatLocal(startDate),
    formatLocal(endDate),
  );

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "CREATE",
      entity: "Schedule",
      description: `Kích hoạt thủ công tạo lịch trình 30 ngày tiếp theo. Tạo thành công ${result.created} lịch trình.`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.json({
    message: `Kích hoạt tự động tạo lịch trình thành công! ${result.message}`,
    created: result.created,
    skipped: result.skipped,
  });
});

// ============================================================
// GET /api/v1/route-templates - Lấy danh sách templates mẫu lịch chạy
// ============================================================
export const getRouteTemplates = asyncHandler(async (req, res) => {
  const templates = await prisma.routeTemplate.findMany({
    include: {
      route: {
        include: {
          startStation: true,
          endStation: true,
        },
      },
      train: true,
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ templates });
});

// ============================================================
// Hỗ trợ tính toán giãn cách thời gian cho Mẫu lịch chạy
// ============================================================
function timeToMinutes(timeStr) {
  if (typeof timeStr !== "string" || !timeStr.includes(":")) return 0;
  const parts = timeStr.split(":");
  if (parts.length < 2) return 0;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return 0;
  return h * 60 + m;
}

function minutesToTime(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getMinutesDifference(t1, t2) {
  const m1 = timeToMinutes(t1);
  const m2 = timeToMinutes(t2);
  const diff = Math.abs(m1 - m2);
  return Math.min(diff, 1440 - diff);
}

function findNextSafeTime(proposedTime, occupiedTimesStr, gap = 20) {
  const occupiedMins = occupiedTimesStr.map(timeToMinutes);
  let currentMins = timeToMinutes(proposedTime);
  let attempts = 0;
  while (attempts < 72) {
    let hasConflict = false;
    for (const occ of occupiedMins) {
      const diff = Math.min(
        Math.abs(currentMins - occ),
        1440 - Math.abs(currentMins - occ),
      );
      if (diff < gap) {
        currentMins = (occ + gap) % 1440;
        hasConflict = true;
        break;
      }
    }
    if (!hasConflict) {
      return minutesToTime(currentMins);
    }
    attempts++;
  }
  return minutesToTime((timeToMinutes(proposedTime) + gap) % 1440);
}

// ============================================================
// POST /api/v1/route-templates - Tạo template mới
// ============================================================
export const createRouteTemplate = asyncHandler(async (req, res) => {
  const { routeId, trainId, departureTimes, bufferMinutes, isActive } =
    req.body;

  if (
    !routeId ||
    !trainId ||
    !departureTimes ||
    !Array.isArray(departureTimes)
  ) {
    return res.status(400).json({
      message:
        "Thiếu thông tin bắt buộc hoặc giờ khởi hành không đúng định dạng.",
    });
  }

  const route = await prisma.route.findUnique({ where: { id: routeId } });
  if (!route) {
    return res.status(404).json({ message: "Không tìm thấy tuyến đường." });
  }
  if (!route.isActive) {
    return res.status(400).json({
      message: "Tuyến đường đã bị vô hiệu hóa. Không thể tạo mẫu lịch chạy.",
    });
  }

  // Check unique constraint: one template per (route, train)
  const existing = await prisma.routeTemplate.findUnique({
    where: {
      routeId_trainId: { routeId, trainId },
    },
  });
  if (existing) {
    return res.status(400).json({
      message: "Mẫu lịch chạy cho Tuyến đường và Tàu này đã tồn tại.",
    });
  }

  // Kiểm tra trùng hoặc quá gần với mẫu lịch của tàu khác trên cùng tuyến
  const activeStatus = isActive !== undefined ? isActive : true;
  if (activeStatus) {
    const activeRouteTemplates = await prisma.routeTemplate.findMany({
      where: {
        routeId,
        isActive: true,
        trainId: { not: trainId },
      },
      include: {
        train: true,
      },
    });

    if (activeRouteTemplates.length > 0) {
      const occupiedTimes = activeRouteTemplates.flatMap(
        (t) => t.departureTimes,
      );
      for (const propTime of departureTimes) {
        for (const activeTpl of activeRouteTemplates) {
          for (const occTime of activeTpl.departureTimes) {
            const diff = getMinutesDifference(propTime, occTime);
            if (diff < 20) {
              const safeTime = findNextSafeTime(propTime, occupiedTimes, 20);
              return res.status(400).json({
                message: `Thời gian khởi hành ${propTime} quá gần với giờ chạy ${occTime} của tàu ${activeTpl.train?.trainCode || "khác"} trên cùng tuyến (giãn cách tối thiểu 20 phút). Gợi ý giờ chạy an toàn tiếp theo: ${safeTime}`,
              });
            }
          }
        }
      }
    }
  }

  const template = await prisma.routeTemplate.create({
    data: {
      routeId,
      trainId,
      departureTimes,
      bufferMinutes: bufferMinutes ? parseInt(bufferMinutes, 10) : 60,
      isActive: activeStatus,
    },
    include: {
      route: {
        include: {
          startStation: true,
          endStation: true,
        },
      },
      train: true,
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "CREATE",
      entity: "RouteTemplate",
      entityId: template.id,
      description: `Tạo mẫu lịch chạy mới cho tuyến ${template.route.routeName} và tàu ${template.train.trainCode}, giờ chạy: [${departureTimes.join(", ")}]`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.status(201).json({
    message: "Tạo mẫu lịch chạy thành công!",
    template,
  });
});

// ============================================================
// PUT /api/v1/route-templates/:id - Cập nhật template
// ============================================================
export const updateRouteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { routeId, trainId, departureTimes, bufferMinutes, isActive } =
    req.body;

  const current = await prisma.routeTemplate.findUnique({
    where: { id },
  });
  if (!current) {
    return res
      .status(404)
      .json({ message: "Không tìm thấy mẫu lịch chạy cần cập nhật." });
  }

  const nextRouteId = routeId || current.routeId;
  const targetRoute = await prisma.route.findUnique({
    where: { id: nextRouteId },
  });
  if (!targetRoute) {
    return res.status(404).json({ message: "Không tìm thấy tuyến đường." });
  }

  const nextIsActive = isActive !== undefined ? isActive : current.isActive;
  if (!targetRoute.isActive && nextIsActive) {
    return res.status(400).json({
      message:
        "Tuyến đường đã bị vô hiệu hóa. Không thể chọn hoặc kích hoạt mẫu lịch chạy cho tuyến đường này.",
    });
  }

  const updateData = {};
  if (departureTimes !== undefined && Array.isArray(departureTimes)) {
    updateData.departureTimes = departureTimes;
  }
  if (bufferMinutes !== undefined) {
    updateData.bufferMinutes = parseInt(bufferMinutes, 10);
  }
  if (isActive !== undefined) {
    updateData.isActive = isActive;
  }

  const nextTrainId = trainId || current.trainId;
  const nextDepartureTimes =
    departureTimes !== undefined ? departureTimes : current.departureTimes;

  // Kiểm tra trùng hoặc quá gần với mẫu lịch của tàu khác trên cùng tuyến
  if (nextIsActive) {
    const activeRouteTemplates = await prisma.routeTemplate.findMany({
      where: {
        routeId: nextRouteId,
        isActive: true,
        id: { not: id },
      },
      include: {
        train: true,
      },
    });

    if (activeRouteTemplates.length > 0) {
      const occupiedTimes = activeRouteTemplates.flatMap(
        (t) => t.departureTimes,
      );
      for (const propTime of nextDepartureTimes) {
        for (const activeTpl of activeRouteTemplates) {
          for (const occTime of activeTpl.departureTimes) {
            const diff = getMinutesDifference(propTime, occTime);
            if (diff < 20) {
              const safeTime = findNextSafeTime(propTime, occupiedTimes, 20);
              return res.status(400).json({
                message: `Thời gian khởi hành ${propTime} quá gần với giờ chạy ${occTime} của tàu ${activeTpl.train?.trainCode || "khác"} trên cùng tuyến (giãn cách tối thiểu 20 phút). Gợi ý giờ chạy an toàn tiếp theo: ${safeTime}`,
              });
            }
          }
        }
      }
    }
  }

  // Handle routeId or trainId updates with unique constraint verification
  if (routeId || trainId) {
    if (nextRouteId !== current.routeId || nextTrainId !== current.trainId) {
      const existing = await prisma.routeTemplate.findUnique({
        where: {
          routeId_trainId: { routeId: nextRouteId, trainId: nextTrainId },
        },
      });
      if (existing && existing.id !== id) {
        return res.status(400).json({
          message: "Mẫu lịch chạy cho Tuyến đường và Tàu này đã tồn tại.",
        });
      }
    }
    if (routeId) updateData.routeId = routeId;
    if (trainId) updateData.trainId = trainId;
  }

  const template = await prisma.routeTemplate.update({
    where: { id },
    data: updateData,
    include: {
      route: {
        include: {
          startStation: true,
          endStation: true,
        },
      },
      train: true,
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "UPDATE",
      entity: "RouteTemplate",
      entityId: id,
      changes: JSON.stringify(updateData),
      description: `Cập nhật mẫu lịch chạy của tuyến ${template.route.routeName} và tàu ${template.train.trainCode}: Giờ chạy: [${template.departureTimes.join(", ")}], Active: ${template.isActive}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.json({
    message: "Cập nhật mẫu lịch chạy thành công!",
    template,
  });
});

// ============================================================
// DELETE /api/v1/route-templates/:id - Xóa/vô hiệu template
// ============================================================
export const deleteRouteTemplate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const template = await prisma.routeTemplate.findUnique({
    where: { id },
    include: {
      route: true,
      train: true,
    },
  });

  if (template) {
    await prisma.routeTemplate.delete({
      where: { id },
    });
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "DELETE",
        entity: "RouteTemplate",
        entityId: id,
        description: `Xóa mẫu lịch chạy của tuyến ${template.route.routeName} và tàu ${template.train.trainCode}`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });
  }

  res.json({
    message: "Đã xóa mẫu lịch chạy thành công.",
  });
});

// ============================================================
// POST /api/v1/schedules/generate-range - Gen lịch từ templates theo khoảng ngày
// ============================================================
export const generateSchedulesByRange = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.body;

  if (!startDate || !endDate) {
    return res.status(400).json({
      message: "Vui lòng nhập đầy đủ ngày bắt đầu và ngày kết thúc.",
    });
  }

  const result = await generateSchedulesForRange(startDate, endDate);

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "CREATE",
      entity: "Schedule",
      changes: JSON.stringify({
        startDate,
        endDate,
        createdCount: result.created,
      }),
      description: `Đồng bộ và tự động tạo lịch trình chạy tàu từ ${startDate} đến ${endDate}. Tạo thành công ${result.created} lịch trình.`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.json({
    message: result.message,
    created: result.created,
    skipped: result.skipped,
  });
});

// ============================================================
// Helper: Xây dựng full timeline từ một Schedule
// ============================================================
function buildTimeline(schedule) {
  const { route, scheduleStops, departureTime, arrivalTime } = schedule;

  // Tính khoảng cách từ ga đầu cho từng ScheduleStop
  // Ưu tiên dùng RouteStation embedded data (route.stations[])
  const distanceMap = {};
  if (route.stations && route.stations.length > 0) {
    for (const rs of route.stations) {
      distanceMap[rs.stationId] = rs.distanceFromStart;
    }
  }

  // Điểm 0: Ga khởi hành
  const points = [
    {
      type: "START",
      stationId: route.startStation.id,
      stationName: route.startStation.stationName,
      city: route.startStation.city,
      stopOrder: 0,
      arrivalTime: null,
      departureTime: departureTime,
      distanceFromStart: 0,
    },
  ];

  // Điểm 1..N: Các ga trung gian (ScheduleStop)
  const sortedStops = [...scheduleStops].sort(
    (a, b) => a.stopOrder - b.stopOrder,
  );
  for (const stop of sortedStops) {
    points.push({
      type: "STOP",
      stationId: stop.station.id,
      stationName: stop.station.stationName,
      city: stop.station.city,
      stopOrder: stop.stopOrder,
      arrivalTime: stop.arrivalTime,
      departureTime: stop.departureTime,
      distanceFromStart: distanceMap[stop.station.id] ?? null,
    });
  }

  // Điểm cuối: Ga kết thúc
  points.push({
    type: "END",
    stationId: route.endStation.id,
    stationName: route.endStation.stationName,
    city: route.endStation.city,
    stopOrder: sortedStops.length + 1,
    arrivalTime: arrivalTime,
    departureTime: null,
    distanceFromStart: route.distance,
  });

  // Tính thời gian di chuyển mỗi chặng (phút)
  for (let i = 1; i < points.length; i++) {
    const prevTime = points[i - 1].departureTime ?? points[i - 1].arrivalTime;
    const currTime = points[i].arrivalTime ?? points[i].departureTime;
    if (prevTime && currTime) {
      const diffMs =
        new Date(currTime).getTime() - new Date(prevTime).getTime();
      points[i].segmentMinutes = Math.round(diffMs / 60000);
      // Khoảng cách chặng này (km)
      if (
        points[i].distanceFromStart != null &&
        points[i - 1].distanceFromStart != null
      ) {
        points[i].segmentDistanceKm =
          points[i].distanceFromStart - points[i - 1].distanceFromStart;
      }
    }
  }

  return points;
}

// ============================================================
// GET /api/v1/schedules/:id/timeline - Lịch Trình Nối Tiếp Liên Tục
// ============================================================
export const getScheduleTimeline = asyncHandler(async (req, res) => {
  const schedule = await prisma.schedule.findUnique({
    where: { id: req.params.id },
    include: {
      train: {
        select: {
          trainName: true,
          trainCode: true,
          trainType: true,
          totalCapacity: true,
        },
      },
      route: {
        include: {
          startStation: {
            select: {
              id: true,
              stationName: true,
              city: true,
              latitude: true,
              longitude: true,
            },
          },
          endStation: {
            select: {
              id: true,
              stationName: true,
              city: true,
              latitude: true,
              longitude: true,
            },
          },
        },
      },
      scheduleStops: {
        include: {
          station: {
            select: {
              id: true,
              stationName: true,
              city: true,
              latitude: true,
              longitude: true,
            },
          },
        },
        orderBy: { stopOrder: "asc" },
      },
    },
  });

  if (!schedule) {
    return res.status(404).json({ message: "Không tìm thấy lịch trình." });
  }

  const timeline = buildTimeline(schedule);

  res.json({
    schedule: {
      id: schedule.id,
      status: schedule.status,
      departureTime: schedule.departureTime,
      arrivalTime: schedule.arrivalTime,
      distance: schedule.distance,
      duration: schedule.duration,
      delayMinutes: schedule.delayMinutes,
      train: schedule.train,
      routeName: schedule.route.routeName,
    },
    timeline,
  });
});

// Can thiệp trạng thái vận hành của tàu trực tiếp
export const updateTrainStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!["ACTIVE", "INACTIVE", "MAINTENANCE"].includes(status)) {
    return res
      .status(400)
      .json({ message: "Trạng thái vận hành không hợp lệ." });
  }

  const now = new Date();

  // Ràng buộc an toàn BR-30: Tàu không được ở trạng thái đang chạy trên đường ray
  const runningSchedule = await prisma.schedule.findFirst({
    where: {
      trainId: id,
      status: { in: ["ACTIVE", "DELAYED"] },
      departureTime: { lte: now },
      arrivalTime: { gte: now },
    },
  });

  if (runningSchedule) {
    return res.status(422).json({
      message:
        "Ràng buộc an toàn (BR-30): Không thể thay đổi trạng thái của tàu đang chạy trên đường ray. Hãy đợi tàu cập ga.",
    });
  }

  const updatedTrain = await prisma.$transaction(async (tx) => {
    const t = await tx.train.update({
      where: { id },
      data: { status },
    });

    // BR-29: Khi tàu ngừng kích hoạt (INACTIVE/MAINTENANCE), tự động từ chối (Decline) các vé pending của các chuyến tàu tương lai
    if (status === "INACTIVE" || status === "MAINTENANCE") {
      const schedules = await tx.schedule.findMany({
        where: {
          trainId: id,
          departureTime: { gte: now },
        },
        select: { id: true },
      });
      const scheduleIds = schedules.map((s) => s.id);

      if (scheduleIds.length > 0) {
        const bookings = await tx.booking.findMany({
          where: {
            scheduleId: { in: scheduleIds },
            status: "PENDING",
          },
        });

        if (bookings.length > 0) {
          await tx.booking.updateMany({
            where: { id: { in: bookings.map((b) => b.id) } },
            data: {
              status: "CANCELLED",
              cancelReason: "Dịch vụ hiện không khả dụng",
            },
          });

          for (const booking of bookings) {
            await tx.bookingPaymentHistory.create({
              data: {
                bookingId: booking.id,
                paymentMethod: booking.paymentMethod || "UNKNOWN",
                amount: booking.totalAmount,
                status: "FAILED",
                failureReason:
                  "Dịch vụ hiện không khả dụng (Ngừng kích hoạt tàu)",
                attemptNumber: 1,
              },
            });

            if (booking.userId) {
              await tx.notification.create({
                data: {
                  userId: booking.userId,
                  type: "BOOKING_CANCELLED",
                  title: "Đơn đặt vé bị hủy bỏ",
                  message: `Rất tiếc, đơn đặt vé ${booking.bookingCode} của bạn đã bị hủy tự động vì tàu tạm dừng vận hành. Lý do: Dịch vụ hiện không khả dụng.`,
                  relatedBookingId: booking.id,
                  deliveryMethod: ["IN_APP"],
                  deliveryStatus: "SENT",
                },
              });
            }
          }
        }
      }
    }

    return t;
  });

  res.json({
    message: `Cập nhật trạng thái vận hành của tàu thành ${status} thành công.`,
    train: updatedTrain,
  });
});

// Cập nhật trễ chuyến tàu & Tự động tính toán lại lịch ga tiếp theo
export const updateScheduleDelay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { delayMinutes, notes } = req.body;

  const delayMins = parseInt(delayMinutes);
  if (isNaN(delayMins) || delayMins < 0) {
    return res
      .status(400)
      .json({ message: "Số phút trễ phải là số nguyên dương." });
  }

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      train: { select: { trainCode: true } },
      route: { select: { routeName: true } },
      scheduleStops: true,
    },
  });

  if (!schedule) {
    return res.status(404).json({ message: "Không tìm thấy lịch trình." });
  }

  // Check if schedule has already departed
  if (new Date(schedule.departureTime).getTime() < Date.now()) {
    return res.status(400).json({
      message:
        "Không thể báo trễ/sự cố cho lịch trình đã xuất phát hoặc đã qua giờ chạy.",
    });
  }

  const deltaMs = delayMins * 60 * 1000;
  const newDeparture = new Date(
    new Date(schedule.departureTime).getTime() + deltaMs,
  );
  const newArrival = new Date(
    new Date(schedule.arrivalTime).getTime() + deltaMs,
  );

  const updatedSchedule = await prisma.$transaction(async (tx) => {
    // 1. Cập nhật lịch trình chính
    const s = await tx.schedule.update({
      where: { id },
      data: {
        delayMinutes: delayMins,
        departureTime: newDeparture,
        arrivalTime: newArrival,
        status: delayMins > 0 ? "DELAYED" : "ACTIVE",
        notes: notes !== undefined ? notes : schedule.notes,
      },
    });

    // 2. Tự động tính toán lại giờ đến/đi của các ga tiếp theo (ScheduleStop)
    for (const stop of schedule.scheduleStops) {
      const stopArr = new Date(new Date(stop.arrivalTime).getTime() + deltaMs);
      const stopDep = stop.departureTime
        ? new Date(new Date(stop.departureTime).getTime() + deltaMs)
        : null;

      await tx.scheduleStop.update({
        where: { id: stop.id },
        data: {
          arrivalTime: stopArr,
          departureTime: stopDep,
        },
      });
    }

    // 3. Ghi log hoạt động admin (audit log)
    await tx.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "UPDATE",
        entity: "Schedule",
        entityId: id,
        changes: JSON.stringify({
          oldStatus: schedule.status,
          newStatus: delayMins > 0 ? "DELAYED" : "ACTIVE",
          oldDelay: schedule.delayMinutes,
          newDelay: delayMins,
          notes,
        }),
        description: `Cập nhật trạng thái lịch trình tàu ${schedule.train.trainCode} (${schedule.route.routeName}): Trạng thái: ${delayMins > 0 ? "DELAYED" : "ACTIVE"}, Trễ: ${delayMins} phút. Ghi chú: ${notes || "Không có"}`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    // 4. Cảnh báo tự động BR-32: Gửi thông báo cảnh báo trễ quá 10 phút cho Admin
    if (delayMins > 10) {
      const admins = await tx.user.findMany({
        where: { userType: "ADMIN" },
        select: { id: true },
      });

      for (const admin of admins) {
        await tx.notification.create({
          data: {
            userId: admin.id,
            type: "DELAY_WARNING",
            title: "Cảnh báo trễ chuyến tàu",
            message: `Chú ý: Tàu ${schedule.train.trainCode} (Tuyến ${schedule.route.routeName}) đang bị trễ ${delayMins} phút so với lịch trình gốc.`,
            relatedScheduleId: id,
            deliveryMethod: ["IN_APP"],
            deliveryStatus: "SENT",
          },
        });
      }
    }

    return s;
  });

  // 5. Gửi email thông báo cho hành khách nếu trễ giờ
  if (delayMins > 0) {
    notifyScheduleChange(id, "DELAYED", {
      delayMinutes: delayMins,
      originalDepartureTime: schedule.departureTime,
      newDepartureTime: newDeparture,
      notes: notes,
    });
  }

  res.json({
    success: true,
    message: `Cập nhật thời gian trễ ${delayMins} phút thành công. Đã tính toán lại toàn bộ lịch trình các ga sau.`,
    schedule: updatedSchedule,
  });
});

// Cập nhật thông số live-tracking thời gian thực
export const updateScheduleLiveTracking = asyncHandler(async (req, res) => {
  const { id } = req.params; // scheduleId
  const {
    speed,
    temperature,
    passengerCount,
    latitude,
    longitude,
    currentStation,
    status,
  } = req.body;

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    select: { trainId: true },
  });

  if (!schedule) {
    return res.status(404).json({ message: "Không tìm thấy lịch trình." });
  }

  const existing = await prisma.liveTracking.findFirst({
    where: { scheduleId: id },
  });

  let tracking;

  if (existing) {
    tracking = await prisma.liveTracking.update({
      where: { id: existing.id },
      data: {
        speed: speed !== undefined ? parseFloat(speed) : existing.speed,
        temperature:
          temperature !== undefined
            ? parseFloat(temperature)
            : existing.temperature,
        passengerCount:
          passengerCount !== undefined
            ? parseInt(passengerCount)
            : existing.passengerCount,
        latitude:
          latitude !== undefined ? parseFloat(latitude) : existing.latitude,
        longitude:
          longitude !== undefined ? parseFloat(longitude) : existing.longitude,
        currentStation:
          currentStation !== undefined
            ? currentStation
            : existing.currentStation,
        status: status || existing.status,
        lastUpdated: new Date(),
      },
    });
  } else {
    const bookedPassengerCount = await prisma.passenger.count({
      where: {
        booking: {
          scheduleId: id,
          status: { in: ["CONFIRMED", "COMPLETED"] },
        },
      },
    });

    tracking = await prisma.liveTracking.create({
      data: {
        scheduleId: id,
        trainId: schedule.trainId,
        speed: parseFloat(speed) || 0.0,
        temperature: parseFloat(temperature) || 25.0,
        passengerCount:
          passengerCount !== undefined
            ? parseInt(passengerCount)
            : bookedPassengerCount || 45,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        currentStation: currentStation || null,
        status: status || "ON_TIME",
      },
    });
  }

  // Phát tín hiệu websocket đồng bộ realtime định vị tàu
  emitLiveTrackingUpdate(id, tracking);

  res.json({
    message: "Cập nhật dữ liệu điều hành hành trình thời gian thực thành công.",
    tracking,
  });
});

// Lấy thông số live-tracking thời gian thực
export const getScheduleLiveTracking = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let tracking = await prisma.liveTracking.findFirst({
    where: { scheduleId: id },
  });

  const bookedPassengerCount = await prisma.passenger.count({
    where: {
      booking: {
        scheduleId: id,
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    },
  });

  if (!tracking) {
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      select: { trainId: true },
    });
    // Trả về dữ liệu mô phỏng mặc định
    tracking = {
      scheduleId: id,
      trainId: schedule?.trainId || "",
      speed: 55.0,
      temperature: 25.0,
      passengerCount: bookedPassengerCount || 45,
      latitude: 21.0285,
      longitude: 105.8542,
      currentStation: "Ga Hà Nội",
      status: "ON_TIME",
    };
  } else {
    if (!tracking.passengerCount) {
      tracking.passengerCount = bookedPassengerCount || 45;
    }
  }

  res.json({ tracking });
});

// ============================================================
// GET /api/v1/schedules/active-tracking - Lấy tất cả tracking tàu đang chạy hôm nay
// ============================================================
export const getActiveSchedulesTracking = asyncHandler(async (req, res) => {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  // Lấy tất cả lịch trình có giờ chạy trong ngày hôm nay
  const schedules = await prisma.schedule.findMany({
    where: {
      departureTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
      status: {
        in: ["ACTIVE", "DELAYED"],
      },
    },
    include: {
      train: { select: { trainName: true, trainCode: true } },
      route: {
        include: {
          startStation: {
            select: {
              id: true,
              stationName: true,
              latitude: true,
              longitude: true,
              city: true,
            },
          },
          endStation: {
            select: {
              id: true,
              stationName: true,
              latitude: true,
              longitude: true,
              city: true,
            },
          },
        },
      },
      scheduleStops: {
        include: {
          station: {
            select: {
              id: true,
              stationName: true,
              latitude: true,
              longitude: true,
              city: true,
            },
          },
        },
        orderBy: { stopOrder: "asc" },
      },
    },
  });

  // Tìm các bản ghi live tracking tương ứng
  const scheduleIds = schedules.map((s) => s.id);
  const trackings = await prisma.liveTracking.findMany({
    where: {
      scheduleId: { in: scheduleIds },
    },
  });

  const trackingMap = {};
  trackings.forEach((t) => {
    trackingMap[t.scheduleId] = t;
  });

  // Truy vấn số lượng khách đặt vé thành công cho các schedule này
  const passengers = await prisma.passenger.findMany({
    where: {
      booking: {
        scheduleId: { in: scheduleIds },
        status: { in: ["CONFIRMED", "COMPLETED"] },
      },
    },
    select: {
      booking: {
        select: {
          scheduleId: true,
        },
      },
    },
  });

  const actualCounts = {};
  passengers.forEach((p) => {
    const sId = p.booking?.scheduleId;
    if (sId) {
      actualCounts[sId] = (actualCounts[sId] || 0) + 1;
    }
  });

  const results = schedules.map((s) => {
    const defaultLat = s.route.startStation.latitude || 21.0285;
    const defaultLong = s.route.startStation.longitude || 105.8412;
    const defaultStation = s.route.startStation.stationName || "Ga xuất phát";
    const realCount = actualCounts[s.id] || 0;

    let tr = trackingMap[s.id];
    if (!tr) {
      tr = {
        scheduleId: s.id,
        trainId: s.trainId,
        speed: 55.0,
        temperature: 24.5,
        passengerCount: realCount || 50,
        latitude: defaultLat,
        longitude: defaultLong,
        currentStation: defaultStation,
        status: s.status === "DELAYED" ? "DELAYED" : "ON_TIME",
        lastUpdated: new Date(),
      };
    } else if (!tr.passengerCount) {
      tr.passengerCount = realCount || 50;
    }

    return {
      schedule: {
        id: s.id,
        trainId: s.trainId,
        routeId: s.routeId,
        departureTime: s.departureTime,
        arrivalTime: s.arrivalTime,
        status: s.status,
        delayMinutes: s.delayMinutes,
        notes: s.notes,
        train: s.train,
        route: s.route,
        scheduleStops: s.scheduleStops,
      },
      tracking: tr,
    };
  });

  res.json({ activeTrackings: results });
});

// ============================================================
// POST /api/v1/schedules - Tạo lịch trình đơn lẻ (UC-27 G4)
// ============================================================
export const createSchedule = asyncHandler(async (req, res) => {
  const {
    trainId,
    routeId,
    departureTime,
    bufferMinutes = 60,
    notes,
  } = req.body;

  // --- Validate required fields (MSG07) ---
  if (!trainId || !routeId || !departureTime) {
    return res.status(400).json({
      message: "Thiếu thông tin bắt buộc: ID tàu, ID tuyến, giờ xuất phát.",
    });
  }

  // --- Validate không tạo lịch trong quá khứ ---
  if (new Date(departureTime) < new Date()) {
    return res.status(400).json({
      message: "Không thể tạo lịch trình trong quá khứ.",
    });
  }

  // --- Fetch route ---
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: { startStation: true, endStation: true },
  });
  if (!route)
    return res.status(404).json({ message: "Không tìm thấy tuyến đường." });
  if (!route.isActive)
    return res.status(400).json({ message: "Tuyến đường đã bị vô hiệu hóa." });

  // --- Fetch train ---
  const train = await prisma.train.findUnique({
    where: { id: trainId },
    select: {
      id: true,
      trainCode: true,
      carriages: {
        select: {
          id: true,
          totalSeats: true,
          seats: {
            where: { status: { not: "BLOCKED" } },
            select: { id: true },
          },
        },
      },
    },
  });
  if (!train)
    return res.status(404).json({ message: "Không tìm thấy đoàn tàu." });

  // --- [G12] Validate tàu không trong bảo trì ---
  const activeMaintenance = await prisma.vehicleMaintenance.findFirst({
    where: {
      trainId,
      status: "SCHEDULED",
      startDate: { lte: new Date(departureTime) },
      endDate: { gte: new Date(departureTime) },
    },
  });
  if (activeMaintenance) {
    return res.status(400).json({
      message: `Tàu ${train.trainCode} đang có lịch bảo trì trùng với thời gian này. Không thể tạo lịch trình.`,
    });
  }

  // --- Tính arrivalTime từ route.estimatedDuration + bufferMinutes ---
  const bufferMins = parseInt(bufferMinutes) || 60;
  const numStops = route.stations ? route.stations.length : 0;
  const totalDurationMins = route.estimatedDuration + numStops * bufferMins;
  const arrivalTime = new Date(
    new Date(departureTime).getTime() + totalDurationMins * 60 * 1000,
  );

  // --- [G9] Validate ràng buộc duy nhất (bộ tứ) ---
  const duplicate = await prisma.schedule.findFirst({
    where: {
      trainId,
      startStationId: route.startStationId,
      endStationId: route.endStationId,
      departureTime: new Date(departureTime),
    },
  });
  if (duplicate) {
    return res.status(409).json({
      message: `Đã tồn tại lịch trình cho tàu ${train.trainCode} trên tuyến này với giờ xuất phát trùng lặp.`,
    });
  }

  // --- [G1] Validate đường đơn: giãn cách cùng chiều ---
  const gapCheck = await validateSameDirectionGap({
    routeId,
    departureTime: new Date(departureTime),
    arrivalTime,
  });
  if (!gapCheck.valid) {
    return res.status(409).json({
      message: gapCheck.conflict.message,
      conflictType: "SAME_DIRECTION_GAP",
      conflict: gapCheck.conflict,
    });
  }

  // --- [G2] Validate đường đơn: tránh tàu ngược chiều ---
  const oppCheck = await validateOpposingDirectionConflict({
    startStationId: route.startStationId,
    endStationId: route.endStationId,
    departureTime: new Date(departureTime),
    arrivalTime,
    proposedStops: [],
  });
  if (!oppCheck.valid) {
    return res.status(409).json({
      message: oppCheck.conflict.message,
      conflictType: "OPPOSING_DIRECTION",
      conflict: oppCheck.conflict,
    });
  }

  // --- Tạo Schedule + auto-generate ScheduleStop ---
  const schedule = await prisma.$transaction(async (tx) => {
    const newSchedule = await tx.schedule.create({
      data: {
        trainId,
        routeId,
        startStationId: route.startStationId,
        endStationId: route.endStationId,
        departureTime: new Date(departureTime),
        arrivalTime,
        distance: route.distance,
        duration: totalDurationMins,
        status: "ACTIVE",
        notes: notes || null,
      },
    });

    // Auto-generate ScheduleStop theo distanceFromStart
    if (route.stations && route.stations.length > 0) {
      const sortedStations = [...route.stations].sort(
        (a, b) => a.stopOrder - b.stopOrder,
      );
      await tx.scheduleStop.createMany({
        data: sortedStations.map((stop, index) => {
          const progress =
            route.distance > 0
              ? Math.min(
                  1,
                  Math.max(0, stop.distanceFromStart / route.distance),
                )
              : 0;
          const movingTimeMs = route.estimatedDuration * progress * 60 * 1000;
          const restingTimeMs = index * bufferMins * 60 * 1000;
          const stopArrivalTime = new Date(
            new Date(departureTime).getTime() + movingTimeMs + restingTimeMs,
          );
          const stopDepartureTime = new Date(
            stopArrivalTime.getTime() + bufferMins * 60 * 1000,
          );
          return {
            scheduleId: newSchedule.id,
            stationId: stop.stationId,
            stopOrder: stop.stopOrder,
            arrivalTime: stopArrivalTime,
            departureTime: stopDepartureTime,
          };
        }),
      });
    }

    await tx.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "CREATE",
        entity: "Schedule",
        entityId: newSchedule.id,
        description: `Tạo lịch trình đơn lẻ: Tàu ${train.trainCode} | Tuyến ${route.routeName} | Xuất phát ${new Date(departureTime).toLocaleString("vi-VN")}`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    return newSchedule;
  });

  res.status(201).json({
    message: `Đã tạo lịch trình thành công! Tàu ${train.trainCode} xuất phát lúc ${new Date(departureTime).toLocaleString("vi-VN")}.`,
    schedule,
  });
});

// ============================================================
// PUT /api/v1/schedules/:id - Cập nhật lịch trình đơn lẻ (UC-27 G5)
// ============================================================
export const updateSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { departureTime, arrivalTime, notes } = req.body;

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      train: { select: { trainCode: true } },
      route: {
        select: { routeName: true, startStationId: true, endStationId: true },
      },
      scheduleStops: true,
    },
  });

  if (!schedule)
    return res.status(404).json({ message: "Không tìm thấy lịch trình." });

  // Không sửa lịch đã kết thúc
  if (
    new Date(schedule.arrivalTime) < new Date() &&
    schedule.status !== "DELAYED"
  ) {
    return res
      .status(400)
      .json({ message: "Không thể sửa lịch trình đã kết thúc." });
  }

  const newDep = departureTime
    ? new Date(departureTime)
    : new Date(schedule.departureTime);
  const newArr = arrivalTime
    ? new Date(arrivalTime)
    : new Date(schedule.arrivalTime);

  if (newDep >= newArr) {
    return res
      .status(400)
      .json({ message: "Giờ xuất phát phải trước giờ cập ga cuối." });
  }

  // [G1] Validate giãn cách cùng chiều
  const gapCheck = await validateSameDirectionGap({
    routeId: schedule.routeId,
    departureTime: newDep,
    arrivalTime: newArr,
    excludeScheduleId: id,
  });
  if (!gapCheck.valid) {
    return res.status(409).json({
      message: gapCheck.conflict.message,
      conflictType: "SAME_DIRECTION_GAP",
      conflict: gapCheck.conflict,
    });
  }

  // [G2] Validate tránh tàu ngược chiều
  const oppCheck = await validateOpposingDirectionConflict({
    startStationId: schedule.route.startStationId,
    endStationId: schedule.route.endStationId,
    departureTime: newDep,
    arrivalTime: newArr,
    excludeScheduleId: id,
  });
  if (!oppCheck.valid) {
    return res.status(409).json({
      message: oppCheck.conflict.message,
      conflictType: "OPPOSING_DIRECTION",
      conflict: oppCheck.conflict,
    });
  }

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.schedule.update({
      where: { id },
      data: {
        departureTime: newDep,
        arrivalTime: newArr,
        ...(notes !== undefined ? { notes } : {}),
        status: "ACTIVE",
        delayMinutes: 0,
      },
    });

    await tx.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "UPDATE",
        entity: "Schedule",
        entityId: id,
        changes: JSON.stringify({
          oldDep: schedule.departureTime,
          newDep,
          oldArr: schedule.arrivalTime,
          newArr,
        }),
        description: `Cập nhật lịch trình tàu ${schedule.train.trainCode} (${schedule.route.routeName}): Xuất phát mới ${newDep.toLocaleString("vi-VN")}`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    return s;
  });

  // [BR-14] Gửi email nếu có booking confirmed
  const confirmedCount = await prisma.booking.count({
    where: { scheduleId: id, status: "CONFIRMED" },
  });
  if (confirmedCount > 0) {
    notifyScheduleChange(id, "DELAYED", {
      delayMinutes: 0,
      originalDepartureTime: schedule.departureTime,
      newDepartureTime: newDep,
      notes: notes || "Cập nhật giờ xuất phát",
    });
  }

  res.json({
    message: `Đã cập nhật lịch trình thành công.${confirmedCount > 0 ? ` Đã thông báo ${confirmedCount} hành khách.` : ""}`,
    schedule: updated,
    notifiedPassengers: confirmedCount,
  });
});

// ============================================================
// PATCH /api/v1/schedules/:id/cancel - Hủy lịch trình đơn lẻ (UC-27 G6)
// ============================================================
export const cancelSchedule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason = "Admin hủy lịch trình" } = req.body;

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      train: { select: { trainCode: true, trainName: true } },
      route: {
        include: {
          startStation: { select: { stationName: true } },
          endStation: { select: { stationName: true } },
        },
      },
    },
  });

  if (!schedule)
    return res.status(404).json({ message: "Không tìm thấy lịch trình." });
  if (schedule.status === "CANCELLED") {
    return res
      .status(400)
      .json({ message: "Lịch trình này đã bị hủy trước đó." });
  }

  // Lấy các booking bị ảnh hưởng
  const confirmedBookings = await prisma.booking.findMany({
    where: { scheduleId: id, status: "CONFIRMED" },
    include: {
      user: { select: { email: true, fullName: true } },
      schedule: {
        include: {
          train: { select: { trainCode: true, trainName: true } },
          route: {
            include: {
              startStation: { select: { stationName: true } },
              endStation: { select: { stationName: true } },
            },
          },
        },
      },
      fromStation: { select: { stationName: true } },
      toStation: { select: { stationName: true } },
      passengers: { select: { fullName: true, email: true } },
    },
  });

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    // 1. Hủy lịch trình
    await tx.schedule.update({
      where: { id },
      data: { status: "CANCELLED", notes: reason },
    });

    // 2. Hủy booking PENDING
    const pendingBookings = await tx.booking.findMany({
      where: { scheduleId: id, status: "PENDING" },
    });
    if (pendingBookings.length > 0) {
      await tx.booking.updateMany({
        where: { id: { in: pendingBookings.map((b) => b.id) } },
        data: { status: "CANCELLED", cancelReason: reason },
      });
    }

    // 3. Hoàn tiền booking CONFIRMED
    for (const booking of confirmedBookings) {
      const method = String(booking.paymentMethod || "WALLET").toUpperCase();
      const isWallet = method === "WALLET";

      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: "CANCELLED",
          paymentStatus: isWallet ? "REFUNDED" : booking.paymentStatus,
          refundAmount: booking.totalAmount,
          cancelReason: reason,
          cancelledAt: now,
        },
      });

      await tx.refund.create({
        data: {
          bookingId: booking.id,
          refundAmount: booking.totalAmount,
          refundMethod: isWallet ? "WALLET" : "BANK_TRANSFER",
          status: isWallet ? "COMPLETED" : "PENDING",
          reason,
          processedAt: isWallet ? now : null,
        },
      });

      if (isWallet && booking.userId) {
        const wallet = await tx.wallet.upsert({
          where: { userId: booking.userId },
          update: {},
          create: { userId: booking.userId, balance: 0, currency: "VND" },
        });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: { increment: booking.totalAmount } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            type: "REFUND",
            amount: booking.totalAmount,
            description: `Hoàn tiền vé ${booking.bookingCode} (Hủy lịch trình)`,
            relatedBookingId: booking.id,
            status: "COMPLETED",
          },
        });
      }

      if (booking.userId) {
        await tx.notification.create({
          data: {
            userId: booking.userId,
            type: "BOOKING_CANCELLED",
            title: "Chuyến tàu bị hủy và Hoàn tiền",
            message: `Chuyến tàu ${schedule.train.trainCode} (${schedule.route.routeName}) xuất phát lúc ${new Date(schedule.departureTime).toLocaleString("vi-VN")} đã bị hủy. ${isWallet ? "Hệ thống đã hoàn trả 100% vào ví của bạn." : "Yêu cầu hoàn tiền đã được tạo."}`,
            relatedBookingId: booking.id,
            deliveryMethod: ["IN_APP"],
            deliveryStatus: "SENT",
          },
        });
      }
    }

    // 4. AdminLog
    await tx.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "DELETE",
        entity: "Schedule",
        entityId: id,
        description: `Hủy lịch trình: Tàu ${schedule.train.trainCode} (${schedule.route.routeName}) xuất phát ${new Date(schedule.departureTime).toLocaleString("vi-VN")}. Lý do: ${reason}. Ảnh hưởng ${confirmedBookings.length} đặt vé.`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });
  });

  // [BR-14] Gửi email cho hành khách (ngoài transaction)
  if (confirmedBookings.length > 0) {
    notifyScheduleChange(confirmedBookings, "CANCELLED", { notes: reason });
  }

  res.json({
    message: `Đã hủy lịch trình thành công. Hoàn tiền tự động cho ${confirmedBookings.length} đặt vé.`,
    cancelledScheduleId: id,
    refundedBookings: confirmedBookings.length,
  });
});

// ============================================================
// PUT /api/v1/schedules/:scheduleId/stops/:stopId - Chỉnh sửa ScheduleStop (UC-27 G3b)
// ?preview=true → chỉ validate, không lưu DB
// ============================================================
export const updateScheduleStop = asyncHandler(async (req, res) => {
  const { scheduleId, stopId } = req.params;
  const { arrivalTime, departureTime } = req.body;
  const isPreview = req.query.preview === "true";

  // --- Validate required fields ---
  if (!arrivalTime || !departureTime) {
    return res.status(400).json({
      message:
        "Giờ đến (arrivalTime) và giờ đi (departureTime) đều là bắt buộc.",
    });
  }

  // --- Lấy Schedule và ScheduleStop ---
  const schedule = await prisma.schedule.findUnique({
    where: { id: scheduleId },
    include: {
      train: { select: { trainCode: true } },
      route: {
        select: {
          routeName: true,
          startStationId: true,
          endStationId: true,
        },
      },
      scheduleStops: {
        orderBy: { stopOrder: "asc" },
        include: { station: { select: { id: true, stationName: true } } },
      },
    },
  });

  if (!schedule)
    return res.status(404).json({ message: "Không tìm thấy lịch trình." });

  // [Validate 2] Không sửa lịch đã khởi hành
  if (new Date(schedule.departureTime) < new Date()) {
    return res.status(400).json({
      message:
        "Không thể chỉnh sửa ga dừng của lịch trình đã khởi hành hoặc đã qua.",
    });
  }

  const stop = schedule.scheduleStops.find((s) => s.id === stopId);
  if (!stop)
    return res
      .status(404)
      .json({ message: "Không tìm thấy ga dừng trong lịch trình này." });

  const stopIndex = schedule.scheduleStops.findIndex((s) => s.id === stopId);
  const prevStop = stopIndex > 0 ? schedule.scheduleStops[stopIndex - 1] : null;
  const nextStop =
    stopIndex < schedule.scheduleStops.length - 1
      ? schedule.scheduleStops[stopIndex + 1]
      : null;

  // [Validate 1] Tính tuần tự tại stop này
  const seqCheck = validateSingleStopSequence({
    arrivalTime: new Date(arrivalTime),
    departureTime: new Date(departureTime),
    prevStop,
    nextStop,
    scheduleDepartureTime: schedule.departureTime,
    scheduleArrivalTime: schedule.arrivalTime,
  });

  if (!seqCheck.valid) {
    return res.status(400).json({
      message: seqCheck.errors[0],
      errors: seqCheck.errors,
    });
  }

  // [Validate 3 & 4] Đường đơn — kiểm tra với giờ mới
  const warnings = [];
  let suggestion = null;

  // Xây dựng lại danh sách stops với giờ mới cho stop hiện tại
  const updatedStops = schedule.scheduleStops.map((s) => ({
    stationId: s.station.id,
    stopOrder: s.stopOrder,
    arrivalTime: s.id === stopId ? new Date(arrivalTime) : s.arrivalTime,
    departureTime: s.id === stopId ? new Date(departureTime) : s.departureTime,
  }));

  const gapCheck = await validateSameDirectionGap({
    routeId: schedule.routeId,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    excludeScheduleId: scheduleId,
  });

  if (!gapCheck.valid) {
    if (isPreview) {
      warnings.push({
        type: "SAME_DIRECTION_GAP",
        message: gapCheck.conflict.message,
      });
    } else {
      return res.status(409).json({
        message: gapCheck.conflict.message,
        conflictType: "SAME_DIRECTION_GAP",
        conflict: gapCheck.conflict,
      });
    }
  }

  const oppCheck = await validateOpposingDirectionConflict({
    startStationId: schedule.route.startStationId,
    endStationId: schedule.route.endStationId,
    departureTime: schedule.departureTime,
    arrivalTime: schedule.arrivalTime,
    proposedStops: updatedStops,
    excludeScheduleId: scheduleId,
  });

  if (!oppCheck.valid) {
    suggestion = oppCheck.conflict.suggestedDepartureTime;
    if (isPreview) {
      warnings.push({
        type: "OPPOSING_DIRECTION",
        message: oppCheck.conflict.message,
        conflictingTrain: oppCheck.conflict.conflictingTrain,
        suggestedDepartureTime: suggestion,
      });
    } else {
      return res.status(409).json({
        message: oppCheck.conflict.message,
        conflictType: "OPPOSING_DIRECTION",
        conflict: oppCheck.conflict,
        suggestedDepartureTime: suggestion,
      });
    }
  }

  // === Preview mode: trả về kết quả mà không lưu DB ===
  if (isPreview) {
    return res.json({
      valid: warnings.length === 0,
      warnings,
      suggestedDepartureTime: suggestion,
      message:
        warnings.length === 0
          ? "Thời gian hợp lệ. Không có xung đột đường đơn."
          : `Phát hiện ${warnings.length} cảnh báo đường đơn.`,
    });
  }

  // === Lưu DB thật ===
  const updatedStop = await prisma.$transaction(async (tx) => {
    const s = await tx.scheduleStop.update({
      where: { id: stopId },
      data: {
        arrivalTime: new Date(arrivalTime),
        departureTime: new Date(departureTime),
      },
      include: { station: { select: { stationName: true } } },
    });

    await tx.adminLog.create({
      data: {
        adminId: req.user.id,
        action: "UPDATE",
        entity: "ScheduleStop",
        entityId: stopId,
        changes: JSON.stringify({
          oldArrival: stop.arrivalTime,
          newArrival: arrivalTime,
          oldDeparture: stop.departureTime,
          newDeparture: departureTime,
        }),
        description: `Điều chỉnh giờ dừng tại ga ${s.station.stationName} của lịch trình tàu ${schedule.train.trainCode} (${schedule.route.routeName}). Giờ đến mới: ${new Date(arrivalTime).toLocaleString("vi-VN")}, Giờ đi mới: ${new Date(departureTime).toLocaleString("vi-VN")}`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      },
    });

    return s;
  });

  // [BR-14] Thông báo hành khách nếu có booking CONFIRMED
  const confirmedCount = await prisma.booking.count({
    where: { scheduleId, status: "CONFIRMED" },
  });
  if (confirmedCount > 0) {
    notifyScheduleChange(scheduleId, "DELAYED", {
      delayMinutes: 0,
      originalDepartureTime: schedule.departureTime,
      newDepartureTime: schedule.departureTime,
      notes: `Thay đổi giờ dừng tại ga ${updatedStop.station.stationName}`,
    });
  }

  res.json({
    message: `Đã cập nhật giờ dừng tại ga ${updatedStop.station.stationName}.${confirmedCount > 0 ? ` Đã thông báo ${confirmedCount} hành khách.` : ""}`,
    updatedStop,
    notifiedPassengers: confirmedCount,
    singleTrackStatus: warnings.length === 0 ? "CLEAR" : "WARNING",
    warnings,
  });
});
