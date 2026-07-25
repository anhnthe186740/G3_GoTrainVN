import { PrismaClient } from "@gotrain/prisma-client-v2";
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.cancellationRequest.deleteMany({
    where: { status: "PENDING" },
  });
  console.log(`Deleted ${result.count} PENDING requests`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
