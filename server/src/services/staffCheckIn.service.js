import { prisma } from "../config/database.js";
import { sendEmail } from "./email.service.js";
import { getCheckInEmailTemplate } from "../utils/emailTemplates.js";

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const CHECK_IN_WINDOW_BEFORE_MS = 24 * 60 * 60 * 1000; // 24h trước giờ khởi hành
const CHECK_IN_WINDOW_AFTER_MS = 30 * 60 * 1000; // 30 phút sau giờ khởi hành
const UNDO_WINDOW_MS = 5 * 60 * 1000; // Cho phép hoàn tác trong 5 phút

const passengerInclude = {
  booking: {
    include: {
      user: true,
      schedule: {
        include: {
          train: true,
          route: true,
        },
      },
    },
  },
  seat: {
    include: {
      carriage: true,
    },
  },
};

export async function processTicketCheckIn({ ticketCode, staffId, ipAddress }) {
  if (!ticketCode) {
    throw httpError(400, "Mã vé không được để trống.");
  }

  const cleanTicketCode = ticketCode.trim().toUpperCase();

  const passenger = await prisma.passenger.findFirst({
    where: { ticketCode: cleanTicketCode },
    include: passengerInclude,
  });

  if (!passenger) {
    throw httpError(
      404,
      `Mã vé "${cleanTicketCode}" không tồn tại trên hệ thống.`,
    );
  }

  const bookingDetail = await prisma.bookingDetail.findFirst({
    where: { passengerId: passenger.id },
  });

  if (!bookingDetail) {
    throw httpError(404, "Không tìm thấy chi tiết đặt ghế cho vé này.");
  }

  if (
    bookingDetail.status === "CANCELLED" ||
    passenger.booking.status === "CANCELLED"
  ) {
    throw httpError(400, "Vé này đã bị hủy, không thể sử dụng để lên tàu.");
  }

  if (passenger.booking.paymentStatus !== "COMPLETED") {
    throw httpError(
      400,
      "Vé chưa được thanh toán thành công, không thể soát vé.",
    );
  }

  if (bookingDetail.status === "USED" || passenger.boardingAt !== null) {
    const timeString = passenger.boardingAt
      ? new Date(passenger.boardingAt).toLocaleString("vi-VN")
      : "trước đó";
    throw httpError(
      400,
      `Vé này đã được sử dụng (soát vé) vào lúc ${timeString}.`,
    );
  }

  if (passenger.booking.schedule.status === "CANCELLED") {
    throw httpError(
      400,
      `Chuyến chạy tàu này (${passenger.booking.schedule.train.trainCode}) đã bị hủy vận hành.`,
    );
  }

  // #4: Kiểm tra cửa sổ thời gian soát vé
  const now = new Date();
  const departureTime = new Date(passenger.booking.schedule.departureTime);
  const diffMs = departureTime - now;

  if (diffMs > CHECK_IN_WINDOW_BEFORE_MS) {
    const depStr = departureTime.toLocaleString("vi-VN");
    throw httpError(
      400,
      `Vé dành cho chuyến khởi hành lúc ${depStr}. Cửa soát vé mở trước 24 giờ khởi hành.`,
    );
  }
  if (diffMs < -CHECK_IN_WINDOW_AFTER_MS) {
    throw httpError(
      400,
      "Chuyến tàu đã khởi hành hơn 30 phút. Không thể soát vé.",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedPassenger = await tx.passenger.update({
      where: { id: passenger.id },
      data: { boardingAt: new Date() },
    });

    const updatedBookingDetail = await tx.bookingDetail.update({
      where: { id: bookingDetail.id },
      data: { status: "USED" },
    });

    await tx.adminLog.create({
      data: {
        adminId: staffId,
        action: "UPDATE",
        entity: "Passenger",
        entityId: passenger.id,
        changes: JSON.stringify({
          oldStatus: bookingDetail.status,
          newStatus: "USED",
          boardingAt: updatedPassenger.boardingAt,
        }),
        description: `Soát vé thành công: Vé ${passenger.ticketCode}, Hành khách: ${passenger.fullName}, Ghế: ${passenger.seat?.seatNumber || "N/A"} - Toa ${passenger.carriageNumber || "N/A"}. Tàu ${passenger.booking.schedule.train.trainCode}`,
        ipAddress: ipAddress || "",
      },
    });

    return { updatedPassenger, updatedBookingDetail };
  });

  // Send check-in boarding confirmation email asynchronously
  const email =
    passenger.booking.confirmationEmail ||
    passenger.booking.user?.email ||
    passenger.email;
  if (email) {
    sendEmail({
      to: email,
      subject: `[GoTrain VN] Xác nhận Check-in lên tàu thành công - Vé ${passenger.ticketCode}`,
      html: getCheckInEmailTemplate(
        passenger.fullName,
        passenger.ticketCode,
        passenger.booking.schedule.train.trainCode,
        passenger.seat?.seatNumber || "N/A",
        passenger.carriageNumber ||
          passenger.seat?.carriage?.carriageNumber ||
          "N/A",
      ),
    }).catch((err) => {
      console.error("❌ Gửi email check-in lên tàu thất bại:", err.message);
    });
  }

  return {
    ticketCode: passenger.ticketCode,
    fullName: passenger.fullName,
    nationalId: passenger.nationalId || "Không cung cấp",
    passengerType: passenger.passengerType,
    seatNumber: passenger.seat?.seatNumber || "N/A",
    carriageNumber:
      passenger.carriageNumber ||
      passenger.seat?.carriage?.carriageNumber ||
      "N/A",
    trainCode: passenger.booking.schedule.train.trainCode,
    trainName: passenger.booking.schedule.train.trainName,
    routeName: passenger.booking.schedule.route.routeName,
    departureTime: passenger.booking.schedule.departureTime,
    boardingAt: updated.updatedPassenger.boardingAt,
  };
}

