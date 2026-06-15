import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";

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
    include: {
      carriages: {
        include: {
          seats: true,
        },
        orderBy: { carriageNumber: "asc" },
      },
      maintenance: true,
      schedules: {
        include: {
          route: {
            select: {
              routeName: true,
            },
          },
        },
      },
    },
    orderBy: { trainName: "asc" },
  });
  res.json({ trains });
});

// ============================================================
// GET /api/v1/routes - Lấy danh sách tuyến đường
// ============================================================
export const getRoutes = asyncHandler(async (_req, res) => {
  const routes = await prisma.route.findMany({
    include: {
      startStation: { select: { stationName: true, city: true } },
      endStation: { select: { stationName: true, city: true } },
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
  let schedules = await prisma.schedule.findMany({
    include: {
      route: {
        select: {
          routeName: true,
          startStation: { select: { stationName: true } },
          endStation: { select: { stationName: true } },
        },
      },
      train: { select: { trainName: true, trainCode: true } },
      pricing: true,
      availabilitySnapshots: true,
    },
    orderBy: { departureTime: "asc" },
  });

  const now = new Date();

  // Ensure default pricing policies and availability snapshots exist for all schedules
  for (const s of schedules) {
    let needsUpdate = false;

    // 1. Check if pricing policies exist, if not create them
    if (!s.pricing || s.pricing.length === 0) {
      const defaultPolicies = [
        {
          passengerType: "ADULT",
          carriageType: "SEAT",
          basePrice: 350000,
          effectiveFrom: now,
        },
        {
          passengerType: "ADULT",
          carriageType: "AC_SEAT",
          basePrice: 490000,
          effectiveFrom: now,
        },
        {
          passengerType: "ADULT",
          carriageType: "SLEEPER",
          basePrice: 820000,
          effectiveFrom: now,
        },
      ];
      await prisma.pricingPolicy.createMany({
        data: defaultPolicies.map((p) => ({
          scheduleId: s.id,
          ...p,
        })),
      });
      needsUpdate = true;
    }

    // 2. Check if availability snapshots exist, if not create them
    if (!s.availabilitySnapshots || s.availabilitySnapshots.length === 0) {
      const defaultSnapshots = [
        {
          carriageType: "SEAT",
          availableSeats: 35,
          bookedSeats: 45,
          occupancyPercentage: 56.25,
        },
        {
          carriageType: "AC_SEAT",
          availableSeats: 18,
          bookedSeats: 42,
          occupancyPercentage: 70.0,
        },
        {
          carriageType: "SLEEPER",
          availableSeats: 6,
          bookedSeats: 26,
          occupancyPercentage: 81.25,
        },
      ];
      await prisma.availabilitySnapshot.createMany({
        data: defaultSnapshots.map((snap) => ({
          scheduleId: s.id,
          ...snap,
          snapshotTime: now,
        })),
      });
      needsUpdate = true;
    } else {
      // If snapshots exist, check if we need to randomly update them to simulate live booking (e.g. if older than 2 minutes)
      const lastSnapshot = s.availabilitySnapshots[0];
      const timeDiffMs =
        now.getTime() - new Date(lastSnapshot.snapshotTime).getTime();
      const twoMinutesMs = 2 * 60 * 1000;

      if (timeDiffMs > twoMinutesMs) {
        for (const snap of s.availabilitySnapshots) {
          const delta = Math.floor(Math.random() * 3) - 1; // -1, 0, or +1
          let newBooked = Math.max(0, snap.bookedSeats + delta);
          // Set capacity limits
          const totalSeats = snap.carriageType === "SLEEPER" ? 32 : 80;
          if (newBooked > totalSeats) newBooked = totalSeats;
          const newAvailable = totalSeats - newBooked;
          const newPercentage =
            Math.round((newBooked / totalSeats) * 10000) / 100;

          await prisma.availabilitySnapshot.update({
            where: { id: snap.id },
            data: {
              availableSeats: newAvailable,
              bookedSeats: newBooked,
              occupancyPercentage: newPercentage,
              snapshotTime: now,
            },
          });
        }
        needsUpdate = true;
      }
    }
  }

  // Refetch if any updates were made to return fresh data
  schedules = await prisma.schedule.findMany({
    include: {
      route: {
        select: {
          routeName: true,
          startStation: { select: { stationName: true } },
          endStation: { select: { stationName: true } },
        },
      },
      train: { select: { trainName: true, trainCode: true } },
      pricing: true,
      availabilitySnapshots: true,
    },
    orderBy: { departureTime: "asc" },
  });

  res.json({ schedules });
});

// ============================================================
// POST /api/v1/routes/auto-generate - Tự động tạo tuyến đường mới
// ============================================================

// ── Haversine (server-side) ──────────────────────────────────
const RAIL_FACTOR_SRV = 1.2;
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
    const directDist = haversineKmSrv(
      startStation.latitude,
      startStation.longitude,
      endStation.latitude,
      endStation.longitude,
    );

    const offRouteStops = [];
    for (const stop of stations) {
      if (!stop.stationId) continue;
      const stopStation = await prisma.station.findUnique({
        where: { id: stop.stationId },
      });
      if (!stopStation?.latitude) continue;

      const viaDist =
        haversineKmSrv(
          startStation.latitude,
          startStation.longitude,
          stopStation.latitude,
          stopStation.longitude,
        ) +
        haversineKmSrv(
          stopStation.latitude,
          stopStation.longitude,
          endStation.latitude,
          endStation.longitude,
        );

      if (directDist > 0 && viaDist / directDist > DETOUR_THRESHOLD_SRV) {
        offRouteStops.push(stopStation.stationName);
      }
    }

    if (offRouteStops.length > 0) {
      return res.status(422).json({
        message: `Ga trung gian không nằm trên tuyến đường (đi vòng > ${Math.round((DETOUR_THRESHOLD_SRV - 1) * 100)}%): ${offRouteStops.join(", ")}. Vui lòng chọn ga phù hợp với lộ trình.`,
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
      message: `Tuyến đường từ ga này đến ga đích đã tồn tại: "${existing.routeName}". Hãy chọn cặp ga khác.`,
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

  const durationMs = route.estimatedDuration * 60 * 1000;
  const bufferMs = parseInt(bufferMinutes) * 60 * 1000;

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
      await prisma.schedule.create({
        data: {
          trainId,
          routeId,
          startStationId: routeWithStations.startStationId,
          endStationId: routeWithStations.endStationId,
          departureTime: trip.departure,
          arrivalTime: trip.arrival,
          status: "ACTIVE",
        },
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
  await prisma.route.update({ where: { id }, data: { isActive: false } });
  res.json({ message: "Tuyến đường đã được vô hiệu hóa." });
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

  // Calculate total seats and validate carriage types
  let totalCapacity = 0;
  const carriageConfigs = carriages.map((type, idx) => {
    let seatsCount = 0;
    if (type === "NORMAL_SEAT") seatsCount = 40;
    else if (type === "AC_SEAT") seatsCount = 28;
    else if (type === "SLEEPER_6") seatsCount = 24;
    else if (type === "SLEEPER_4") seatsCount = 16;
    else {
      throw new Error(`Loại toa không hợp lệ: ${type}`);
    }
    totalCapacity += seatsCount;
    return {
      carriageNumber: idx + 1,
      carriageType: type,
      totalSeats: seatsCount,
    };
  });

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

    // 2. Create carriages and seats
    for (const config of carriageConfigs) {
      const carriage = await tx.carriage.create({
        data: {
          trainId: newTrain.id,
          carriageNumber: config.carriageNumber,
          carriageType: config.carriageType,
          totalSeats: config.totalSeats,
        },
      });

      // Generate seats for this carriage
      const seatsData = [];
      if (config.carriageType === "NORMAL_SEAT") {
        for (let i = 1; i <= 40; i++) {
          const colIndex = (i - 1) % 4; // 0, 1, 2, 3
          const seatType =
            colIndex === 0 || colIndex === 3 ? "WINDOW" : "AISLE";
          seatsData.push({
            carriageId: carriage.id,
            seatNumber: String(i),
            seatType,
            status: "AVAILABLE",
            basePrice: 100000.0, // basePrice in VND
          });
        }
      } else if (config.carriageType === "AC_SEAT") {
        for (let i = 1; i <= 28; i++) {
          const colIndex = (i - 1) % 4;
          const seatType =
            colIndex === 0 || colIndex === 3 ? "WINDOW" : "AISLE";
          seatsData.push({
            carriageId: carriage.id,
            seatNumber: String(i),
            seatType,
            status: "AVAILABLE",
            basePrice: 120000.0, // 1.2 factor
          });
        }
      } else if (config.carriageType === "SLEEPER_6") {
        // 4 compartments, each 6 beds
        for (let comp = 1; comp <= 4; comp++) {
          // Floors 1, 2, 3
          for (const floor of ["1", "2", "3"]) {
            // Side A, B
            for (const side of ["A", "B"]) {
              let seatType = "WINDOW";
              if (floor === "2") seatType = "MIDDLE";
              if (floor === "3") seatType = "AISLE";

              seatsData.push({
                carriageId: carriage.id,
                seatNumber: `K${comp}-T${floor}-${side}`,
                seatType,
                status: "AVAILABLE",
                basePrice: 150000.0, // 1.5 factor
              });
            }
          }
        }
      } else if (config.carriageType === "SLEEPER_4") {
        // 4 compartments, each 4 beds
        for (let comp = 1; comp <= 4; comp++) {
          // Floors 1, 2
          for (const floor of ["1", "2"]) {
            // Side A, B
            for (const side of ["A", "B"]) {
              let seatType = floor === "1" ? "WINDOW" : "AISLE";

              seatsData.push({
                carriageId: carriage.id,
                seatNumber: `K${comp}-T${floor}-${side}`,
                seatType,
                status: "AVAILABLE",
                basePrice: 180000.0, // 1.8 factor
              });
            }
          }
        }
      }

      await tx.seat.createMany({
        data: seatsData,
      });
    }

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
  await prisma.train.delete({
    where: { id },
  });
  res.json({ message: "Đoàn tàu đã được xóa thành công." });
});
