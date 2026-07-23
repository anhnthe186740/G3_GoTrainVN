import { registerUser, loginUser } from "../services/auth.service.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { prisma } from "../config/database.js";
import { sendEmail } from "../services/email.service.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getWelcomeEmailTemplate } from "../utils/emailTemplates.js";

export const register = asyncHandler(async (req, res) => {
  const user = await registerUser(req.body);
  res.status(201).json({
    user: {
      id: user.id,
      name: user.fullName,
      email: user.email,
      role: user.userType,
    },
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await loginUser(email, password);
  const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";
  const userAgent = req.headers["user-agent"] || "";

  if (!result) {
    // Find if user exists to link userId to the log
    const user = await prisma.user.findFirst({
      where: {
        email,
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      },
    });
    await prisma.securityLog.create({
      data: {
        userId: user?.id || null,
        eventType: "LOGIN_FAILED",
        description: `Đăng nhập thất bại cho email: ${email}`,
        ipAddress,
        userAgent,
        status: "FAILURE",
      },
    });
    return res.status(401).json({ message: "Invalid credentials" });
  }

  await prisma.securityLog.create({
    data: {
      userId: result.user.id,
      eventType: "LOGIN_SUCCESS",
      description: `Đăng nhập thành công với email: ${email}`,
      ipAddress,
      userAgent,
      status: "SUCCESS",
    },
  });

  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("token", result.token, {
    httpOnly: true,
    sameSite: isProduction ? "none" : "lax",
    secure: isProduction,
  });
  res.json({ user: result.user, token: result.token });
});

// Request password reset email
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: "Vui lòng cung cấp địa chỉ email" });
  }

  const user = await prisma.user.findFirst({
    where: {
      email,
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    },
  });

  if (!user) {
    return res
      .status(404)
      .json({ message: "Không tìm thấy người dùng có địa chỉ email này" });
  }

  // Generate reset token
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 3600000); // 1 hour expiry

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetPasswordToken: token,
      resetPasswordExpires: expires,
    },
  });

  const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
  const resetLink = `${clientUrl}/reset-password?token=${token}`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #bec7d4; border-radius: 12px; background-color: #ffffff;">
      <h2 style="color: #00629d; text-align: center;">Yêu cầu khôi phục mật khẩu</h2>
      <p>Xin chào <strong>${user.fullName}</strong>,</p>
      <p>Chúng tôi đã nhận được yêu cầu đặt lại mật khẩu cho tài khoản GoTrain VN của bạn.</p>
      <p>Vui lòng nhấn vào nút bên dưới để tiến hành đặt mật khẩu mới (Mã khôi phục này có hiệu lực trong vòng 1 giờ):</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #00629d; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Đặt lại mật khẩu</a>
      </div>
      <p style="font-size: 12px; color: #3f4852;">Nếu bạn không yêu cầu điều này, xin vui lòng bỏ qua email này. Mật khẩu của bạn sẽ không thay đổi.</p>
      <hr style="border: 0; border-top: 1px solid #bec7d4; margin: 20px 0;" />
      <p style="font-size: 11px; text-align: center; color: #6f7883;">Hệ thống đặt vé tàu trực tuyến GoTrain VN</p>
    </div>
  `;

  await sendEmail({
    to: user.email,
    subject: "[GoTrain VN] Hướng dẫn đặt lại mật khẩu tài khoản",
    html,
  });

  await prisma.securityLog.create({
    data: {
      userId: user.id,
      eventType: "PASSWORD_RESET_REQUEST",
      description: `Yêu cầu khôi phục mật khẩu gửi tới email ${email}`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      userAgent: req.headers["user-agent"] || "",
      status: "SUCCESS",
    },
  });

  res.json({
    success: true,
    message: "Email hướng dẫn khôi phục mật khẩu đã được gửi đi.",
  });
});

// Update password using token
export const resetPassword = asyncHandler(async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ message: "Thiếu thông tin bắt buộc" });
  }

  if (password.length < 8) {
    return res
      .status(400)
      .json({ message: "Mật khẩu phải từ 8 ký tự trở lên" });
  }

  // Find user by valid, unexpired token
  const user = await prisma.user.findFirst({
    where: {
      resetPasswordToken: token,
      resetPasswordExpires: {
        gt: new Date(),
      },
      OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
    },
  });

  if (!user) {
    return res
      .status(400)
      .json({ message: "Mã khôi phục mật khẩu không hợp lệ hoặc đã hết hạn" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
    },
  });

  await prisma.securityLog.create({
    data: {
      userId: user.id,
      eventType: "PASSWORD_CHANGE",
      description: `Thay đổi mật khẩu thành công qua token khôi phục`,
      ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
      userAgent: req.headers["user-agent"] || "",
      status: "SUCCESS",
    },
  });

  // Send password change notification email
  sendEmail({
    to: user.email,
    subject:
      "[GoTrain VN] Mật khẩu tài khoản của bạn đã được thay đổi thành công",
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
        <div style="text-align: center; margin-bottom: 25px;">
          <h1 style="color: #00629d; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">GoTrain VN</h1>
          <p style="color: #64748b; margin: 5px 0 0 0; font-size: 14px;">Cảnh báo bảo mật tài khoản</p>
        </div>
        <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 20px;">
          <h2 style="color: #0f172a; margin: 0 0 10px 0; font-size: 18px; font-weight: 700;">Thay đổi mật khẩu thành công</h2>
          <p style="margin: 0; line-height: 1.6; font-size: 14px; color: #475569;">
            Xin chào <strong>${user.fullName}</strong>,<br/>
            Mật khẩu cho tài khoản GoTrain VN (<strong>${user.email}</strong>) của bạn vừa được cập nhật thành công vào lúc <strong>${new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</strong>.
          </p>
        </div>
        <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 12px; padding: 15px 20px; margin-bottom: 25px;">
          <p style="margin: 0; font-size: 13px; color: #991b1b; line-height: 1.5;">
            <strong>Lưu ý bảo mật:</strong> Nếu bạn không thực hiện yêu cầu thay đổi mật khẩu này, vui lòng liên hệ ngay với bộ phận hỗ trợ GoTrain VN để được hỗ trợ khóa và bảo vệ tài khoản khẩn cấp.
          </p>
        </div>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 25px 0;" />
        <div style="text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
          <p style="margin: 0 0 5px 0;">Email này được gửi tự động từ hệ thống GoTrain VN.</p>
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} GoTrain VN. Mọi quyền được bảo lưu.</p>
        </div>
      </div>
    `,
  }).catch((err) =>
    console.error("❌ Gửi email cảnh báo đổi mật khẩu thất bại:", err.message),
  );

  res.json({
    success: true,
    message:
      "Đặt lại mật khẩu thành công. Bạn có thể đăng nhập bằng mật khẩu mới.",
  });
});

