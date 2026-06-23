import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getStaffStats = asyncHandler(async (req, res) => {
  const staffId = req.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [checkInsToday, cancellationsToday] = await Promise.all([
    prisma.adminLog.count({
      where: {
        adminId: staffId,
        action: "UPDATE",
        entity: "Passenger",
        createdAt: { gte: today },
      },
    }),
    prisma.adminLog.count({
      where: {
        adminId: staffId,
        action: "APPROVE",
        entity: "Booking",
        createdAt: { gte: today },
      },
    }),
  ]);

  res.json({ checkInsToday, cancellationsToday });
});
