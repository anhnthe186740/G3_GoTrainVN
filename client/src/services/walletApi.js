import { api } from "./api.js";

export const walletApi = {
  getWallet: () => api.get("/wallet"),
  deposit: (amount, description) =>
    api.post("/wallet/deposit", { amount, description }),
  depositStatus: (transactionId) =>
    api.get(`/wallet/deposit/${transactionId}/status`),
  pendingDeposit: () => api.get("/wallet/deposit/pending"),
  cancelDeposit: (transactionId) =>
    api.post(`/wallet/deposit/${transactionId}/cancel`),
  withdraw: (amount) => api.post("/wallet/withdraw", { amount }),
  getTransactions: (params) => api.get("/wallet/transactions", { params }),

  // Admin
  getAdminStats: () => api.get("/wallet/admin/stats"),
  getAdminTransactions: (params) =>
    api.get("/wallet/admin/transactions", { params }),
  approveWithdrawal: (id) =>
    api.patch(`/wallet/admin/transactions/${id}/approve`),
  rejectWithdrawal: (id, reason) =>
    api.patch(`/wallet/admin/transactions/${id}/reject`, { reason }),
};
