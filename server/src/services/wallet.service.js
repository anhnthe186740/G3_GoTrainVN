import { prisma } from "../config/database.js";

export async function getOrCreateWallet(userId) {
  return prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: { userId, balance: 0, currency: "VND" },
  });
}

export async function getWallet(userId) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { id: true, balance: true, currency: true, updatedAt: true },
  });
  if (!wallet) return getOrCreateWallet(userId);
  return wallet;
}

export async function deposit(userId, amount, description = "Nạp tiền vào ví") {
  const wallet = await getOrCreateWallet(userId);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "DEPOSIT",
        amount,
        description,
        status: "COMPLETED",
      },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "WALLET_DEPOSIT",
        title: "Nạp tiền thành công",
        message: `Ví của bạn đã được cộng ${amount.toLocaleString("vi-VN")} VND`,
        deliveryMethod: ["IN_APP"],
        deliveryStatus: "SENT",
      },
    });

    return { wallet: updated, transaction };
  });
}

export async function requestWithdrawal(userId, amount) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet)
    throw Object.assign(new Error("Ví không tồn tại"), { statusCode: 404 });
  if (wallet.balance < amount)
    throw Object.assign(new Error("Số dư không đủ để thực hiện giao dịch"), {
      statusCode: 422,
    });

  return prisma.$transaction(async (tx) => {
    const updated = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    const transaction = await tx.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: "WITHDRAWAL",
        amount,
        description: "Yêu cầu rút tiền — chờ admin duyệt",
        status: "PENDING",
      },
    });

    return { wallet: updated, transaction };
  });
}

export async function approveWithdrawal(transactionId) {
  const txn = await prisma.walletTransaction.findUnique({
    where: { id: transactionId },
    include: { wallet: true },
  });

  if (!txn)
    throw Object.assign(new Error("Giao dịch không tồn tại"), {
      statusCode: 404,
    });
  if (txn.type !== "WITHDRAWAL" || txn.status !== "PENDING")
    throw Object.assign(new Error("Giao dịch không hợp lệ để duyệt"), {
      statusCode: 422,
    });

  const updated = await prisma.walletTransaction.update({
    where: { id: transactionId },
    data: { status: "COMPLETED" },
  });

  await prisma.notification.create({
    data: {
      userId: txn.wallet.userId,
      type: "WALLET_WITHDRAWAL_APPROVED",
      title: "Yêu cầu rút tiền được duyệt",
      message: `Yêu cầu rút ${txn.amount.toLocaleString("vi-VN")} VND đã được xử lý thành công`,
      deliveryMethod: ["IN_APP"],
      deliveryStatus: "SENT",
    },
  });

  return updated;
}

export async function rejectWithdrawal(transactionId, reason = "") {
  const txn = await prisma.walletTransaction.findUnique({
    where: { id: transactionId },
    include: { wallet: true },
  });

  if (!txn)
    throw Object.assign(new Error("Giao dịch không tồn tại"), {
      statusCode: 404,
    });
  if (txn.type !== "WITHDRAWAL" || txn.status !== "PENDING")
    throw Object.assign(new Error("Giao dịch không hợp lệ để từ chối"), {
      statusCode: 422,
    });

  return prisma.$transaction(async (tx) => {
    await tx.wallet.update({
      where: { id: txn.walletId },
      data: { balance: { increment: txn.amount } },
    });

    const updated = await tx.walletTransaction.update({
      where: { id: transactionId },
      data: {
        status: "FAILED",
        description: `Bị từ chối: ${reason || "Không đủ điều kiện"}`,
      },
    });

    await tx.notification.create({
      data: {
        userId: txn.wallet.userId,
        type: "WALLET_WITHDRAWAL_REJECTED",
        title: "Yêu cầu rút tiền bị từ chối",
        message: `Yêu cầu rút ${txn.amount.toLocaleString("vi-VN")} VND bị từ chối. Tiền đã được hoàn lại vào ví`,
        deliveryMethod: ["IN_APP"],
        deliveryStatus: "SENT",
      },
    });

    return updated;
  });
}

export async function getMyTransactions(
  userId,
  { type, status, page = 1, limit = 10 },
) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet)
    return { transactions: [], total: 0, page, limit, totalPages: 0 };

  const where = {
    walletId: wallet.id,
    ...(type && { type }),
    ...(status && { status }),
  };

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getAdminStats() {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalBalance, depositToday, pendingWithdrawals, refundThisMonth] =
    await Promise.all([
      prisma.wallet.aggregate({ _sum: { balance: true } }),
      prisma.walletTransaction.aggregate({
        where: {
          type: "DEPOSIT",
          status: "COMPLETED",
          createdAt: { gte: startOfDay },
        },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.count({
        where: { type: "WITHDRAWAL", status: "PENDING" },
      }),
      prisma.walletTransaction.aggregate({
        where: {
          type: "REFUND",
          status: "COMPLETED",
          createdAt: { gte: startOfMonth },
        },
        _sum: { amount: true },
      }),
    ]);

  return {
    totalBalance: totalBalance._sum.balance ?? 0,
    depositToday: depositToday._sum.amount ?? 0,
    pendingWithdrawals,
    refundThisMonth: refundThisMonth._sum.amount ?? 0,
  };
}

export async function getAllTransactions({
  type,
  status,
  page = 1,
  limit = 20,
}) {
  const where = {
    ...(type && { type }),
    ...(status && { status }),
  };

  const [transactions, total] = await Promise.all([
    prisma.walletTransaction.findMany({
      where,
      include: {
        wallet: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                bankAccount: true,
                bankName: true,
                accountHolder: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.walletTransaction.count({ where }),
  ]);

  return {
    transactions,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}
