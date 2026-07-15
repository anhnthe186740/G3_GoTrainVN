import { test as originalTest } from "node:test";
const test = originalTest;

import assert from "node:assert/strict";

// ------------------------------------------------------------------
// getOrCreateWallet
// ------------------------------------------------------------------

test("UTCID01: getOrCreateWallet returns an upserted wallet for a valid userId", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          upsert: async (args) => {
            assert.deepEqual(args.where, { userId: "user-1" });
            assert.deepEqual(args.create, {
              userId: "user-1",
              balance: 0,
              currency: "VND",
            });
            return { id: "w1", userId: "user-1", balance: 0, currency: "VND" };
          },
        },
      },
    },
  });
  const { getOrCreateWallet } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const wallet = await getOrCreateWallet("user-1");
  assert.equal(wallet.id, "w1");
  assert.equal(wallet.balance, 0);
});

test("UTCID02: getOrCreateWallet passes through an empty-string userId unchanged (no validation)", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          upsert: async (args) => ({
            id: "w-empty",
            userId: args.where.userId,
            balance: 0,
            currency: "VND",
          }),
        },
      },
    },
  });
  const { getOrCreateWallet } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const wallet = await getOrCreateWallet("");
  assert.equal(wallet.userId, "");
});

test("UTCID03: getOrCreateWallet propagates a database error", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          upsert: async () => {
            throw new Error("DB connection lost");
          },
        },
      },
    },
  });
  const { getOrCreateWallet } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(() => getOrCreateWallet("user-1"), /DB connection lost/);
});

// ------------------------------------------------------------------
// getWallet
// ------------------------------------------------------------------

test("UTCID01: getWallet returns the selected fields when the wallet exists", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          findUnique: async (args) => {
            assert.deepEqual(args.where, { userId: "user-1" });
            return {
              id: "w1",
              balance: 150000,
              currency: "VND",
              updatedAt: new Date("2026-01-01"),
            };
          },
          upsert: async () => {
            throw new Error("should not be called");
          },
        },
      },
    },
  });
  const { getWallet } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const wallet = await getWallet("user-1");
  assert.equal(wallet.id, "w1");
  assert.equal(wallet.balance, 150000);
});

test("UTCID02: getWallet returns a wallet with boundary balance = 0", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          findUnique: async () => ({
            id: "w1",
            balance: 0,
            currency: "VND",
            updatedAt: new Date(),
          }),
        },
      },
    },
  });
  const { getWallet } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const wallet = await getWallet("user-1");
  assert.equal(wallet.balance, 0);
});

test("UTCID03: getWallet auto-creates a wallet when none exists yet", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          findUnique: async () => null,
          upsert: async () => ({
            id: "new-w",
            userId: "user-1",
            balance: 0,
            currency: "VND",
          }),
        },
      },
    },
  });
  const { getWallet } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const wallet = await getWallet("user-1");
  assert.equal(wallet.id, "new-w");
});

// ------------------------------------------------------------------
// deposit
// ------------------------------------------------------------------

// deposit
// ------------------------------------------------------------------

function mockPayos(t) {
  t.mock.module("../src/services/payos.service.js", {
    namedExports: {
      createPayosPaymentRequest: async () => ({
        paymentLinkId: "pl-mock-1",
        checkoutUrl: "https://pay.payos.vn/checkout/123",
        qrCode: "0002010102123858...",
        accountNumber: "123456",
        accountName: "GOTRAIN VN",
        bin: "970415",
      }),
      getPayosPaymentRequest: async () => ({
        id: "pl-mock-1",
        status: "PAID",
        transactions: [{ reference: "ref-123" }],
      }),
    },
  });
}

test("UTCID01: deposit creates a PENDING transaction and returns PayOS link info", async (t) => {
  mockPayos(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          upsert: async () => ({ id: "w1", userId: "user-1", balance: 0 }),
          findUnique: async () => ({ id: "w1", userId: "user-1", balance: 0 }),
        },
        walletTransaction: {
          findFirst: async () => null,
          create: async (args) => ({ id: "txn-1", ...args.data }),
        },
        user: {
          findUnique: async () => ({
            fullName: "User One",
            email: "user@example.com",
            phoneNumber: "0900000000",
          }),
        },
      },
    },
  });

  const { deposit } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await deposit("user-1", 100000);
  assert.equal(result.transaction.type, "DEPOSIT");
  assert.equal(result.transaction.status, "PENDING");
  assert.equal(result.payos.paymentLinkId, "pl-mock-1");
  assert.equal(result.payos.checkoutUrl, "https://pay.payos.vn/checkout/123");
});

