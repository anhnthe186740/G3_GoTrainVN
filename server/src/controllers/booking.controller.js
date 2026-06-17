import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  checkoutBooking,
  confirmQrPayment,
  getBookingPaymentStatus,
  handlePayosWebhook,
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

export const getBookingPaymentState = asyncHandler(async (req, res) => {
  const booking = await getBookingPaymentStatus(
    req.bookingIdentity,
    req.params.id,
  );
  res.json({ booking });
});

export const receivePayosWebhook = asyncHandler(async (req, res) => {
  const result = await handlePayosWebhook(req.body);
  res.json({
    success: true,
    ignored: Boolean(result.ignored),
    duplicate: Boolean(result.duplicate),
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

  // Shared include: include passenger's ACTUAL boarding/alighting stations from Booking
  // (fromStation / toStation), not the full-route endpoints of the Schedule.
  const stationSelect = {
    select: { id: true, stationCode: true, stationName: true, city: true },
  };

  const bookingInclude = {
    include: {
      schedule: {
        include: {
          train: true,
          route: true,
          startStation: stationSelect,
          endStation: stationSelect,
          scheduleStops: {
            include: { station: true },
            orderBy: { stopOrder: "asc" },
          },
        },
      },
      // Actual boarding / alighting stations saved at checkout time
      fromStation: stationSelect,
      toStation: stationSelect,
    },
  };

  const seatInclude = { include: { carriage: true } };

  // ------------------------------------------------------------------
  // Scenario 1: Both Ticket Code AND Contact Info → secure single lookup
  // ------------------------------------------------------------------
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
        booking: bookingInclude,
        seat: seatInclude,
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

  // ------------------------------------------------------------------
  // Scenario 2: Only Ticket Code → public lookup (masked PII)
  // ------------------------------------------------------------------
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
        booking: bookingInclude,
        seat: seatInclude,
      },
    });

    if (!passenger) {
      return res.status(404).json({
        message: "Không tìm thấy thông tin vé cho mã đã nhập.",
      });
    }

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

  // ------------------------------------------------------------------
  // Scenario 3: Only Contact Info → return list of all bookings
  // ------------------------------------------------------------------
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
        booking: bookingInclude,
        seat: seatInclude,
      },
      orderBy: { createdAt: "desc" },
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
// GET /api/v1/bookings/my - Get current user's bookings
// ============================================================
export const getMyBookings = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: "Yêu cầu đăng nhập." });
  }

  const bookings = await prisma.booking.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
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
        select: {
          id: true,
          fullName: true,
          passengerType: true,
          ticketCode: true,
          carriageNumber: true,
        },
      },
    },
  });

  res.json({ bookings });
});

// ============================================================
// GET /api/v1/bookings/admin - Admin: get all bookings with filters
// ============================================================
export const getAdminBookings = asyncHandler(async (req, res) => {
  const { search, status, paymentStatus, page = 1, limit = 10 } = req.query;

  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  if (status) where.status = status;
  if (paymentStatus) where.paymentStatus = paymentStatus;
  if (search) {
    where.OR = [
      { bookingCode: { contains: search, mode: "insensitive" } },
      {
        user: {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
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
          include: {
            train: { select: { trainName: true } },
            startStation: { select: { stationName: true } },
            endStation: { select: { stationName: true } },
          },
        },
        passengers: {
          select: {
            id: true,
            fullName: true,
            passengerType: true,
            ticketCode: true,
            carriageNumber: true,
          },
        },
      },
    }),
  ]);

  res.json({
    bookings,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// ============================================================
// GET /api/v1/bookings/admin/stats - Admin booking statistics
// ============================================================
export const getAdminBookingStats = asyncHandler(async (req, res) => {
  const [
    totalBookings,
    confirmedBookings,
    cancelledBookings,
    pendingBookings,
    totalAmountResult,
    refundedAmountResult,
    totalPassengers,
  ] = await Promise.all([
    prisma.booking.count(),
    prisma.booking.count({ where: { status: "CONFIRMED" } }),
    prisma.booking.count({ where: { status: "CANCELLED" } }),
    prisma.booking.count({ where: { status: "PENDING" } }),
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { paymentStatus: "COMPLETED" },
    }),
    prisma.booking.aggregate({
      _sum: { refundAmount: true },
      where: { status: "REFUNDED" },
    }),
    prisma.passenger.count(),
  ]);

  const totalRevenue = totalAmountResult._sum.totalAmount || 0;
  const totalRefunds = refundedAmountResult._sum.refundAmount || 0;
  const completedBookings = confirmedBookings;

  res.json({
    stats: {
      overview: {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        pendingBookings,
        totalRevenue,
        netRevenue: totalRevenue - totalRefunds,
        totalRefunds,
        totalPassengers,
        avgBookingValue:
          completedBookings > 0
            ? Math.round(totalRevenue / completedBookings)
            : 0,
      },
    },
  });
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
