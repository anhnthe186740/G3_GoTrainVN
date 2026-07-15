import { randomInt } from "node:crypto";
import { prisma } from "../config/database.js";
import {
  createPayosPaymentRequest,
  getPayosPaymentRequest,
} from "./payos.service.js";

const DEPOSIT_EXPIRY_MINUTES = 15;

function httpError(statusCode, message, details = null) {
  const error = new Error(message);
  error.statusCode = statusCode;
  if (details) error.details = details;
  return error;
}

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

// ============================================================
// Deposit — creates PENDING transaction + PayOS payment link
// ============================================================

async function depositOrderCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = Number(`${Date.now()}${randomInt(10, 99)}`);
    const existing = await prisma.walletTransaction.findFirst({
      where: { payosOrderCode: String(candidate) },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  throw httpError(500, "Không thể tạo mã thanh toán PayOS duy nhất.");
}

function depositDescription(orderCode) {
  return `NAP${String(orderCode).slice(-7)}`;
}

export async function deposit(userId, amount, description = "Nạp tiền vào ví") {
  const wallet = await getOrCreateWallet(userId);

  // Block concurrent pending deposits (max 1 per user)
  const existingPending = await prisma.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      type: "DEPOSIT",
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (existingPending) {
    throw httpError(
      409,
      "Bạn đang có một lệnh nạp tiền chưa hoàn tất. Vui lòng thanh toán hoặc đợi hết hạn.",
      { pendingTransaction: existingPending },
    );
  }

  // Generate unique order code & call PayOS
  const orderCode = await depositOrderCode();
  const payosDesc = depositDescription(orderCode);
  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const expiresAt = new Date(Date.now() + DEPOSIT_EXPIRY_MINUTES * 60 * 1000);

  // Fetch user info for buyer field
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true, phoneNumber: true },
  });

  const payosPayment = await createPayosPaymentRequest({
    orderCode,
    amount,
    description: payosDesc,
    expiresAt,
    buyer: {
      name: user?.fullName,
      email: user?.email,
      phone: user?.phoneNumber,
    },
  });

  // Create PENDING transaction only after PayOS succeeds
  const transaction = await prisma.walletTransaction.create({
    data: {
      walletId: wallet.id,
      type: "DEPOSIT",
      amount,
      description,
      status: "PENDING",
      payosOrderCode: String(orderCode),
      payosPaymentLinkId: payosPayment.paymentLinkId,
      payosCheckoutUrl: payosPayment.checkoutUrl,
      payosQrCode: payosPayment.qrCode,
      payosAccountNumber: payosPayment.accountNumber,
      payosAccountName: payosPayment.accountName,
      payosBin: payosPayment.bin,
      expiresAt,
    },
  });

  return {
    transaction,
    payos: {
      orderCode,
      description: payosDesc,
      paymentLinkId: payosPayment.paymentLinkId,
      checkoutUrl: payosPayment.checkoutUrl,
      qrCode: payosPayment.qrCode,
      accountNumber: payosPayment.accountNumber,
      accountName: payosPayment.accountName,
      bin: payosPayment.bin,
    },
    paymentExpiresAt: expiresAt,
  };
}

// ============================================================
// Complete deposit — shared by webhook + poll sync
// ============================================================

async function completeWalletDeposit(tx, transaction, webhookData) {
  // Attempt to mark PENDING → COMPLETED (idempotent via status check)
  const updated = await tx.walletTransaction.updateMany({
    where: { id: transaction.id, status: "PENDING", type: "DEPOSIT" },
    data: {
      status: "COMPLETED",
      transactionId: webhookData.reference || webhookData.paymentLinkId,
    },
  });

  if (updated.count !== 1) {
    // Already processed (duplicate) — return current state
    return tx.walletTransaction.findUnique({ where: { id: transaction.id } });
  }

  // Increment wallet balance
  await tx.wallet.update({
    where: { id: transaction.walletId },
    data: { balance: { increment: transaction.amount } },
  });

  // Notification
  const wallet = await tx.wallet.findUnique({
    where: { id: transaction.walletId },
    select: { userId: true },
  });
  if (wallet) {
    await tx.notification.create({
      data: {
        userId: wallet.userId,
        type: "WALLET_DEPOSIT",
        title: "Nạp tiền thành công",
        message: `Ví của bạn đã được cộng ${transaction.amount.toLocaleString("vi-VN")} VND`,
        deliveryMethod: ["IN_APP"],
        deliveryStatus: "SENT",
      },
    });
  }

  return tx.walletTransaction.findUnique({ where: { id: transaction.id } });
}