// Verify Google Token & Sign In/Sign Up
export const googleLogin = asyncHandler(async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res
      .status(400)
      .json({ message: "Thiếu credential xác thực từ Google" });
  }

  try {
    const googleResponse = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`,
    );
    if (!googleResponse.ok) {
      throw new Error(`Google API returned status ${googleResponse.status}`);
    }

    const payload = await googleResponse.json();

    const expectedClientId = process.env.GOOGLE_CLIENT_ID;
    if (expectedClientId && payload.aud !== expectedClientId) {
      return res.status(401).json({
        message: "Xác thực token Google thất bại (Client ID không khớp)",
      });
    }

    const { email, name, email_verified } = payload;
    if (!email_verified) {
      return res
        .status(400)
        .json({ message: "Tài khoản Google chưa được xác minh" });
    }

    let user = await prisma.user.findFirst({
      where: {
        email,
        OR: [{ deletedAt: null }, { deletedAt: { isSet: false } }],
      },
    });

    if (user) {
      if (!user.isActive) {
        await prisma.securityLog.create({
          data: {
            userId: user.id,
            eventType: "LOGIN_FAILED",
            description: `Đăng nhập Google thất bại do tài khoản bị khóa. Lý do: ${user.lockReason || "Không rõ lý do"}`,
            ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
            userAgent: req.headers["user-agent"] || "",
            status: "FAILURE",
          },
        });
        return res.status(403).json({
          message: `Tài khoản đã bị khóa. Lý do: ${user.lockReason || "Không rõ lý do"}`,
        });
      }
    } else {
      const randomPassword = crypto.randomBytes(16).toString("hex");
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = await prisma.user.create({
        data: {
          email,
          fullName: name || "Google User",
          phoneNumber: "N/A",
          password: hashedPassword,
          userType: "CUSTOMER",
          isActive: true,
          wallet: {
            create: {
              balance: 0,
            },
          },
        },
      });

      // Send welcome email asynchronously for Google login registration
      sendEmail({
        to: user.email,
        subject: `[GoTrain VN] Chào mừng ${user.fullName} tham gia GoTrain VN!`,
        html: getWelcomeEmailTemplate(user.fullName, user.email),
      }).catch((err) => {
        console.error(
          "❌ Gửi email chào mừng Google Login thất bại:",
          err.message,
        );
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    const token = jwt.sign(
      { id: user.id, role: user.userType },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" },
    );

    await prisma.securityLog.create({
      data: {
        userId: user.id,
        eventType: "LOGIN_SUCCESS",
        description: `Đăng nhập Google thành công với email: ${email}`,
        ipAddress: req.ip || req.headers["x-forwarded-for"] || "",
        userAgent: req.headers["user-agent"] || "",
        status: "SUCCESS",
      },
    });

    const isProduction = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: true,
      sameSite: isProduction ? "none" : "lax",
      secure: isProduction,
    });
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.fullName,
        email: user.email,
        role: user.userType,
        loyaltyPoints: user.loyaltyPoints || 0,
      },
    });
  } catch (error) {
    console.error("❌ Google login token verification failed:", error.message);
    const ipAddress = req.ip || req.headers["x-forwarded-for"] || "";
    const userAgent = req.headers["user-agent"] || "";
    await prisma.securityLog.create({
      data: {
        userId: null,
        eventType: "LOGIN_FAILED",
        description: `Đăng nhập Google thất bại: ${error.message}`,
        ipAddress,
        userAgent,
        status: "FAILURE",
      },
    });
    return res
      .status(401)
      .json({ message: "Xác thực tài khoản Google thất bại" });
  }
});
