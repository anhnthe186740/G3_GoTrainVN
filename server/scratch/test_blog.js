import { PrismaClient } from "@gotrain/prisma-client-v2";
const prisma = new PrismaClient();

async function main() {
  console.log("Querying blog posts...");
  const posts = await prisma.blogPost.findMany({
    include: {
      author: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });
  console.log("Number of posts:", posts.length);
  console.log("Posts:", JSON.stringify(posts, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
