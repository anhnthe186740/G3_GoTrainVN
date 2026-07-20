import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { emitSeatState } from "../realtime/seatRealtime.js";
import { notifyScheduleChange } from "../services/scheduleNotification.service.js";

// Helper: Tự động từ chối (decline) các đặt vé PENDING
async function declinePendingBookings(scheduleIds, tx) {
  if (!scheduleIds || scheduleIds.length === 0) return;

  // Tìm tất cả booking đang PENDING thuộc danh sách lịch trình này
  const bookings = await tx.booking.findMany({
    where: {
      scheduleId: { in: scheduleIds },
      status: "PENDING",
    },
  });

  if (bookings.length > 0) {
    const bookingIds = bookings.map((b) => b.id);
    await tx.booking.updateMany({
      where: { id: { in: bookingIds } },
      data: {
        status: "CANCELLED",
        cancelReason: "Dịch vụ hiện không khả dụng",
      },
    });

    // Thêm log lịch sử thanh toán thất bại/từ chối hoặc thông báo
    for (const booking of bookings) {
      await tx.bookingPaymentHistory.create({
        data: {
          bookingId: booking.id,
          paymentMethod: booking.paymentMethod || "UNKNOWN",
          amount: booking.totalAmount,
          status: "FAILED",
          failureReason: "Dịch vụ hiện không khả dụng (Tàu đi bảo trì)",
          attemptNumber: 1,
        },
      });

      if (booking.userId) {
        await tx.notification.create({
          data: {
            userId: booking.userId,
            type: "BOOKING_CANCELLED",
            title: "Đơn đặt vé bị hủy bỏ",
            message: `Rất tiếc, đơn đặt vé ${booking.bookingCode} của bạn đã bị hủy do lịch chạy tàu bị thay đổi để bảo trì kỹ thuật. Lý do: Dịch vụ hiện không khả dụng.`,
            relatedBookingId: booking.id,
            deliveryMethod: ["IN_APP"],
            deliveryStatus: "SENT",
          },
        });
      }
    }
  }
}

// = [1] Lập kế hoạch bảo trì (Vehicle Maintenance) =
export const createMaintenance = asyncHandler(async (req, res) => {
  const {
    trainId,
    maintenanceType,
    description,
    startDate,
    endDate,
    affectedScheduleIds = [],
    notes,
  } = req.body;

  if (!trainId || !maintenanceType || !description || !startDate || !endDate) {
    return res
      .status(400)
      .json({ message: "Thiếu thông tin bắt buộc để lập lịch bảo trì." });
  }

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Ràng buộc an toàn BR-30: Không thể chuyển trạng thái bảo trì cho tàu đang ở trạng thái Running
  const runningSchedule = await prisma.schedule.findFirst({
    where: {
      trainId,
      status: { in: ["ACTIVE", "DELAYED"] },
      departureTime: { lte: now },
      arrivalTime: { gte: now },
    },
  });

  if (runningSchedule) {
    return res.status(422).json({
      message:
        "Ràng buộc an toàn (BR-30): Không thể chuyển trạng thái bảo trì cho một tàu đang chạy trên đường ray. Hãy đợi tàu cập ga.",
    });
  }

  // Thực hiện lưu bảo trì và hủy lịch trình bị ảnh hưởng trong 1 transaction
  const maintenance = await prisma.$transaction(async (tx) => {
    // 1. Tạo bản ghi VehicleMaintenance
    const vm = await tx.vehicleMaintenance.create({
      data: {
        trainId,
        maintenanceType,
        description,
        startDate: start,
        endDate: end,
        affectedScheduleIds,
        status: start <= now ? "IN_PROGRESS" : "SCHEDULED",
        notes,
      },
    });

    // Nếu thời gian bắt đầu bảo trì là ngay bây giờ, chuyển trạng thái tàu sang MAINTENANCE
    if (start <= now && now <= end) {
      await tx.train.update({
        where: { id: trainId },
        data: { status: "MAINTENANCE" },
      });
    }

    // 2. Hủy các lịch trình bị ảnh hưởng
    if (affectedScheduleIds.length > 0) {
      await tx.schedule.updateMany({
        where: { id: { in: affectedScheduleIds } },
        data: {
          status: "CANCELLED",
          notes: `Hủy chuyến do tàu đi bảo trì (${description})`,
        },
      });

      // 3. Tự động từ chối các đặt vé PENDING trên lịch trình này (BR-29)
      await declinePendingBookings(affectedScheduleIds, tx);
    }

    return vm;
  });

  // Gửi email thông báo hủy chuyến tự động cho hành khách có vé
  if (affectedScheduleIds && affectedScheduleIds.length > 0) {
    for (const scheduleId of affectedScheduleIds) {
      notifyScheduleChange(scheduleId, "CANCELLED", {
        notes: `Hủy chuyến do tàu đi bảo trì (${description})`,
      });
    }
  }

  res.status(201).json({
    message: "Lập lịch bảo trì đoàn tàu thành công!",
    maintenance,
  });
});

