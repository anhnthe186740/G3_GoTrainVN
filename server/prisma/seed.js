/**
 * Seed script - Nhập dữ liệu mẫu vào MongoDB cho UC-15
 * Chạy: node server/prisma/seed.js
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATIONS = [
  {
    stationCode: "HAN",
    stationName: "Ga Hà Nội",
    city: "Hà Nội",
    province: "Hà Nội",
    latitude: 21.0245,
    longitude: 105.8412,
  },
  {
    stationCode: "VIN",
    stationName: "Ga Vinh",
    city: "Vinh",
    province: "Nghệ An",
    latitude: 18.6796,
    longitude: 105.6813,
  },
  {
    stationCode: "DHI",
    stationName: "Ga Đồng Hới",
    city: "Đồng Hới",
    province: "Quảng Bình",
    latitude: 17.4765,
    longitude: 106.6002,
  },
  {
    stationCode: "HUE",
    stationName: "Ga Huế",
    city: "Huế",
    province: "Thừa Thiên Huế",
    latitude: 16.4674,
    longitude: 107.5954,
  },
  {
    stationCode: "DAN",
    stationName: "Ga Đà Nẵng",
    city: "Đà Nẵng",
    province: "Đà Nẵng",
    latitude: 16.0544,
    longitude: 108.2022,
  },
  {
    stationCode: "QNH",
    stationName: "Ga Quy Nhơn",
    city: "Quy Nhơn",
    province: "Bình Định",
    latitude: 13.783,
    longitude: 109.2196,
  },
  {
    stationCode: "NTR",
    stationName: "Ga Nha Trang",
    city: "Nha Trang",
    province: "Khánh Hòa",
    latitude: 12.2388,
    longitude: 109.1967,
  },
  {
    stationCode: "SGN",
    stationName: "Ga Sài Gòn",
    city: "TP. Hồ Chí Minh",
    province: "TP. Hồ Chí Minh",
    latitude: 10.7769,
    longitude: 106.6952,
  },
  {
    stationCode: "LCA",
    stationName: "Ga Lào Cai",
    city: "Lào Cai",
    province: "Lào Cai",
    latitude: 22.4856,
    longitude: 103.9755,
  },
  {
    stationCode: "HPH",
    stationName: "Ga Hải Phòng",
    city: "Hải Phòng",
    province: "Hải Phòng",
    latitude: 20.8449,
    longitude: 106.6881,
  },
];

const TRAINS = [
  {
    trainName: "SE1",
    trainCode: "SE1",
    trainType: "SE",
    totalCarriages: 14,
    totalCapacity: 840,
  },
  {
    trainName: "SE2",
    trainCode: "SE2",
    trainType: "SE",
    totalCarriages: 14,
    totalCapacity: 840,
  },
  {
    trainName: "SE3",
    trainCode: "SE3",
    trainType: "SE",
    totalCarriages: 12,
    totalCapacity: 720,
  },
  {
    trainName: "SE4",
    trainCode: "SE4",
    trainType: "SE",
    totalCarriages: 12,
    totalCapacity: 720,
  },
  {
    trainName: "TN1",
    trainCode: "TN1",
    trainType: "TN",
    totalCarriages: 10,
    totalCapacity: 400,
  },
  {
    trainName: "TN2",
    trainCode: "TN2",
    trainType: "TN",
    totalCarriages: 10,
    totalCapacity: 400,
  },
  {
    trainName: "SP1",
    trainCode: "SP1",
    trainType: "SP",
    totalCarriages: 8,
    totalCapacity: 320,
  },
  {
    trainName: "QN1",
    trainCode: "QN1",
    trainType: "QN",
    totalCarriages: 6,
    totalCapacity: 240,
  },
];

async function main() {
  console.log("🌱 Bắt đầu seed dữ liệu GoTrainVN...\n");

  // ── Seed Stations ────────────────────────────────────────────
  console.log("📍 Đang tạo Stations...");
  let stationCount = 0;
  for (const station of STATIONS) {
    try {
      await prisma.station.upsert({
        where: { stationCode: station.stationCode },
        update: {
          stationName: station.stationName,
          city: station.city,
          latitude: station.latitude,
          longitude: station.longitude,
          isActive: true,
        },
        create: { ...station, isActive: true },
      });
      stationCount++;
    } catch (e) {
      console.warn(`  ⚠️  Bỏ qua station ${station.stationCode}: ${e.message}`);
    }
  }
  console.log(`  ✅ ${stationCount} stations đã được tạo/cập nhật.\n`);

  // ── Seed Trains ──────────────────────────────────────────────
  console.log("🚂 Đang tạo Trains...");
  let trainCount = 0;
  for (const train of TRAINS) {
    try {
      await prisma.train.upsert({
        where: { trainCode: train.trainCode },
        update: { trainName: train.trainName, trainType: train.trainType },
        create: train,
      });
      trainCount++;
    } catch (e) {
      console.warn(`  ⚠️  Bỏ qua train ${train.trainCode}: ${e.message}`);
    }
  }
  console.log(`  ✅ ${trainCount} trains đã được tạo/cập nhật.\n`);

  console.log("🎉 Seed hoàn tất!");
  console.log(
    "   → Truy cập Admin Dashboard > Quản Lý Tuyến để sử dụng dữ liệu mẫu.",
  );
}

main()
  .catch((e) => {
    console.error("❌ Lỗi seed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
