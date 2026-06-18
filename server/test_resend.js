import dotenv from "dotenv";
dotenv.config();
import { sendEmail } from "./src/services/email.service.js";

async function run() {
  const email = process.argv[2];
  if (!email) {
    console.error("Vui lòng cung cấp email nhận: node test_resend.js <email>");
    process.exit(1);
  }
  console.log(`Đang thử gửi email tới: ${email}...`);
  const result = await sendEmail({
    to: email,
    subject: "Thử nghiệm dịch vụ gửi mail Resend - GoTrain VN",
    html: "<h3>Xin chào!</h3><p>Đây là email thử nghiệm gửi từ GoTrain VN sử dụng Resend API.</p>",
  });
  console.log("Kết quả:", result);
}
run().catch(console.error);
