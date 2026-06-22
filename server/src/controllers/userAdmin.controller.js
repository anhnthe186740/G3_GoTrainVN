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
      lockReason: u.lockReason,
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

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      description: `Tạo người dùng mới: ${user.fullName} (${user.email}) với vai trò ${user.userType}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
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
  const {
    fullName,
    email,
    phoneNumber,
    userType,
    isActive,
    password,
    lockReason,
  } = req.body;

  const user = await prisma.user.findFirst({
    where: {
      id,
      ...notDeleted,
    },
  });

  if (!user) {
    return res.status(404).json({ message: "Không tìm thấy người dùng" });
  }

  if (
    (email && email !== user.email) ||
    (phoneNumber && phoneNumber !== user.phoneNumber)
  ) {
    const existing = await prisma.user.findFirst({
      where: {
        id: { not: id },
        AND: [
          { OR: [{ email: email || "" }, { phoneNumber: phoneNumber || "" }] },
          notDeleted,
        ],
      },
    });

    if (existing) {
      if (email && existing.email === email) {
        return res.status(400).json({ message: "Email này đã được sử dụng" });
      }
      return res
        .status(400)
        .json({ message: "Số điện thoại này đã được sử dụng" });
    }
  }

  const data = {
    fullName: fullName || user.fullName,
    email: email || user.email,
    phoneNumber: phoneNumber || user.phoneNumber,
    userType: userType || user.userType,
    isActive: isActive !== undefined ? isActive : user.isActive,
  };

  // Ngăn Admin tự khóa chính mình
  if (isActive === false && id === req.user.id) {
    return res
      .status(400)
      .json({ message: "Bạn không thể tự khóa tài khoản của chính mình." });
  }

  // Check if locking the account (changing isActive from true to false)
  if (isActive === false && user.isActive === true) {
    data.lockReason = lockReason || "Vi phạm điều khoản dịch vụ";
  } else if (isActive === true) {
    data.lockReason = null; // Clear lockReason on unlock
  }

  if (password) {
    if (user.userType !== "STAFF") {
      return res.status(400).json({
        message:
          "Quản trị viên chỉ được phép đặt lại mật khẩu cho tài khoản Nhân viên.",
      });
    }
    data.password = await bcrypt.hash(password, 10);
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
  });

  let successMessage = "Cập nhật người dùng thành công";
  if (isActive === false && user.isActive === true) {
    successMessage = "Khóa tài khoản thành công";
  } else if (isActive === true && user.isActive === false) {
    successMessage = "Mở khóa tài khoản thành công";
  }

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "UPDATE",
      entity: "User",
      entityId: updated.id,
      changes: JSON.stringify({
        fullName: fullName !== undefined ? fullName : undefined,
        email: email !== undefined ? email : undefined,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : undefined,
        userType: userType !== undefined ? userType : undefined,
        isActive: isActive !== undefined ? isActive : undefined,
        lockReason: lockReason !== undefined ? lockReason : undefined,
        passwordChanged: password ? true : undefined,
      }),
      description: `Cập nhật thông tin người dùng: ${updated.fullName} (${updated.email}). ${
        isActive === false && user.isActive === true
          ? `Lý do khóa: ${lockReason || "Không có"}`
          : ""
      }${
        isActive === true && user.isActive === false ? "Mở khóa tài khoản" : ""
      }${password ? "Đã đặt lại mật khẩu." : ""}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.json({
    success: true,
    message: successMessage,
    user: {
      id: updated.id,
      fullName: updated.fullName,
      email: updated.email,
      phoneNumber: updated.phoneNumber,
      userType: updated.userType,
      isActive: updated.isActive,
      lockReason: updated.lockReason,
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

  await prisma.adminLog.create({
    data: {
      adminId: req.user.id,
      action: "DELETE",
      entity: "User",
      entityId: id,
      description: `Xóa mềm người dùng: ${user.fullName} (${user.email})`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
    },
  });

  res.json({
    success: true,
    message: "Xóa người dùng thành công (Xóa mềm)",
  });
});

// Roles statistics
export const getAdminRolesStats = asyncHandler(async (req, res) => {
  const [totalUsers, totalCustomers, totalAdmins, totalStaff, totalBanned] =
    await Promise.all([
      prisma.user.count({ where: { ...notDeleted } }),
      prisma.user.count({ where: { userType: "CUSTOMER", ...notDeleted } }),
      prisma.user.count({ where: { userType: "ADMIN", ...notDeleted } }),
      prisma.user.count({ where: { userType: "STAFF", ...notDeleted } }),
      prisma.user.count({ where: { isActive: false, ...notDeleted } }),
    ]);

  res.json({
    success: true,
    stats: {
      total: totalUsers,
      customer: totalCustomers,
      admin: totalAdmins,
      staff: totalStaff,
      banned: totalBanned,
    },
  });
});

// Get system audit logs with pagination, search, and filters
export const getAdminAuditLogs = asyncHandler(async (req, res) => {
  const {
    search,
    action,
    entity,
    adminId,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  if (action) {
    where.action = action;
  }

  if (entity) {
    where.entity = entity;
  }

  if (adminId) {
    where.adminId = adminId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { changes: { contains: search, mode: "insensitive" } },
      {
        admin: {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [total, logs] = await Promise.all([
    prisma.adminLog.count({ where }),
    prisma.adminLog.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        admin: {
          select: {
            id: true,
            fullName: true,
            email: true,
            userType: true,
          },
        },
      },
    }),
  ]);

  res.json({
    success: true,
    logs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});

// Get security logs with pagination, search, and filters
export const getSecurityLogs = asyncHandler(async (req, res) => {
  const {
    search,
    eventType,
    status,
    userId,
    startDate,
    endDate,
    page = 1,
    limit = 10,
  } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const take = Number(limit);

  const where = {};

  if (eventType) {
    where.eventType = eventType;
  }

  if (status) {
    where.status = status;
  }

  if (userId) {
    where.userId = userId;
  }

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) {
      where.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  if (search) {
    where.OR = [
      { description: { contains: search, mode: "insensitive" } },
      { ipAddress: { contains: search, mode: "insensitive" } },
      { userAgent: { contains: search, mode: "insensitive" } },
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

  const [total, logs] = await Promise.all([
    prisma.securityLog.count({ where }),
    prisma.securityLog.findMany({
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
          },
        },
      },
    }),
  ]);

  res.json({
    success: true,
    logs,
    pagination: {
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    },
  });
});
