import { PrismaClient } from "@gotrain/prisma-client-v2";

const prisma = new PrismaClient();

async function main() {
  const routes = await prisma.route.findMany({
    include: {
      startStation: true,
      endStation: true,
    },
  });

  for (const r of routes) {
    console.log(`Route: ${r.routeName}`);
    console.log(
      `- Start: ${r.startStation.stationName}, End: ${r.endStation.stationName}`,
    );
    console.log(
      `- Distance: ${r.distance} km, Est Duration: ${r.estimatedDuration} mins`,
    );
    console.log(`- Stations:`, r.stations);
    console.log("-----------------------------------------");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
