import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  checkoutBooking,
  confirmQrPayment,
  quoteBooking,
} from "../services/bookingCheckout.service.js";

export const getBookingQuote = asyncHandler(async (req, res) => {
  const quote = await quoteBooking(req.bookingIdentity, req.body);
  res.json({ quote });
});

export const createBookingCheckout = asyncHandler(async (req, res) => {
  const result = await checkoutBooking(req.bookingIdentity, req.body);
  res.status(201).json({
    message:
      result.booking.paymentStatus === "COMPLETED"
        ? "Đặt vé và thanh toán thành công."
        : "Đơn hàng đã được tạo. Vui lòng xác nhận thanh toán.",
    ...result,
  });
});

export const confirmBookingQrPayment = asyncHandler(async (req, res) => {
  const booking = await confirmQrPayment(req.bookingIdentity, req.params.id);
  res.json({
    message: "Thanh toán thành công. Vé điện tử đang được gửi qua email.",
    booking,
  });
});

// ============================================================
// GET /api/v1/bookings/lookup - Look up ticket by code or contact info
// ============================================================
export const lookupBooking = asyncHandler(async (req, res) => {
  const { ticketCode, contactInfo } = req.query;

  if (!ticketCode && !contactInfo) {
    return res.status(400).json({
      message: "Vui lòng cung cấp Mã vé hoặc Email/Số điện thoại để tra cứu.",
    });
  }

  // Scenario 1: Both Ticket Code and Contact Info are provided (Secure lookup for single ticket)
  if (ticketCode && contactInfo) {
    const cleanTicketCode = ticketCode.trim().toUpperCase();
    const cleanContact = contactInfo.trim().toLowerCase();

    const passenger = await prisma.passenger.findFirst({
      where: {
        AND: [
          {
            OR: [
              { ticketCode: cleanTicketCode },
              { booking: { bookingCode: cleanTicketCode } },
            ],
          },
          {
            OR: [
              { email: { equals: cleanContact, mode: "insensitive" } },
              { phoneNumber: cleanContact },
            ],
          },
        ],
      },
      include: {
        booking: {
          include: {
            schedule: {
              include: {
                train: true,
                route: true,
                startStation: true,
                endStation: true,
                scheduleStops: {
                  include: {
                    station: true,
                  },
                  orderBy: {
                    stopOrder: "asc",
                  },
                },
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
      return res.status(404).json({
        message:
          "Không tìm thấy thông tin vé khớp với mã vé và thông tin liên hệ đã cung cấp.",
      });
    }

    return res.json({ type: "single", ticket: passenger });
  }

  // Scenario 2: Only Ticket Code is provided
  if (ticketCode) {
    const cleanTicketCode = ticketCode.trim().toUpperCase();

    const passenger = await prisma.passenger.findFirst({
      where: {
        OR: [
          { ticketCode: cleanTicketCode },
          { booking: { bookingCode: cleanTicketCode } },
        ],
      },
      include: {
        booking: {
          include: {
            schedule: {
              include: {
                train: true,
                route: true,
                startStation: true,
                endStation: true,
                scheduleStops: {
                  include: {
                    station: true,
                  },
                  orderBy: {
                    stopOrder: "asc",
                  },
                },
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
      return res.status(404).json({
        message: "Không tìm thấy thông tin vé cho mã đã nhập.",
      });
    }

    // Return the ticket (We can mask sensitive email/phone for security if accessed publicly)
    const maskedTicket = {
      ...passenger,
      email: passenger.email
        ? passenger.email.replace(/(.{2})(.*)(@.*)/, "$1***$3")
        : null,
      phoneNumber: passenger.phoneNumber
        ? passenger.phoneNumber.replace(/(.{3})(.*)(.{3})/, "$1****$3")
        : null,
    };

    return res.json({ type: "single", ticket: maskedTicket, isMasked: true });
  }

  // Scenario 3: Only Contact Info is provided (Return list of bookings)
  if (contactInfo) {
    const cleanContact = contactInfo.trim().toLowerCase();

    const passengers = await prisma.passenger.findMany({
      where: {
        OR: [
          { email: { equals: cleanContact, mode: "insensitive" } },
          { phoneNumber: cleanContact },
        ],
      },
      include: {
        booking: {
          include: {
            schedule: {
              include: {
                train: true,
                route: true,
                startStation: true,
                endStation: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    if (passengers.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy vé nào gắn với thông tin liên hệ này.",
      });
    }

    return res.json({ type: "list", tickets: passengers });
  }
});

// ============================================================
// POST /api/v1/bookings/:id/cancel - Request ticket cancellation & refund
// ============================================================
export const cancelBooking = asyncHandler(async (req, res) => {
  const { id } = req.params; // bookingId
  const { reason, refundMethod = "WALLET" } = req.body;

  // 1. Fetch the booking with schedule and passenger details
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      schedule: true,
      passengers: true,
    },
  });

  if (!booking) {
    return res
      .status(404)
      .json({ message: "Không tìm thấy giao dịch đặt vé." });
  }

  if (booking.status === "CANCELLED" || booking.status === "REFUNDED") {
    return res
      .status(400)
      .json({ message: "Giao dịch này đã được hủy hoặc hoàn tiền từ trước." });
  }

  // 2. Validate departure time and calculate refund percentage
  const now = new Date();
  const departure = new Date(booking.schedule.departureTime);
  const diffMs = departure.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 0) {
    return res
      .status(400)
      .json({ message: "Không thể hủy vé cho chuyến tàu đã khởi hành." });
  }

  let refundPercentage = 0;
  if (diffHours >= 24) {
    refundPercentage = 0.8; // 80% refund
  } else if (diffHours >= 4) {
    refundPercentage = 0.5; // 50% refund
  } else {
    return res.status(400).json({
      message:
        "Không thể hủy vé sát giờ khởi hành (dưới 4 tiếng). Vui lòng liên hệ quầy vé ga để được hỗ trợ.",
    });
  }

  const refundAmount = booking.totalAmount * refundPercentage;

  // 3. Process cancellation in transaction
  const result = await prisma.$transaction(async (tx) => {
    // a. Update Booking Status
    const updatedBooking = await tx.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        paymentStatus: "REFUNDED",
        refundAmount: refundAmount,
        cancelReason: reason || "Yêu cầu từ khách hàng",
        cancelledAt: now,
      },
    });

    // b. Update seat status back to AVAILABLE
    if (booking.passengers && booking.passengers.length > 0) {
      for (const p of booking.passengers) {
        if (p.seatId) {
          await tx.seat.update({
            where: { id: p.seatId },
            data: { status: "AVAILABLE" },
          });
        }
      }
    }

    // c. Create CancellationRequest record
    const passengerId = booking.passengers?.[0]?.id;
    let cancelReq = null;
    if (passengerId) {
      cancelReq = await tx.cancellationRequest.create({
        data: {
          bookingId: booking.id,
          passengerId: passengerId,
          status: "APPROVED",
          requestReason: reason || "Yêu cầu hủy từ website",
          refundAmount: refundAmount,
          approvedAt: now,
        },
      });
    }

    // d. Create Refund record
    await tx.refund.create({
      data: {
        bookingId: booking.id,
        refundAmount: refundAmount,
        refundMethod: refundMethod,
        status: "COMPLETED",
        reason: reason || "Hủy vé tự động qua hệ thống",
        processedAt: now,
      },
    });

    // e. If refund method is WALLET, credit the user's wallet
    let walletTx = null;
    if (refundMethod === "WALLET") {
      const userWallet = await tx.wallet.findUnique({
        where: { userId: booking.userId },
      });

      if (userWallet) {
        await tx.wallet.update({
          where: { id: userWallet.id },
          data: {
            balance: {
              increment: refundAmount,
            },
          },
        });

        walletTx = await tx.walletTransaction.create({
          data: {
            walletId: userWallet.id,
            type: "REFUND",
            amount: refundAmount,
            description: `Hoàn tiền vé mã ${booking.bookingCode}`,
            relatedBookingId: booking.id,
            status: "COMPLETED",
          },
        });
      }
    }

    return { updatedBooking, cancelReq, refundAmount };
  });

  res.json({
    message: "Hủy vé và hoàn tiền thành công!",
    refundAmount: result.refundAmount,
    refundPercentage: refundPercentage * 100,
    bookingStatus: result.updatedBooking.status,
  });
});
