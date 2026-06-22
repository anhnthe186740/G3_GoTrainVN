import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";
import { sendEmail } from "./email.service.js";
import { getWelcomeEmailTemplate } from "../utils/emailTemplates.js";

export async function registerUser(data) {
  const password = await bcrypt.hash(data.password, 10);
  const user = await prisma.user.create({ data: { ...data, password } });

  // Send welcome email asynchronously without blocking the registration response
  sendEmail({
    to: user.email,
    subject: `[GoTrain VN] Chào mừng ${user.fullName} tham gia GoTrain VN!`,
    html: getWelcomeEmailTemplate(user.fullName, user.email),
  }).catch((err) => {
    console.error("❌ Gửi email chào mừng đăng ký thất bại:", err.message);
  });

  return user;
}

export async function loginUser(email, password) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return null;
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return null;
  const token = jwt.sign(
    { id: user.id, role: user.userType },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
  );
  return {
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.userType,
    },
    token,
  };
}