// #5: Hoàn tác soát vé — chỉ cho phép trong vòng 5 phút
export async function undoTicketCheckIn({ ticketCode, staffId, ipAddress }) {
  if (!ticketCode) {
    throw httpError(400, "Mã vé không được để trống.");
  }

  const cleanTicketCode = ticketCode.trim().toUpperCase();

  const passenger = await prisma.passenger.findFirst({
    where: { ticketCode: cleanTicketCode },
    include: passengerInclude,
  });

  if (!passenger) {
    throw httpError(404, `Mã vé "${cleanTicketCode}" không tồn tại.`);
  }

  if (!passenger.boardingAt) {
    throw httpError(400, "Vé này chưa được soát, không có gì để hoàn tác.");
  }

  const now = new Date();
  const elapsed = now - new Date(passenger.boardingAt);
  if (elapsed > UNDO_WINDOW_MS) {
    throw httpError(
      409,
      `Đã quá 5 phút kể từ lúc soát vé (${new Date(passenger.boardingAt).toLocaleString("vi-VN")}). Không thể hoàn tác.`,
    );
  }

  const bookingDetail = await prisma.bookingDetail.findFirst({
    where: { passengerId: passenger.id, status: "USED" },
  });

  if (!bookingDetail) {
    throw httpError(400, "Không tìm thấy chi tiết vé ở trạng thái đã sử dụng.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.passenger.update({
      where: { id: passenger.id },
      data: { boardingAt: null },
    });

    await tx.bookingDetail.update({
      where: { id: bookingDetail.id },
      data: { status: "CONFIRMED" },
    });

    await tx.adminLog.create({
      data: {
        adminId: staffId,
        action: "UPDATE",
        entity: "Passenger",
        entityId: passenger.id,
        changes: JSON.stringify({
          oldStatus: "USED",
          newStatus: "CONFIRMED",
          boardingAt: null,
          undoneAt: now.toISOString(),
        }),
        description: `Hoàn tác soát vé: Vé ${passenger.ticketCode}, Hành khách: ${passenger.fullName}. Tàu ${passenger.booking.schedule.train.trainCode}`,
        ipAddress: ipAddress || "",
      },
    });
  });

  return { ticketCode: cleanTicketCode, fullName: passenger.fullName };
}

