export function errorHandler(err, _req, res, _next) {
  // Prisma unique constraint violation (e.g. duplicate email)
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] ?? "field";
    return res.status(409).json({ message: `${field} already exists` });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error",
    ...(err.details || {}),
  });
}
