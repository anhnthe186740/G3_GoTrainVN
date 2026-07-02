import "dotenv/config";
// Trigger nodemon reload - DSVN business logic updated
import { createServer } from "node:http";
import app from "./app.js";
import { connectDatabase } from "./config/database.js";
import {
  emitSeatState,
  emitSessionExpired,
  initializeSeatRealtime,
} from "./realtime/seatRealtime.js";
import { cleanupExpiredHolds } from "./services/seatSelection.service.js";
import { cleanupExpiredBookings } from "./services/bookingCheckout.service.js";
import { startAutoScheduleCron } from "./services/autoSchedule.service.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
  await connectDatabase();
  startAutoScheduleCron();
  const httpServer = createServer(app);
  initializeSeatRealtime(httpServer);

  const cleanupTimer = setInterval(async () => {
    try {
      const { expiredHolds, expiredSessions } = await cleanupExpiredHolds();
      for (const hold of expiredHolds) {
        emitSeatState(hold.scheduleId, {
          seatId: hold.seatId,
          state: "AVAILABLE",
        });
      }
      for (const session of expiredSessions) {
        if (session.userId) {
          emitSessionExpired(session.userId, { sessionId: session.id });
        }
      }
    } catch (error) {
      console.error("Failed to clean expired seat holds", error);
    }
  }, 15_000);
  cleanupTimer.unref();

  const bookingExpiryTimer = setInterval(async () => {
    try {
      await cleanupExpiredBookings();
    } catch (error) {
      console.error("Failed to clean expired bookings", error);
    }
  }, 60_000);
  bookingExpiryTimer.unref();

  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
