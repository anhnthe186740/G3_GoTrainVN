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

export function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex text-xs font-semibold text-slate-500 gap-1.5 items-center">
          <Link to="/" className="hover:text-primary transition-colors">
            Trang chủ
          </Link>
          <span>/</span>
          <span className="text-slate-800">Chính sách bảo mật</span>
        </nav>

        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#004c7a] to-[#00629d] p-8 md:p-12 text-white shadow-xl mb-8">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 rounded-full bg-white/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-60 h-60 rounded-full bg-white/5 blur-3xl" />

          <div className="relative flex flex-col md:flex-row items-center gap-6 justify-between">
            <div className="text-center md:text-left">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur border border-white/20 text-[#b3d4f0] uppercase tracking-wider">
                <Shield className="w-3.5 h-3.5" />
                Bảo vệ thông tin
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold mt-3 tracking-tight">
                Chính Sách Bảo Mật
              </h1>
              <p className="mt-2 text-sm text-[#b3d4f0]/90 max-w-lg leading-relaxed">
                Tại GoTrain VN, chúng tôi cam kết bảo vệ thông tin cá nhân và
                quyền riêng tư của hành khách lên hàng đầu. Dưới đây là cách
                chúng tôi thu thập, sử dụng và bảo mật dữ liệu của bạn.
              </p>
            </div>
            <div className="w-20 h-20 rounded-2xl bg-white/10 backdrop-blur border border-white/15 flex items-center justify-center shrink-0 shadow-inner">
              <Lock className="w-10 h-10 text-[#b3d4f0]" />
            </div>
          </div>
        </div>

        {/* Policy Content */}
        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 md:p-10 space-y-8 text-slate-700 leading-relaxed text-sm">
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
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex flex-col gap-1"
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
              Chúng tôi chỉ sử dụng thông tin cá nhân của bạn vào những mục đích
              hợp pháp và minh bạch sau:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                Xử lý giao dịch đặt giữ chỗ, xuất vé điện tử và gửi hóa đơn xác
                nhận.
              </li>
              <li>
                Xác thực danh tính hành khách khi soát vé tại ga và lên toa tàu.
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
              Chúng tôi áp dụng các tiêu chuẩn công nghệ bảo mật cao nhất để bảo
              vệ dữ liệu của bạn trước việc truy cập, thay đổi, tiết lộ hoặc phá
              hủy trái phép:
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
              thương mại. Chúng tôi chỉ chia sẻ dữ liệu trong các trường hợp cực
              kỳ hạn chế:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                Chia sẻ mã giao dịch với đối tác cổng thanh toán (PayOS) để xử
                lý việc chuyển khoản ngân hàng.
              </li>
              <li>
                Khi có yêu cầu bằng văn bản chính thức của cơ quan pháp luật nhà
                nước có thẩm quyền trong các trường hợp khẩn cấp hoặc phòng
                chống tội phạm.
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

          {/* Contact Support */}
          <div className="bg-[#f7f9fb] border border-slate-200/50 rounded-2.5xl p-6 flex flex-col md:flex-row justify-between items-center gap-4 mt-8">
            <div className="text-center md:text-left space-y-1">
              <span className="font-bold text-slate-800 block text-base">
                Bạn có thắc mắc về chính sách bảo mật?
              </span>
              <span className="text-slate-500 text-xs block">
                Đội ngũ hỗ trợ quyền riêng tư của chúng tôi luôn sẵn sàng lắng
                nghe bạn.
              </span>
            </div>
            <div className="flex gap-3 shrink-0">
              <a
                href="mailto:support@gotrain.vn"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 hover:border-primary/20 text-slate-700 hover:text-primary rounded-xl font-bold text-xs shadow-sm transition-all"
              >
                <Mail className="w-4 h-4 text-primary" />
                Email hỗ trợ
              </a>
              <a
                href="tel:19001234"
                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary-container text-white rounded-xl font-bold text-xs shadow-md transition-all"
              >
                <Phone className="w-4 h-4" />
                Hotline 1900 1234
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
