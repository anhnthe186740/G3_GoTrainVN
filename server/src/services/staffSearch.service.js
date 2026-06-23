import { prisma } from "../config/database.js";

const CODE_PATTERN = /^[A-Z0-9]{6,24}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NATIONAL_ID_PATTERN = /^\d{12}$/;

function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("84") && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function phoneVariants(value) {
  const normalized = normalizePhone(value);
  if (!normalized) return [];
  const variants = new Set([normalized]);
  if (normalized.startsWith("0")) {
    variants.add(`+84${normalized.slice(1)}`);
    variants.add(`84${normalized.slice(1)}`);
  }
  return [...variants];
}

function classifyQuery(query) {
  const raw = String(query || "").trim();
  const upper = raw.toUpperCase();
  const phone = normalizePhone(raw);

  if (EMAIL_PATTERN.test(raw)) return "EMAIL";
  if (upper.startsWith("GT") && CODE_PATTERN.test(upper)) return "BOOKING_CODE";
  if (upper.startsWith("VE") && CODE_PATTERN.test(upper)) return "TICKET_CODE";
  if (NATIONAL_ID_PATTERN.test(phone)) return "NATIONAL_ID";
  if (/^\+?\d[\d\s.-]{7,}$/.test(raw)) return "PHONE";
  if (CODE_PATTERN.test(upper)) return "CODE";
  return "TEXT";
}

const stationSelect = {
  select: { id: true, stationCode: true, stationName: true, city: true },
};

const seatInclude = { include: { carriage: true } };

const bookingInclude = {
  include: {
    user: {
      select: {
        id: true,
        fullName: true,
        email: true,
        phoneNumber: true,
        nationalId: true,
        nationalIdType: true,
        dateOfBirth: true,
        wallet: {
          select: {
            id: true,
            balance: true,
            currency: true,
          },
        },
      },
    },
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
    fromStation: stationSelect,
    toStation: stationSelect,
    passengers: {
      include: {
        seat: seatInclude,
        bookingDetails: {
          include: {
            schedule: true,
            seat: seatInclude,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    },
  },
};

const ticketInclude = {
  booking: bookingInclude,
  seat: seatInclude,
  bookingDetails: {
    include: {
      schedule: true,
      seat: seatInclude,
    },
  },
};

function uniqueById(items) {
  const seen = new Set();
  return items.filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function passengerClauses(query, queryType) {
  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();
  const cleanPhone = phoneVariants(trimmed);
  const cleanNationalId = normalizePhone(trimmed);
  const clauses = [];

  if (["TICKET_CODE", "CODE"].includes(queryType)) {
    clauses.push({ ticketCode: upper });
  }
  if (["BOOKING_CODE", "CODE"].includes(queryType)) {
    clauses.push({ booking: { bookingCode: upper } });
  }
  if (queryType === "NATIONAL_ID") {
    clauses.push({ nationalId: cleanNationalId });
  }
  if (queryType === "TEXT" && trimmed.length >= 2) {
    clauses.push({ fullName: { contains: trimmed, mode: "insensitive" } });
  }

  return clauses;
}

function bookingClauses(query, queryType) {
  const trimmed = query.trim();
  const upper = trimmed.toUpperCase();
  const cleanPhone = phoneVariants(trimmed);
  const clauses = [];

  if (["BOOKING_CODE", "CODE"].includes(queryType)) {
    clauses.push({ bookingCode: upper });
  }
  if (queryType === "EMAIL") {
    clauses.push({
      userId: { not: null },
      user: { email: { equals: trimmed.toLowerCase(), mode: "insensitive" } },
    });
  }
  if (queryType === "PHONE" && cleanPhone.length > 0) {
    clauses.push({
      userId: { not: null },
      user: { phoneNumber: { in: cleanPhone } },
    });
  }
  if (queryType === "TEXT" && trimmed.length >= 2) {
    clauses.push({
      userId: { not: null },
      user: { email: { contains: trimmed, mode: "insensitive" } },
    });
  }

  const pClauses = passengerClauses(query, queryType);
  if (pClauses.length > 0) {
    clauses.push({ passengers: { some: { OR: pClauses } } });
  }

  return clauses;
}

export async function searchStaffWorkspace(query) {
  const trimmed = String(query || "").trim();
  if (trimmed.length < 2) {
    const error = new Error("Nhập ít nhất 2 ký tự để tìm kiếm.");
    error.statusCode = 400;
    throw error;
  }

  const queryType = classifyQuery(trimmed);
  // #6: Mở rộng phạm vi tìm kiếm — staff được xem booking từ 30 ngày trước đến tương lai,
  // bao gồm cả booking đã hủy/hoàn tiền để hỗ trợ giải quyết khiếu nại.
  const sevenDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const bookingWhere = {
    schedule: { departureTime: { gte: sevenDaysAgo } },
  };
  const [tickets, bookings] = await Promise.all([
    passengerClauses(trimmed, queryType).length > 0
      ? prisma.passenger.findMany({
          where: {
            AND: [
              { OR: passengerClauses(trimmed, queryType) },
              { booking: bookingWhere },
            ],
          },
          include: ticketInclude,
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    bookingClauses(trimmed, queryType).length > 0
      ? prisma.booking.findMany({
          where: {
            AND: [{ OR: bookingClauses(trimmed, queryType) }, bookingWhere],
          },
          include: bookingInclude.include,
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      : Promise.resolve([]),
  ]);

  const uniqueTickets = uniqueById(tickets);
  const bookingMap = new Map(bookings.map((booking) => [booking.id, booking]));
  uniqueTickets.forEach((ticket) => {
    if (ticket.booking?.id && !bookingMap.has(ticket.booking.id)) {
      bookingMap.set(ticket.booking.id, ticket.booking);
    }
  });
  const uniqueBookings = [...bookingMap.values()];

  const total = uniqueTickets.length + uniqueBookings.length;
  const primaryType =
    uniqueBookings.length === 1 &&
    uniqueTickets.length <= uniqueBookings[0].passengers.length
      ? "BOOKING"
      : uniqueTickets.length === 1 && uniqueBookings.length <= 1
        ? "TICKET"
        : "MULTIPLE";

  return {
    query: trimmed,
    queryType,
    type: total === 0 ? "EMPTY" : primaryType,
    tickets: uniqueTickets,
    bookings: uniqueBookings,
    total,
  };
}
