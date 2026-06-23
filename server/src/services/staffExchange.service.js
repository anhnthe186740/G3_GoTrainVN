import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";

const ALLOWED_METHODS = ["CASH", "WALLET"];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function confirmStaffExchange({
  bookingId,
  sessionId,
  paymentMethod = "WALLET",
  reason,
  staffId,
  ipAddress,
}) {
  const method = String(paymentMethod || "").toUpperCase();
  if (!ALLOWED_METHODS.includes(method)) {
    throw httpError(
      400,
      "Phương thức thanh toán không hợp lệ (CASH hoặc WALLET).",
    );
  }
  if (!reason || !String(reason).trim()) {
    throw httpError(400, "Vui lòng nhập lý do đổi vé.");
  }
  if (!sessionId) {
    throw httpError(400, "Thiếu phiên giữ ghế mới.");
  }

  const now = new Date();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      schedule: true,
      passengers: { orderBy: { createdAt: "asc" } },
      bookingDetails: { orderBy: { id: "asc" } },
    },
  });
  if (!booking) throw httpError(404, "Không tìm thấy booking.");
  if (booking.status !== "CONFIRMED" || booking.paymentStatus !== "COMPLETED") {
    throw httpError(400, "Chỉ có thể đổi vé đã thanh toán và còn hiệu lực.");
  }
  if (new Date(booking.schedule.departureTime).getTime() <= now.getTime()) {
    throw httpError(400, "Không thể đổi vé cho chuyến tàu đã khởi hành.");
  }

  if (method === "WALLET" && !booking.userId) {
    throw httpError(
      400,
      "Khách vãng lai không có ví. Vui lòng chọn thanh toán tiền mặt.",
    );
  }

  // Xây dựng map passengerId → bookingDetail, ưu tiên detail chưa CANCELLED
  const detailByPassengerId = new Map();
  for (const d of booking.bookingDetails) {
    const existing = detailByPassengerId.get(d.passengerId);
    if (!existing || existing.status === "CANCELLED") {
      detailByPassengerId.set(d.passengerId, d);
    }
  }

  // Chỉ xử lý hành khách có bookingDetail còn active
  const activePassengers = booking.passengers.filter((p) => {
    const detail = detailByPassengerId.get(p.id);
    return detail && detail.status !== "CANCELLED";
  });
  if (activePassengers.length === 0) {
    throw httpError(400, "Booking không còn vé nào đủ điều kiện đổi.");
  }

  // Tính giá trị thực tế từ các vé active (không dùng booking.totalAmount vì có thể stale)
  const oldFare = activePassengers.reduce((sum, p) => {
    const detail = detailByPassengerId.get(p.id);
    return sum + Number(detail?.finalPrice || 0);
  }, 0);

  // Session được tạo bởi staff nên userId = staffId
  const session = await prisma.seatHoldSession.findFirst({
    where: {
      id: sessionId,
      userId: staffId,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    include: {
      holds: {
        include: { seat: { include: { carriage: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) {
    throw httpError(409, "Phiên giữ ghế mới đã hết hạn hoặc không hợp lệ.");
  }

  const newHolds = session.holds.filter(
    (hold) => hold.scheduleId === session.outboundScheduleId,
  );
  const newSchedule = await prisma.schedule.findUnique({
    where: { id: session.outboundScheduleId },
  });
  if (!newSchedule || newSchedule.status !== "ACTIVE") {
    throw httpError(400, "Chuyến tàu mới không còn hoạt động.");
  }
  if (new Date(newSchedule.departureTime).getTime() <= now.getTime()) {
    throw httpError(400, "Không thể đổi sang chuyến tàu đã khởi hành.");
  }
  // So sánh với activePassengers.length thay vì booking.totalPassengers (đã có thể partial-cancel)
  if (newHolds.length !== activePassengers.length) {
    throw httpError(
      400,
      `Vui lòng chọn đúng ${activePassengers.length} ghế mới để đổi vé.`,
    );
  }

  const newFare = newHolds.reduce(
    (sum, hold) => sum + Number(hold.priceSnapshot || 0),
    0,
  );
  // Phí cố định tính theo đầu vé
  const fixedFee = 20000 * activePassengers.length;
  const percentFee = Math.round(oldFare * 0.1);
  const fareDifference = newFare - oldFare;
  const netAmount = fixedFee + percentFee + fareDifference;
  const amountDue = Math.max(netAmount, 0);
  const refundSurplus = Math.max(-netAmount, 0);

  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.seatHoldSession.updateMany({
      where: {
        id: session.id,
        userId: staffId,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      data: { status: "CONVERTED" },
    });
    if (claimed.count !== 1) {
      throw httpError(409, "Phiên giữ ghế mới đã được sử dụng.");
    }

    // Xử lý thanh toán ví của khách
    if (method === "WALLET") {
      const customerWallet = await tx.wallet.findUnique({
        where: { userId: booking.userId },
      });
      if (amountDue > 0) {
        if (!customerWallet || customerWallet.balance < amountDue) {
          throw httpError(
            422,
            "Số dư ví khách không đủ để thanh toán phí đổi vé.",
          );
        }
        await tx.wallet.update({
          where: { id: customerWallet.id },
          data: { balance: { decrement: amountDue } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: customerWallet.id,
            type: "PAYMENT",
            amount: amountDue,
            description: `Phí đổi vé ${booking.bookingCode} (nhân viên hỗ trợ)`,
            relatedBookingId: booking.id,
            status: "COMPLETED",
          },
        });
      }
      if (refundSurplus > 0) {
        const effectiveWallet =
          customerWallet ??
          (await tx.wallet.upsert({
            where: { userId: booking.userId },
            update: {},
            create: { userId: booking.userId, balance: 0, currency: "VND" },
          }));
        await tx.wallet.update({
          where: { id: effectiveWallet.id },
          data: { balance: { increment: refundSurplus } },
        });
        await tx.walletTransaction.create({
          data: {
            walletId: effectiveWallet.id,
            type: "REFUND",
            amount: refundSurplus,
            description: `Hoàn chênh lệch đổi vé ${booking.bookingCode} (nhân viên hỗ trợ)`,
            relatedBookingId: booking.id,
            status: "COMPLETED",
          },
        });
      }
    }

    // Giải phóng chỉ ghế của các hành khách active
    const oldSeatIds = [
      ...new Set(
        activePassengers.flatMap((p) => {
          const detail = detailByPassengerId.get(p.id);
          return [p.seatId, detail?.seatId].filter(Boolean);
        }),
      ),
    ];
    if (oldSeatIds.length > 0) {
      await tx.seat.updateMany({
        where: { id: { in: oldSeatIds } },
        data: {
          status: "AVAILABLE",
          selectedBy: null,
          selectedAt: null,
          selectionExpiry: null,
        },
      });
    }

    // Book ghế mới
    for (const hold of newHolds) {
      await tx.seat.update({
        where: { id: hold.seatId },
        data: {
          status: "BOOKED",
          selectedBy: null,
          selectedAt: null,
          selectionExpiry: null,
        },
      });
    }

    // Cập nhật chỉ hành khách active và bookingDetail tương ứng (map bằng passengerId)
    for (const [index, passenger] of activePassengers.entries()) {
      const hold = newHolds[index];
      const detail = detailByPassengerId.get(passenger.id);

      await tx.passenger.update({
        where: { id: passenger.id },
        data: {
          seatId: hold.seatId,
          carriageNumber: hold.seat.carriage.carriageNumber,
          boardingAt: null,
        },
      });

      if (detail) {
        await tx.bookingDetail.update({
          where: { id: detail.id },
          data: {
            seatId: hold.seatId,
            scheduleId: hold.scheduleId,
            carriageType: hold.carriageType,
            basePrice: hold.priceSnapshot,
            discountAmount: 0,
            finalPrice: hold.priceSnapshot,
            status: "CONFIRMED",
          },
        });
      } else {
        await tx.bookingDetail.create({
          data: {
            bookingId: booking.id,
            passengerId: passenger.id,
            seatId: hold.seatId,
            scheduleId: hold.scheduleId,
            carriageType: hold.carriageType,
            basePrice: hold.priceSnapshot,
            discountAmount: 0,
            finalPrice: hold.priceSnapshot,
            status: "CONFIRMED",
          },
        });
      }
    }

    // Lịch sử thanh toán
    const txId = randomUUID();
    if (amountDue > 0) {
      await tx.bookingPaymentHistory.create({
        data: {
          bookingId: booking.id,
          paymentMethod: method,
          amount: amountDue,
          status: "SUCCESS",
          transactionId: `STAFF-EXCHANGE-${txId}`,
          attemptNumber: 1,
        },
      });
    }
    if (refundSurplus > 0) {
      await tx.bookingPaymentHistory.create({
        data: {
          bookingId: booking.id,
          paymentMethod: `REFUND_${method}`,
          amount: refundSurplus,
          status: "SUCCESS",
          transactionId: `STAFF-EXCHANGE-REFUND-${txId}`,
          attemptNumber: 1,
        },
      });
    }

    // Cập nhật booking — totalAmount = newFare của các vé active
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        scheduleId: session.outboundScheduleId,
        fromStationId: session.outboundFromStationId,
        toStationId: session.outboundToStationId,
        subtotal: newFare,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: newFare,
        paymentMethod: method,
        paymentStatus: "COMPLETED",
        paidAt: now,
        status: "CONFIRMED",
        expiresAt: null,
      },
      include: { passengers: true },
    });

    // Thông báo cho khách (nếu có tài khoản)
    if (booking.userId) {
      await tx.notification.create({
        data: {
          userId: booking.userId,
          type: "BOOKING_EXCHANGED",
          title: "Đổi vé thành công",
          message:
            refundSurplus > 0
              ? `Vé ${booking.bookingCode} đã được đổi tại quầy. Hoàn ${refundSurplus.toLocaleString("vi-VN")}đ vào ví.`
              : `Vé ${booking.bookingCode} đã được đổi tại quầy. Phí ${amountDue.toLocaleString("vi-VN")}đ.`,
          relatedBookingId: booking.id,
          relatedScheduleId: session.outboundScheduleId,
          deliveryMethod: ["IN_APP", "EMAIL"],
          deliveryStatus: "PENDING",
        },
      });
    }

    await tx.adminLog.create({
      data: {
        adminId: staffId,
        action: "UPDATE",
        entity: "Booking",
        entityId: booking.id,
        changes: JSON.stringify({
          oldScheduleId: booking.scheduleId,
          newScheduleId: session.outboundScheduleId,
          paymentMethod: method,
          amountDue,
          refundSurplus,
          reason,
          activePassengersCount: activePassengers.length,
        }),
        description: `Nhân viên đổi vé booking ${booking.bookingCode} (${activePassengers.length} vé). Phí: ${amountDue.toLocaleString("vi-VN")}đ, hoàn: ${refundSurplus.toLocaleString("vi-VN")}đ. Lý do: ${reason}`,
        ipAddress: ipAddress || "",
      },
    });

    await tx.seatHold.deleteMany({ where: { sessionId: session.id } });

    return updatedBooking;
  });

  return {
    booking: result,
    passengers: result.passengers,
    exchange: {
      oldFare,
      newFare,
      fixedFee,
      percentFee,
      fareDifference,
      amountDue,
      refundSurplus,
      paymentMethod: method,
    },
  };
}
