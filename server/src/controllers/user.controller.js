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
      nationalId: true,
      nationalIdType: true,
      dateOfBirth: true,
      gender: true,
      address: true,
      loyaltyPoints: true,
      userType: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  res.json({ user });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const {
    fullName,
    phoneNumber,
    nationalId,
    nationalIdType,
    dateOfBirth,
    gender,
    address,
  } = req.body;

  const dataToUpdate = {};

  if (fullName !== undefined) dataToUpdate.fullName = fullName;
  if (phoneNumber !== undefined) dataToUpdate.phoneNumber = phoneNumber;
  if (nationalId !== undefined) dataToUpdate.nationalId = nationalId;
  if (nationalIdType !== undefined)
    dataToUpdate.nationalIdType = nationalIdType;
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

export const searchCustomerForStaff = asyncHandler(async (req, res) => {
  const phone = String(req.query.phone || "").replace(/\s/g, "");
  if (!/^(0|\+84)\d{9,10}$/.test(phone)) {
    return res.status(400).json({
      message: "Nhập số điện thoại khách hàng hợp lệ để tra cứu.",
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      phoneNumber: phone,
      userType: "CUSTOMER",
      isActive: true,
      deletedAt: null,
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      nationalId: true,
      nationalIdType: true,
      dateOfBirth: true,
      loyaltyPoints: true,
    },
  });

  res.json({ user });
});
