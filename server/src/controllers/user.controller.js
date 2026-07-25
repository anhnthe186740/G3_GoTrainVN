import { prisma } from "../config/database.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendEmail } from "../services/email.service.js";
import {
  getProfileUpdatedEmailTemplate,
  getContactFormConfirmationEmailTemplate,
  getAdminContactFormNotificationEmailTemplate,
} from "../utils/emailTemplates.js";

function calculateBackendCompleteness(u) {
  if (!u) return { percentage: 0, isComplete: false, missingFields: [] };
  const fields = [
    { key: "fullName", filled: Boolean(u.fullName), weight: 15 },
    { key: "phoneNumber", filled: Boolean(u.phoneNumber), weight: 15 },
    { key: "nationalId", filled: Boolean(u.nationalId), weight: 20 },
    { key: "dateOfBirth", filled: Boolean(u.dateOfBirth), weight: 15 },
    { key: "gender", filled: Boolean(u.gender), weight: 10 },
    { key: "address", filled: Boolean(u.address), weight: 15 },
    {
      key: "bankInfo",
      filled: Boolean(u.bankAccount && u.bankName),
      weight: 10,
    },
  ];

  const percentage = Math.min(
    100,
    fields.reduce((acc, f) => acc + (f.filled ? f.weight : 0), 0),
  );
  const missingFields = fields.filter((f) => !f.filled).map((f) => f.key);

  return {
    percentage,
    isComplete: percentage === 100,
    missingFields,
  };
}

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
      bankName: true,
      bankAccount: true,
      accountHolder: true,
    },
  });
  res.json({
    user,
    completeness: calculateBackendCompleteness(user),
  });
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
    bankName,
    bankAccount,
    accountHolder,
  } = req.body;

  const dataToUpdate = {};

  if (fullName !== undefined) dataToUpdate.fullName = fullName;
  if (phoneNumber !== undefined) dataToUpdate.phoneNumber = phoneNumber;
  if (nationalId !== undefined) dataToUpdate.nationalId = nationalId;
  if (nationalIdType !== undefined)
    dataToUpdate.nationalIdType = nationalIdType;
  if (address !== undefined) dataToUpdate.address = address;
  if (gender !== undefined) dataToUpdate.gender = gender;
  if (bankName !== undefined) dataToUpdate.bankName = bankName;
  if (bankAccount !== undefined) dataToUpdate.bankAccount = bankAccount;
  if (accountHolder !== undefined) dataToUpdate.accountHolder = accountHolder;

  if (dateOfBirth !== undefined) {
    dataToUpdate.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: dataToUpdate,
  });

  if (updatedUser.email) {
    sendEmail({
      to: updatedUser.email,
      subject: "[GoTrain VN] Cảnh báo: Thông tin hồ sơ cá nhân đã thay đổi",
      html: getProfileUpdatedEmailTemplate(
        updatedUser.fullName,
        new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      ),
    }).catch((err) => {
      console.error(
        "❌ Gửi email cảnh báo thay đổi thông tin thất bại:",
        err.message,
      );
    });
  }

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

export const submitContactForm = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !message) {
    return res.status(400).json({
      message: "Vui lòng điền đầy đủ họ tên, email và nội dung liên hệ.",
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanSubject = String(subject || "Hỗ trợ dịch vụ GoTrain VN").trim();
  const cleanMessage = String(message).trim();

  // 1. Send confirmation email to Customer
  sendEmail({
    to: cleanEmail,
    subject: `[GoTrain VN] Tiếp nhận yêu cầu hỗ trợ: ${cleanSubject}`,
    html: getContactFormConfirmationEmailTemplate(
      name,
      cleanSubject,
      cleanMessage,
    ),
  }).catch((err) => {
    console.error(
      "❌ Gửi email xác nhận hỗ trợ cho khách hàng thất bại:",
      err.message,
    );
  });

  // 2. Fetch admins and send notification emails to them
  try {
    const admins = await prisma.user.findMany({
      where: {
        userType: "ADMIN",
        isActive: true,
        deletedAt: null,
      },
      select: {
        email: true,
      },
    });

    if (admins && admins.length > 0) {
      for (const admin of admins) {
        if (admin.email) {
          sendEmail({
            to: admin.email,
            subject: `[GoTrain VN] [Admin Notice] Yêu cầu hỗ trợ mới từ khách hàng ${name}`,
            html: getAdminContactFormNotificationEmailTemplate(
              name,
              cleanEmail,
              cleanSubject,
              cleanMessage,
            ),
          }).catch((err) => {
            console.error(
              `❌ Gửi email thông báo liên hệ tới admin ${admin.email} thất bại:`,
              err.message,
            );
          });
        }
      }
    }
  } catch (error) {
    console.error(
      "❌ Truy vấn danh sách Admin để gửi mail liên hệ thất bại:",
      error.message,
    );
  }

  res.json({
    success: true,
    message:
      "Gửi yêu cầu hỗ trợ thành công. Một email xác nhận đã được gửi tới bạn.",
  });
});
