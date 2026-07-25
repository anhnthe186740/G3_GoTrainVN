import { Router } from "express";
import { body } from "express-validator";
import { authMiddleware } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import {
  getMyWallet,
  deposit,
  getDepositStatus,
  getPendingDeposit,
  cancelDeposit,
  withdraw,
  getMyTransactions,
  getAdminStats,
  getAdminTransactions,
  approveWithdrawal,
  rejectWithdrawal,
} from "../controllers/wallet.controller.js";

export const walletRoutes = Router();

function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN")
    return res.status(403).json({ message: "Forbidden" });
  next();
}

// User routes
walletRoutes.get("/", authMiddleware, getMyWallet);

walletRoutes.post(
  "/deposit",
  authMiddleware,
  [
    body("amount")
      .isFloat({ min: 10000, max: 50000000 })
      .withMessage("Số tiền nạp phải từ 10,000 đến 50,000,000 VND")
      .custom((v) => Number(v) % 1000 === 0)
      .withMessage("Số tiền phải là bội số của 1,000"),
  ],
  validate,
  deposit,
);

walletRoutes.get("/deposit/pending", authMiddleware, getPendingDeposit);
walletRoutes.get(
  "/deposit/:transactionId/status",
  authMiddleware,
  getDepositStatus,
);
walletRoutes.post(
  "/deposit/:transactionId/cancel",
  authMiddleware,
  cancelDeposit,
);

walletRoutes.post(
  "/withdraw",
  authMiddleware,
  [
    body("amount")
      .isFloat({ min: 50000 })
      .withMessage("Số tiền rút tối thiểu 50,000 VND")
      .custom((v) => Number(v) % 1000 === 0)
      .withMessage("Số tiền phải là bội số của 1,000"),
  ],
  validate,
  withdraw,
);

walletRoutes.get("/transactions", authMiddleware, getMyTransactions);

// Admin routes
walletRoutes.get("/admin/stats", authMiddleware, adminOnly, getAdminStats);
walletRoutes.get(
  "/admin/transactions",
  authMiddleware,
  adminOnly,
  getAdminTransactions,
);
walletRoutes.patch(
  "/admin/transactions/:id/approve",
  authMiddleware,
  adminOnly,
  approveWithdrawal,
);
walletRoutes.patch(
  "/admin/transactions/:id/reject",
  authMiddleware,
  adminOnly,
  [body("reason").optional().trim()],
  validate,
  rejectWithdrawal,
);
