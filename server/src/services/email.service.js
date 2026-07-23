import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store sent emails in the root of the server folder: server/sent_emails.json
const emailsFilePath = path.join(__dirname, "../../../sent_emails.json");

let smtpTransporter = null;

function getSmtpTransporter() {
  if (!smtpTransporter && process.env.SMTP_USER && process.env.SMTP_PASS) {
    smtpTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      family: 4, // Force IPv4 to prevent ENETUNREACH on environments without IPv6 support (e.g., Render)
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return smtpTransporter;
}

export async function sendEmail({ to, subject, html }) {
  // Option 1: Priority 1 - Send via SMTP (Nodemailer) if SMTP_USER is configured
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = getSmtpTransporter();
      const senderName = process.env.EMAIL_FROM_NAME || "GoTrain VN";
      const info = await transporter.sendMail({
        from: `"${senderName}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html,
      });

      console.log(
        `✉️  [SMTP EMAIL SENT] MessageID: ${info.messageId} | To: ${to} | Subject: ${subject}`,
      );
      return { success: true, provider: "SMTP", emailId: info.messageId };
    } catch (err) {
      console.error("❌ Gửi email qua SMTP thất bại:", err.message);
      console.log("⚠️  Đang tự động chuyển sang kiểm tra cấu hình Resend...");
    }
  }

  // Option 2: Priority 2 - Send via Resend API
  if (process.env.RESEND_API_KEY) {
    try {
      const fromEmail =
        process.env.EMAIL_FROM || "GoTrain VN <onboarding@resend.dev>";
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          html,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.message || `Resend API Error (HTTP ${response.status})`,
        );
      }

      console.log(
        `✉️  [RESEND EMAIL SENT] ID: ${data.id} | To: ${to} | Subject: ${subject}`,
      );
      return { success: true, provider: "RESEND", emailId: data.id };
    } catch (err) {
      console.error("❌ Gửi email qua Resend API thất bại:", err.message);
      if (
        err.message.includes("validation_error") ||
        err.message.includes("can only send to your own email")
      ) {
        console.warn(
          "💡 Ghi chú Resend Free Tier: Tài khoản Resend thử nghiệm (onboarding@resend.dev) chỉ cho phép gửi tới Email đăng ký tài khoản Resend.",
        );
      }
      console.log(
        "⚠️  Đang tự động chuyển sang lưu email giả lập (sent_emails.json)...",
      );
    }
  }

  // Option 3: Priority 3 - Mock Email Fallback
  const timestamp = new Date().toISOString();
  const emailRecord = {
    id: `email-${Math.random().toString(36).substr(2, 9)}`,
    to,
    subject,
    html,
    sentAt: timestamp,
  };

  // 1. Log to console in a nice formatted box
  console.log("\n" + "=".repeat(60));
  console.log(`✉️  [MOCK EMAIL SENT]`);
  console.log(`   To:      ${to}`);
  console.log(`   Subject: ${subject}`);
  console.log(`   Time:    ${timestamp}`);
  console.log("-".repeat(60));
  console.log(
    html
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ); // Strip HTML for console reading
  console.log("=".repeat(60) + "\n");

  // 2. Write to server/sent_emails.json
  try {
    let currentEmails = [];
    try {
      const fileContent = await fs.readFile(emailsFilePath, "utf-8");
      currentEmails = JSON.parse(fileContent);
      if (!Array.isArray(currentEmails)) {
        currentEmails = [];
      }
    } catch (err) {
      // File doesn't exist yet, we will start with empty array
    }

    currentEmails.push(emailRecord);
    await fs.writeFile(
      emailsFilePath,
      JSON.stringify(currentEmails, null, 2),
      "utf-8",
    );
  } catch (err) {
    console.error("❌ Không thể ghi vào file sent_emails.json:", err.message);
  }

  return { success: true, provider: "MOCK", emailId: emailRecord.id };
}
