import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const profile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      userType: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json({ user });
});