test("UTCID02: deposit blocks concurrent pending deposits", async (t) => {
  mockPayos(t);
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          upsert: async () => ({ id: "w1", userId: "user-1", balance: 0 }),
        },
        walletTransaction: {
          findFirst: async () => ({
            id: "existing-txn",
            status: "PENDING",
            expiresAt: new Date(Date.now() + 10000),
          }),
        },
      },
    },
  });

  const { deposit } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => deposit("user-1", 100000),
    /Bạn đang có một lệnh nạp tiền chưa hoàn tất/,
  );
});

test("UTCID03: getDepositStatus syncs with PayOS if PENDING", async (t) => {
  mockPayos(t);
  let walletUpdated = false;
  let transactionUpdated = false;
  const mockPrisma = {
    wallet: {
      findUnique: async () => ({ id: "w1", userId: "user-1", balance: 0 }),
      update: async () => {
        walletUpdated = true;
        return { id: "w1", balance: 100000 };
      },
    },
    walletTransaction: {
      findFirst: async () => ({
        id: "txn-1",
        walletId: "w1",
        type: "DEPOSIT",
        status: "PENDING",
        amount: 100000,
        payosPaymentLinkId: "pl-mock-1",
      }),
      updateMany: async () => {
        transactionUpdated = true;
        return { count: 1 };
      },
      findUnique: async () => ({
        id: "txn-1",
        status: "COMPLETED",
      }),
    },
    notification: {
      create: async () => ({ id: "notif-1" }),
    },
    $transaction: async (fn) => fn(mockPrisma),
  };

  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: mockPrisma,
    },
  });

  const { getDepositStatus } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await getDepositStatus("user-1", "txn-1");
  assert.equal(result.status, "COMPLETED");
  assert.ok(walletUpdated);
  assert.ok(transactionUpdated);
});

// ------------------------------------------------------------------
// requestWithdrawal
// ------------------------------------------------------------------

test("UTCID01: requestWithdrawal succeeds when balance is greater than the amount", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          findUnique: async () => ({
            id: "w1",
            userId: "user-1",
            balance: 200000,
          }),
        },
        $transaction: async (fn) =>
          fn({
            wallet: {
              update: async () => ({ id: "w1", balance: 150000 }),
            },
            walletTransaction: {
              create: async (args) => ({ id: "txn-2", ...args.data }),
            },
          }),
      },
    },
  });
  const { requestWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await requestWithdrawal("user-1", 50000);
  assert.equal(result.wallet.balance, 150000);
  assert.equal(result.transaction.type, "WITHDRAWAL");
  assert.equal(result.transaction.status, "PENDING");
});

test("UTCID02: requestWithdrawal succeeds at the exact boundary where amount equals balance", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          findUnique: async () => ({
            id: "w1",
            userId: "user-1",
            balance: 100000,
          }),
        },
        $transaction: async (fn) =>
          fn({
            wallet: { update: async () => ({ id: "w1", balance: 0 }) },
            walletTransaction: {
              create: async (args) => ({ id: "txn-3", ...args.data }),
            },
          }),
      },
    },
  });
  const { requestWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await requestWithdrawal("user-1", 100000);
  assert.equal(result.wallet.balance, 0);
});

test("UTCID03: requestWithdrawal throws 422 when the balance is insufficient", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          findUnique: async () => ({
            id: "w1",
            userId: "user-1",
            balance: 10000,
          }),
        },
      },
    },
  });
  const { requestWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => requestWithdrawal("user-1", 50000),
    (err) => {
      assert.match(err.message, /Số dư không đủ/);
      assert.equal(err.statusCode, 422);
      return true;
    },
  );
});

test("UTCID04: requestWithdrawal throws 404 when the wallet does not exist", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: { findUnique: async () => null },
      },
    },
  });
  const { requestWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => requestWithdrawal("ghost-user", 50000),
    (err) => {
      assert.match(err.message, /Ví không tồn tại/);
      assert.equal(err.statusCode, 404);
      return true;
    },
  );
});

// ------------------------------------------------------------------
// approveWithdrawal
// ------------------------------------------------------------------

test("UTCID01: approveWithdrawal marks a PENDING withdrawal as COMPLETED", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findUnique: async () => ({
            id: "txn-1",
            type: "WITHDRAWAL",
            status: "PENDING",
            amount: 50000,
            wallet: { userId: "user-1" },
          }),
          update: async (args) => ({
            id: args.where.id,
            status: args.data.status,
          }),
        },
        notification: { create: async () => ({ id: "notif" }) },
      },
    },
  });
  const { approveWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await approveWithdrawal("txn-1");
  assert.equal(result.status, "COMPLETED");
});

test("UTCID02: approveWithdrawal handles a boundary amount of 0 without error", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findUnique: async () => ({
            id: "txn-1",
            type: "WITHDRAWAL",
            status: "PENDING",
            amount: 0,
            wallet: { userId: "user-1" },
          }),
          update: async () => ({ id: "txn-1", status: "COMPLETED" }),
        },
        notification: { create: async () => ({ id: "notif" }) },
      },
    },
  });
  const { approveWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await approveWithdrawal("txn-1");
  assert.equal(result.status, "COMPLETED");
});

