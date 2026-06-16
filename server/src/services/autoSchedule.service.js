import { prisma } from "../config/database.js";

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

  const targetEnd = new Date(targetDate);
  targetEnd.setHours(23, 59, 59, 999);

  console.log(
    `[AutoSchedule] Bắt đầu kiểm tra tự động tạo lịch trình cho ngày: ${targetDate.toDateString()}`,
  );

  // 1. Kiểm tra xem ngày đích T đã có lịch trình nào chưa
  const existingOnTarget = await prisma.schedule.count({
    where: {
      departureTime: {
        gte: targetDate,
        lte: targetEnd,
      },
    },
  });

  if (existingOnTarget > 0) {
    const msg = `Ngày ${targetDate.toLocaleDateString("vi-VN")} đã có sẵn ${existingOnTarget} lịch trình. Bỏ qua tự động sinh.`;
    console.log(`[AutoSchedule] ${msg}`);
    return { created: 0, skipped: 0, message: msg };
  }

  // 2. Lấy dữ liệu mẫu từ các lịch trình đã chạy/hoạt động trong 7 ngày gần đây
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
      "Không tìm thấy lịch trình mẫu nào trong 7 ngày qua để nhân bản. Hãy tạo lịch trình thủ công trước.";
    console.log(`[AutoSchedule] ${msg}`);
    return { created: 0, skipped: 0, message: msg };
  }

  // 3. Trích xuất mẫu (Route, Train, Giờ trong ngày)
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
  console.log(
    `[AutoSchedule] Phát hiện ${patterns.length} lịch trình mẫu từ 7 ngày qua.`,
  );

  let insertedCount = 0;
  let skippedCount = 0;

  // 4. Lặp qua từng mẫu và tiến hành tạo lịch trình cho ngày đích T
  for (const pattern of patterns) {
    try {
      // Fetch route details
      const route = await prisma.route.findUnique({
        where: { id: pattern.routeId },
        include: { startStation: true, endStation: true },
      });
      if (!route || !route.isActive) {
        skippedCount++;
        continue;
      }

      // Fetch train details and verify seats config
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
        // Tàu chưa cấu hình ghế
        skippedCount++;
        continue;
      }

      // Thiết lập ngày giờ đi cụ thể cho ngày đích T
      const departure = new Date(targetDate);
      departure.setHours(pattern.hour, pattern.minute, 0, 0);
      const arrival = new Date(
        departure.getTime() + route.estimatedDuration * 60 * 1000,
      );

      // Kiểm tra xem tàu đó đã có chuyến chạy nào trùng giờ trên ngày đích chưa
      const bufferMs = 60 * 60 * 1000; // Giãn cách mặc định 60 phút
      const windowStart = departure.getTime() - bufferMs;
      const windowEnd = arrival.getTime() + bufferMs;

      const conflict = await prisma.schedule.findFirst({
        where: {
          trainId: train.id,
          departureTime: {
            gte: new Date(targetDate.getTime() - 24 * 3600 * 1000),
            lte: new Date(targetEnd.getTime() + 24 * 3600 * 1000),
          },
        },
      });

      // Kiểm tra chi tiết overlap
      let hasConflict = false;
      if (conflict) {
        const cSchedules = await prisma.schedule.findMany({
          where: {
            trainId: train.id,
            departureTime: {
              gte: targetDate,
              lte: targetEnd,
            },
          },
        });

        for (const cs of cSchedules) {
          const csStart = new Date(cs.departureTime).getTime();
          const csEnd = new Date(cs.arrivalTime).getTime();
          if (windowStart < csEnd && windowEnd > csStart) {
            hasConflict = true;
            break;
          }
        }
      }

      if (hasConflict) {
        skippedCount++;
        continue;
      }

      // Thực hiện tạo mới trong Transaction
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
            duration: route.estimatedDuration,
            status: "ACTIVE",
          },
        });

        // Tạo ScheduleStops
        if (route.stations.length > 0) {
          const tripDurationMs = arrival.getTime() - departure.getTime();
          await tx.scheduleStop.createMany({
            data: route.stations.map((stop) => {
              const progress = Math.min(
                1,
                Math.max(0, stop.distanceFromStart / route.distance),
              );
              const stopTime = new Date(
                departure.getTime() + tripDurationMs * progress,
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
    } catch (err) {
      console.error(
        `[AutoSchedule] Lỗi khi tạo chuyến mẫu ${pattern.routeId}-${pattern.trainId}:`,
        err,
      );
      skippedCount++;
    }
  }

  const msg = `Tự động tạo thành công ${insertedCount} lịch trình cho ngày ${targetDate.toLocaleDateString("vi-VN")}.${skippedCount > 0 ? ` Bỏ qua ${skippedCount} lịch trình bị trùng lặp/xung đột.` : ""}`;
  console.log(`[AutoSchedule] ${msg}`);
  return { created: insertedCount, skipped: skippedCount, message: msg };
}

/**
 * Khởi chạy timer tự động tạo lịch trình mỗi 24 giờ
 */
export function startAutoScheduleCron() {
  // Chạy thử lần đầu sau 10 giây khi khởi động server
  setTimeout(async () => {
    try {
      await generateSchedulesForDay30();
    } catch (e) {
      console.error("[AutoSchedule] Lỗi chạy ngầm lần đầu:", e);
    }
  }, 10_000);

  // Chạy định kỳ sau mỗi 24 giờ
  const intervalTime = 24 * 3600 * 1000;
  const timer = setInterval(async () => {
    try {
      await generateSchedulesForDay30();
    } catch (e) {
      console.error("[AutoSchedule] Lỗi tác vụ chạy ngầm định kỳ:", e);
    }
  }, intervalTime);

  timer.unref();
}
