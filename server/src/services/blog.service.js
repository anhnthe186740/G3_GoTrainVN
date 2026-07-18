import { prisma } from "../config/database.js";

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export async function createBlogPost({ title, summary, content, authorId }) {
  if (!title || !content) {
    throw httpError(400, "Tiêu đề và Nội dung bài viết không được để trống.");
  }

  // Ensure author exists
  const author = await prisma.user.findUnique({
    where: { id: authorId },
  });

  if (!author) {
    throw httpError(404, "Không tìm thấy thông tin tác giả.");
  }

  const post = await prisma.blogPost.create({
    data: {
      title,
      summary: summary || content.substring(0, 150) + "...",
      content,
      authorId,
    },
    include: {
      author: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  return post;
}

export async function getAllBlogPosts() {
  const posts = await prisma.blogPost.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      author: {
        select: {
          fullName: true,
          email: true,
        },
      },
    },
  });

  return posts;
}
