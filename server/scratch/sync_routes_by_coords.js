import { PrismaClient } from "@gotrain/prisma-client-v2";

const prisma = new PrismaClient();

const RAIL_FACTOR = 1.45;
const AVG_SPEED_KMH = 55;

function haversineKm(lat1, lng1, lat2, lng2) {
  if (!lat1 || !lng1 || !lat2 || !lng2) return 0;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * RAIL_FACTOR);
}

async function main() {
  console.log(
    "🔄 Khởi động đồng bộ khoảng cách và thời gian theo tọa độ (Quản lý tuyến)...",
  );

  // 1. Tải danh sách ga để map tọa độ
  const stations = await prisma.station.findMany();
  const stationMap = {};
  stations.forEach((s) => {
    stationMap[s.id] = s;
  });

  // 2. Tải tất cả tuyến đường
  const routes = await prisma.route.findMany();
  console.log(
    `Tìm thấy ${routes.length} tuyến đường. Bắt đầu tính lại khoảng cách & thời gian...`,
  );

  const updatedRoutesMap = {};

  for (const route of routes) {
    const startSt = stationMap[route.startStationId];
    const endSt = stationMap[route.endStationId];

    if (!startSt || !endSt) {
      console.warn(
        `⚠️ Tuyến ${route.routeName} có ga đầu/cuối không hợp lệ. Bỏ qua.`,
      );
      continue;
    }

    // Tính khoảng cách ga đầu -> ga cuối
    const newRouteDistance = haversineKm(
      startSt.latitude,
      startSt.longitude,
      endSt.latitude,
      endSt.longitude,
    );

    // Tính thời gian chạy ước tính mới (phút) ở tốc độ 55 km/h
    const newRouteDuration = Math.round(
      (newRouteDistance / AVG_SPEED_KMH) * 60,
    );

    // Tính lại distanceFromStart cho từng ga trung gian trong mảng RouteStation
    const updatedStations = [];
    if (route.stations && route.stations.length > 0) {
      const sortedStops = [...route.stations].sort(
        (a, b) => a.stopOrder - b.stopOrder,
      );
      for (const stop of sortedStops) {
        const stopSt = stationMap[stop.stationId];
        let newDist = stop.distanceFromStart;

        if (stopSt && startSt) {
          newDist = haversineKm(
            startSt.latitude,
            startSt.longitude,
            stopSt.latitude,
            stopSt.longitude,
          );
        }

        updatedStations.push({
          stationId: stop.stationId,
          stationName: stop.stationName,
          stopOrder: stop.stopOrder,
          distanceFromStart: newDist,
        });
      }
    }

    // Cập nhật Route trong DB
    const updatedRoute = await prisma.route.update({
      where: { id: route.id },
      data: {
        distance: newRouteDistance,
        estimatedDuration: newRouteDuration,
        stations: updatedStations,
      },
    });

    updatedRoutesMap[route.id] = updatedRoute;

    console.log(`- Tuyến "${route.routeName}":`);
    console.log(
      `  * Cũ: ${route.distance} km - ${route.estimatedDuration} phút`,
    );
    console.log(`  * Mới: ${newRouteDistance} km - ${newRouteDuration} phút`);
    updatedStations.forEach((us) => {
      console.log(
        `    > Ga trung gian: ${us.stationName} (cách Ga đi: ${us.distanceFromStart} km)`,
      );
    });
  }

  // 3. Cập nhật tất cả các Lịch chạy (Schedule) và các Ga dừng (ScheduleStop) dựa trên Tuyến đã cập nhật
  const schedules = await prisma.schedule.findMany({
    include: {
      scheduleStops: {
        orderBy: { stopOrder: "asc" },
      },
    },
  });

  console.log(
    `\nCập nhật lại ${schedules.length} lịch trình chạy tàu theo thông số tuyến mới...`,
  );

  for (const schedule of schedules) {
    const route = updatedRoutesMap[schedule.routeId];
    if (!route) {
      console.warn(
        `⚠️ Lịch trình ID ${schedule.id} không tìm thấy tuyến tương ứng. Bỏ qua.`,
      );
      continue;
    }

    const numStops = schedule.scheduleStops.length;
    const bufferMins = 60; // Mặc định dừng 60 phút ở ga trung gian
    const totalDurationMins = route.estimatedDuration + numStops * bufferMins;

    const newArrivalTime = new Date(
      schedule.departureTime.getTime() + totalDurationMins * 60 * 1000,
    );

    // Cập nhật Schedule
    await prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        distance: route.distance,
        duration: totalDurationMins,
        arrivalTime: newArrivalTime,
      },
    });

    console.log(`- Lịch chạy ${schedule.id} (Tuyến: ${route.routeName}):`);
    console.log(
      `  * Tọa độ di chuyển: ${schedule.departureTime.toISOString()} -> Đến: ${newArrivalTime.toISOString()} (Tổng: ${totalDurationMins} phút)`,
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
        distanceFromStart = Math.round(
          (route.distance / (numStops + 1)) * stop.stopOrder,
        );
      }

      const progress =
        route.distance > 0 ? distanceFromStart / route.distance : 0;
      const movingTimeMs = route.estimatedDuration * progress * 60 * 1000;
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
        `    > Ga trung gian ${stop.stopOrder} (Vinh/Đồng Hới...): Đến lúc ${stopArrivalTime.toISOString()} -> Đi lúc ${stopDepartureTime.toISOString()} (km thứ ${distanceFromStart})`,
      );
    }
  }

  console.log(
    "\n✅ Đồng bộ khoảng cách, ga dừng và thời gian chạy theo Quản lý tuyến hoàn tất!",
  );
}

main()
  .catch((e) => {
    console.error("❌ Lỗi thực hiện:", e);
  })
  .finally(() => prisma.$disconnect());
