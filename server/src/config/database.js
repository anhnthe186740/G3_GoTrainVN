import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function connectDatabase() {
  await prisma.$connect();
  console.log("Connected to MongoDB via Prisma");
}

export { prisma };