test("UTCID03: approveWithdrawal throws 404 when the transaction does not exist", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { walletTransaction: { findUnique: async () => null } },
    },
  });
  const { approveWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => approveWithdrawal("missing-txn"),
    (err) => {
      assert.match(err.message, /Giao dịch không tồn tại/);
      assert.equal(err.statusCode, 404);
      return true;
    },
  );
});

test("UTCID04: approveWithdrawal throws 422 when the transaction is not PENDING", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findUnique: async () => ({
            id: "txn-1",
            type: "WITHDRAWAL",
            status: "COMPLETED",
            amount: 50000,
            wallet: { userId: "user-1" },
          }),
        },
      },
    },
  });
  const { approveWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => approveWithdrawal("txn-1"),
    (err) => {
      assert.match(err.message, /không hợp lệ để duyệt/);
      assert.equal(err.statusCode, 422);
      return true;
    },
  );
});

test("UTCID05: approveWithdrawal throws 422 when the transaction type is not WITHDRAWAL", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findUnique: async () => ({
            id: "txn-1",
            type: "DEPOSIT",
            status: "PENDING",
            amount: 50000,
            wallet: { userId: "user-1" },
          }),
        },
      },
    },
  });
  const { approveWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => approveWithdrawal("txn-1"),
    (err) => {
      assert.match(err.message, /không hợp lệ để duyệt/);
      return true;
    },
  );
});

// ------------------------------------------------------------------
// rejectWithdrawal
// ------------------------------------------------------------------

test("UTCID01: rejectWithdrawal refunds the wallet and marks the transaction FAILED with the given reason", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findUnique: async () => ({
            id: "txn-1",
            walletId: "w1",
            type: "WITHDRAWAL",
            status: "PENDING",
            amount: 50000,
            wallet: { userId: "user-1" },
          }),
        },
        $transaction: async (fn) =>
          fn({
            wallet: { update: async () => ({ id: "w1", balance: 150000 }) },
            walletTransaction: {
              update: async (args) => ({ id: "txn-1", ...args.data }),
            },
            notification: { create: async () => ({ id: "notif" }) },
          }),
      },
    },
  });
  const { rejectWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await rejectWithdrawal("txn-1", "Thông tin không hợp lệ");
  assert.equal(result.status, "FAILED");
  assert.match(result.description, /Thông tin không hợp lệ/);
});

test("UTCID02: rejectWithdrawal falls back to a default description when no reason is given", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findUnique: async () => ({
            id: "txn-1",
            walletId: "w1",
            type: "WITHDRAWAL",
            status: "PENDING",
            amount: 50000,
            wallet: { userId: "user-1" },
          }),
        },
        $transaction: async (fn) =>
          fn({
            wallet: { update: async () => ({ id: "w1", balance: 150000 }) },
            walletTransaction: {
              update: async (args) => ({ id: "txn-1", ...args.data }),
            },
            notification: { create: async () => ({ id: "notif" }) },
          }),
      },
    },
  });
  const { rejectWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await rejectWithdrawal("txn-1");
  assert.match(result.description, /Không đủ điều kiện/);
});

test("UTCID03: rejectWithdrawal throws 404 when the transaction does not exist", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: { walletTransaction: { findUnique: async () => null } },
    },
  });
  const { rejectWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => rejectWithdrawal("missing-txn", "reason"),
    (err) => {
      assert.match(err.message, /Giao dịch không tồn tại/);
      assert.equal(err.statusCode, 404);
      return true;
    },
  );
});

test("UTCID04: rejectWithdrawal throws 422 when the transaction is not eligible for rejection", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findUnique: async () => ({
            id: "txn-1",
            walletId: "w1",
            type: "WITHDRAWAL",
            status: "FAILED",
            amount: 50000,
            wallet: { userId: "user-1" },
          }),
        },
      },
    },
  });
  const { rejectWithdrawal } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(
    () => rejectWithdrawal("txn-1", "reason"),
    (err) => {
      assert.match(err.message, /không hợp lệ để từ chối/);
      assert.equal(err.statusCode, 422);
      return true;
    },
  );
});

// ------------------------------------------------------------------
// getMyTransactions
// ------------------------------------------------------------------

test("UTCID01: getMyTransactions applies type/status filters and computes pagination", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: { findUnique: async () => ({ id: "w1", userId: "user-1" }) },
        walletTransaction: {
          findMany: async (args) => {
            assert.deepEqual(args.where, {
              walletId: "w1",
              type: "DEPOSIT",
              status: "COMPLETED",
            });
            assert.equal(args.skip, 10);
            assert.equal(args.take, 10);
            return [{ id: "t1" }];
          },
          count: async () => 21,
        },
      },
    },
  });
  const { getMyTransactions } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await getMyTransactions("user-1", {
    type: "DEPOSIT",
    status: "COMPLETED",
    page: 2,
    limit: 10,
  });
  assert.equal(result.total, 21);
  assert.equal(result.totalPages, 3);
  assert.equal(result.transactions.length, 1);
});