// Báo sai lệch thông tin kiểm soát vé (MISMATCH_REJECTED)
export async function reportTicketMismatch({ ticketCode, staffId, ipAddress }) {
  if (!ticketCode) {
    throw httpError(400, "Mã vé không được để trống.");
  }

  const cleanTicketCode = ticketCode.trim().toUpperCase();

  const passenger = await prisma.passenger.findFirst({
    where: { ticketCode: cleanTicketCode },
    include: passengerInclude,
  });

  if (!passenger) {
    throw httpError(404, `Mã vé "${cleanTicketCode}" không tồn tại.`);
  }

  const bookingDetail = await prisma.bookingDetail.findFirst({
    where: { passengerId: passenger.id },
  });

  if (!bookingDetail) {
    throw httpError(404, "Không tìm thấy chi tiết vé.");
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.passenger.update({
      where: { id: passenger.id },
      data: { boardingAt: null },
    });

    await tx.bookingDetail.update({
      where: { id: bookingDetail.id },
      data: { status: "CONFIRMED" },
    });

    await tx.adminLog.create({
      data: {
        adminId: staffId,
        action: "REJECT",
        entity: "Passenger",
        entityId: passenger.id,
        changes: JSON.stringify({
          oldStatus: bookingDetail.status,
          newStatus: "CONFIRMED",
          boardingAt: null,
          reason: "MISMATCH_REJECTED",
          reportedAt: now.toISOString(),
        }),
        description: `Từ chối soát vé do sai lệch thông tin (MISMATCH_REJECTED): Vé ${passenger.ticketCode}, Hành khách: ${passenger.fullName}. Tàu ${passenger.booking.schedule.train.trainCode}`,
        ipAddress: ipAddress || "",
      },
    });
  });

  return { ticketCode: cleanTicketCode, fullName: passenger.fullName };
}

// Đính chính thông tin hành khách theo giấy tờ gốc
export async function correctPassengerInfo({
  ticketCode,
  fullName,
  nationalId,
  dateOfBirth,
  staffId,
  ipAddress,
}) {
  if (!ticketCode) {
    throw httpError(400, "Mã vé không được để trống.");
  }
  if (!fullName || !fullName.trim()) {
    throw httpError(400, "Họ tên không được để trống.");
  }

  const cleanTicketCode = ticketCode.trim().toUpperCase();

  const passenger = await prisma.passenger.findFirst({
    where: { ticketCode: cleanTicketCode },
  });

  if (!passenger) {
    throw httpError(404, `Mã vé "${cleanTicketCode}" không tồn tại.`);
  }

  const updateData = {
    fullName: fullName.trim(),
    nationalId: nationalId ? nationalId.trim() : null,
  };

  if (dateOfBirth) {
    updateData.dateOfBirth = new Date(dateOfBirth);
  }

  await prisma.$transaction(async (tx) => {
    await tx.passenger.update({
      where: { id: passenger.id },
      data: updateData,
    });

    await tx.adminLog.create({
      data: {
        adminId: staffId,
        action: "UPDATE",
        entity: "Passenger",
        entityId: passenger.id,
        changes: JSON.stringify({
          oldName: passenger.fullName,
          newName: updateData.fullName,
          oldNationalId: passenger.nationalId,
          newNationalId: updateData.nationalId,
          oldDob: passenger.dateOfBirth,
          newDob: updateData.dateOfBirth,
        }),
        description: `Đính chính thông tin hành khách: Vé ${cleanTicketCode}. Tên: ${passenger.fullName} ➔ ${updateData.fullName}, CCCD: ${passenger.nationalId || "N/A"} ➔ ${updateData.nationalId || "N/A"}`,
        ipAddress: ipAddress || "",
      },
    });
  });

  return { ticketCode: cleanTicketCode, fullName: updateData.fullName };
}

// Vô hiệu hóa vé do vi phạm điều khoản vận chuyển
export async function invalidateTicket({
  ticketCode,
  reason,
  staffId,
  ipAddress,
}) {
  if (!ticketCode) {
    throw httpError(400, "Mã vé không được để trống.");
  }
  if (!reason || !reason.trim()) {
    throw httpError(400, "Lý do vô hiệu hóa không được để trống.");
  }

  const cleanTicketCode = ticketCode.trim().toUpperCase();

  const passenger = await prisma.passenger.findFirst({
    where: { ticketCode: cleanTicketCode },
    include: passengerInclude,
  });

  if (!passenger) {
    throw httpError(404, `Mã vé "${cleanTicketCode}" không tồn tại.`);
  }

  const bookingDetail = await prisma.bookingDetail.findFirst({
    where: { passengerId: passenger.id },
  });

  if (!bookingDetail) {
    throw httpError(404, "Không tìm thấy chi tiết vé.");
  }

  if (bookingDetail.status === "CANCELLED") {
    throw httpError(400, "Vé này đã bị hủy từ trước.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.bookingDetail.update({
      where: { id: bookingDetail.id },
      data: { status: "CANCELLED" },
    });

    if (passenger.seatId) {
      await tx.seat.update({
        where: { id: passenger.seatId },
        data: {
          status: "AVAILABLE",
          selectedBy: null,
          selectedAt: null,
          selectionExpiry: null,
        },
      });
    }

    await tx.adminLog.create({
      data: {
        adminId: staffId,
        action: "REJECT",
        entity: "Passenger",
        entityId: passenger.id,
        changes: JSON.stringify({
          status: "CANCELLED",
          reason: reason.trim(),
        }),
        description: `Vô hiệu hóa vé (Hủy vi phạm): Vé ${cleanTicketCode}, Hành khách: ${passenger.fullName}. Lý do: ${reason}`,
        ipAddress: ipAddress || "",
      },
    });
  });

  return { ticketCode: cleanTicketCode, fullName: passenger.fullName };
}

