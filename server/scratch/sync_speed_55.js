import { PrismaClient } from "@gotrain/prisma-client-v2";

const prisma = new PrismaClient();

async function main() {
  console.log("🔄 Bắt đầu đồng bộ tốc độ tàu về 55 km/h...");

  // 1. Cập nhật tất cả các Route
  const routes = await prisma.route.findMany();
  console.log(
    `Tìm thấy ${routes.length} tuyến đường. Đang cập nhật thời gian chạy ước tính...`,
  );

  for (const route of routes) {
    const newEstDuration = Math.round((route.distance / 55) * 60); // thời gian chạy tính bằng phút tại 55 km/h
    await prisma.route.update({
      where: { id: route.id },
      data: {
        estimatedDuration: newEstDuration,
      },
    });
    console.log(
      `- Tuyến ${route.routeName}: Khoảng cách ${route.distance} km -> Thời gian ước tính mới: ${newEstDuration} phút (~${(newEstDuration / 60).toFixed(2)}h)`,
    );
  }

  // 2. Cập nhật tất cả các Lịch chạy (Schedule) và các Ga dừng (ScheduleStop)
  const schedules = await prisma.schedule.findMany({
    include: {
      route: true,
      scheduleStops: {
        orderBy: { stopOrder: "asc" },
      },
    },
  });

  console.log(
    `\nTìm thấy ${schedules.length} lịch trình. Đang tính toán lại giờ chạy và giờ dừng ga...`,
  );

  for (const schedule of schedules) {
    const route = schedule.route;
    if (!route) {
      console.warn(
        `⚠️ Lịch trình ID ${schedule.id} không liên kết với tuyến đường hợp lệ. Bỏ qua.`,
      );
      continue;
    }

    const newRouteEstDuration = Math.round((route.distance / 55) * 60);
    const numStops = schedule.scheduleStops.length;
    const bufferMins = 60; // Mặc định dừng 60 phút ở mỗi ga trung gian
    const totalDurationMins = newRouteEstDuration + numStops * bufferMins;

    const newArrivalTime = new Date(
      schedule.departureTime.getTime() + totalDurationMins * 60 * 1000,
    );

    // Cập nhật Schedule
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        duration: totalDurationMins,
        arrivalTime: newArrivalTime,
      },
    });

    console.log(
      `- Lịch trình ${schedule.id} (Tàu ${schedule.trainId || "N/A"}):`,
    );
    console.log(
      `  * Đi: ${schedule.departureTime.toISOString()} -> Đến mới: ${newArrivalTime.toISOString()} (Tổng: ${totalDurationMins} phút)`,
    );

    // Cập nhật từng ScheduleStop
    for (let index = 0; index < schedule.scheduleStops.length; index++) {
      const stop = schedule.scheduleStops[index];

      // Tìm ga tương ứng trong route.stations để biết khoảng cách từ ga xuất phát
      const routeStation = route.stations.find(
        (rs) => rs.stationId === stop.stationId,
      );

      let distanceFromStart = 0;
      if (routeStation) {
        distanceFromStart = routeStation.distanceFromStart;
      } else {
        // Fallback ước lượng theo stopOrder nếu không tìm thấy cấu hình ga trong route
        distanceFromStart = Math.round(
          (route.distance / (numStops + 1)) * stop.stopOrder,
        );
        console.warn(
          `  ⚠️ Không tìm thấy cấu hình khoảng cách của ga ${stop.stationId} trong tuyến ${route.routeName}. Sử dụng fallback ước lượng: ${distanceFromStart} km.`,
        );
      }

      const progress =
        route.distance > 0 ? distanceFromStart / route.distance : 0;
      const movingTimeMs = newRouteEstDuration * progress * 60 * 1000;
      const restingTimeMs = index * bufferMins * 60 * 1000;

      const stopArrivalTime = new Date(
        schedule.departureTime.getTime() + movingTimeMs + restingTimeMs,
      );
      const stopDepartureTime = new Date(
        stopArrivalTime.getTime() + bufferMins * 60 * 1000,
      );

      await prisma.scheduleStop.update({
        where: { id: stop.id },
        data: {
          arrivalTime: stopArrivalTime,
          departureTime: stopDepartureTime,
        },
      });

      console.log(
        `  * Ga dừng ${stop.stopOrder}: Đến lúc ${stopArrivalTime.toISOString()} -> Đi lúc ${stopDepartureTime.toISOString()} (Vị trí km thứ ${distanceFromStart})`,
      );
    }
  }

  console.log(
    "\n✅ Đồng bộ tốc độ tàu về 55 km/h và tính toán lại toàn bộ lịch trình hoàn tất!",
  );
}

main()
  .catch((e) => {
    console.error("❌ Lỗi đồng bộ tốc độ:", e);
  })
  .finally(() => prisma.$disconnect());
