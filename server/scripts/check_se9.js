import { prisma } from "../src/config/database.js";

async function main() {
  const train = await prisma.train.findFirst({
    where: {
      OR: [
        { trainCode: "SE9" },
        { trainName: "SE9" },
        { trainCode: { contains: "SE9", mode: "insensitive" } },
      ],
    },
  });

  if (!train) {
    console.log("No SE9 train found in database!");
    return;
  }

  console.log(
    `=== Train: ${train.trainName} (${train.trainCode}) | ID: ${train.id} ===`,
  );

  const schedules = await prisma.schedule.findMany({
    where: { trainId: train.id },
    include: {
      route: true,
    },
    orderBy: { departureTime: "asc" },
  });

  console.log(`Total schedules found: ${schedules.length}`);
  schedules.forEach((s) => {
    console.log(`- Schedule ID: ${s.id}`);
    console.log(`  Route: ${s.route?.routeName || "Unknown"}`);
    console.log(
      `  Dep: ${s.departureTime.toISOString()} (${s.departureTime.toLocaleString("vi-VN")})`,
    );
    console.log(
      `  Arr: ${s.arrivalTime.toISOString()} (${s.arrivalTime.toLocaleString("vi-VN")})`,
    );
    console.log(`  Status: ${s.status}`);
  });

  const templates = await prisma.routeTemplate.findMany({
    where: { trainId: train.id },
    include: {
      route: true,
    },
  });

  console.log(`\n=== RouteTemplates count: ${templates.length} ===`);
  templates.forEach((t) => {
    console.log(`- Template ID: ${t.id}`);
    console.log(
      `  Route: ${t.route?.routeName || "Unknown"} (duration: ${t.route?.estimatedDuration} mins)`,
    );
    console.log(`  Departure times: ${t.departureTimes.join(", ")}`);
    console.log(`  Buffer: ${t.bufferMinutes} mins`);
    console.log(`  Active: ${t.isActive}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
