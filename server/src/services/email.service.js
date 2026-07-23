import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import nodemailer from "nodemailer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Store sent emails in the root of the server folder: server/sent_emails.json
const emailsFilePath = path.join(__dirname, "../../../sent_emails.json");

let smtpTransporter465 = null;
let smtpTransporter587 = null;

function createSmtpTransporter(port, secure) {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    family: 4, // Force IPv4
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });
}

function getTransporter465() {
  if (!smtpTransporter465) {
    smtpTransporter465 = createSmtpTransporter(465, true);
  }
  return smtpTransporter465;
}

function getTransporter587() {
  if (!smtpTransporter587) {
    smtpTransporter587 = createSmtpTransporter(587, false);
  }
  return smtpTransporter587;
}

export async function sendEmail({ to, subject, html }) {
  const senderName = process.env.EMAIL_FROM_NAME || "GoTrain VN";
  const from = `"${senderName}" <${process.env.SMTP_USER}>`;

  // 1. Primary Attempt: SMTP Port 465 (SSL/TLS)
  const preferredPort = parseInt(process.env.SMTP_PORT || "465");
  const isSecurePreferred = process.env.SMTP_SECURE !== "false";

  const primaryTransporter =
    preferredPort === 465 && isSecurePreferred
      ? getTransporter465()
      : getTransporter587();
  const secondaryTransporter =
    preferredPort === 465 && isSecurePreferred
      ? getTransporter587()
      : getTransporter465();

  if (primaryTransporter) {
    try {
      const info = await primaryTransporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log(
        `✉️  [SMTP SENT] Port ${preferredPort} | MessageID: ${info.messageId} | To: ${to} | Subject: ${subject}`,
      );
      return {
        success: true,
        provider: `SMTP-${preferredPort}`,
        emailId: info.messageId,
      };
    } catch (err) {
      console.error(
        `❌ Gửi email qua SMTP Port ${preferredPort} thất bại:`,
        err.message,
      );
    }
  }

  // 2. Secondary Attempt: Fallback SMTP Port (587 STARTTLS or 465 SSL)
  const fallbackPort = preferredPort === 465 ? 587 : 465;
  if (secondaryTransporter) {
    try {
      console.log(
        `🔄 Đang thử lại gửi qua SMTP Cổng dự phòng ${fallbackPort}...`,
      );
      const info = await secondaryTransporter.sendMail({
        from,
        to,
        subject,
        html,
      });
      console.log(
        `✉️  [SMTP FALLBACK SENT] Port ${fallbackPort} | MessageID: ${info.messageId} | To: ${to} | Subject: ${subject}`,
      );
      return {
        success: true,
        provider: `SMTP-${fallbackPort}`,
        emailId: info.messageId,
      };
    } catch (err) {
      console.error(
        `❌ Gửi email qua SMTP Port dự phòng ${fallbackPort} thất bại:`,
        err.message,
      );
    }
  }

  // 3. Fallback: Mock Email Record
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
