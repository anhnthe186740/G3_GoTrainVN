import { api } from "./api";

export const bookingApi = {
  quote: (payload) => api.post("/bookings/quote", payload),
  checkout: (payload) => api.post("/bookings/checkout", payload),
  exchange: (bookingId, payload) =>
    api.post(`/bookings/${bookingId}/exchange`, payload),
  paymentStatus: (bookingId) =>
    api.get(`/bookings/${bookingId}/payment-status`),
  confirmQrPayment: (bookingId) =>
    api.post(`/bookings/${bookingId}/confirm-qr-payment`),
};
