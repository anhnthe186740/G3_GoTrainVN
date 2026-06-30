import { PrismaClient } from "@gotrain/prisma-client-v2";
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.routeTemplate.findMany({
    include: {
      route: true,
      train: true,
    },
  });

  console.log("=== ROUTE TEMPLATES ===");
  templates.forEach((t) => {
    console.log(
      `ID: ${t.id}, Route: ${t.route.routeName}, Train: ${t.train.trainCode}, Times: ${JSON.stringify(t.departureTimes)}, Active: ${t.isActive}`,
    );
  });

  const schedules = await prisma.schedule.findMany({
    take: 10,
    orderBy: { departureTime: "desc" },
    include: {
      route: true,
      train: true,
    },
  });

  console.log("\n=== SCHEDULES (LATEST 10) ===");
  schedules.forEach((s) => {
    console.log(
      `ID: ${s.id}, Route: ${s.route.routeName}, Train: ${s.train.trainCode}, Departure: ${s.departureTime}, Status: ${s.status}`,
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
