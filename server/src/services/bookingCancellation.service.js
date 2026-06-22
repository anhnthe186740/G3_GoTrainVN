import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";

const REFUND_METHODS = ["WALLET", "BANK", "BANK_TRANSFER"];
const ACTIVE_BOOKING_DETAIL_STATUSES = ["CONFIRMED", "PENDING"];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeContact(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizePhone(value) {
  return String(value || "").replace(/\s/g, "");
}

export function refundPolicy(departureTime, now = new Date()) {
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

export function normalizeRefundMethod(refundMethod) {
  const method = String(refundMethod || "WALLET").toUpperCase();
  if (!REFUND_METHODS.includes(method)) {
    throw httpError(400, "Phương thức hoàn tiền không hợp lệ.");
  }
  return method === "BANK" ? "BANK_TRANSFER" : method;
}

function activeDetails(passenger) {
  return (passenger.bookingDetails || []).filter((detail) =>
    ACTIVE_BOOKING_DETAIL_STATUSES.includes(detail.status),
  );
}

function ticketAmount(passenger) {
  return activeDetails(passenger).reduce(
    (sum, detail) => sum + Number(detail.finalPrice || 0),
    0,
  );
}

function bookingIsPaidAndCancelable(booking) {
  return (
    booking.status === "CONFIRMED" && booking.paymentStatus === "COMPLETED"
  );
}

function verificationMatchesPassenger(passenger, booking, verification = {}) {
  const code = String(verification.ticketCode || "")
    .trim()
    .toUpperCase();
  const contact = normalizeContact(verification.contactInfo);
  if (!code || !contact) return false;

  const codeMatches =
    code === String(booking.bookingCode || "").toUpperCase() ||
    code === String(passenger.ticketCode || "").toUpperCase();
  if (!codeMatches) return false;

  const passengerEmail = normalizeContact(passenger.email);
  const bookingEmail = normalizeContact(booking.confirmationEmail);
  const passengerPhone = normalizePhone(passenger.phoneNumber).toLowerCase();
  const contactPhone = normalizePhone(contact).toLowerCase();

  return (
    contact === passengerEmail ||
    contact === bookingEmail ||
    (contactPhone && contactPhone === passengerPhone)
  );
}

function assertCancellationAccess(booking, identity = {}, verification = {}) {
  if (["STAFF", "ADMIN"].includes(identity.role)) return;

  if (
    identity.userId &&
    (booking.userId === identity.userId ||
      booking.passengers.some(
        (passenger) => passenger.userId === identity.userId,
      ))
  ) {
    return;
  }

  if (identity.guestToken && booking.guestToken === identity.guestToken) return;

  if (
    booking.passengers.some((passenger) =>
      verificationMatchesPassenger(passenger, booking, verification),
    )
  ) {
    return;
  }

  throw httpError(
    403,
    "Bạn cần đăng nhập đúng tài khoản hoặc cung cấp mã vé cùng thông tin liên hệ để hủy vé.",
  );
}

function selectedPassengersForCancellation(booking, passengerIds) {
  const activePassengers = booking.passengers.filter(
    (passenger) => activeDetails(passenger).length > 0,
  );

  const selectedIds =
    Array.isArray(passengerIds) && passengerIds.length > 0
      ? new Set(passengerIds.map(String))
      : new Set(activePassengers.map((passenger) => passenger.id));

  const selected = booking.passengers.filter((passenger) =>
    selectedIds.has(passenger.id),
  );

  if (selected.length !== selectedIds.size) {
    throw httpError(400, "Danh sách vé cần hủy không thuộc booking này.");
  }
  if (selected.length === 0) {
    throw httpError(400, "Chọn ít nhất một vé còn hiệu lực để hủy.");
  }
  if (selected.some((passenger) => activeDetails(passenger).length === 0)) {
    throw httpError(409, "Có vé đã được hủy trước đó.");
  }

  return selected;
}

async function adjustLoyaltyPoints(tx, userId, amount, bookingId) {
  if (!userId) return;
  const points = Math.floor(Number(amount || 0) / 10000);
  if (points <= 0) return;

  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { loyaltyPoints: true },
  });
  const deductPoints = Math.min(points, user?.loyaltyPoints || 0);
  if (deductPoints <= 0) return;

  await tx.user.update({
    where: { id: userId },
    data: { loyaltyPoints: { decrement: deductPoints } },
  });
  await tx.loyaltyPoint.create({
    data: {
      userId,
      points: deductPoints,
      type: "REDEEMED",
      source: "BOOKING",
      relatedBookingId: bookingId,
    },
  });
}

