/**
 * Script tạo tài khoản test: staff và customer
 * Chạy: node scripts/seed-test-users.js
 */

import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

const TEST_USERS = [
  {
    fullName: "Nhân Viên Test",
    email: "staff@gotrain.vn",
    password: "Staff@123",
    userType: "STAFF",
    phoneNumber: "0901234567",
    loyaltyPoints: 0,
  },
  {
    fullName: "Khách Hàng Test",
    email: "customer@gotrain.vn",
    password: "Customer@123",
    userType: "CUSTOMER",
    phoneNumber: "0907654321",
    loyaltyPoints: 250,
  },
  {
    fullName: "Admin GoTrain",
    email: "admin@gotrain.vn",
    password: "Admin@123",
    userType: "ADMIN",
    phoneNumber: "0900000001",
    loyaltyPoints: 0,
  },
];

async function main() {
  console.log("🌱 Bắt đầu tạo tài khoản test...\n");

  for (const u of TEST_USERS) {
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
    });

    if (existing) {
      console.log(`⚠️  [${u.userType}] ${u.email} — ĐÃ TỒN TẠI, bỏ qua.`);
      continue;
    }

    const hashedPassword = await bcrypt.hash(u.password, 10);
    await prisma.user.create({
      data: {
        fullName: u.fullName,
        email: u.email,
        password: hashedPassword,
        userType: u.userType,
        phoneNumber: u.phoneNumber,
        loyaltyPoints: u.loyaltyPoints,
      },
    });

    console.log(`✅ [${u.userType}] Đã tạo: ${u.email} / ${u.password}`);
  }

  console.log("\n🎉 Hoàn tất!\n");
  console.log("─".repeat(50));
  console.log("📋 DANH SÁCH TÀI KHOẢN TEST:");
  console.log("─".repeat(50));
  for (const u of TEST_USERS) {
    console.log(
      `  ${u.userType.padEnd(10)} │ ${u.email.padEnd(25)} │ ${u.password}`,
    );
  }
  console.log("─".repeat(50));
}

main()
  .catch((e) => {
    console.error("❌ Lỗi:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
