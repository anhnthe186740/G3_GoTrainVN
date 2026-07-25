import {
  FileText,
  AlertTriangle,
  ShieldCheck,
  Mail,
  Phone,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

export function TermsOfService() {
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
            {language === "vi" ? "Điều khoản dịch vụ" : "Terms of Service"}
          </span>
        </nav>

        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#004c7a] to-[#00629d] p-8 md:p-12 text-white shadow-xl mb-8">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-60 h-60 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur border border-white/20 text-[#b3d4f0] uppercase tracking-wider">
                <FileText className="w-3.5 h-3.5" />
                {language === "vi" ? "Hợp đồng sử dụng" : "User Agreement"}
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tight text-left">
                {language === "vi" ? "Điều Khoản Dịch Vụ" : "Terms of Service"}
              </h1>
              <p className="mt-2 text-sm text-[#b3d4f0]/90 max-w-lg leading-relaxed text-left">
                {language === "vi"
                  ? "Chào mừng bạn đến với GoTrain VN. Việc sử dụng website và đặt vé tàu của chúng tôi đồng nghĩa với việc bạn đồng ý tuân thủ các điều khoản và quy định dưới đây."
                  : "Welcome to GoTrain VN. Your use of our website and ticket booking services signifies your agreement to abide by the terms and conditions set forth below."}
              </p>
            </div>
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
              <ShieldCheck className="w-10 h-10 text-[#b3d4f0]" />
            </div>
          </div>
        </div>

        {/* Terms Content */}
        {language === "vi" ? (
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 md:p-10 space-y-8 text-slate-700 leading-relaxed text-sm text-left">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                1. Chấp thuận các điều khoản
              </h2>
              <p>
                Bằng việc truy cập, tạo tài khoản và sử dụng hệ thống đặt vé
                điện tử **GoTrain VN**, bạn xác nhận đã đọc, hiểu và đồng ý hoàn
                toàn bị ràng buộc bởi các quy định này. Nếu bạn không đồng ý với
                bất kỳ phần nào của điều khoản này, vui lòng ngừng sử dụng trang
                web của chúng tôi ngay lập tức.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                2. Đăng ký và bảo mật tài khoản
              </h2>
              <p>
                Khi đăng ký tài khoản tại GoTrain VN, bạn cần cam kết cung cấp
                thông tin cá nhân (họ tên, email, số điện thoại) một cách chính
                xác nhất:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Bạn chịu trách nhiệm bảo mật mật khẩu và quản lý hoạt động
                  truy cập tài khoản của mình.
                </li>
                <li>
                  Bạn đồng ý thông báo ngay lập tức cho chúng tôi nếu phát hiện
                  bất kỳ hành vi xâm nhập hoặc sử dụng tài khoản trái phép nào.
                </li>
                <li>
                  Chúng tôi có quyền khóa hoặc chấm dứt tài khoản nếu phát hiện
                  thông tin đăng ký sai lệch hoặc tài khoản vi phạm các chính
                  sách chung.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                3. Quy định đặt vé và thanh toán
              </h2>
              <p>
                Quy trình đặt vé điện tử và xử lý thanh toán trên hệ thống tuân
                theo các nguyên tắc sau:
              </p>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3.5 items-start mt-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-850">
                  <span className="font-bold text-amber-900 block text-left">
                    Thời gian hết hạn giữ chỗ
                  </span>
                  <span className="leading-relaxed block text-left">
                    Sau khi đặt chỗ thành công, ghế của bạn sẽ được giữ tạm thời
                    trong vòng **10 phút**. Nếu quá thời gian này bạn không hoàn
                    tất thanh toán (qua PayOS hoặc Ví điện tử), vé sẽ tự động bị
                    hủy và ghế sẽ được mở lại công khai cho người khác đặt.
                  </span>
                </div>
              </div>
              <p className="mt-2 text-left">
                Vé điện tử chỉ được phát hành chính thức sau khi hệ thống của
                chúng tôi nhận được xác nhận thanh toán thành công từ cổng thanh
                toán.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                4. Chính sách hoàn, đổi vé tàu trực tuyến
              </h2>
              <p>
                Việc hoàn vé hoặc đổi vé của hành khách được tính toán tự động
                dựa trên thời gian so với giờ khởi hành của tàu:
              </p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 mt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                      <th className="p-3">Thời gian yêu cầu</th>
                      <th className="p-3">Chính sách hoàn tiền</th>
                      <th className="p-3">Khả năng đổi vé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="p-3 font-semibold">
                        Trước khởi hành &gt; 24 giờ
                      </td>
                      <td className="p-3 text-emerald-600 font-semibold">
                        Hoàn 80% giá trị vé
                      </td>
                      <td className="p-3 text-emerald-600 font-semibold">
                        Được phép đổi
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">
                        Trước khởi hành từ 4h - 24h
                      </td>
                      <td className="p-3 text-amber-600 font-semibold">
                        Hoàn 50% giá trị vé
                      </td>
                      <td className="p-3 text-emerald-600 font-semibold">
                        Được phép đổi
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">
                        Trước khởi hành &lt; 4 giờ
                      </td>
                      <td className="p-3 text-red-500 font-semibold">
                        Không hỗ trợ hoàn vé online
                      </td>
                      <td className="p-3 text-red-500 font-semibold">
                        Không hỗ trợ đổi vé
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                5. Trách nhiệm của khách hàng
              </h2>
              <p>
                Khi tham gia sử dụng dịch vụ vận tải của GoTrain VN, hành khách
                cần chấp hành các quy định sau:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Mang theo đúng Giấy tờ định danh cá nhân đã điền khi đặt vé để
                  nhân viên ga thực hiện kiểm soát tại cửa toa.
                </li>
                <li>
                  Tuyệt đối không mang theo các vật phẩm thuộc danh mục cấm
                  (chất gây cháy nổ, vũ khí, chất cấm...) lên tàu.
                </li>
                <li>
                  Có mặt tại ga tối thiểu **15 - 30 phút** trước giờ tàu khởi
                  hành để làm thủ tục soát vé lên tàu thuận lợi.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                6. Giới hạn trách nhiệm
              </h2>
              <p>
                Chúng tôi không chịu trách nhiệm bồi thường đối với các thiệt
                hại phát sinh do:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Hành khách trễ tàu do lý do cá nhân hoặc không xuất trình được
                  giấy tờ xác minh hợp lệ.
                </li>
                <li>
                  Sự cố bất khả kháng bao gồm: thiên tai, lũ lụt, sạt lở đường
                  ray hoặc các sự cố kỹ thuật hạ tầng thuộc quản lý nhà nước
                  ngoài tầm kiểm soát của GoTrain VN. Trong trường hợp này,
                  chúng tôi sẽ hỗ trợ hoàn vé 100% theo quy định chung.
                </li>
              </ul>
            </section>
          </div>
        ) : (
          <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 md:p-10 space-y-8 text-slate-700 leading-relaxed text-sm text-left">
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing, registering an account, and using the **GoTrain
                VN** electronic ticket booking system, you acknowledge that you
                have read, understood, and fully agreed to be bound by these
                terms. If you do not agree with any part of these terms, please
                stop using our website immediately.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                2. Account Registration and Security
              </h2>
              <p>
                When registering an account on GoTrain VN, you commit to
                providing accurate personal details (full name, email, phone
                number):
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  You are responsible for securing your password and managing
                  your account access activities.
                </li>
                <li>
                  You agree to notify us immediately if you discover any
                  unauthorized intrusion or use of your account.
                </li>
                <li>
                  We reserve the right to lock or terminate accounts if
                  registered details are found to be false or in violation of
                  general policies.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                3. Booking and Payment Regulations
              </h2>
              <p>
                The electronic ticket booking and payment processing cycle
                follows these guidelines:
              </p>
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 flex gap-3.5 items-start mt-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs text-amber-850">
                  <span className="font-bold text-amber-900 block text-left">
                    Hold Time Expiration
                  </span>
                  <span className="leading-relaxed block text-left">
                    Upon successful seat holding, your seats will be reserved
                    temporarily for **10 minutes**. If payment is not completed
                    (via PayOS or E-Wallet) within this timeframe, your ticket
                    reservation is automatically cancelled, and seats become
                    publicly available again.
                  </span>
                </div>
              </div>
              <p className="mt-2 text-left">
                Electronic tickets are officially issued only after our system
                receives payment confirmation from the payment gateway.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                4. Online Ticket Refund and Exchange Policy
              </h2>
              <p>
                Ticket refund and exchange rates are automatically calculated
                based on the request submission time relative to train
                departure:
              </p>
              <div className="overflow-x-auto rounded-2xl border border-slate-200 mt-2">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-700">
                      <th className="p-3">Request Timeframe</th>
                      <th className="p-3">Refund Policy</th>
                      <th className="p-3">Exchange Eligibility</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-600">
                    <tr>
                      <td className="p-3 font-semibold">
                        &gt; 24 hours prior to departure
                      </td>
                      <td className="p-3 text-emerald-600 font-semibold">
                        Refund 80% ticket value
                      </td>
                      <td className="p-3 text-emerald-600 font-semibold">
                        Allowed
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">
                        4 to 24 hours prior to departure
                      </td>
                      <td className="p-3 text-amber-600 font-semibold">
                        Refund 50% ticket value
                      </td>
                      <td className="p-3 text-emerald-600 font-semibold">
                        Allowed
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-semibold">
                        &lt; 4 hours prior to departure
                      </td>
                      <td className="p-3 text-red-500 font-semibold">
                        Not eligible for online refund
                      </td>
                      <td className="p-3 text-red-500 font-semibold">
                        Not allowed
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                5. Customer Responsibilities
              </h2>
              <p>
                When using GoTrain VN transportation services, passengers must
                comply with the following:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Bring the exact personal identification ID entered during
                  booking to show station staff at boarding gates.
                </li>
                <li>
                  Do not bring prohibited items (combustible liquids,
                  explosives, weapons, contraband...) onto the train.
                </li>
                <li>
                  Arrive at the station at least **15 - 30 minutes** prior to
                  train departure for smooth gate clearance.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                <span className="w-1.5 h-6 rounded-full bg-primary" />
                6. Limitation of Liability
              </h2>
              <p>
                We do not assume liability or offer compensation for damages
                arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 pl-2">
                <li>
                  Passengers missing the train due to personal reasons or
                  failure to present valid verification documents.
                </li>
                <li>
                  Force majeure events including: natural disasters, floods,
                  track landslides, or rail infrastructure technical failures
                  under state management beyond our control. In such events, we
                  will issue a 100% refund.
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
                ? "Bạn cần giải đáp về điều khoản sử dụng?"
                : "Need clarification on Terms of Service?"}
            </span>
            <span className="text-slate-500 text-xs block text-left">
              {language === "vi"
                ? "Vui lòng liên hệ bộ phận hỗ trợ khách hàng của chúng tôi để được tư vấn thêm."
                : "Please reach out to our customer support team for further advice."}
            </span>
          </div>
          <div className="flex gap-3 shrink-0">
            <a
              href="tel:0975230204"
              className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-primary/20 text-slate-700 hover:text-primary rounded-xl font-bold text-xs shadow-sm transition-all"
            >
              <Phone className="w-4 h-4 text-primary" />
              {language === "vi"
                ? "Tổng đài: 0975 230 204"
                : "Hotline: 0975 230 204"}
            </a>
            <button
              onClick={(e) => {
                e.preventDefault();
                window.dispatchEvent(new CustomEvent("open-contact-modal"));
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-[#00527f] text-white rounded-xl font-bold text-xs shadow-md transition-all border-none cursor-pointer"
            >
              <Mail className="w-4 h-4" />
              {language === "vi" ? "Gửi Email hỗ trợ" : "Send support Email"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
