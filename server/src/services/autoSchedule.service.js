import { prisma } from "../config/database.js";

/**
 * Tự động tạo lịch trình từ các RouteTemplate hoạt động cho một ngày chỉ định
 * @param {Date} targetDate
 * @returns {Promise<{created: number, skipped: number, message: string}>}
 */
export async function generateSchedulesByTemplate(targetDate) {
  const targetDay = new Date(targetDate);
  targetDay.setHours(0, 0, 0, 0);

  const targetEnd = new Date(targetDay);
  targetEnd.setHours(23, 59, 59, 999);

  // 1. Lấy tất cả RouteTemplate đang hoạt động
  const templates = await prisma.routeTemplate.findMany({
    where: { isActive: true },
  });

  // Nếu không có template nào, tự động fallback về logic nhân bản theo 7 ngày trước đó
  if (templates.length === 0) {
    console.log(
      `[AutoSchedule] Không tìm thấy mẫu lịch chạy (RouteTemplate) nào hoạt động. Chuyển sang logic nhân bản từ lịch sử.`,
    );
    return generateSchedulesByBaseline(targetDay);
  }

  let createdCount = 0;
  let skippedCount = 0;

  // 2. Lặp qua từng template và tạo lịch trình cho ngày targetDate
  for (const template of templates) {
    try {
      // Fetch route details
      const route = await prisma.route.findUnique({
        where: { id: template.routeId },
        include: { startStation: true, endStation: true },
      });
      if (!route || !route.isActive) {
        skippedCount += template.departureTimes.length;
        continue;
      }

      // Fetch train details
      const train = await prisma.train.findUnique({
        where: { id: template.trainId },
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
        skippedCount += template.departureTimes.length;
        continue;
      }

      const sellableSeats = train.carriages.reduce(
        (total, carriage) =>
          total +
          (carriage.seats.length > 0
            ? carriage.seats.length
            : carriage.totalSeats),
        0,
      );
      if (train.carriages.length === 0 || sellableSeats === 0) {
        skippedCount += template.departureTimes.length;
        continue;
      }

      // Tạo lịch trình cho từng giờ xuất phát trong mẫu
      for (const timeStr of template.departureTimes) {
        const [hourStr, minStr] = timeStr.split(":");
        const hour = parseInt(hourStr, 10);
        const minute = parseInt(minStr, 10);

        const bufferMins = template.bufferMinutes || 60;
        const numStops = route.stations ? route.stations.length : 0;
        const totalDurationMins =
          route.estimatedDuration + numStops * bufferMins;

        const departure = new Date(targetDay);
        departure.setHours(hour, minute, 0, 0);
        const arrival = new Date(
          departure.getTime() + totalDurationMins * 60 * 1000,
        );

        // Kiểm tra xung đột (giãn cách bufferMinutes)
        const bufferMs = bufferMins * 60 * 1000;
        const windowStart = departure.getTime() - bufferMs;
        const windowEnd = arrival.getTime() + bufferMs;

        // Truy vấn lịch hiện có của tàu trong vòng 2 ngày xung quanh ngày target
        const startRange = new Date(targetDay);
        startRange.setDate(startRange.getDate() - 1);
        const endRange = new Date(targetDay);
        endRange.setDate(endRange.getDate() + 2);

        const existingSchedules = await prisma.schedule.findMany({
          where: {
            trainId: train.id,
            status: { not: "CANCELLED" },
            departureTime: {
              gte: startRange,
              lte: endRange,
            },
          },
        });

        let hasConflict = false;
        for (const cs of existingSchedules) {
          const csStart = new Date(cs.departureTime).getTime();
          const csEnd = new Date(cs.arrivalTime).getTime();
          if (windowStart < csEnd && windowEnd > csStart) {
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) {
          skippedCount++;
          continue;
        }

        // Tạo lịch trình trong Transaction
        await prisma.$transaction(async (tx) => {
          const schedule = await tx.schedule.create({
            data: {
              trainId: train.id,
              routeId: route.id,
              startStationId: route.startStationId,
              endStationId: route.endStationId,
              departureTime: departure,
              arrivalTime: arrival,
              distance: route.distance,
              duration: totalDurationMins,
              status: "ACTIVE",
            },
          });

          // Tạo ScheduleStops
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
                const movingTimeMs =
                  route.estimatedDuration * progress * 60 * 1000;
                const restingTimeMs = index * bufferMins * 60 * 1000;
                const stopArrivalTime = new Date(
                  departure.getTime() + movingTimeMs + restingTimeMs,
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

        createdCount++;
      }
    } catch (err) {
      console.error(
        `[AutoSchedule] Lỗi tạo lịch từ Template cho ngày ${targetDay.toLocaleDateString("vi-VN")}:`,
        err,
      );
      skippedCount += template.departureTimes.length;
    }
  }

  const msg = `Sinh lịch trình từ Mẫu thành công: Tạo mới ${createdCount} lịch trình, Bỏ qua/Xung đột ${skippedCount} lịch trình cho ngày ${targetDay.toLocaleDateString("vi-VN")}.`;
  console.log(`[AutoSchedule] ${msg}`);
  return { created: createdCount, skipped: skippedCount, message: msg };
}

/**
 * Logic nhân bản lịch cũ (baseline 7 ngày qua) dùng làm fallback
 * @param {Date} targetDate
 * @returns {Promise<{created: number, skipped: number, message: string}>}
 */
export async function generateSchedulesByBaseline(targetDate) {
  const targetDay = new Date(targetDate);
  targetDay.setHours(0, 0, 0, 0);

  const targetEnd = new Date(targetDay);
  targetEnd.setHours(23, 59, 59, 999);

  const today = new Date();

  // 1. Kiểm tra xem ngày đích đã có lịch nào chưa
  const existingOnTarget = await prisma.schedule.count({
    where: {
      departureTime: {
        gte: targetDay,
        lte: targetEnd,
      },
    },
  });

  if (existingOnTarget > 0) {
    const msg = `Ngày ${targetDay.toLocaleDateString("vi-VN")} đã có sẵn ${existingOnTarget} lịch trình. Bỏ qua tự động sinh (Baseline).`;
    return { created: 0, skipped: 0, message: msg };
  }

  // 2. Lấy dữ liệu mẫu từ các lịch trình đã chạy trong 7 ngày gần đây
  const baselineStart = new Date(today);
  baselineStart.setDate(baselineStart.getDate() - 7);
  baselineStart.setHours(0, 0, 0, 0);

  const baselineEnd = new Date(today);
  baselineEnd.setHours(23, 59, 59, 999);

  const baselineSchedules = await prisma.schedule.findMany({
    where: {
      departureTime: {
        gte: baselineStart,
        lte: baselineEnd,
      },
      status: "ACTIVE",
    },
    select: {
      routeId: true,
      trainId: true,
      departureTime: true,
      duration: true,
    },
  });

  if (baselineSchedules.length === 0) {
    const msg =
      "Không tìm thấy lịch trình mẫu nào trong 7 ngày qua để nhân bản.";
    return { created: 0, skipped: 0, message: msg };
  }

  // 3. Trích xuất mẫu chạy
  const patternsMap = new Map();
  for (const s of baselineSchedules) {
    const dep = new Date(s.departureTime);
    const hour = dep.getHours();
    const minute = dep.getMinutes();
    const timeStr = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const key = `${s.routeId}-${s.trainId}-${timeStr}`;
    patternsMap.set(key, {
      routeId: s.routeId,
      trainId: s.trainId,
      hour,
      minute,
      timeStr,
    });
  }

  const patterns = Array.from(patternsMap.values());
  let insertedCount = 0;
  let skippedCount = 0;

  // 4. Sinh lịch
  for (const pattern of patterns) {
    try {
      const route = await prisma.route.findUnique({
        where: { id: pattern.routeId },
        include: { startStation: true, endStation: true },
      });
      if (!route || !route.isActive) {
        skippedCount++;
        continue;
      }

      const train = await prisma.train.findUnique({
        where: { id: pattern.trainId },
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
        skippedCount++;
        continue;
      }

      const sellableSeats = train.carriages.reduce(
        (total, carriage) =>
          total +
          (carriage.seats.length > 0
            ? carriage.seats.length
            : carriage.totalSeats),
        0,
      );
      if (train.carriages.length === 0 || sellableSeats === 0) {
        skippedCount++;
        continue;
      }

      const template = await prisma.routeTemplate.findUnique({
        where: {
          routeId_trainId: {
            routeId: pattern.routeId,
            trainId: pattern.trainId,
          },
        },
      });
      const bufferMins = template ? (template.bufferMinutes ?? 60) : 60;
      const numStops = route.stations ? route.stations.length : 0;
      const totalDurationMins = route.estimatedDuration + numStops * bufferMins;

      const departure = new Date(targetDay);
      departure.setHours(pattern.hour, pattern.minute, 0, 0);
      const arrival = new Date(
        departure.getTime() + totalDurationMins * 60 * 1000,
      );

      const bufferMs = bufferMins * 60 * 1000;
      const windowStart = departure.getTime() - bufferMs;
      const windowEnd = arrival.getTime() + bufferMs;

      const startRange = new Date(targetDay);
      startRange.setDate(startRange.getDate() - 1);
      const endRange = new Date(targetDay);
      endRange.setDate(endRange.getDate() + 2);

      const existingSchedules = await prisma.schedule.findMany({
        where: {
          trainId: train.id,
          status: { not: "CANCELLED" },
          departureTime: {
            gte: startRange,
            lte: endRange,
          },
        },
      });

      let hasConflict = false;
      for (const cs of existingSchedules) {
        const csStart = new Date(cs.departureTime).getTime();
        const csEnd = new Date(cs.arrivalTime).getTime();
        if (windowStart < csEnd && windowEnd > csStart) {
          hasConflict = true;
          break;
        }
      }

      if (hasConflict) {
        skippedCount++;
        continue;
      }

      await prisma.$transaction(async (tx) => {
        const schedule = await tx.schedule.create({
          data: {
            trainId: train.id,
            routeId: route.id,
            startStationId: route.startStationId,
            endStationId: route.endStationId,
            departureTime: departure,
            arrivalTime: arrival,
            distance: route.distance,
            duration: totalDurationMins,
            status: "ACTIVE",
          },
        });

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
              const movingTimeMs =
                route.estimatedDuration * progress * 60 * 1000;
              const restingTimeMs = index * bufferMins * 60 * 1000;
              const stopArrivalTime = new Date(
                departure.getTime() + movingTimeMs + restingTimeMs,
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
    } catch (err) {
      console.error("[AutoSchedule] Lỗi khi tạo chuyến baseline:", err);
      skippedCount++;
    }
  }

  const msg = `Tự động nhân bản (Baseline) thành công ${insertedCount} lịch trình cho ngày ${targetDay.toLocaleDateString("vi-VN")}.${skippedCount > 0 ? ` Bỏ qua ${skippedCount} lịch trình bị trùng lặp/xung đột.` : ""}`;
  return { created: insertedCount, skipped: skippedCount, message: msg };
}

/**
 * Tự động tạo lịch trình cho ngày thứ 30 kể từ hôm nay
 * @returns {Promise<{created: number, skipped: number, message: string}>}
 */
export async function generateSchedulesForDay30() {
  const today = new Date();

  // Tính toán ngày đích: T = hôm nay + 30 ngày
  const targetDate = new Date(today);
  targetDate.setDate(targetDate.getDate() + 30);
  targetDate.setHours(0, 0, 0, 0);

  console.log(
    `[AutoSchedule] Bắt đầu tự động quét và tạo lịch trình cho 30 ngày tới: từ ${today.toLocaleDateString("vi-VN")} đến ${targetDate.toLocaleDateString("vi-VN")}`,
  );

  return generateSchedulesForRange(
    today.toISOString().split("T")[0],
    targetDate.toISOString().split("T")[0],
  );
}

/**
 * Sinh lịch trình thủ công hoặc tự động theo khoảng ngày (startDate -> endDate)
 * @param {string} startDateStr
 * @param {string} endDateStr
 * @returns {Promise<{created: number, skipped: number, message: string}>}
 */
export async function generateSchedulesForRange(startDateStr, endDateStr) {
  const start = new Date(startDateStr);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDateStr);
  end.setHours(0, 0, 0, 0);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Định dạng ngày không hợp lệ.");
  }

  if (start > end) {
    throw new Error("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  // Duyệt qua từng ngày trong khoảng thời gian để tạo lịch trình
  const current = new Date(start);
  while (current <= end) {
    const res = await generateSchedulesByTemplate(current);
    totalCreated += res.created;
    totalSkipped += res.skipped;
    current.setDate(current.getDate() + 1);
  }

  return {
    created: totalCreated,
    skipped: totalSkipped,
    message: `Đã sinh lịch chạy thành công từ ngày ${start.toLocaleDateString("vi-VN")} đến ngày ${end.toLocaleDateString("vi-VN")}. Tạo mới: ${totalCreated}, Bỏ qua/Xung đột: ${totalSkipped}.`,
  };
}

/**
 * Khởi chạy timer tự động tạo lịch trình định kỳ lúc 00:00 hàng ngày
 */
export function startAutoScheduleCron() {
  // 1. Chạy thử lần đầu sau 10 giây khi khởi động server để bù lịch nếu có gián đoạn
  setTimeout(async () => {
    try {
      await generateSchedulesForDay30();
    } catch (e) {
      console.error("[AutoSchedule] Lỗi chạy ngầm lần đầu khi khởi động:", e);
    }
  }, 10_000);

  // 2. Tính toán thời gian chờ đến 00:00 đêm tiếp theo
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);

  const msUntilMidnight = nextMidnight.getTime() - now.getTime();

  console.log(
    `[AutoSchedule] Đã hẹn giờ tự động quét tiếp theo vào lúc 00:00 ngày ${nextMidnight.toLocaleDateString("vi-VN")} (sau ${Math.round(msUntilMidnight / 60000)} phút nữa).`,
  );

  // Đợi đến mốc 00:00 đêm
  const startupTimer = setTimeout(() => {
    // Chạy tác vụ lúc 00:00
    try {
      generateSchedulesForDay30();
    } catch (e) {
      console.error("[AutoSchedule] Lỗi chạy ngầm lúc 00:00:", e);
    }

    // Thiết lập chạy lặp lại định kỳ mỗi 24 giờ kể từ lúc 00:00
    const intervalTime = 24 * 3600 * 1000;
    const timer = setInterval(async () => {
      try {
        await generateSchedulesForDay30();
      } catch (e) {
        console.error("[AutoSchedule] Lỗi tác vụ chạy ngầm định kỳ 00:00:", e);
      }
    }, intervalTime);

    timer.unref();
  }, msUntilMidnight);

  startupTimer.unref();
}
