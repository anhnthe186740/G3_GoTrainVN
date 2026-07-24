import "dotenv/config";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.EMAIL_FROM || "GoTrain VN <onboarding@resend.dev>";
const toEmail = "duongtrongluc31072004@gmail.com";

console.log(
  "Resend API Key:",
  apiKey
    ? "Loaded (starts with " + apiKey.substring(0, 10) + "...)"
    : "Not found!",
);
console.log("From Email:", fromEmail);
console.log("To Email:", toEmail);

async function testResend() {
  if (!apiKey) {
    console.error("No RESEND_API_KEY set in env!");
    return;
  }
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        subject: "Kiểm tra kết nối Resend từ GoTrain VN",
        html: "<h1>Kết nối thành công!</h1><p>Email này được gửi tự động từ hệ thống GoTrain VN qua Resend API.</p>",
      }),
    });

    const data = await response.json();
    if (response.ok) {
      console.log("✅ Email sent successfully! ID:", data.id);
    } else {
      console.error("❌ Failed to send email:", data);
    }
  } catch (err) {
    console.error("❌ Exception occurred during fetch:", err.message);
  }
}

testResend();
