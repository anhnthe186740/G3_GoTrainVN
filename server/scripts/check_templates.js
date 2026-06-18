import "dotenv/config";
import { prisma } from "../src/config/database.js";

async function main() {
  const templates = await prisma.routeTemplate.findMany({
    include: {
      route: { include: { startStation: true, endStation: true } },
      train: true,
    },
  });

  console.log("=== RouteTemplate count:", templates.length, "===");
  if (templates.length === 0) {
    console.log("  (Không có RouteTemplate nào trong DB)");
  } else {
    templates.forEach((t) => {
      const from = t.route?.startStation?.stationCode ?? "?";
      const to = t.route?.endStation?.stationCode ?? "?";
      const train = t.train?.trainCode ?? "?";
      const times = t.departureTimes.join(", ");
      console.log(
        `  - Tuyến: ${from} -> ${to} | Tàu: ${train} | Giờ: [${times}] | Active: ${t.isActive}`,
      );
    });
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
