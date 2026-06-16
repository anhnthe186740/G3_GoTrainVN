import jwt from "jsonwebtoken";
import { Server } from "socket.io";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
let io;

function tokenFromCookie(cookieHeader = "") {
  const tokenCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("token="));
  return tokenCookie ? decodeURIComponent(tokenCookie.slice(6)) : null;
}

export function initializeSeatRealtime(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      tokenFromCookie(socket.handshake.headers.cookie) ||
      socket.handshake.auth?.token;
    if (!token) return next();

    try {
      socket.user = jwt.verify(token, process.env.JWT_SECRET);
      next();
    } catch {
      next();
    }
  });

  io.on("connection", (socket) => {
    socket.on("schedule:join", (scheduleId) => {
      if (!OBJECT_ID_PATTERN.test(String(scheduleId))) return;
      socket.join(`schedule:${scheduleId}`);
    });

    socket.on("schedule:leave", (scheduleId) => {
      if (!OBJECT_ID_PATTERN.test(String(scheduleId))) return;
      socket.leave(`schedule:${scheduleId}`);
    });
  });

  return io;
}

export function emitSeatState(scheduleId, payload) {
  io?.to(`schedule:${scheduleId}`).emit("seat:state", {
    scheduleId,
    ...payload,
  });
}

export function emitSessionExpired(userId, payload) {
  if (!io) return;
  for (const socket of io.sockets.sockets.values()) {
    if (socket.user?.id === userId) {
      socket.emit("session:expired", payload);
    }
  }
}
