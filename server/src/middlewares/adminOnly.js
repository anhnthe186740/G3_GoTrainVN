export function adminOnly(req, res, next) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({
      message: "Bạn không có quyền thực hiện thao tác quản trị này.",
    });
  }

  next();
}
