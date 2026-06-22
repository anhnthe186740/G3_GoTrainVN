import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  checkoutBooking,
  confirmQrPayment,
  getBookingPaymentStatus,
  handlePayosWebhook,
  quoteBooking,
} from "../services/bookingCheckout.service.js";
import {
  cancelBookingTickets,
  getAdminCancellationRequests,
  reviewCancellationRequest,
} from "../services/bookingCancellation.service.js";

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

export const createStaffBookingCheckout = asyncHandler(async (req, res) => {
  const result = await checkoutBooking(
    { userId: req.user.id, guestToken: null },
    { ...req.body, salesChannel: "STAFF_COUNTER" },
  );
  res.status(201).json({
    message:
      result.booking.paymentStatus === "COMPLETED"
        ? "Đặt vé tại quầy và thanh toán thành công."
        : "Đơn hàng tại quầy đã được tạo. Vui lòng xác nhận thanh toán.",
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
  const isPrivilegedLookup = ["STAFF", "ADMIN"].includes(req.user?.role);
  const currentUserId = req.user?.id || req.bookingIdentity?.userId;

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
    if (!isPrivilegedLookup && !currentUserId) {
      return res.status(400).json({
        message:
          "Vui lòng nhập thêm Email/Số điện thoại liên hệ để tra cứu vé.",
      });
    }

    const cleanTicketCode = ticketCode.trim().toUpperCase();

    const ownerLookupFilter = isPrivilegedLookup
      ? []
      : [
          {
            OR: [
              { userId: currentUserId },
              { booking: { userId: currentUserId } },
            ],
          },
        ];

    const passenger = await prisma.passenger.findFirst({
      where: {
        AND: [
          {
            OR: [
              { ticketCode: cleanTicketCode },
              { booking: { bookingCode: cleanTicketCode } },
            ],
          },
          ...ownerLookupFilter,
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

    return res.json({ type: "single", ticket: passenger });
  }

  // ------------------------------------------------------------------
  // Scenario 3: Only Contact Info → return list of all bookings
  // ------------------------------------------------------------------
  if (contactInfo) {
    if (!isPrivilegedLookup && !currentUserId) {
      return res.status(400).json({
        message: "Vui lòng nhập mã vé kèm Email/Số điện thoại để tra cứu.",
      });
    }

    const cleanContact = contactInfo.trim().toLowerCase();

    const ownerLookupFilter = isPrivilegedLookup
      ? []
      : [
          {
            OR: [
              { userId: currentUserId },
              { booking: { userId: currentUserId } },
            ],
          },
        ];

    const passengers = await prisma.passenger.findMany({
      where: {
        AND: [
          {
            OR: [
              { email: { equals: cleanContact, mode: "insensitive" } },
              { phoneNumber: cleanContact },
            ],
          },
          ...ownerLookupFilter,
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
    where: {
      OR: [{ userId }, { passengers: { some: { userId } } }],
    },
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
      cancellationRequest: true,
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
  const period = ["daily", "monthly", "yearly"].includes(req.query.period)
    ? req.query.period
    : "monthly";
  const now = new Date();
  const reportStart = new Date(now);
  const reportEnd = new Date(now);

  if (period === "daily") {
    reportStart.setHours(0, 0, 0, 0);
    reportEnd.setHours(23, 59, 59, 999);
  } else if (period === "yearly") {
    reportStart.setMonth(0, 1);
    reportStart.setHours(0, 0, 0, 0);
    reportEnd.setMonth(11, 31);
    reportEnd.setHours(23, 59, 59, 999);
  } else {
    reportStart.setDate(1);
    reportStart.setHours(0, 0, 0, 0);
    reportEnd.setMonth(reportEnd.getMonth() + 1, 0);
    reportEnd.setHours(23, 59, 59, 999);
  }

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    bookingsForReports,
    totalUsers,
    totalCustomers,
    totalAdmins,
    totalTrains,
    totalRoutes,
    totalSchedules,
    activeSchedules,
    delayedSchedules,
    totalWalletBalance,
    pendingWithdrawals,
    refundThisMonth,
  ] = await Promise.all([
    prisma.booking.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        schedule: {
          include: {
            route: {
              include: {
                startStation: { select: { stationName: true } },
                endStation: { select: { stationName: true } },
              },
            },
            train: { select: { trainType: true, trainName: true } },
          },
        },
        bookingDetails: {
          select: {
            carriageType: true,
            finalPrice: true,
          },
        },
      },
    }),
    prisma.user.count({
      where: { OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }] },
    }),
    prisma.user.count({
      where: {
        userType: "CUSTOMER",
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      },
    }),
    prisma.user.count({
      where: {
        userType: "ADMIN",
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      },
    }),
    prisma.train.count(),
    prisma.route.count({ where: { isActive: true } }),
    prisma.schedule.count(),
    prisma.schedule.count({ where: { status: "ACTIVE" } }),
    prisma.schedule.count({ where: { status: "DELAYED" } }),
    prisma.wallet.aggregate({ _sum: { balance: true } }),
    prisma.walletTransaction.count({
      where: { type: "WITHDRAWAL", status: "PENDING" },
    }),
    prisma.walletTransaction.aggregate({
      where: {
        type: "REFUND",
        status: "COMPLETED",
        createdAt: { gte: startOfMonth },
      },
      _sum: { amount: true },
    }),
  ]);

  const inRange = (date, start, end) => {
    const time = new Date(date).getTime();
    return time >= start.getTime() && time <= end.getTime();
  };
  const dateKey = (date) => {
    const d = new Date(date);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
  };
  const filteredBookings = bookingsForReports.filter((booking) =>
    inRange(booking.createdAt, reportStart, reportEnd),
  );
  const completedReportBookings = bookingsForReports.filter(
    (booking) =>
      booking.paymentStatus === "COMPLETED" &&
      inRange(booking.createdAt, reportStart, reportEnd),
  );
  const routeMap = new Map();
  const carriageMap = new Map();
  const dayMap = new Map([
    ["T2", 0],
    ["T3", 0],
    ["T4", 0],
    ["T5", 0],
    ["T6", 0],
    ["T7", 0],
    ["CN", 0],
  ]);

  const revenueMap = new Map();
  if (period === "daily") {
    for (let i = 6; i >= 0; i--) {
      const day = new Date(now);
      day.setDate(now.getDate() - i);
      const key = dateKey(day);
      revenueMap.set(key, {
        label: day.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        }),
        value: 0,
      });
    }
  } else if (period === "yearly") {
    for (let i = 4; i >= 0; i--) {
      const year = now.getFullYear() - i;
      revenueMap.set(String(year), {
        label: String(year),
        value: 0,
      });
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
      revenueMap.set(key, {
        label: `T${monthDate.getMonth() + 1}`,
        value: 0,
      });
    }
  }

  for (const booking of bookingsForReports) {
    if (booking.paymentStatus !== "COMPLETED") continue;

    const createdAt = new Date(booking.createdAt);
    const bucketKey =
      period === "daily"
        ? dateKey(createdAt)
        : period === "yearly"
          ? String(createdAt.getFullYear())
          : `${createdAt.getFullYear()}-${createdAt.getMonth()}`;

    if (revenueMap.has(bucketKey)) {
      revenueMap.get(bucketKey).value += booking.totalAmount || 0;
    }
  }

  for (const booking of filteredBookings) {
    const createdAt = new Date(booking.createdAt);
    const dayLabel =
      createdAt.getDay() === 0 ? "CN" : `T${createdAt.getDay() + 1}`;
    if (dayMap.has(dayLabel)) {
      dayMap.set(dayLabel, dayMap.get(dayLabel) + 1);
    }
  }

  for (const booking of completedReportBookings) {
    const route =
      booking.schedule?.route?.routeName ||
      [
        booking.schedule?.route?.startStation?.stationName,
        booking.schedule?.route?.endStation?.stationName,
      ]
        .filter(Boolean)
        .join(" → ") ||
      "Chưa xác định";
    const routeStats = routeMap.get(route) || {
      name: route,
      bookings: 0,
      revenue: 0,
    };
    routeStats.bookings += 1;
    routeStats.revenue += booking.totalAmount || 0;
    routeMap.set(route, routeStats);

    for (const detail of booking.bookingDetails || []) {
      const type = detail.carriageType || "Chưa xác định";
      const typeStats = carriageMap.get(type) || {
        name: type,
        count: 0,
      };
      typeStats.count += 1;
      carriageMap.set(type, typeStats);
    }
  }

  const carriageTotal = [...carriageMap.values()].reduce(
    (sum, item) => sum + item.count,
    0,
  );
  const totalBookings = filteredBookings.length;
  const confirmedBookings = filteredBookings.filter(
    (booking) => booking.status === "CONFIRMED",
  ).length;
  const cancelledBookings = filteredBookings.filter((booking) =>
    ["CANCELLED", "REFUNDED"].includes(booking.status),
  ).length;
  const pendingBookings = filteredBookings.filter(
    (booking) => booking.status === "PENDING",
  ).length;
  const totalRevenue = completedReportBookings.reduce(
    (sum, booking) => sum + (booking.totalAmount || 0),
    0,
  );
  const totalRefunds = filteredBookings.reduce((sum, booking) => {
    if (!["CANCELLED", "REFUNDED"].includes(booking.status)) return sum;
    return sum + (booking.refundAmount || 0);
  }, 0);
  const totalPassengers = filteredBookings.reduce(
    (sum, booking) => sum + (booking.totalPassengers || 0),
    0,
  );

  res.json({
    stats: {
      period,
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
          completedReportBookings.length > 0
            ? Math.round(totalRevenue / completedReportBookings.length)
            : 0,
      },
      adminOverview: {
        totalUsers,
        totalCustomers,
        totalAdmins,
        totalTrains,
        totalRoutes,
        totalSchedules,
        activeSchedules,
        delayedSchedules,
        totalWalletBalance: totalWalletBalance._sum.balance ?? 0,
        pendingWithdrawals,
        refundThisMonth: refundThisMonth._sum.amount ?? 0,
      },
      revenueSeries: [...revenueMap.values()].map((item) => ({
        ...item,
        value: Math.round(item.value),
      })),
      monthly: [...revenueMap.values()].map((item) => ({
        ...item,
        value: Math.round(item.value),
      })),
      topRoutes: [...routeMap.values()]
        .sort((a, b) => b.bookings - a.bookings)
        .slice(0, 5)
        .map((item) => ({ ...item, revenue: Math.round(item.revenue) })),
      trainTypes: [...carriageMap.values()]
        .sort((a, b) => b.count - a.count)
        .map((item) => ({
          ...item,
          pct:
            carriageTotal > 0
              ? Number(((item.count / carriageTotal) * 100).toFixed(1))
              : 0,
        })),
      bookingByDay: [...dayMap.entries()].map(([label, value]) => ({
        label,
        value,
      })),
    },
  });
});

// ============================================================
// POST /api/v1/bookings/:id/exchange - Confirm ticket exchange
// ============================================================
export const exchangeBooking = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { sessionId, paymentMethod = "WALLET" } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ message: "Vui lòng đăng nhập để đổi vé." });
  }
  if (!sessionId) {
    return res.status(400).json({ message: "Thiếu phiên giữ ghế mới." });
  }
  if (String(paymentMethod).toUpperCase() !== "WALLET") {
    return res.status(400).json({
      message: "Đổi vé hiện chỉ hỗ trợ thanh toán phí bằng ví GoTrain.",
    });
  }

  const now = new Date();
  const booking = await prisma.booking.findFirst({
    where: { id, userId },
    include: {
      schedule: true,
      passengers: { orderBy: { createdAt: "asc" } },
      bookingDetails: { orderBy: { id: "asc" } },
    },
  });

  if (!booking) {
    return res.status(404).json({ message: "Không tìm thấy vé cần đổi." });
  }
  if (booking.status !== "CONFIRMED" || booking.paymentStatus !== "COMPLETED") {
    return res
      .status(400)
      .json({ message: "Chỉ có thể đổi vé đã thanh toán và còn hiệu lực." });
  }
  if (new Date(booking.schedule.departureTime).getTime() <= now.getTime()) {
    return res
      .status(400)
      .json({ message: "Không thể đổi vé cho chuyến tàu đã khởi hành." });
  }

  const session = await prisma.seatHoldSession.findFirst({
    where: {
      id: sessionId,
      userId,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    include: {
      holds: {
        include: {
          seat: { include: { carriage: true } },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!session) {
    return res
      .status(409)
      .json({ message: "Phiên giữ ghế mới đã hết hạn hoặc không hợp lệ." });
  }

  const newHolds = session.holds.filter(
    (hold) => hold.scheduleId === session.outboundScheduleId,
  );
  const newSchedule = await prisma.schedule.findUnique({
    where: { id: session.outboundScheduleId },
  });
  if (!newSchedule || newSchedule.status !== "ACTIVE") {
    return res
      .status(400)
      .json({ message: "Chuyến tàu mới không còn hoạt động." });
  }
  if (new Date(newSchedule.departureTime).getTime() <= now.getTime()) {
    return res
      .status(400)
      .json({ message: "Không thể đổi sang chuyến tàu đã khởi hành." });
  }
  if (newHolds.length !== booking.totalPassengers) {
    return res.status(400).json({
      message: `Vui lòng chọn đúng ${booking.totalPassengers} ghế mới để đổi vé.`,
    });
  }

  const oldFare = Number(booking.totalAmount || 0);
  const newFare = newHolds.reduce(
    (sum, hold) => sum + Number(hold.priceSnapshot || 0),
    0,
  );
  const fixedFee = 20000;
  const percentFee = Math.round(oldFare * 0.1);
  const fareDifference = Math.max(newFare - oldFare, 0);
  const totalDue = fixedFee + percentFee + fareDifference;

  const result = await prisma.$transaction(async (tx) => {
    const claimedSession = await tx.seatHoldSession.updateMany({
      where: {
        id: session.id,
        userId,
        status: "ACTIVE",
        expiresAt: { gt: now },
      },
      data: { status: "CONVERTED" },
    });
    if (claimedSession.count !== 1) {
      throw Object.assign(new Error("Phiên giữ ghế mới đã được sử dụng."), {
        statusCode: 409,
      });
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance < totalDue) {
      throw Object.assign(
        new Error("Số dư ví không đủ để thanh toán phí đổi vé."),
        {
          statusCode: 422,
        },
      );
    }

    if (totalDue > 0) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: totalDue } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "PAYMENT",
          amount: totalDue,
          description: `Phí đổi vé ${booking.bookingCode}`,
          relatedBookingId: booking.id,
          status: "COMPLETED",
        },
      });
    }

    const oldSeatIds = [
      ...new Set(
        [
          ...booking.passengers.map((passenger) => passenger.seatId),
          ...booking.bookingDetails.map((detail) => detail.seatId),
        ].filter(Boolean),
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

    for (const [index, passenger] of booking.passengers.entries()) {
      const hold = newHolds[index];
      await tx.passenger.update({
        where: { id: passenger.id },
        data: {
          seatId: hold.seatId,
          carriageNumber: hold.seat.carriage.carriageNumber,
          boardingAt: newSchedule.departureTime,
        },
      });

      const detail = booking.bookingDetails[index];
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

    await tx.bookingPaymentHistory.create({
      data: {
        bookingId: booking.id,
        paymentMethod: "WALLET",
        amount: totalDue,
        status: "SUCCESS",
        transactionId: `EXCHANGE-${randomUUID()}`,
        attemptNumber: 1,
      },
    });

    const updatedBooking = await tx.booking.update({
      where: { id: booking.id },
      data: {
        scheduleId: session.outboundScheduleId,
        fromStationId: session.outboundFromStationId,
        toStationId: session.outboundToStationId,
        returnScheduleId: null,
        returnFromStationId: null,
        returnToStationId: null,
        bookingType: "ONE_WAY",
        subtotal: newFare,
        discountAmount: 0,
        taxAmount: 0,
        totalAmount: newFare,
        paymentMethod: "WALLET",
        paymentStatus: "COMPLETED",
        paidAt: now,
        status: "CONFIRMED",
        expiresAt: null,
      },
      include: { passengers: true },
    });

    await tx.notification.create({
      data: {
        userId,
        type: "BOOKING_EXCHANGED",
        title: "Đổi vé thành công",
        message: `Vé ${booking.bookingCode} đã được đổi. Phí đổi vé ${totalDue.toLocaleString("vi-VN")}đ.`,
        relatedBookingId: booking.id,
        relatedScheduleId: session.outboundScheduleId,
        deliveryMethod: ["IN_APP", "EMAIL"],
        deliveryStatus: "PENDING",
      },
    });

    await tx.seatHold.deleteMany({ where: { sessionId: session.id } });

    return updatedBooking;
  });

  res.json({
    message: "Đổi vé thành công.",
    booking: result,
    passengers: result.passengers,
    exchange: {
      oldFare,
      newFare,
      fareDifference,
      fixedFee,
      percentFee,
      totalDue,
    },
  });
});

// ============================================================
// POST /api/v1/bookings/:id/cancel - Request ticket cancellation & refund
// ============================================================
export const legacyCancelBooking = asyncHandler(async (req, res) => {
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

    // Deduct loyalty points if the booking had a user
    if (booking.userId) {
      const originalEarned = Math.floor(booking.totalAmount / 10000);
      if (originalEarned > 0) {
        const dbUser = await tx.user.findUnique({
          where: { id: booking.userId },
          select: { loyaltyPoints: true },
        });
        const currentPoints = dbUser?.loyaltyPoints || 0;
        const deductPoints = Math.min(originalEarned, currentPoints);
        if (deductPoints > 0) {
          await tx.user.update({
            where: { id: booking.userId },
            data: { loyaltyPoints: { decrement: deductPoints } },
          });
          await tx.loyaltyPoint.create({
            data: {
              userId: booking.userId,
              points: deductPoints,
              type: "REDEEMED",
              source: "BOOKING",
              relatedBookingId: booking.id,
            },
          });
        }
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
export const cancelBooking = asyncHandler(async (req, res) => {
  const result = await cancelBookingTickets({
    bookingId: req.params.id,
    passengerIds: req.body.passengerIds,
    refundMethod: req.body.refundMethod,
    reason: req.body.reason,
    identity: req.bookingIdentity,
    verification: {
      ticketCode: req.body.ticketCode,
      contactInfo: req.body.contactInfo,
    },
    bankInfo: {
      bankName: req.body.bankName,
      bankAccount: req.body.bankAccount,
    },
  });

  res.status(201).json({
    message: "Đã gửi yêu cầu hủy vé. Vui lòng chờ Admin phê duyệt.",
    cancellationStatus: result.cancellationRequest.status,
    cancellationRequestId: result.cancellationRequest.id,
    refundAmount: result.refundAmount,
    refundPercentage: result.refundPercentage,
    bookingStatus: result.booking.status,
    paymentStatus: result.booking.paymentStatus,
    requestedPassengerIds: result.requestedPassengerIds,
    refundMethod: result.refundMethod,
    refundStatus: result.refundStatus,
  });
});

export const listAdminCancellationRequests = asyncHandler(async (req, res) => {
  const requests = await getAdminCancellationRequests({
    status: req.query.status,
  });
  res.json({ requests });
});

export const decideCancellationRequest = asyncHandler(async (req, res) => {
  const result = await reviewCancellationRequest({
    requestId: req.params.requestId,
    action: req.body.action,
    rejectionReason: req.body.rejectionReason,
    adminId: req.user.id,
  });

  res.json({
    message:
      String(req.body.action).toUpperCase() === "APPROVE"
        ? "Đã duyệt yêu cầu hủy vé và xử lý hoàn tiền."
        : "Đã từ chối yêu cầu hủy vé.",
    result,
  });
});
