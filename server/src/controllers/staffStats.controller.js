import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getStaffStats = asyncHandler(async (req, res) => {
  const staffId = req.user.id;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Dùng description prefix để phân biệt soát vé và hoàn tác soát vé
  // (cả hai đều ghi action:"UPDATE" entity:"Passenger")
  const [checkInsToday, cancellationsToday, exchangesToday] = await Promise.all(
    [
      prisma.adminLog.count({
        where: {
          adminId: staffId,
          action: "UPDATE",
          entity: "Passenger",
          description: { startsWith: "Soát vé thành công:" },
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
      prisma.adminLog.count({
        where: {
          adminId: staffId,
          action: "UPDATE",
          entity: "Booking",
          description: { startsWith: "Nhân viên đổi vé" },
          createdAt: { gte: today },
        },
      }),
    ],
  );

  res.json({ checkInsToday, cancellationsToday, exchangesToday });
});
