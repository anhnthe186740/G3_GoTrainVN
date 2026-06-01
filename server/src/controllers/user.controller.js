import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const profile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user });
});
