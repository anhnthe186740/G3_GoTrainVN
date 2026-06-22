import { PrismaClient } from "@gotrain/prisma-client-v2";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.liveTracking.updateMany({
    data: {
      speed: 55.0,
    },
  });
  console.log(
    `Updated ${result.count} existing live tracking records to 55 km/h.`,
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
