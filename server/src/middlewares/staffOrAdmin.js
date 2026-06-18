export function staffOrAdmin(req, res, next) {
  if (!["STAFF", "ADMIN"].includes(req.user?.role)) {
    return res.status(403).json({
      message: "Bạn không có quyền thực hiện thao tác dành cho nhân viên.",
    });
  }

  next();
}