// Lấy danh sách lịch sử bảo trì
export const getMaintenanceList = asyncHandler(async (_req, res) => {
  const list = await prisma.vehicleMaintenance.findMany({
    include: {
      train: {
        select: { trainName: true, trainCode: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ maintenanceList: list });
});

// Cập nhật trạng thái bảo trì (luồng: SCHEDULED -> IN_PROGRESS -> COMPLETED)
export const updateMaintenanceStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  if (!["SCHEDULED", "IN_PROGRESS", "COMPLETED"].includes(status)) {
    return res
      .status(400)
      .json({ message: "Trạng thái bảo trì không hợp lệ." });
  }

  const currentVM = await prisma.vehicleMaintenance.findUnique({
    where: { id },
    include: { train: true },
  });

  if (!currentVM) {
    return res.status(404).json({ message: "Không tìm thấy lịch bảo trì." });
  }

  const updatedVM = await prisma.$transaction(async (tx) => {
    const vm = await tx.vehicleMaintenance.update({
      where: { id },
      data: {
        status,
        ...(notes && { notes }),
        ...(status === "COMPLETED" && { endDate: new Date() }),
      },
    });

    const trainId = currentVM.trainId;

    if (status === "IN_PROGRESS") {
      // Đưa tàu sang trạng thái bảo trì
      await tx.train.update({
        where: { id: trainId },
        data: { status: "MAINTENANCE" },
      });
    } else if (status === "COMPLETED") {
      // Kiểm tra xem tàu có còn đợt bảo trì nào khác đang chạy không
      const otherRunning = await tx.vehicleMaintenance.findFirst({
        where: {
          trainId,
          id: { not: id },
          status: "IN_PROGRESS",
        },
      });

      if (!otherRunning) {
        // Khôi phục tàu về trạng thái hoạt động bình thường
        await tx.train.update({
          where: { id: trainId },
          data: { status: "ACTIVE" },
        });
      }
    }

    return vm;
  });

  res.json({
    message: `Cập nhật trạng thái đợt bảo trì sang ${status} thành công.`,
    maintenance: updatedVM,
  });
});

// Xóa lịch trình bảo trì
export const deleteMaintenance = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const currentVM = await prisma.vehicleMaintenance.findUnique({
    where: { id },
  });

  if (!currentVM) {
    return res.status(404).json({ message: "Không tìm thấy lịch bảo trì." });
  }

  if (currentVM.status === "IN_PROGRESS") {
    return res
      .status(400)
      .json({ message: "Không thể xóa đợt bảo trì đang thực hiện." });
  }

  await prisma.vehicleMaintenance.delete({ where: { id } });

  res.json({ message: "Đã xóa bản ghi kế hoạch bảo trì thành công." });
});

// = [2] Giám sát & Khóa ghế (Seat Blocking) =
export const blockSeat = asyncHandler(async (req, res) => {
  const { id } = req.params; // seatId
  const { status, blockReason, blockUntil } = req.body;

  if (!["BLOCKED", "AVAILABLE"].includes(status)) {
    return res.status(400).json({
      message:
        "Trạng thái ghế không hợp lệ. Chỉ chấp nhận BLOCKED hoặc AVAILABLE.",
    });
  }

  const targetSeat = await prisma.seat.findUnique({
    where: { id },
    include: {
      carriage: {
        select: { trainId: true },
      },
    },
  });

  if (!targetSeat) {
    return res.status(404).json({ message: "Không tìm thấy ghế yêu cầu." });
  }

  const updatedSeat = await prisma.seat.update({
    where: { id },
    data: {
      status,
      blockReason: status === "BLOCKED" ? blockReason || "MAINTENANCE" : null,
      blockUntil:
        status === "BLOCKED" && blockUntil ? new Date(blockUntil) : null,
    },
  });

  // Tìm tất cả schedule ACTIVE/DELAYED của train chứa ghế này để gửi socket update thời gian thực
  const activeSchedules = await prisma.schedule.findMany({
    where: {
      trainId: targetSeat.carriage.trainId,
      status: { in: ["ACTIVE", "DELAYED"] },
    },
    select: { id: true },
  });

  // Phát tín hiệu socket đồng bộ real-time
  for (const s of activeSchedules) {
    emitSeatState(s.id, {
      seatId: id,
      state: status,
      blockReason: status === "BLOCKED" ? blockReason : null,
      blockUntil: status === "BLOCKED" ? blockUntil : null,
    });
  }

  res.json({
    message:
      status === "BLOCKED"
        ? "Đã khóa ghế thành công!"
        : "Đã mở khóa ghế thành công!",
    seat: updatedSeat,
  });
});
