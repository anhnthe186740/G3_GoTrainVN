import "dotenv/config";
import { sendEmail } from "../src/services/email.service.js";
import {
  getWelcomeEmailTemplate,
  getBookingPendingEmailTemplate,
  getPaymentSuccessEmailTemplate,
  getCancelBookingEmailTemplate,
  getScheduleDelayEmailTemplate,
  getScheduleCancelledEmailTemplate,
  getWalletDepositEmailTemplate,
  getCheckInEmailTemplate,
  getAccountLockedEmailTemplate,
  getAccountUnlockedEmailTemplate,
  getProfileUpdatedEmailTemplate,
  getContactFormConfirmationEmailTemplate,
  getAdminContactFormNotificationEmailTemplate,
} from "../src/utils/emailTemplates.js";

const toEmail = "duongtrongluc31072004@gmail.com";

// Mock data structures matching schema relations
const mockBooking = {
  bookingCode: "GTB8472910",
  totalAmount: 480000,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 mins from now
  payosCheckoutUrl: "https://pay.payos.vn/web/test-checkout-link",
  paidAt: new Date().toISOString(),
  paymentMethod: "WALLET",
  fromStation: { stationName: "Ga Hà Nội" },
  toStation: { stationName: "Ga Vinh" },
  schedule: {
    departureTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h from now
    train: {
      trainName: "Tàu Thống Nhất SE3",
      trainCode: "SE3",
    },
  },
  passengers: [
    {
      fullName: "Dương Trọng Lực",
      passengerType: "ADULT",
      ticketCode: "GT-SE3-A12",
      carriageNumber: 4,
      seat: { seatNumber: "A12" },
      nationalId: "001204012345",
    },
    {
      fullName: "Nguyễn Văn A",
      passengerType: "CHILD",
      ticketCode: "GT-SE3-A13",
      carriageNumber: 4,
      seat: { seatNumber: "A13" },
      nationalId: "N/A",
    },
  ],
};

async function testAll13Emails() {
  console.log("🚀 Starting verification of ALL 13 email templates...");

  const emailTests = [
    {
      name: "1. Welcome Email",
      subject: "Test 1: [GoTrain VN] Chào mừng thành viên mới!",
      html: getWelcomeEmailTemplate("Dương Trọng Lực", toEmail),
    },
    {
      name: "2. Booking Pending Payment",
      subject: "Test 2: [GoTrain VN] Đặt chỗ thành công - Chờ thanh toán",
      html: getBookingPendingEmailTemplate(mockBooking),
    },
    {
      name: "3. Payment Success / E-Ticket",
      subject: "Test 3: [GoTrain VN] Xác nhận đặt vé thành công",
      html: getPaymentSuccessEmailTemplate(mockBooking),
    },
    {
      name: "4. Ticket Cancelled / Refund",
      subject: "Test 4: [GoTrain VN] Hủy vé & Hoàn tiền thành công",
      html: getCancelBookingEmailTemplate(mockBooking, 400000, 80, "WALLET"),
    },
    {
      name: "5. Train Delay Notification",
      subject:
        "Test 5: [GoTrain VN] Cập nhật lịch trình: Tàu SE3 khởi hành trễ",
      html: getScheduleDelayEmailTemplate(
        mockBooking,
        45,
        mockBooking.schedule.departureTime,
        new Date(Date.now() + 24.75 * 60 * 60 * 1000).toISOString(),
        "Ảnh hưởng bởi sự cố kỹ thuật hạ tầng đường ray phía Bắc.",
      ),
    },
    {
      name: "6. Train Cancellation Notification",
      subject: "Test 6: [GoTrain VN] Hủy chuyến tàu khẩn cấp",
      html: getScheduleCancelledEmailTemplate(
        mockBooking,
        "Ảnh hưởng bởi điều kiện thời tiết bão lũ ngập úng đường ray.",
      ),
    },
    {
      name: "7. Wallet Deposit Success",
      subject: "Test 7: [GoTrain VN] Xác nhận nạp tiền vào ví thành công",
      html: getWalletDepositEmailTemplate(
        "Dương Trọng Lực",
        500000,
        850000,
        "DEP-PAYOS-998877",
      ),
    },
    {
      name: "8. Check-In Success",
      subject: "Test 8: [GoTrain VN] Xác nhận Check-in lên tàu thành công",
      html: getCheckInEmailTemplate(
        "Dương Trọng Lực",
        "GT-SE3-A12",
        "SE3",
        "A12",
        "4",
      ),
    },
    {
      name: "9. Account Locked",
      subject: "Test 9: [GoTrain VN] Thông báo khóa tài khoản tạm thời",
      html: getAccountLockedEmailTemplate(
        "Dương Trọng Lực",
        "Có hành vi gian lận hoặc tranh chấp giao dịch thanh toán vé.",
      ),
    },
    {
      name: "10. Account Unlocked",
      subject: "Test 10: [GoTrain VN] Thông báo mở khóa tài khoản thành công",
      html: getAccountUnlockedEmailTemplate("Dương Trọng Lực"),
    },
    {
      name: "11. Profile Updated Alert",
      subject:
        "Test 11: [GoTrain VN] Cảnh báo: Thông tin hồ sơ cá nhân đã thay đổi",
      html: getProfileUpdatedEmailTemplate(
        "Dương Trọng Lực",
        new Date().toLocaleString("vi-VN"),
      ),
    },
    {
      name: "12. Support Form Confirmation",
      subject: "Test 12: [GoTrain VN] Đã tiếp nhận yêu cầu hỗ trợ của bạn",
      html: getContactFormConfirmationEmailTemplate(
        "Dương Trọng Lực",
        "Lỗi nạp tiền ví chưa cộng số dư",
        "Tôi nạp 200k qua PayOS lúc 20h nhưng ví chưa nhảy số dư. Vui lòng check giúp.",
      ),
    },
    {
      name: "13. Support Admin Notification",
      subject: "Test 13: [GoTrain VN] [Admin Notice] Có yêu cầu hỗ trợ mới",
      html: getAdminContactFormNotificationEmailTemplate(
        "Dương Trọng Lực",
        toEmail,
        "Lỗi nạp tiền ví chưa cộng số dư",
        "Tôi nạp 200k qua PayOS lúc 20h nhưng ví chưa nhảy số dư. Vui lòng check giúp.",
      ),
    },
  ];

  for (const test of emailTests) {
    try {
      console.log(`Sending: ${test.name}...`);
      const res = await sendEmail({
        to: toEmail,
        subject: test.subject,
        html: test.html,
      });
      console.log(`   👉 Sent successfully! ID: ${res.emailId}`);
    } catch (err) {
      console.error(`   ❌ Failed to send ${test.name}:`, err.message);
    }
  }

  console.log("==================================================");
  console.log("✅ Finished testing all 13 email templates!");
}

testAll13Emails();
