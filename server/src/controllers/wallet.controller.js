import { asyncHandler } from "../utils/asyncHandler.js";
import * as walletService from "../services/wallet.service.js";

export const getMyWallet = asyncHandler(async (req, res) => {
  const wallet = await walletService.getWallet(req.user.id);
  res.json({ wallet });
});

export const deposit = asyncHandler(async (req, res) => {
  const { amount, description } = req.body;
  const result = await walletService.deposit(
    req.user.id,
    Number(amount),
    description,
  );
  res.json({ message: "Tạo link nạp tiền thành công", ...result });
});

export const getDepositStatus = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await walletService.getDepositStatus(
    req.user.id,
    transactionId,
  );
  res.json({ transaction });
});

export const getPendingDeposit = asyncHandler(async (req, res) => {
  const transaction = await walletService.getPendingDeposit(req.user.id);
  res.json({ transaction });
});

export const cancelDeposit = asyncHandler(async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await walletService.cancelDeposit(
    req.user.id,
    transactionId,
  );
  res.json({ message: "Đã hủy yêu cầu nạp tiền", transaction });
});

export const withdraw = asyncHandler(async (req, res) => {
  const { amount } = req.body;
  const result = await walletService.requestWithdrawal(
    req.user.id,
    Number(amount),
  );
  res.json({
    message: "Yêu cầu rút tiền đã được ghi nhận, đang chờ admin duyệt",
    ...result,
  });
});

export const getMyTransactions = asyncHandler(async (req, res) => {
  const { type, status, page, limit } = req.query;
  const result = await walletService.getMyTransactions(req.user.id, {
    type,
    status,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 10,
  });
  res.json(result);
});

export const getAdminStats = asyncHandler(async (_req, res) => {
  const stats = await walletService.getAdminStats();
  res.json({ stats });
});

export const getAdminTransactions = asyncHandler(async (req, res) => {
  const { type, status, page, limit } = req.query;
  const result = await walletService.getAllTransactions({
    type,
    status,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 20,
  });
  res.json(result);
});

export const approveWithdrawal = asyncHandler(async (req, res) => {
  const transaction = await walletService.approveWithdrawal(req.params.id);
  res.json({ message: "Đã duyệt yêu cầu rút tiền", transaction });
});

export const rejectWithdrawal = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  const transaction = await walletService.rejectWithdrawal(
    req.params.id,
    reason,
  );
  res.json({
    message: "Đã từ chối yêu cầu rút tiền, tiền đã hoàn lại ví",
    transaction,
  });
});
