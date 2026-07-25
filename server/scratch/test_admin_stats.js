import { prisma } from "../src/config/database.js";

async function testStats() {
  console.log("Testing stats query...");
  const [
    totalUsers,
    totalCustomers,
    totalAdmins,
    totalTrains,
    activeTrainsCount,
    totalRoutes,
    totalSchedules,
    activeSchedules,
    delayedSchedules,
    totalWalletBalance,
    pendingWithdrawals,
  ] = await Promise.all([
    prisma.user.count({
      where: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
    }),
    prisma.user.count({
      where: {
        userType: "CUSTOMER",
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      },
    }),
    prisma.user.count({
      where: {
        userType: "ADMIN",
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      },
    }),
    prisma.train.count(),
    prisma.train.count({ where: { status: "ACTIVE" } }),
    prisma.route.count({ where: { isActive: true } }),
    prisma.schedule.count(),
    prisma.schedule.count({ where: { status: "ACTIVE" } }),
    prisma.schedule.count({ where: { status: "DELAYED" } }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.walletTransaction.count({
      where: { type: "WITHDRAWAL", status: "PENDING" },
    }),
  ]);

  console.log({
    totalUsers,
    totalCustomers,
    totalAdmins,
    totalTrains,
    activeTrainsCount,
    totalRoutes,
    totalSchedules,
    activeSchedules,
    delayedSchedules,
    totalWalletBalance: totalWalletBalance._sum.balance,
    pendingWithdrawals,
  });
}

testStats()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
