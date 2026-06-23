import { prisma } from "../config/database.js";

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
