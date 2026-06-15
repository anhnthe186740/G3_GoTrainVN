import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== EXTRA COUNTS ===");
  console.log("Carriages count:", await prisma.carriage.count());
  console.log("Seats count:", await prisma.seat.count());
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
