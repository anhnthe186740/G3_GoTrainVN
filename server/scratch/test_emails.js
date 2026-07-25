import "dotenv/config";
import { sendEmail } from "../src/services/email.service.js";
import {
  getWalletDepositEmailTemplate,
  getCheckInEmailTemplate,
  getAccountLockedEmailTemplate,
  getAccountUnlockedEmailTemplate,
  getProfileUpdatedEmailTemplate,
  getContactFormConfirmationEmailTemplate,
  getAdminContactFormNotificationEmailTemplate,
} from "../src/utils/emailTemplates.js";

const toEmail = "duongtrongluc31072004@gmail.com";

async function runTest() {
  console.log(
    "🚀 Starting verification of 5 new transactional email templates...",
  );

  try {
    // 1. Wallet Deposit
    console.log("Sending Wallet Deposit email...");
    await sendEmail({
      to: toEmail,
      subject: "Test: [GoTrain VN] Xác nhận nạp tiền vào ví thành công",
      html: getWalletDepositEmailTemplate(
        "Dương Trọng Lực",
        200000,
        350000,
        "DEP-PAYOS-123456",
      ),
    });

    // 2. Check-In Boarding
    console.log("Sending Check-in Boarding email...");
    await sendEmail({
      to: toEmail,
      subject: "Test: [GoTrain VN] Xác nhận Check-in lên tàu thành công",
      html: getCheckInEmailTemplate(
        "Dương Trọng Lực",
        "GT-SE3-ABCD",
        "SE3",
        "A12",
        "4",
      ),
    });

    // 3. Account Locked
    console.log("Sending Account Locked email...");
    await sendEmail({
      to: toEmail,
      subject: "Test: [GoTrain VN] Thông báo khóa tài khoản tạm thời",
      html: getAccountLockedEmailTemplate(
        "Dương Trọng Lực",
        "Phát hiện hành vi giao dịch ví bất thường hoặc tranh chấp thanh toán.",
      ),
    });

    // 4. Account Unlocked
    console.log("Sending Account Unlocked email...");
    await sendEmail({
      to: toEmail,
      subject: "Test: [GoTrain VN] Thông báo mở khóa tài khoản thành công",
      html: getAccountUnlockedEmailTemplate("Dương Trọng Lực"),
    });

    // 5. Profile Updated
    console.log("Sending Profile Updated email...");
    await sendEmail({
      to: toEmail,
      subject:
        "Test: [GoTrain VN] Cảnh báo: Thông tin hồ sơ cá nhân đã thay đổi",
      html: getProfileUpdatedEmailTemplate(
        "Dương Trọng Lực",
        new Date().toLocaleString("vi-VN"),
      ),
    });

    // 6. Contact Form Confirmation
    console.log("Sending Contact Form Confirmation email...");
    await sendEmail({
      to: toEmail,
      subject: "Test: [GoTrain VN] Tiếp nhận yêu cầu hỗ trợ",
      html: getContactFormConfirmationEmailTemplate(
        "Dương Trọng Lực",
        "Hỏi về hoàn tiền vé tàu trễ",
        "Tôi muốn hỏi thời gian hoàn tiền vào ví sau khi tàu bị trễ chuyến là bao lâu?",
      ),
    });

    console.log("✅ All test emails queued successfully!");
  } catch (err) {
    console.error("❌ Test failed with error:", err.message);
  }
}

runTest();
