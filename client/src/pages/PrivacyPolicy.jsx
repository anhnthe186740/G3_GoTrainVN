import {
  Shield,
  Lock,
  Eye,
  CheckCircle,
  Mail,
  Phone,
  MapPin,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export function PrivacyPolicy() {
  const { language } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex text-xs font-semibold text-slate-500 gap-1.5 items-center">
          <Link to="/" className="hover:text-primary transition-colors">
            {language === "vi" ? "Trang chủ" : "Home"}
          </Link>
          <span>/</span>
          <span className="text-slate-800">
            {language === "vi" ? "Chính sách bảo mật" : "Privacy Policy"}
          </span>
        </nav>

        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#004c7a] to-[#00629d] p-8 md:p-12 text-white shadow-xl mb-8">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-60 h-60 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur border border-white/20 text-[#b3d4f0] uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                {language === "vi"
                  ? "Bảo vệ thông tin"
                  : "Information Protection"}
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tight text-left">
                {language === "vi" ? "Chính Sách Bảo Mật" : "Privacy Policy"}
              </h1>
              <p className="mt-2 text-sm text-[#b3d4f0]/90 max-w-lg leading-relaxed text-left">
                {language === "vi"
                  ? "Tại GoTrain VN, chúng tôi cam kết bảo vệ thông tin cá nhân và quyền riêng tư của hành khách lên hàng đầu. Dưới đây là cách chúng tôi thu thập, sử dụng và bảo mật dữ liệu của bạn."
                  : "At GoTrain VN, we put protecting passenger personal information and privacy first. Below is how we collect, use, and secure your data."}
              </p>
            </div>
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
              <Lock className="w-10 h-10 text-[#b3d4f0]" />
            </div>
          </div>
        </div>

        {/* Policy Content */}
        {language === "vi" ? (
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 md:p-10 space-y-8 text-slate-700 leading-relaxed text-sm text-left">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                1. Thông tin chúng tôi thu thập
              </h2>
              <p>
                Để cung cấp dịch vụ đặt vé tàu điện tử tốt nhất, chúng tôi thu
                thập các loại thông tin sau của khách hàng:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {[
                  {
                    title: "Thông tin cá nhân cơ bản",
                    desc: "Họ và tên, ngày sinh, giới tính để in lên thẻ lên tàu đúng quy định của Tổng công ty Đường sắt.",
                  },
                  {
                    title: "Thông tin liên hệ",
                    desc: "Email và Số điện thoại để gửi mã đặt chỗ, hóa đơn thanh toán và các cập nhật trễ/hủy chuyến tàu.",
                  },
                  {
                    title: "Giấy tờ định danh",
                    desc: "Số CCCD, Hộ chiếu hoặc mã thẻ Sinh viên/Người cao tuổi để áp dụng chính sách giảm giá phù hợp.",
                  },
                  {
                    title: "Dữ liệu giao dịch & Ví",
                    desc: "Lịch sử mua vé, nạp/rút tiền qua Ví điện tử và giao dịch ngân hàng để xử lý thanh toán và hoàn tiền.",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1 text-left"
                  >
                    <span className="font-bold text-slate-800 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      {item.title}
                    </span>
                    <span className="text-slate-500 text-xs">{item.desc}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                2. Cách thức chúng tôi sử dụng thông tin
              </h2>
              <p>
                Chúng tôi chỉ sử dụng thông tin cá nhân của bạn vào những mục
                đích hợp pháp và minh bạch sau:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Xử lý giao dịch đặt giữ chỗ, xuất vé điện tử và gửi hóa đơn
                  xác nhận.
                </li>
                <li>
                  Xác thực danh tính hành khách khi soát vé tại ga và lên toa
                  tàu.
                </li>
                <li>
                  Thông báo các thay đổi quan trọng về lịch trình tàu chạy (trễ
                  chuyến, thay đổi ga đón, hủy chuyến đột xuất).
                </li>
                <li>
                  Cung cấp tính năng chăm sóc khách hàng, hỗ trợ đổi trả vé và
                  giải quyết tranh chấp hoàn tiền.
                </li>
                <li>
                  Tích lũy điểm thưởng thành viên và gửi các ưu đãi cá nhân hóa
                  (quà tặng sinh nhật, voucher nâng hạng).
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                3. Bảo mật thông tin khách hàng
              </h2>
              <p>
                Chúng tôi áp dụng các tiêu chuẩn công nghệ bảo mật cao nhất để
                bảo vệ dữ liệu của bạn trước việc truy cập, thay đổi, tiết lộ
                hoặc phá hủy trái phép:
              </p>
              <div className="flex gap-4 items-start bg-blue-50/50 border border-blue-100 p-4 rounded-2xl mt-2">
                <Lock className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <span className="font-bold text-blue-900 block">
                    Công nghệ mã hóa cao cấp
                  </span>
                  <span className="text-blue-800/80 leading-relaxed block">
                    Toàn bộ thông tin nhạy cảm (mật khẩu, CCCD, thông tin ngân
                    hàng) đều được băm và mã hóa bằng các thuật toán hiện đại
                    trước khi lưu trữ vào cơ sở dữ liệu. Mọi kết nối truyền tải
                    thông tin đều được bảo mật qua giao thức SSL/HTTPS.
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                4. Chia sẻ thông tin với bên thứ ba
              </h2>
              <p>
                GoTrain VN cam kết **không mua bán, trao đổi hoặc tiết lộ thông
                tin** của bạn cho bất kỳ bên thứ ba nào vì mục đích quảng cáo
                thương mại. Chúng tôi chỉ chia sẻ dữ liệu trong các trường hợp
                cực kỳ hạn chế:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Chia sẻ mã giao dịch với đối tác cổng thanh toán (PayOS) để xử
                  lý việc chuyển khoản ngân hàng.
                </li>
                <li>
                  Khi có yêu cầu bằng văn bản chính thức của cơ quan pháp luật
                  nhà nước có thẩm quyền trong các trường hợp khẩn cấp hoặc
                  phòng chống tội phạm.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                5. Quyền lợi của bạn đối với dữ liệu
              </h2>
              <p>
                Là người dùng dịch vụ, bạn có toàn quyền kiểm soát thông tin cá
                nhân của mình:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  **Xem & Cập nhật:** Bạn có thể tự chỉnh sửa thông tin liên hệ,
                  mật khẩu tại trang Cá nhân.
                </li>
                <li>
                  **Xóa dữ liệu:** Bạn có quyền gửi yêu cầu hỗ trợ tới ban quản
                  trị để thực hiện xóa hoặc vô hiệu hóa tài khoản vĩnh viễn.
                </li>
              </ul>
            </section>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 md:p-10 space-y-8 text-slate-700 leading-relaxed text-sm text-left">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                1. Information We Collect
              </h2>
              <p>
                To provide the best electronic ticket booking services, we
                collect the following types of customer data:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                {[
                  {
                    title: "Basic Personal Information",
                    desc: "Full name, date of birth, and gender to print on the boarding pass as required by Railway regulations.",
                  },
                  {
                    title: "Contact Details",
                    desc: "Email and Phone number to send booking codes, payment invoices, and updates on delays or cancellations.",
                  },
                  {
                    title: "Identity Documents",
                    desc: "ID number, Passport, or Student/Senior card code to apply correct discount policies.",
                  },
                  {
                    title: "Transaction & Wallet Data",
                    desc: "Booking history, deposits/withdrawals via E-wallet, and bank transactions to process payments and refunds.",
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1 text-left"
                  >
                    <span className="font-bold text-slate-800 flex items-center gap-1.5 text-left">
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                      {item.title}
                    </span>
                    <span className="text-slate-500 text-xs text-left">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                2. How We Use Your Information
              </h2>
              <p>
                We only use your personal details for the following legitimate
                and transparent purposes:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Process booking transactions, issue electronic tickets, and
                  send confirmation receipts.
                </li>
                <li>
                  Verify passenger identity during station ticket checks and
                  carriage boarding.
                </li>
                <li>
                  Notify you about important schedule modifications (delays,
                  station adjustments, emergency cancellations).
                </li>
                <li>
                  Provide customer care support, handle refund/exchange
                  requests, and resolve refund disputes.
                </li>
                <li>
                  Calculate loyalty reward points and deliver personalized
                  offers (birthday perks, rank vouchers).
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                3. Customer Data Security
              </h2>
              <p>
                We implement the highest security technology standards to
                safeguard your data from unauthorized access, modification,
                disclosure, or destruction:
              </p>
              <div className="flex gap-4 items-start bg-blue-50/50 border border-blue-100 p-4 rounded-2xl mt-2 text-left">
                <Lock className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-left">
                  <span className="font-bold text-blue-900 block text-left">
                    Advanced Encryption Technology
                  </span>
                  <span className="text-blue-800/80 leading-relaxed block text-left">
                    All sensitive information (passwords, ID numbers, bank
                    details) are hashed and encrypted using modern algorithms
                    before being stored in the database. All connection paths
                    transfer information securely via SSL/HTTPS.
                  </span>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                4. Third-Party Data Sharing
              </h2>
              <p>
                GoTrain VN commits to **never sell, trade, or disclose your
                information** to any third parties for commercial advertising
                purposes. We only share data in highly restricted circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Share transaction codes with payment gateway partners (PayOS)
                  to verify bank transfers.
                </li>
                <li>
                  Upon official written request by state law enforcement
                  agencies in emergency or crime-prevention scenarios.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                5. Your Data Rights
              </h2>
              <p>
                As a user of our services, you maintain full control over your
                personal data:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  **View & Update:** You can edit your contact details and
                  account password on your Profile page.
                </li>
                <li>
                  **Delete Data:** You have the right to request support staff
                  to permanently delete or deactivate your account.
                </li>
              </ul>
            </section>
          </div>
        )}

        {/* Contact Support */}
        <div className="bg-[#f7f9fb] border border-slate-200/50 rounded-2.5xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 mt-8 text-left">
          <div className="space-y-1">
            <span className="font-bold text-slate-800 block text-base text-left">
              {language === "vi"
                ? "Bạn có thắc mắc về chính sách bảo mật?"
                : "Questions about our Privacy Policy?"}
            </span>
            <span className="text-slate-500 text-xs block text-left">
              {language === "vi"
                ? "Đội ngũ hỗ trợ quyền riêng tư của chúng tôi luôn sẵn sàng lắng nghe bạn."
                : "Our privacy support team is always here to listen and help."}
            </span>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("open-contact-modal"));
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-primary/20 text-slate-700 hover:text-primary rounded-xl font-bold text-xs shadow-sm transition-all border-none cursor-pointer"
            >
              <Mail className="w-4 h-4 text-primary" />
              {language === "vi" ? "Email hỗ trợ" : "Support Email"}
            </button>
            <a
              href="tel:0975230204"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-[#00527f] text-white rounded-xl font-bold text-xs shadow-md transition-all text-decoration-none"
            >
              <Phone className="w-4 h-4 text-white" />
              {language === "vi"
                ? "Hotline 0975 230 204"
                : "Hotline 0975 230 204"}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
