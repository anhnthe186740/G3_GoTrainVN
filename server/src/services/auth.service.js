import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database.js";

export async function registerUser(data) {
  const password = await bcrypt.hash(data.password, 10);
  return prisma.user.create({ data: { ...data, password } });
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
