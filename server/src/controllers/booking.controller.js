import { randomUUID } from "node:crypto";
import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendEmail } from "../services/email.service.js";
import { getCancelBookingEmailTemplate } from "../utils/emailTemplates.js";

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
      message: "Vui lòng cung cấp mã đặt chỗ và email để tra cứu.",
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
      cancellationRequest: true,
    },
  };

  const seatInclude = { include: { carriage: true } };
  const isPrivilegedLookup = ["STAFF", "ADMIN"].includes(req.user?.role);
  const currentUserId = req.user?.id || req.bookingIdentity?.userId;

  // ------------------------------------------------------------------
  // Scenario 1: Booking Code + Email → return every ticket in the booking
  // ------------------------------------------------------------------
  if (ticketCode && contactInfo) {
    const cleanBookingCode = ticketCode.trim().toUpperCase();
    const cleanContact = contactInfo.trim().toLowerCase();

    const matchedBooking = await prisma.booking.findUnique({
      where: { bookingCode: cleanBookingCode },
      select: {
        id: true,
        confirmationEmail: true,
        passengers: { select: { email: true } },
      },
    });
    const emailMatches =
      matchedBooking &&
      [
        matchedBooking.confirmationEmail,
        ...matchedBooking.passengers.map((passenger) => passenger.email),
      ].some((email) => email?.trim().toLowerCase() === cleanContact);

    if (!emailMatches) {
      return res.status(404).json({
        message: "Mã đặt chỗ hoặc email không chính xác.",
      });
    }

    const passengers = await prisma.passenger.findMany({
      where: { bookingId: matchedBooking.id },
      include: {
        booking: bookingInclude,
        seat: seatInclude,
      },
      orderBy: { createdAt: "asc" },
    });

    if (passengers.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy vé nào thuộc mã đặt chỗ này.",
      });
    }

    return res.json({ type: "list", tickets: passengers });
  }

  // ------------------------------------------------------------------
  // Scenario 2: Booking Code only → allowed for its owner or staff/admin
  // ------------------------------------------------------------------
  if (ticketCode) {
    if (!isPrivilegedLookup && !currentUserId) {
      return res.status(400).json({
        message: "Vui lòng nhập thêm email liên hệ để tra cứu đặt chỗ.",
      });
    }

    const cleanBookingCode = ticketCode.trim().toUpperCase();
    const matchedBooking = await prisma.booking.findFirst({
      where: {
        bookingCode: cleanBookingCode,
        ...(isPrivilegedLookup ? {} : { userId: currentUserId }),
      },
      select: { id: true },
    });

    if (!matchedBooking) {
      return res.status(404).json({
        message: "Không tìm thấy đặt chỗ cho mã đã nhập.",
      });
    }

    const passengers = await prisma.passenger.findMany({
      where: { bookingId: matchedBooking.id },
      include: {
        booking: bookingInclude,
        seat: seatInclude,
      },
      orderBy: { createdAt: "asc" },
    });

    if (passengers.length === 0) {
      return res.status(404).json({
        message: "Không tìm thấy vé nào thuộc mã đặt chỗ này.",
      });
    }

    return res.json({ type: "list", tickets: passengers });
  }

  // ------------------------------------------------------------------
  // Scenario 3: Only Contact Info → return list of all bookings
  // ------------------------------------------------------------------
  if (contactInfo) {
    if (!isPrivilegedLookup && !currentUserId) {
      return res.status(400).json({
        message: "Vui lòng nhập mã đặt chỗ kèm email để tra cứu.",
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
            train: {
              select: { trainType: true, trainName: true, totalCapacity: true },
            },
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
      totalCapacity: 0,
      scheduleIds: new Set(),
    };
    const ticketCount = booking.bookingDetails?.length || 0;
    routeStats.bookings += ticketCount;
    routeStats.revenue += booking.totalAmount || 0;

    if (booking.scheduleId && !routeStats.scheduleIds.has(booking.scheduleId)) {
      routeStats.scheduleIds.add(booking.scheduleId);
      routeStats.totalCapacity += booking.schedule?.train?.totalCapacity || 0;
    }
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
  const totalBookings = filteredBookings.reduce(
    (sum, booking) => sum + (booking.totalPassengers || 0),
    0,
  );
  const confirmedBookings = filteredBookings
    .filter((booking) => ["CONFIRMED", "COMPLETED"].includes(booking.status))
    .reduce((sum, booking) => sum + (booking.totalPassengers || 0), 0);
  const cancelledBookings = filteredBookings
    .filter((booking) => ["CANCELLED", "REFUNDED"].includes(booking.status))
    .reduce((sum, booking) => sum + (booking.totalPassengers || 0), 0);
  const pendingBookings = filteredBookings
    .filter((booking) => booking.status === "PENDING")
    .reduce((sum, booking) => sum + (booking.totalPassengers || 0), 0);
  const totalRevenue = completedReportBookings.reduce(
    (sum, booking) => sum + (booking.totalAmount || 0),
    0,
  );
  const totalRefunds = filteredBookings.reduce((sum, booking) => {
    if (!["CANCELLED", "REFUNDED"].includes(booking.status)) return sum;
    return sum + (booking.refundAmount || 0);
  }, 0);
  const totalPassengers = totalBookings;

  // Calculate average utilization rate
  const totalCompletedBookedSeats = completedReportBookings.reduce(
    (sum, b) => sum + (b.totalPassengers || 0),
    0,
  );
  const uniqueScheduleIds = new Set();
  let totalCompletedCapacity = 0;
  for (const b of completedReportBookings) {
    if (b.scheduleId && !uniqueScheduleIds.has(b.scheduleId)) {
      uniqueScheduleIds.add(b.scheduleId);
      totalCompletedCapacity += b.schedule?.train?.totalCapacity || 0;
    }
  }
  const avgUtilization =
    totalCompletedCapacity > 0
      ? Number(
          ((totalCompletedBookedSeats / totalCompletedCapacity) * 100).toFixed(
            1,
          ),
        )
      : 0;

  // Initialize heatmap structure: Monday (index 0) to Sunday (index 6)
  const daysOfWeek = [
    "Thứ 2",
    "Thứ 3",
    "Thứ 4",
    "Thứ 5",
    "Thứ 6",
    "Thứ 7",
    "Chủ Nhật",
  ];
  const heatmapTemp = Array.from({ length: 7 }, (_, i) => ({
    day: daysOfWeek[i],
    slots: Array.from({ length: 4 }, () => ({
      booked: 0,
      capacity: 0,
      scheduleIds: new Set(),
    })),
  }));

  for (const booking of completedReportBookings) {
    if (!booking.schedule) continue;
    const depTime = new Date(booking.schedule.departureTime);
    const jsDay = depTime.getDay();
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1; // Map Sunday (0) to index 6, Monday (1) to index 0...

    const hour = depTime.getHours();
    let slotIndex = 0;
    if (hour >= 6 && hour < 12) slotIndex = 1;
    else if (hour >= 12 && hour < 18) slotIndex = 2;
    else if (hour >= 18 && hour < 24) slotIndex = 3;

    const slot = heatmapTemp[dayIndex].slots[slotIndex];
    slot.booked += booking.totalPassengers || 0;

    if (booking.scheduleId && !slot.scheduleIds.has(booking.scheduleId)) {
      slot.scheduleIds.add(booking.scheduleId);
      slot.capacity += booking.schedule?.train?.totalCapacity || 0;
    }
  }

  const heatmap = heatmapTemp.map((d) => ({
    day: d.day,
    slots: d.slots.map((s) => {
      if (s.capacity === 0) return 0;
      return Number(((s.booked / s.capacity) * 100).toFixed(1));
    }),
  }));

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
        avgUtilization,
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
        .map((item) => {
          const occupancy =
            item.totalCapacity > 0
              ? Number(((item.bookings / item.totalCapacity) * 100).toFixed(1))
              : 0;
          const { scheduleIds, ...rest } = item;
          return {
            ...rest,
            revenue: Math.round(item.revenue),
            occupancy,
          };
        }),
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
      heatmap,
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
  // Xây dựng map passengerId → bookingDetail, ưu tiên detail chưa CANCELLED
  const detailByPassengerId = new Map();
  for (const d of booking.bookingDetails) {
    const existing = detailByPassengerId.get(d.passengerId);
    if (!existing || existing.status === "CANCELLED") {
      detailByPassengerId.set(d.passengerId, d);
    }
  }
  const activePassengers = booking.passengers.filter((p) => {
    const detail = detailByPassengerId.get(p.id);
    return detail && detail.status !== "CANCELLED";
  });
  if (activePassengers.length === 0) {
    return res
      .status(400)
      .json({ message: "Booking không còn vé nào đủ điều kiện đổi." });
  }

  if (newHolds.length !== activePassengers.length) {
    return res.status(400).json({
      message: `Vui lòng chọn đúng ${activePassengers.length} ghế mới để đổi vé.`,
    });
  }

  // Tính giá trị thực tế từ các vé active
  const oldFare = activePassengers.reduce((sum, p) => {
    const detail = detailByPassengerId.get(p.id);
    return sum + Number(detail?.finalPrice || 0);
  }, 0);
  const newFare = newHolds.reduce(
    (sum, hold) => sum + Number(hold.priceSnapshot || 0),
    0,
  );
  // Phí cố định tính theo đầu vé
  const fixedFee = 20000 * activePassengers.length;
  const percentFee = Math.round(oldFare * 0.1);
  const fareDifference = newFare - oldFare; // signed: positive = cần bù thêm, negative = vé rẻ hơn
  const totalFees = fixedFee + percentFee;
  const netAmount = totalFees + fareDifference;
  const amountDue = Math.max(netAmount, 0);
  const refundSurplus = Math.max(-netAmount, 0);

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
    if (amountDue > 0 && (!wallet || wallet.balance < amountDue)) {
      throw Object.assign(
        new Error("Số dư ví không đủ để thanh toán phí đổi vé."),
        { statusCode: 422 },
      );
    }

    if (amountDue > 0) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: { decrement: amountDue } },
      });
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: "PAYMENT",
          amount: amountDue,
          description: `Phí đổi vé ${booking.bookingCode}`,
          relatedBookingId: booking.id,
          status: "COMPLETED",
        },
      });
    }

    if (refundSurplus > 0) {
      const effectiveWallet =
        wallet ??
        (await tx.wallet.upsert({
          where: { userId },
          update: {},
          create: { userId, balance: 0, currency: "VND" },
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
          description: `Hoàn chênh lệch đổi vé ${booking.bookingCode}`,
          relatedBookingId: booking.id,
          status: "COMPLETED",
        },
      });
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

    // Chỉ cập nhật hành khách active, map bằng passengerId
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

    if (amountDue > 0) {
      await tx.bookingPaymentHistory.create({
        data: {
          bookingId: booking.id,
          paymentMethod: "WALLET",
          amount: amountDue,
          status: "SUCCESS",
          transactionId: `EXCHANGE-${randomUUID()}`,
          attemptNumber: 1,
        },
      });
    }
    if (refundSurplus > 0) {
      await tx.bookingPaymentHistory.create({
        data: {
          bookingId: booking.id,
          paymentMethod: "REFUND_WALLET",
          amount: refundSurplus,
          status: "SUCCESS",
          transactionId: `EXCHANGE-REFUND-${randomUUID()}`,
          attemptNumber: 1,
        },
      });
    }

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
        message:
          refundSurplus > 0
            ? `Vé ${booking.bookingCode} đã được đổi. Hoàn chênh lệch ${refundSurplus.toLocaleString("vi-VN")}đ vào ví.`
            : `Vé ${booking.bookingCode} đã được đổi. Phí đổi vé ${amountDue.toLocaleString("vi-VN")}đ.`,
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
      amountDue,
      refundSurplus,
    },
  });
});