// Also handle recovery: if cleanup marked it FAILED but PayOS confirmed payment
async function recoverFailedDeposit(tx, transaction, webhookData) {
  await tx.walletTransaction.update({
    where: { id: transaction.id },
    data: {
      status: "COMPLETED",
      transactionId: webhookData.reference || webhookData.paymentLinkId,
      description:
        (transaction.description || "Nạp tiền vào ví") + " (recovered)",
    },
  });

  await tx.wallet.update({
    where: { id: transaction.walletId },
    data: { balance: { increment: transaction.amount } },
  });

  const wallet = await tx.wallet.findUnique({
    where: { id: transaction.walletId },
    select: { userId: true },
  });
  if (wallet) {
    await tx.notification.create({
      data: {
        userId: wallet.userId,
        type: "WALLET_DEPOSIT",
        title: "Nạp tiền thành công",
        message: `Ví của bạn đã được cộng ${transaction.amount.toLocaleString("vi-VN")} VND`,
        deliveryMethod: ["IN_APP"],
        deliveryStatus: "SENT",
      },
    });
  }

  return tx.walletTransaction.findUnique({ where: { id: transaction.id } });
}

// ============================================================
// Webhook handler — called from bookingCheckout fallback
// ============================================================

export async function handleWalletDepositWebhook(data) {
  const orderCode = data.orderCode != null ? String(data.orderCode) : null;
  const paymentMatchers = [
    orderCode ? { payosOrderCode: orderCode } : null,
    data.paymentLinkId ? { payosPaymentLinkId: data.paymentLinkId } : null,
  ].filter(Boolean);

  if (paymentMatchers.length === 0) {
    return { ignored: true, reason: "missing_payment_identity" };
  }

  const transaction = await prisma.walletTransaction.findFirst({
    where: {
      type: "DEPOSIT",
      OR: paymentMatchers,
    },
  });

  if (!transaction) {
    return { ignored: true, reason: "wallet_txn_not_found" };
  }

  if (transaction.status === "COMPLETED") {
    return { ignored: false, duplicate: true };
  }

  if (Math.round(transaction.amount) !== Math.round(Number(data.amount))) {
    return { ignored: true, reason: "amount_mismatch" };
  }

  // EC7: Handle FAILED (expired) deposit recovery
  if (transaction.status === "FAILED") {
    const result = await prisma.$transaction((tx) =>
      recoverFailedDeposit(tx, transaction, data),
    );
    return { ignored: false, recovered: true, transaction: result };
  }

  const result = await prisma.$transaction((tx) =>
    completeWalletDeposit(tx, transaction, data),
  );

  return { ignored: false, transaction: result };
}

// ============================================================
// Poll sync — frontend calls to check status
// ============================================================

export async function getDepositStatus(userId, transactionId) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw httpError(404, "Ví không tồn tại.");

  const transaction = await prisma.walletTransaction.findFirst({
    where: {
      id: transactionId,
      walletId: wallet.id,
      type: "DEPOSIT",
    },
  });
  if (!transaction) throw httpError(404, "Giao dịch không tồn tại.");

  // If still PENDING, try to sync with PayOS
  if (transaction.status === "PENDING" && transaction.payosPaymentLinkId) {
    try {
      const payosData = await getPayosPaymentRequest(
        transaction.payosPaymentLinkId,
      );
      if (payosData && payosData.status === "PAID") {
        const completed = await prisma.$transaction((tx) =>
          completeWalletDeposit(tx, transaction, {
            paymentLinkId: payosData.id,
            reference: payosData.transactions?.[0]?.reference || payosData.id,
          }),
        );
        return completed;
      }
    } catch (error) {
      console.error(
        "Failed to sync PayOS status for wallet deposit:",
        error.message,
      );
    }
  }

  return transaction;
}

