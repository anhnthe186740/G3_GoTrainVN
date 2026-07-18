import { createBlogPost, getAllBlogPosts } from "../services/blog.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const getBlogs = asyncHandler(async (req, res) => {
  const posts = await getAllBlogPosts();
  res.json({
    success: true,
    posts,
  });
});

export const createBlog = asyncHandler(async (req, res) => {
  const { title, summary, content } = req.body;
  const authorId = req.user.id;

  const post = await createBlogPost({
    title,
    summary,
    content,
    authorId,
  });

  res.status(201).json({
    success: true,
    message: "Đăng bài viết chia sẻ thành công.",
    post,
  });
});