// ============================================================
// POST /api/v1/bookings/:id/cancel - Request ticket cancellation & refund
// ============================================================
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
      accountHolder: req.body.accountHolder,
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
    audience: req.query.audience,
  });
  res.json({ requests });
});

export const decideCancellationRequest = asyncHandler(async (req, res) => {
  const action = String(req.body.action || "").toUpperCase();
  const result = await reviewCancellationRequest({
    requestId: req.params.requestId,
    action,
    rejectionReason: req.body.rejectionReason,
    adminId: req.user.id,
  });

  res.json({
    message:
      action === "APPROVE"
        ? "Đã duyệt yêu cầu hủy vé và xử lý hoàn tiền."
        : "Đã từ chối yêu cầu hủy vé.",
    result,
  });

  // Fire-and-forget: thông báo cho hành khách sau khi admin ra quyết định
  const booking = result.booking ?? result.cancellationRequest?.booking;
  if (!booking) return;
  const userId = booking.userId;

  if (action === "APPROVE") {
    if (userId) {
      const refundMethodLabel =
        result.refundMethod === "WALLET"
          ? "Ví GoTrainVN"
          : "Chuyển khoản ngân hàng";
      prisma.notification
        .create({
          data: {
            userId,
            type: "CANCELLATION_APPROVED",
            title: "Yêu cầu hủy vé được duyệt",
            message: `Yêu cầu hủy vé ${booking.bookingCode} đã được duyệt. Hoàn tiền ${Number(result.refundAmount || 0).toLocaleString("vi-VN")}đ qua ${refundMethodLabel}.`,
            relatedBookingId: booking.id,
            deliveryMethod: ["IN_APP"],
            deliveryStatus: "PENDING",
          },
        })
        .catch(() => {});
    }

    prisma.booking
      .findUnique({
        where: { id: booking.id },
        include: {
          user: { select: { email: true, fullName: true } },
          schedule: {
            include: { startStation: true, endStation: true, train: true },
          },
          fromStation: true,
          toStation: true,
          passengers: { include: { bookingDetails: true } },
        },
      })
      .then((fullBooking) => {
        if (!fullBooking?.user?.email) return;
        const refundPct = fullBooking.totalAmount
          ? Math.round((result.refundAmount / fullBooking.totalAmount) * 100)
          : 0;
        const html = getCancelBookingEmailTemplate(
          fullBooking,
          result.refundAmount,
          refundPct,
          result.refundMethod,
        );
        return sendEmail({
          to: fullBooking.user.email,
          subject: `[GoTrain VN] Yêu cầu hủy vé đã được duyệt - Mã đặt chỗ: ${booking.bookingCode}`,
          html,
        });
      })
      .catch(() => {});
  } else {
    if (userId) {
      prisma.notification
        .create({
          data: {
            userId,
            type: "CANCELLATION_REJECTED",
            title: "Yêu cầu hủy vé bị từ chối",
            message: `Yêu cầu hủy vé ${booking.bookingCode} đã bị từ chối. Lý do: ${req.body.rejectionReason || "Không đủ điều kiện hủy vé"}.`,
            relatedBookingId: booking.id,
            deliveryMethod: ["IN_APP"],
            deliveryStatus: "PENDING",
          },
        })
        .catch(() => {});
    }
  }
});
