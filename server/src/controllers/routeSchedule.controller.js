import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { searchJourneys } from "../services/scheduleSearch.service.js";
import {
  buildCarriageConfigs,
  createTrainInventory,
} from "../utils/trainInventory.js";
import {
  generateSchedulesForDay30,
  generateSchedulesForRange,
} from "../services/autoSchedule.service.js";

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
          startStation: { select: { stationName: true } },
          endStation: { select: { stationName: true } },
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

// ============================================================
// POST /api/v1/schedules/trigger-auto-generate - Kích hoạt thủ công tạo lịch trình ngày thứ 30
// ============================================================
export const triggerAutoGenerateSchedules = asyncHandler(async (req, res) => {
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 30);

  const result = await generateSchedulesForRange(
    startDate.toISOString().split("T")[0],
    endDate.toISOString().split("T")[0],
  );

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

  const template = await prisma.routeTemplate.create({
    data: {
      routeId,
      trainId,
      departureTimes,
      bufferMinutes: bufferMinutes ? parseInt(bufferMinutes, 10) : 60,
      isActive: isActive !== undefined ? isActive : true,
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

  // Handle routeId or trainId updates with unique constraint verification
  if (routeId || trainId) {
    const current = await prisma.routeTemplate.findUnique({
      where: { id },
    });
    if (!current) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy mẫu lịch chạy cần cập nhật." });
    }
    const nextRouteId = routeId || current.routeId;
    const nextTrainId = trainId || current.trainId;

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

  await prisma.routeTemplate.delete({
    where: { id },
  });

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
  const { delayMinutes } = req.body;

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

    // 3. Cảnh báo tự động BR-32: Gửi thông báo cảnh báo trễ quá 10 phút cho Admin
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

  res.json({
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
    tracking = await prisma.liveTracking.create({
      data: {
        scheduleId: id,
        trainId: schedule.trainId,
        speed: parseFloat(speed) || 0.0,
        temperature: parseFloat(temperature) || 25.0,
        passengerCount: parseInt(passengerCount) || 0,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        currentStation: currentStation || null,
        status: status || "ON_TIME",
      },
    });
  }

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

  if (!tracking) {
    const schedule = await prisma.schedule.findUnique({
      where: { id },
      select: { trainId: true },
    });
    // Trả về dữ liệu mô phỏng mặc định
    tracking = {
      scheduleId: id,
      trainId: schedule?.trainId || "",
      speed: 0.0,
      temperature: 25.0,
      passengerCount: 45,
      latitude: 21.0285,
      longitude: 105.8542,
      currentStation: "Ga Hà Nội",
      status: "ON_TIME",
    };
  }

  res.json({ tracking });
});