test("UTCID02: getMyTransactions returns an empty boundary result when the wallet does not exist", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: { findUnique: async () => null },
      },
    },
  });
  const { getMyTransactions } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await getMyTransactions("ghost-user", {});
  assert.deepEqual(result, {
    transactions: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
});

test("UTCID03: getMyTransactions rejects when the database query fails", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: { findUnique: async () => ({ id: "w1", userId: "user-1" }) },
        walletTransaction: {
          findMany: async () => {
            throw new Error("Query timeout");
          },
          count: async () => 0,
        },
      },
    },
  });
  const { getMyTransactions } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(() => getMyTransactions("user-1", {}), /Query timeout/);
});

// ------------------------------------------------------------------
// getAdminStats
// ------------------------------------------------------------------

test("UTCID01: getAdminStats aggregates balance, deposits, pending withdrawals and refunds", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          aggregate: async () => ({ _sum: { balance: 5000000 } }),
        },
        walletTransaction: {
          aggregate: async (args) => {
            if (args.where.type === "DEPOSIT")
              return { _sum: { amount: 200000 } };
            return { _sum: { amount: 80000 } };
          },
          count: async () => 4,
        },
      },
    },
  });
  const { getAdminStats } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const stats = await getAdminStats();
  assert.equal(stats.totalBalance, 5000000);
  assert.equal(stats.depositToday, 200000);
  assert.equal(stats.pendingWithdrawals, 4);
  assert.equal(stats.refundThisMonth, 80000);
});

test("UTCID02: getAdminStats falls back to boundary value 0 when aggregates are null", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: { aggregate: async () => ({ _sum: { balance: null } }) },
        walletTransaction: {
          aggregate: async () => ({ _sum: { amount: null } }),
          count: async () => 0,
        },
      },
    },
  });
  const { getAdminStats } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const stats = await getAdminStats();
  assert.equal(stats.totalBalance, 0);
  assert.equal(stats.depositToday, 0);
  assert.equal(stats.pendingWithdrawals, 0);
  assert.equal(stats.refundThisMonth, 0);
});

test("UTCID03: getAdminStats rejects when an aggregate query fails", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        wallet: {
          aggregate: async () => {
            throw new Error("Aggregate failed");
          },
        },
        walletTransaction: {
          aggregate: async () => ({ _sum: { amount: 0 } }),
          count: async () => 0,
        },
      },
    },
  });
  const { getAdminStats } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(() => getAdminStats(), /Aggregate failed/);
});

// ------------------------------------------------------------------
// getAllTransactions
// ------------------------------------------------------------------

test("UTCID01: getAllTransactions applies filters, includes wallet/user and computes pagination", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findMany: async (args) => {
            assert.deepEqual(args.where, {
              type: "WITHDRAWAL",
              status: "PENDING",
            });
            assert.equal(args.skip, 20);
            assert.equal(args.take, 20);
            return [
              {
                id: "t1",
                wallet: { user: { id: "u1", fullName: "A", email: "a@x.com" } },
              },
            ];
          },
          count: async () => 41,
        },
      },
    },
  });
  const { getAllTransactions } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await getAllTransactions({
    type: "WITHDRAWAL",
    status: "PENDING",
    page: 2,
    limit: 20,
  });
  assert.equal(result.total, 41);
  assert.equal(result.totalPages, 3);
  assert.equal(result.transactions[0].wallet.user.fullName, "A");
});

test("UTCID02: getAllTransactions uses an empty boundary where-clause when no filters are given", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findMany: async (args) => {
            assert.deepEqual(args.where, {});
            assert.equal(args.skip, 0);
            assert.equal(args.take, 20);
            return [];
          },
          count: async () => 0,
        },
      },
    },
  });
  const { getAllTransactions } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  const result = await getAllTransactions({});
  assert.deepEqual(result.transactions, []);
  assert.equal(result.totalPages, 0);
});

test("UTCID03: getAllTransactions rejects when the database query fails", async (t) => {
  t.mock.module("../src/config/database.js", {
    namedExports: {
      prisma: {
        walletTransaction: {
          findMany: async () => {
            throw new Error("Connection reset");
          },
          count: async () => 0,
        },
      },
    },
  });
  const { getAllTransactions } = await import(
    `../src/services/wallet.service.js?case=${Date.now()}-${Math.random()}`
  );
  await assert.rejects(() => getAllTransactions({}), /Connection reset/);
});
