import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const profile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const { fullName, phoneNumber, nationalId, nationalIdType, dateOfBirth, gender, address } = req.body;

  const dataToUpdate = {};

  if (fullName !== undefined) dataToUpdate.fullName = fullName;
  if (phoneNumber !== undefined) dataToUpdate.phoneNumber = phoneNumber;
  if (nationalId !== undefined) dataToUpdate.nationalId = nationalId;
  if (nationalIdType !== undefined) dataToUpdate.nationalIdType = nationalIdType;
  if (address !== undefined) dataToUpdate.address = address;
  if (gender !== undefined) dataToUpdate.gender = gender;

  if (dateOfBirth !== undefined) {
    dataToUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: dataToUpdate,
  });

  res.json({
    success: true,
    message: "Cập nhật hồ sơ thành công",
    user: updatedUser,
  });
});
