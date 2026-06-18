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
            duration: routeWithStations.estimatedDuration,
            status: "ACTIVE",
          },
        });

        if (routeWithStations.stations.length > 0) {
          const tripDurationMs =
            trip.arrival.getTime() - trip.departure.getTime();
          await tx.scheduleStop.createMany({
            data: routeWithStations.stations.map((stop) => {
              const progress = Math.min(
                1,
                Math.max(
                  0,
                  stop.distanceFromStart / routeWithStations.distance,
                ),
              );
              const stopTime = new Date(
                trip.departure.getTime() + tripDurationMs * progress,
              );

              return {
                scheduleId: schedule.id,
                stationId: stop.stationId,
                stopOrder: stop.stopOrder,
                arrivalTime: stopTime,
                departureTime: stopTime,
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
  const route = await prisma.route.update({
    where: { id },
    data: { isActive: false },
  });
  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "DELETE",
      entity: "Route",
      entityId: id,
      description: `Vô hiệu hóa tuyến đường: ${route.routeName}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });
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

  const result = await generateSchedulesForRange(
    startDate.toISOString().split("T")[0],
    endDate.toISOString().split("T")[0],
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
  const { departureTimes, bufferMinutes, isActive } = req.body;

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

export const updateScheduleDelay = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, delayMinutes, notes } = req.body;

  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: {
      train: true,
      route: true,
    },
  });

  if (!schedule) {
    return res.status(404).json({ message: "Không tìm thấy lịch trình." });
  }

  // Check if schedule has already departed
  const delayMs =
    schedule.status === "DELAYED" ? (schedule.delayMinutes || 0) * 60000 : 0;
  const actualDeparture = new Date(schedule.departureTime).getTime() + delayMs;
  if (actualDeparture < Date.now()) {
    return res
      .status(400)
      .json({
        message:
          "Không thể báo trễ/sự cố cho lịch trình đã xuất phát hoặc đã qua giờ chạy.",
      });
  }

  const updatedSchedule = await prisma.schedule.update({
    where: { id },
    data: {
      status: status || schedule.status,
      delayMinutes:
        delayMinutes !== undefined
          ? Number(delayMinutes)
          : schedule.delayMinutes,
      notes: notes !== undefined ? notes : schedule.notes,
    },
  });

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "UPDATE",
      entity: "Schedule",
      entityId: id,
      changes: JSON.stringify({
        oldStatus: schedule.status,
        newStatus: status || schedule.status,
        oldDelay: schedule.delayMinutes,
        newDelay:
          delayMinutes !== undefined
            ? Number(delayMinutes)
            : schedule.delayMinutes,
        notes,
      }),
      description: `Cập nhật trạng thái lịch trình tàu ${schedule.train.trainCode} (${schedule.route.routeName}): Trạng thái: ${status || schedule.status}, Trễ: ${delayMinutes || 0} phút. Ghi chú: ${notes || "Không có"}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.json({
    success: true,
    message: "Cập nhật trạng thái và thời gian trễ của lịch trình thành công.",
    schedule: updatedSchedule,
  });
});