export async function cancelBookingTickets({
  bookingId,
  passengerIds,
  refundMethod,
  reason,
  identity,
  verification,
  bankInfo,
}) {
  let method = normalizeRefundMethod(refundMethod);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      schedule: true,
      passengers: {
        include: {
          bookingDetails: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!booking) throw httpError(404, "Không tìm thấy giao dịch đặt vé.");
  assertCancellationAccess(booking, identity, verification);

  if (!bookingIsPaidAndCancelable(booking)) {
    throw httpError(
      409,
      "Chỉ có thể hủy vé đã xác nhận và đã thanh toán thành công.",
    );
  }

  const policy = refundPolicy(booking.schedule.departureTime);
  if (!policy.allowed) throw httpError(400, policy.message);

  const selectedPassengers = selectedPassengersForCancellation(
    booking,
    passengerIds,
  );
  const selectedPassengerIds = selectedPassengers.map(
    (passenger) => passenger.id,
  );
  const totalOriginalAmount = selectedPassengers.reduce(
    (sum, passenger) => sum + ticketAmount(passenger),
    0,
  );
  const totalRefundAmount = Math.round(totalOriginalAmount * policy.rate);
  if (totalRefundAmount <= 0) {
    throw httpError(409, "Không có số tiền hợp lệ để hoàn cho các vé đã chọn.");
  }

  if (method === "WALLET" && !booking.userId) {
    method = "CASH";
  }

  const requestReason = [
    reason || "Yêu cầu hủy vé trực tuyến",
    bankInfo?.bankName ? `Ngân hàng: ${bankInfo.bankName}` : null,
    bankInfo?.bankAccount ? `STK: ${bankInfo.bankAccount}` : null,
  ]
    .filter(Boolean)
    .join(" | ");

  const existingRequest = await prisma.cancellationRequest.findUnique({
    where: { bookingId },
  });
  if (existingRequest?.status === "PENDING") {
    throw httpError(409, "Yêu cầu hủy vé này đang chờ Admin duyệt.");
  }
  if (existingRequest?.status === "APPROVED") {
    throw httpError(409, "Yêu cầu hủy vé này đã được duyệt.");
  }

  const requestData = {
    passengerId: selectedPassengerIds[0],
    passengerIds: selectedPassengerIds,
    status: "PENDING",
    requestReason,
    refundAmount: totalRefundAmount,
    refundMethod: method,
    rejectionReason: null,
    approvedBy: null,
    approvedAt: null,
  };
  const request = existingRequest
    ? await prisma.cancellationRequest.update({
        where: { id: existingRequest.id },
        data: requestData,
      })
    : await prisma.cancellationRequest.create({
        data: { bookingId, ...requestData },
      });

  return {
    booking,
    cancellationRequest: request,
    requestedPassengerIds: selectedPassengerIds,
    refundMethod: method,
    refundStatus: "PENDING_APPROVAL",
    refundAmount: totalRefundAmount,
    refundPercentage: Math.round(policy.rate * 100),
    totalOriginalAmount,
  };
}

export async function getAdminCancellationRequests({ status } = {}) {
  const allowedStatuses = ["PENDING", "APPROVED", "REJECTED"];
  const normalizedStatus = String(status || "").toUpperCase();
  const where = allowedStatuses.includes(normalizedStatus)
    ? { status: normalizedStatus }
    : {};

  return prisma.cancellationRequest.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      passenger: true,
      approvedByAdmin: {
        select: { id: true, fullName: true, email: true },
      },
      booking: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              phoneNumber: true,
            },
          },
          schedule: {
            include: { startStation: true, endStation: true, train: true },
          },
          passengers: { include: { bookingDetails: true } },
        },
      },
    },
  });
}

