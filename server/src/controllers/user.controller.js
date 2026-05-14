import { prisma } from "../config/prisma.js";

export async function profile(req, res) {
  const user = await prisma.user.findUnique({ where: { id: req.user.id } });
  res.json({ user });
}
