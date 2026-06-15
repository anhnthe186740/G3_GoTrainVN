import { api } from "./api";

export const bookingApi = {
  quote: (payload) => api.post("/bookings/quote", payload),
  checkout: (payload) => api.post("/bookings/checkout", payload),
  confirmQrPayment: (bookingId) =>
    api.post(`/bookings/${bookingId}/confirm-qr-payment`),
};
