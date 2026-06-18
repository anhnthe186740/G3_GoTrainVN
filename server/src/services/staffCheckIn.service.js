import { prisma } from "../config/database.js";

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function processTicketCheckIn({ ticketCode, staffId, ipAddress }) {
  if (!ticketCode) {
    throw httpError(400, "Mã vé không được để trống.");
  }

  const cleanTicketCode = ticketCode.trim().toUpperCase();

  // 1. Find the Passenger by ticketCode
  const passenger = await prisma.passenger.findFirst({
    where: { ticketCode: cleanTicketCode },
    include: {
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
    },
  });

  if (!passenger) {
    throw httpError(
      404,
      `Mã vé "${cleanTicketCode}" không tồn tại trên hệ thống.`,
    );
  }

  // 2. Find the BookingDetail associated with this passenger
  const bookingDetail = await prisma.bookingDetail.findFirst({
    where: { passengerId: passenger.id },
  });

  if (!bookingDetail) {
    throw httpError(404, "Không tìm thấy chi tiết đặt ghế cho vé này.");
  }

  // 3. Validations
  // A. Check if the booking or ticket detail status is CANCELLED
  if (
    bookingDetail.status === "CANCELLED" ||
    passenger.booking.status === "CANCELLED"
  ) {
    throw httpError(400, "Vé này đã bị hủy, không thể sử dụng để lên tàu.");
  }

  // B. Check if booking is paid
  if (passenger.booking.paymentStatus !== "COMPLETED") {
    throw httpError(
      400,
      "Vé chưa được thanh toán thành công, không thể soát vé.",
    );
  }

  // C. Check if ticket has already been used (scanned)
  if (bookingDetail.status === "USED" || passenger.boardingAt !== null) {
    const timeString = passenger.boardingAt
      ? new Date(passenger.boardingAt).toLocaleString("vi-VN")
      : "trước đó";
    throw httpError(
      400,
      `Vé này đã được sử dụng (soát vé) vào lúc ${timeString}.`,
    );
  }

  // D. Check if schedule is cancelled
  if (passenger.booking.schedule.status === "CANCELLED") {
    throw httpError(
      400,
      `Chuyến chạy tàu này (${passenger.booking.schedule.train.trainCode}) đã bị hủy vận hành.`,
    );
  }

  // 4. Perform check-in update inside a transaction
  const updated = await prisma.$transaction(async (tx) => {
    // A. Update Passenger boardingAt
    const updatedPassenger = await tx.passenger.update({
      where: { id: passenger.id },
      data: { boardingAt: new Date() },
    });

    // B. Update BookingDetail status
    const updatedBookingDetail = await tx.bookingDetail.update({
      where: { id: bookingDetail.id },
      data: { status: "USED" },
    });

    // C. Write to AdminLog
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

  // 5. Return detailed result for UI
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
