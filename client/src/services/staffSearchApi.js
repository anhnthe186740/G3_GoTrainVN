import { api } from "./api";

export const staffSearchApi = {
  globalSearch: (query) => api.get("/staff/search", { params: { q: query } }),
  cancellationQuote: (payload) =>
    api.post("/staff/cancellations/quote", payload),
  cancellationConfirm: (payload) =>
    api.post("/staff/cancellations/confirm", payload),
  checkIn: (ticketCode) => api.post("/staff/check-in", { ticketCode }),
  undoCheckIn: (ticketCode) => api.post("/staff/check-in/undo", { ticketCode }),
  reportMismatch: (ticketCode) =>
    api.post("/staff/check-in/mismatch", { ticketCode }),
  correctInfo: (payload) => api.post("/staff/check-in/correct-info", payload),
  invalidate: (payload) => api.post("/staff/check-in/invalidate", payload),
  exchangeType: (payload) => api.post("/staff/check-in/exchange-type", payload),
  getStats: () => api.get("/staff/stats"),
  exchangeConfirm: (payload) => api.post("/staff/exchange", payload),
};
