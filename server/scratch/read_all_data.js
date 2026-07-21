import { prisma } from "../src/config/database.js";

async function main() {
  console.log("==================================================");
  console.log("          GOTRAINVN DATABASE DATA SUMMARY          ");
  console.log("==================================================\n");

  const models = [
    "user",
    "wallet",
    "walletTransaction",
    "loyaltyPoint",
    "station",
    "route",
    "train",
    "carriage",
    "seat",
    "schedule",
    "scheduleStop",
    "seatHoldSession",
    "seatHold",
    "booking",
    "passenger",
    "cancellationRequest",
    "promotion",
    "review",
    "blogPost",
    "adminLog",
    "securityLog",
    "notification",
  ];

  const summary = {};

  for (const m of models) {
    if (prisma[m]) {
      try {
        const count = await prisma[m].count();
        summary[m] = count;
        console.log(`[${m.padEnd(20)}] Count: ${count}`);
      } catch (err) {
        console.log(`[${m.padEnd(20)}] Error: ${err.message}`);
      }
    }
  }

  console.log("\n==================================================");
  console.log("                DETAILED SAMPLES                  ");
  console.log("==================================================\n");

  async function safePrint(modelName, title) {
    if (summary[modelName] > 0) {
      try {
        const data = await prisma[modelName].findMany({ take: 5 });
        console.log(`\n--- ${title} (Top 5 / Total ${summary[modelName]}) ---`);
        console.log(JSON.stringify(data, null, 2));
      } catch (err) {
        console.log(`\n--- ${title} --- Error printing sample: ${err.message}`);
      }
    }
  }

  await safePrint("user", "USERS");
  await safePrint("station", "STATIONS");
  await safePrint("train", "TRAINS");
  await safePrint("route", "ROUTES");
  await safePrint("schedule", "SCHEDULES");
  await safePrint("booking", "BOOKINGS");
  await safePrint("passenger", "PASSENGERS");
  await safePrint("cancellationRequest", "CANCELLATION REQUESTS");
  await safePrint("blogPost", "BLOG POSTS");
  await safePrint("promotion", "PROMOTIONS");
  await safePrint("wallet", "WALLETS");
}

main()
  .catch((e) => {
    console.error("Error reading database:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
