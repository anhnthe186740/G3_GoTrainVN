import { PrismaClient } from "@gotrain/prisma-client-v2";

const prisma = new PrismaClient();

async function main() {
  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(today);
  endOfDay.setHours(23, 59, 59, 999);

  const schedules = await prisma.schedule.findMany({
    where: {
      departureTime: {
        gte: startOfDay,
        lte: endOfDay,
      },
    },
    include: {
      train: true,
      route: true,
    },
  });

  console.log(`Found ${schedules.length} schedules today:`);
  for (const s of schedules) {
    console.log(
      `- ID: ${s.id}, Train: ${s.train.trainCode}, Route: ${s.route.routeName}, Dep: ${s.departureTime.toISOString()}, Arr: ${s.arrivalTime.toISOString()}, Status: ${s.status}`,
    );
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