// ============================================================
// Get pending deposit — for resume after page reload / back
// ============================================================

export async function getPendingDeposit(userId) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) return null;

  const transaction = await prisma.walletTransaction.findFirst({
    where: {
      walletId: wallet.id,
      type: "DEPOSIT",
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!transaction) return null;

  // Fetch live PayOS details to get account number, name, bin, qrCode, description, etc.
  if (transaction.payosPaymentLinkId) {
    try {
      const payosData = await getPayosPaymentRequest(
        transaction.payosPaymentLinkId,
      );
      if (payosData && payosData.status === "PAID") {
        const completed = await prisma.$transaction((tx) =>
          completeWalletDeposit(tx, transaction, {
            paymentLinkId: payosData.id,
            reference: payosData.transactions?.[0]?.reference || payosData.id,
          }),
        );
        return null;
      }

      return {
        ...transaction,
        payos: {
          orderCode: transaction.payosOrderCode,
          description:
            payosData.description ||
            `NAP${String(transaction.payosOrderCode).slice(-7)}`,
          paymentLinkId: transaction.payosPaymentLinkId,
          checkoutUrl: payosData.checkoutUrl || transaction.payosCheckoutUrl,
          qrCode: payosData.qrCode || transaction.payosQrCode,
          accountNumber:
            payosData.accountNumber || transaction.payosAccountNumber,
          accountName: payosData.accountName || transaction.payosAccountName,
          bin: payosData.bin || transaction.payosBin,
          amount: payosData.amount || transaction.amount,
        },
      };
    } catch (error) {
      console.error("Failed to fetch pending PayOS request:", error.message);
    }
  }

  // Fallback to cached fields in db
  return {
    ...transaction,
    payos: {
      orderCode: transaction.payosOrderCode,
      description: `NAP${String(transaction.payosOrderCode).slice(-7)}`,
      paymentLinkId: transaction.payosPaymentLinkId,
      checkoutUrl: transaction.payosCheckoutUrl,
      qrCode: transaction.payosQrCode,
      accountNumber: transaction.payosAccountNumber,
      accountName: transaction.payosAccountName,
      bin: transaction.payosBin,
      amount: transaction.amount,
    },
  };
}

export async function cancelDeposit(userId, transactionId) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });
  if (!wallet) throw httpError(404, "Ví không tồn tại.");

  const transaction = await prisma.walletTransaction.findFirst({
    where: {
      id: transactionId,
      walletId: wallet.id,
      type: "DEPOSIT",
      status: "PENDING",
    },
  });

  if (!transaction) {
    throw httpError(404, "Không tìm thấy giao dịch chờ thanh toán.");
  }

  // Update status to FAILED
  const updated = await prisma.walletTransaction.update({
    where: { id: transactionId },
    data: {
      status: "FAILED",
      description:
        (transaction.description || "Nạp tiền vào ví") +
        " — Đã hủy bởi người dùng",
    },
  });

  return updated;
}

// ============================================================
// Cleanup expired deposits
// ============================================================

export async function cleanupExpiredDeposits(now = new Date()) {
  const expired = await prisma.walletTransaction.findMany({
    where: {
      type: "DEPOSIT",
      status: "PENDING",
      expiresAt: { lte: now },
    },
    select: { id: true, payosOrderCode: true },
  });

  if (expired.length === 0) return [];

  await prisma.walletTransaction.updateMany({
    where: {
      id: { in: expired.map((t) => t.id) },
      status: "PENDING",
    },
    data: { status: "FAILED" },
  });

  return expired;
}

// ============================================================
// Withdrawal (unchanged)
// ============================================================

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

// ============================================================
// Query helpers (unchanged)
// ============================================================

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
            user: { select: { id: true, fullName: true, email: true } },
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