export async function reviewCancellationRequest({
  requestId,
  action,
  adminId,
  rejectionReason,
}) {
  const decision = String(action || "").toUpperCase();
  if (!["APPROVE", "REJECT"].includes(decision)) {
    throw httpError(400, "Quyết định duyệt không hợp lệ.");
  }

  const request = await prisma.cancellationRequest.findUnique({
    where: { id: requestId },
    include: {
      booking: {
        include: {
          schedule: true,
          passengers: {
            include: { bookingDetails: true },
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });
  if (!request) throw httpError(404, "Không tìm thấy yêu cầu hủy vé.");
  if (request.status !== "PENDING") {
    throw httpError(409, "Yêu cầu này đã được xử lý trước đó.");
  }

  if (decision === "REJECT") {
    return prisma.cancellationRequest.update({
      where: { id: requestId },
      data: {
        status: "REJECTED",
        rejectionReason: rejectionReason?.trim() || "Không đủ điều kiện hủy vé",
      },
      include: { booking: true },
    });
  }

  const booking = request.booking;
  if (!bookingIsPaidAndCancelable(booking)) {
    throw httpError(409, "Đặt vé không còn ở trạng thái có thể hủy.");
  }

  const passengerIds =
    request.passengerIds?.length > 0
      ? request.passengerIds
      : [request.passengerId];
  const selectedPassengers = selectedPassengersForCancellation(
    booking,
    passengerIds,
  );
  const selectedPassengerIds = selectedPassengers.map(({ id }) => id);
  const totalOriginalAmount = selectedPassengers.reduce(
    (sum, passenger) => sum + ticketAmount(passenger),
    0,
  );
  const policy = refundPolicy(
    booking.schedule.departureTime,
    request.createdAt,
  );
  if (!policy.allowed) throw httpError(409, policy.message);

  const refundAmount =
    Number(request.refundAmount) ||
    Math.round(totalOriginalAmount * policy.rate);
  const method = booking.userId ? request.refundMethod || "WALLET" : "CASH";
  const refundStatus = method === "WALLET" ? "COMPLETED" : "PENDING";
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    await tx.bookingDetail.updateMany({
      where: {
        bookingId: booking.id,
        passengerId: { in: selectedPassengerIds },
        status: { in: ACTIVE_BOOKING_DETAIL_STATUSES },
      },
      data: { status: "CANCELLED" },
    });

    const remainingActiveDetails = await tx.bookingDetail.count({
      where: {
        bookingId: booking.id,
        status: { in: ACTIVE_BOOKING_DETAIL_STATUSES },
      },
    });
    const fullyCancelled = remainingActiveDetails === 0;
    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: fullyCancelled ? "CANCELLED" : "CONFIRMED",
        paymentStatus:
          fullyCancelled && refundStatus === "COMPLETED"
            ? "REFUNDED"
            : booking.paymentStatus,
        refundAmount: Number(booking.refundAmount || 0) + refundAmount,
        cancelReason: request.requestReason,
        cancelledAt: fullyCancelled ? now : booking.cancelledAt,
      },
    });

    await tx.bookingPaymentHistory.create({
      data: {
        bookingId: booking.id,
        paymentMethod: `REFUND_${method}`,
        amount: refundAmount,
        status: refundStatus === "COMPLETED" ? "SUCCESS" : "PENDING",
        transactionId:
          refundStatus === "COMPLETED"
            ? `REFUND-${method}-${randomUUID()}`
            : null,
        attemptNumber: 1,
      },
    });
    await tx.refund.upsert({
      where: { bookingId: booking.id },
      create: {
        bookingId: booking.id,
        refundAmount,
        refundMethod: method,
        status: refundStatus,
        reason: request.requestReason,
        processedAt: refundStatus === "COMPLETED" ? now : null,
      },
      update: {
        refundAmount: { increment: refundAmount },
        refundMethod: method,
        status: refundStatus,
        reason: request.requestReason,
        processedAt: refundStatus === "COMPLETED" ? now : null,
      },
    });

    if (method === "WALLET") {
      const wallet = await tx.wallet.upsert({
        where: { userId: booking.userId },
        update: {},
        create: { userId: booking.userId, balance: 0, currency: "VND" },
      });
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { increment: refundAmount } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "REFUND",
          amount: refundAmount,
          description: `Hoàn tiền vé ${booking.bookingCode}`,
          relatedBookingId: booking.id,
          status: "COMPLETED",
        },
      });
    }

    await adjustLoyaltyPoints(
      tx,
      booking.userId,
      totalOriginalAmount,
      booking.id,
    );
    const updatedRequest = await tx.cancellationRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", approvedBy: adminId, approvedAt: now },
    });

    return {
      cancellationRequest: updatedRequest,
      booking: updatedBooking,
      refundAmount,
      refundMethod: method,
      refundStatus,
      cancelledPassengerIds: selectedPassengerIds,
    };
  });
}
