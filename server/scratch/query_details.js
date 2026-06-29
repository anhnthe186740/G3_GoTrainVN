import { PrismaClient } from "@gotrain/prisma-client-v2";
const prisma = new PrismaClient();

async function main() {
  const templates = await prisma.routeTemplate.findMany({
    include: {
      route: {
        include: {
          startStation: true,
          endStation: true,
        },
      },
      train: true,
    },
  });

  console.log("=== ROUTE TEMPLATES ===");
  templates.forEach((t) => {
    console.log(`ID: ${t.id}`);
    console.log(
      `  Route ID: ${t.routeId} (${t.route.routeName}: ${t.route.startStation.stationName} -> ${t.route.endStation.stationName})`,
    );
    console.log(`  Train ID: ${t.trainId} (${t.train.trainCode})`);
    console.log(`  Times: ${JSON.stringify(t.departureTimes)}`);
    console.log(`  Active: ${t.isActive}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
