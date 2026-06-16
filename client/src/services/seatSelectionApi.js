import { io } from "socket.io-client";
import { api } from "./api";

const socketUrl =
  import.meta.env.VITE_SOCKET_URL ||
  api.defaults.baseURL.replace(/\/api\/v1\/?$/, "");

export const seatSelectionApi = {
  confirmSelection: (payload) => api.post("/seat-holds/confirm", payload),
  getSession: (sessionId) => api.get(`/seat-sessions/${sessionId}`),
  releaseSession: (sessionId) => api.delete(`/seat-sessions/${sessionId}`),
  getSeatMap: ({ scheduleId, fromStationId, toStationId, sessionId }) =>
    api.get(`/schedules/${scheduleId}/seat-map`, {
      params: { fromStationId, toStationId, sessionId },
    }),
};

export function createSeatSocket() {
  return io(socketUrl, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
}
