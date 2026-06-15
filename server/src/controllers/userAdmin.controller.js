import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import bcrypt from "bcryptjs";

// Helper filter to match active (non-deleted) users in MongoDB
const notDeleted = {
  OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
};

// Get user list with pagination, search, and filters
export const getAdminUsers = asyncHandler(async (req, res) => {
  const { search, userType, isActive, page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {
    ...notDeleted,
  };

  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { phoneNumber: { contains: search, mode: "insensitive" } },
    ];
  }

  if (userType) {
    if (userType === "STAFF_ALL") {
      where.userType = { in: ["ADMIN", "STAFF", "ANALYST"] };
    } else {
      where.userType = userType;
    }
  }

  if (isActive !== undefined) {
    where.isActive = isActive === "true";
  }

  const [total, rawUsers] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        bookings: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            schedule: {
              include: {
                startStation: true,
                endStation: true,
              },
            },
          },
        },
        _count: {
          select: { bookings: true },
        },
      },
    }),
  ]);

  const users = rawUsers.map((u) => {
    let latestBookingRoute = null;
    if (u.bookings && u.bookings.length > 0) {
      const b = u.bookings[0];
      if (b.schedule) {
        const startName = b.schedule.startStation?.stationName || "";
        const endName = b.schedule.endStation?.stationName || "";
        const depTime = b.schedule.departureTime;
        const formattedDate = new Date(depTime).toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        });
        latestBookingRoute = `${startName} → ${endName} (${formattedDate})`;
      }
    }

    return {
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      phoneNumber: u.phoneNumber,
      userType: u.userType,
      isActive: u.isActive,
      totalBookings: u._count.bookings,
      latestBookingRoute,
      createdAt: u.createdAt,
    };
  });

  res.json({
    success: true,
    users,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Create user
export const createAdminUser = asyncHandler(async (req, res) => {
  const { fullName, email, phoneNumber, password, userType, isActive } =
    req.body;

  if (!fullName || !email || !phoneNumber || !password) {
    return res
      .status(400)
      .json({ message: "Vui lòng nhập đầy đủ thông tin bắt buộc" });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      AND: [{ OR: [{ email }, { phoneNumber }] }, notDeleted],
    },
  });

  if (existingUser) {
    if (existingUser.email === email) {
      return res.status(400).json({ message: "Email này đã được sử dụng" });
    }
    return res
      .status(400)
      .json({ message: "Số điện thoại này đã được sử dụng" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      fullName,
      email,
      phoneNumber,
      password: hashedPassword,
      userType: userType || "CUSTOMER",
      isActive: isActive !== undefined ? isActive : true,
      wallet: {
        create: {
          balance: 0,
        },
      },
    },
  });

  res.status(201).json({
    success: true,
    message: "Tạo người dùng thành công",
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      userType: user.userType,
      isActive: user.isActive,
    },
  });
});

// Update user details
export const updateAdminUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phoneNumber, userType, isActive, password } =
    req.body;

  const user = await prisma.user.findFirst({
    where: {
      id,
      ...notDeleted,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy người dùng" });
  }

  if (email !== user.email || phoneNumber !== user.phoneNumber) {
    const existing = await prisma.user.findFirst({
      where: {
        id: { not: id },
        AND: [{ OR: [{ email }, { phoneNumber }] }, notDeleted],
      },
    });

    if (existing) {
      if (existing.email === email) {
        return res.status(400).json({ message: "Email này đã được sử dụng" });
      }
      return res
        .status(400)
        .json({ message: "Số điện thoại này đã được sử dụng" });
    }
  }

  const data = {
    fullName,
    email,
    phoneNumber,
    userType,
    isActive: isActive !== undefined ? isActive : user.isActive,
  };

  if (password) {
    data.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
  });

  res.json({
    success: true,
    message: "Cập nhật người dùng thành công",
    user: {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      phoneNumber: updated.phoneNumber,
      userType: updated.userType,
      isActive: updated.isActive,
    },
  });
});

// Soft-delete user
export const deleteAdminUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await prisma.user.findFirst({
    where: {
      id,
      ...notDeleted,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy người dùng" });
  }

  await prisma.user.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  res.json({
    success: true,
    message: "Xóa người dùng thành công (Xóa mềm)",
  });
});

// Roles statistics
export const getAdminRolesStats = asyncHandler(async (req, res) => {
  const [
    totalUsers,
    totalCustomers,
    totalAdmins,
    totalStaff,
    totalAnalysts,
    totalBanned,
  ] = await Promise.all([
    prisma.user.count({ where: { ...notDeleted } }),
    prisma.user.count({ where: { userType: "CUSTOMER", ...notDeleted } }),
    prisma.user.count({ where: { userType: "ADMIN", ...notDeleted } }),
    prisma.user.count({ where: { userType: "STAFF", ...notDeleted } }),
    prisma.user.count({ where: { userType: "ANALYST", ...notDeleted } }),
    prisma.user.count({ where: { isActive: false, ...notDeleted } }),
  ]);

  res.json({
    success: true,
    stats: {
      total: totalUsers,
      customer: totalCustomers,
      admin: totalAdmins,
      staff: totalStaff,
      analyst: totalAnalysts,
      banned: totalBanned,
    },
  });
});
