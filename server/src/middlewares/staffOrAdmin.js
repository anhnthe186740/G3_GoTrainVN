import { prisma } from "../config/database.js";

export async function staffOrAdmin(req, res, next) {
  if (!["STAFF", "ADMIN"].includes(req.user?.role)) {
    return res.status(403).json({
      message: "Bạn không có quyền thực hiện thao tác dành cho nhân viên.",
    });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { isActive: true },
    });
    if (!user || user.isActive === false) {
      return res.status(403).json({
        message: "Tài khoản nhân viên đã bị vô hiệu hóa.",
      });
    }
    next();
  } catch {
    return res
      .status(500)
      .json({ message: "Không thể xác minh trạng thái tài khoản." });
  }
}
