import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";

const REFUND_METHODS = ["CASH", "WALLET"];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function refundPolicy(departureTime, now = new Date()) {
  const diffHours = (new Date(departureTime).getTime() - now.getTime()) / 36e5;
  if (diffHours < 0) {
    return {
      allowed: false,
      rate: 0,
      message: "Chuyến tàu đã khởi hành.",
    };
  }
  if (diffHours < 4) {
    return {
      allowed: false,
      rate: 0,
      message: "Không thể hủy vé trong vòng 4 giờ trước giờ khởi hành.",
    };
  }
  if (diffHours < 24) {
    return {
      allowed: true,
      rate: 0.5,
      message: "Hoàn 50% vì còn từ 4 đến dưới 24 giờ trước giờ khởi hành.",
    };
  }
  return {
    allowed: true,
    rate: 0.8,
    message: "Hoàn 80% vì còn ít nhất 24 giờ trước giờ khởi hành.",
  };
}

const bookingInclude = {
  schedule: {
    include: {
      train: true,
      startStation: true,
      endStation: true,
    },
  },
  fromStation: true,
  toStation: true,
  passengers: {
    include: {
      seat: { include: { carriage: true } },
      bookingDetails: {
        include: {
          schedule: true,
          seat: { include: { carriage: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  },
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
    },
  },
};

function activeDetails(passenger) {
  return (passenger.bookingDetails || []).filter(
    (detail) => detail.status !== "CANCELLED",
  );
}

function ticketAmount(passenger) {
  return activeDetails(passenger).reduce(
    (sum, detail) => sum + Number(detail.finalPrice || 0),
    0,
  );
}

async function getBookingForCancellation(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: bookingInclude,
  });
  if (!booking) throw httpError(404, "Không tìm thấy booking.");
  return booking;
}

export async function quoteStaffCancellation({ bookingId, passengerIds }) {
  if (!bookingId) throw httpError(400, "Thiếu mã booking.");
  if (!Array.isArray(passengerIds) || passengerIds.length === 0) {
    throw httpError(400, "Chọn ít nhất một vé cần hủy.");
  }

  const booking = await getBookingForCancellation(bookingId);
  const selected = new Set(passengerIds);
  const policy = refundPolicy(booking.schedule.departureTime);
  const bookingClosed = ["CANCELLED", "REFUNDED"].includes(booking.status);

  const items = booking.passengers
    .filter((passenger) => selected.has(passenger.id))
    .map((passenger) => {
      const originalAmount = ticketAmount(passenger);
      const alreadyCancelled = activeDetails(passenger).length === 0;
      const eligible = !bookingClosed && !alreadyCancelled && policy.allowed;
      const reason = bookingClosed
        ? "Booking đã bị hủy hoặc hoàn tiền."
        : alreadyCancelled
          ? "Vé này đã được hủy trước đó."
          : policy.message;
      return {
        passengerId: passenger.id,
        ticketCode: passenger.ticketCode,
        fullName: passenger.fullName,
        seatNumber: passenger.seat?.seatNumber,
        carriageNumber: passenger.carriageNumber,
        originalAmount,
        refundAmount: eligible ? Math.round(originalAmount * policy.rate) : 0,
        eligible,
        reason,
      };
    });

  if (items.length !== passengerIds.length) {
    throw httpError(400, "Danh sách vé chọn không thuộc booking này.");
  }

  const eligibleItems = items.filter((item) => item.eligible);
  return {
    booking: {
      id: booking.id,
      bookingCode: booking.bookingCode,
      status: booking.status,
      paymentMethod: booking.paymentMethod,
      userId: booking.userId,
      totalAmount: booking.totalAmount,
      refundAmount: booking.refundAmount,
      departureTime: booking.schedule.departureTime,
    },
    policy: {
      allowed: policy.allowed && !bookingClosed,
      refundRate: policy.rate,
      refundPercentage: Math.round(policy.rate * 100),
      message: bookingClosed
        ? "Booking đã đóng, không thể hủy thêm."
        : policy.message,
    },
    items,
    eligible: eligibleItems.length > 0,
    totalOriginalAmount: eligibleItems.reduce(
      (sum, item) => sum + item.originalAmount,
      0,
    ),
    totalRefundAmount: eligibleItems.reduce(
      (sum, item) => sum + item.refundAmount,
      0,
    ),
  };
}

export async function confirmStaffCancellation({
  bookingId,
  passengerIds,
  refundMethod = "CASH",
  reason,
  staffId,
}) {
  const method = String(refundMethod || "").toUpperCase();
  if (!REFUND_METHODS.includes(method)) {
    throw httpError(400, "Phương thức hoàn tiền không hợp lệ.");
  }

  const quote = await quoteStaffCancellation({ bookingId, passengerIds });
  if (method === "WALLET" && !quote.booking.userId) {
    throw httpError(400, "Khách vãng lai chỉ có thể hoàn tiền mặt tại quầy.");
  }

  const eligibleItems = quote.items.filter((item) => item.eligible);
  if (eligibleItems.length === 0) {
    throw httpError(409, "Không có vé nào đủ điều kiện hủy.");
  }

  const eligiblePassengerIds = eligibleItems.map((item) => item.passengerId);
  const now = new Date();
  const totalRefundAmount = quote.totalRefundAmount;

  const result = await prisma.$transaction(async (tx) => {
    await tx.bookingDetail.updateMany({
      where: {
        bookingId,
        passengerId: { in: eligiblePassengerIds },
        status: { not: "CANCELLED" },
      },
      data: { status: "CANCELLED" },
    });

    const remainingActiveDetails = await tx.bookingDetail.count({
      where: {
        bookingId,
        status: { not: "CANCELLED" },
      },
    });

    const nextBookingStatus =
      remainingActiveDetails === 0 ? "CANCELLED" : "CONFIRMED";
    const nextPaymentStatus =
      remainingActiveDetails === 0 ? "REFUNDED" : "COMPLETED";

    const updatedBooking = await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: nextBookingStatus,
        paymentStatus: nextPaymentStatus,
        refundAmount:
          Number(quote.booking.refundAmount || 0) + totalRefundAmount,
        cancelReason: reason || "Staff hủy vé tại quầy",
        cancelledAt: remainingActiveDetails === 0 ? now : undefined,
      },
    });

    await tx.bookingPaymentHistory.create({
      data: {
        bookingId,
        paymentMethod: `REFUND_${method}`,
        amount: totalRefundAmount,
        status: "SUCCESS",
        transactionId: `STAFF-REFUND-${randomUUID()}`,
        attemptNumber: 1,
      },
    });

    if (method === "WALLET") {
      const wallet = await tx.wallet.findUnique({
        where: { userId: updatedBooking.userId },
      });
      if (!wallet) {
        throw httpError(422, "Khách hàng chưa có ví để hoàn tiền.");
      }
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: totalRefundAmount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "REFUND",
          amount: totalRefundAmount,
          description: `Hoàn tiền vé tại quầy ${updatedBooking.bookingCode}`,
          relatedBookingId: bookingId,
          status: "COMPLETED",
        },
      });
    }

    return updatedBooking;
  });

  return {
    booking: result,
    cancelledPassengerIds: eligiblePassengerIds,
    refundMethod: method,
    refundAmount: totalRefundAmount,
    handledBy: staffId,
    quote,
  };
}