// Thu hồi ưu đãi và nâng cấp loại vé STUDENT ➔ ADULT tại quầy
import { randomUUID } from "node:crypto";
export async function exchangeTicketType({
  ticketCode,
  paymentMethod = "CASH",
  staffId,
  ipAddress,
}) {
  if (!ticketCode) {
    throw httpError(400, "Mã vé không được để trống.");
  }

  const cleanTicketCode = ticketCode.trim().toUpperCase();

  const passenger = await prisma.passenger.findFirst({
    where: { ticketCode: cleanTicketCode },
    include: passengerInclude,
  });

  if (!passenger) {
    throw httpError(404, `Mã vé "${cleanTicketCode}" không tồn tại.`);
  }

  if (passenger.passengerType !== "STUDENT") {
    throw httpError(400, "Chỉ có thể thu hồi ưu đãi cho vé Sinh viên.");
  }

  const bookingDetail = await prisma.bookingDetail.findFirst({
    where: { passengerId: passenger.id },
  });

  if (!bookingDetail) {
    throw httpError(404, "Không tìm thấy chi tiết vé.");
  }

  const discountAmount = bookingDetail.discountAmount || 0;
  const penaltyFee = 50000; // 50k VND phí xử lý tại quầy quy định
  const totalDue = discountAmount + penaltyFee;

  const now = new Date();
  const newTicketCode = `VE${randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase()}`;

  await prisma.$transaction(async (tx) => {
    if (paymentMethod === "WALLET") {
      if (!passenger.booking.userId) {
        throw httpError(
          400,
          "Khách vãng lai không có ví. Vui lòng thanh toán tiền mặt.",
        );
      }
      const wallet = await tx.wallet.findUnique({
        where: { userId: passenger.booking.userId },
      });
      if (!wallet || wallet.balance < totalDue) {
        throw httpError(
          422,
          `Số dư ví khách hàng không đủ (cần ${totalDue.toLocaleString("vi-VN")}đ).`,
        );
      }
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: totalDue } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "PAYMENT",
          amount: totalDue,
          description: `Thu hồi ưu đãi (STUDENT ➔ ADULT) vé ${cleanTicketCode}`,
          relatedBookingId: passenger.bookingId,
          status: "COMPLETED",
        },
      });
    }

    await tx.bookingPaymentHistory.create({
      data: {
        bookingId: passenger.bookingId,
        paymentMethod,
        amount: totalDue,
        status: "SUCCESS",
        transactionId: `STAFF-EXCHANGE-TYPE-${randomUUID()}`,
        attemptNumber: 1,
      },
    });

    await tx.passenger.update({
      where: { id: passenger.id },
      data: {
        passengerType: "ADULT",
        discountPercentage: 0,
        discountReason: null,
        ticketCode: newTicketCode,
        boardingAt: null,
      },
    });

    await tx.bookingDetail.update({
      where: { id: bookingDetail.id },
      data: {
        discountAmount: 0,
        finalPrice: bookingDetail.basePrice,
        status: "CONFIRMED",
      },
    });

    await tx.booking.update({
      where: { id: passenger.bookingId },
      data: {
        discountAmount: { decrement: discountAmount },
        totalAmount: { increment: totalDue },
      },
    });

    await tx.adminLog.create({
      data: {
        adminId: staffId,
        action: "UPDATE",
        entity: "Passenger",
        entityId: passenger.id,
        changes: JSON.stringify({
          oldType: "STUDENT",
          newType: "ADULT",
          oldTicketCode: cleanTicketCode,
          newTicketCode,
          amountCollected: totalDue,
        }),
        description: `Thu hồi ưu đãi (Sinh viên -> Người lớn): Vé cũ: ${cleanTicketCode}, Vé mới: ${newTicketCode}, Thu thêm: ${totalDue.toLocaleString("vi-VN")}đ. Lý do: Không có thẻ SV hợp lệ.`,
        ipAddress: ipAddress || "",
      },
    });
  });

  return { oldTicketCode: cleanTicketCode, newTicketCode, totalDue };
}
