import { api } from "./api";

export const staffSearchApi = {
  globalSearch: (query) => api.get("/staff/search", { params: { q: query } }),
  cancellationQuote: (payload) =>
    api.post("/staff/cancellations/quote", payload),
  cancellationConfirm: (payload) =>
    api.post("/staff/cancellations/confirm", payload),
  checkIn: (ticketCode) => api.post("/staff/check-in", { ticketCode }),
  undoCheckIn: (ticketCode) => api.post("/staff/check-in/undo", { ticketCode }),
  getStats: () => api.get("/staff/stats"),
  exchangeConfirm: (payload) => api.post("/staff/exchange", payload),
};
