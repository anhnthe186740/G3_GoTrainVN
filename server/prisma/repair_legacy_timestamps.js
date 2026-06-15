import { PrismaClient } from "@gotrain/prisma-client-v2";

const prisma = new PrismaClient();

async function repairCollection(collectionName) {
  const invalidTimestamp = {
    $expr: { $ne: [{ $type: "$updatedAt" }, "date"] },
  };
  const before = await prisma.$runCommandRaw({
    aggregate: collectionName,
    pipeline: [{ $match: invalidTimestamp }, { $count: "count" }],
    cursor: {},
  });
  const count = before.cursor.firstBatch[0]?.count || 0;

  if (count === 0) return 0;

  await prisma.$runCommandRaw({
    update: collectionName,
    updates: [
      {
        q: invalidTimestamp,
        u: [
          {
            $set: {
              updatedAt: {
                $cond: [
                  { $eq: [{ $type: "$createdAt" }, "date"] },
                  "$createdAt",
                  "$$NOW",
                ],
              },
            },
          },
        ],
        multi: true,
      },
    ],
  });

  return count;
}

async function main() {
  const repairedSchedules = await repairCollection("Schedule");
  const repairedPricingPolicies = await repairCollection("PricingPolicy");

  console.log(
    `Đã sửa ${repairedSchedules} lịch trình và ${repairedPricingPolicies} dòng chính sách giá legacy.`,
  );
}

main()
  .catch((error) => {
    console.error("Không thể sửa timestamp legacy:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
