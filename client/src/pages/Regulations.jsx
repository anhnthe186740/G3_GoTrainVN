import { useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Banknote,
  ChevronDown,
  ChevronRight,
  FileText,
  Info,
  RefreshCcw,
  ShieldCheck,
} from "lucide-react";

const regulationGroups = [
  {
    id: "1",
    title: "Các Điều Kiện & Điều Khoản",
    icon: FileText,
    items: [
      "Quy định vận chuyển",
      "Điều kiện sử dụng hệ thống mua vé trực tuyến",
      "Điều khoản sử dụng website GoTrain VN",
    ],
  },
  {
    id: "2",
    title: "Phương thức thanh toán",
    icon: Banknote,
    items: [
      "Thanh toán bằng ví GoTrain",
      "Thanh toán qua cổng ngân hàng và thẻ nội địa",
      "Xác nhận giao dịch sau khi đặt vé thành công",
    ],
  },
  {
    id: "3",
    title: "Chính sách hoàn trả vé",
    icon: RefreshCcw,
    items: [
      "Chính sách hoàn trả vé, đổi vé",
      "Quy định thời gian hoàn tiền",
      "Điều kiện tiếp nhận yêu cầu hủy vé",
    ],
  },
  {
    id: "4",
    title: "Chính sách Bảo Mật Thông Tin",
    icon: ShieldCheck,
    items: [
      "Bảo vệ dữ liệu hành khách",
      "Quy định sử dụng thông tin liên hệ khi đặt vé",
    ],
  },
];

const regulationDetails = {
  1.1: [
    "Hành khách cần có mặt tại ga trước giờ tàu chạy để hoàn tất kiểm tra vé và giấy tờ tùy thân.",
    "Thông tin trên vé phải trùng khớp với thông tin hành khách sử dụng dịch vụ.",
    "Hành lý mang theo phải tuân thủ giới hạn an toàn và không thuộc danh mục hàng hóa bị cấm vận chuyển.",
  ],
  1.2: [
    "Người dùng chịu trách nhiệm kiểm tra đầy đủ thông tin hành trình trước khi xác nhận đặt vé.",
    "Sau khi thanh toán thành công, hệ thống sẽ phát hành vé điện tử kèm mã đặt chỗ hoặc mã vé.",
    "GoTrain VN có thể từ chối giao dịch nếu phát hiện thông tin không hợp lệ hoặc có dấu hiệu gian lận.",
  ],
  1.3: [
    "Không sử dụng website để sao chép dữ liệu, gây quá tải hệ thống hoặc thực hiện hành vi trái pháp luật.",
    "Tài khoản người dùng cần được bảo mật; mọi thao tác phát sinh từ tài khoản sẽ được ghi nhận trên hệ thống.",
    "Nội dung, hình ảnh và dữ liệu trên website thuộc quyền quản lý của GoTrain VN.",
  ],
  2.1: [
    "Ví GoTrain có thể dùng để thanh toán vé, nhận hoàn tiền và theo dõi lịch sử giao dịch.",
    "Số dư ví cần đủ trước khi xác nhận thanh toán.",
    "Giao dịch ví thành công sẽ được cập nhật ngay trong tài khoản người dùng.",
  ],
  2.2: [
    "Hệ thống hỗ trợ thanh toán qua cổng ngân hàng và thẻ nội địa tùy theo trạng thái dịch vụ thanh toán.",
    "Người dùng cần hoàn tất giao dịch trong thời gian giữ chỗ quy định.",
    "Nếu giao dịch bị gián đoạn, vui lòng tra cứu lại vé hoặc liên hệ hỗ trợ trước khi đặt vé mới.",
  ],
  2.3: [
    "Vé chỉ được ghi nhận là hợp lệ sau khi hệ thống xác nhận thanh toán thành công.",
    "Thông báo xác nhận có thể được hiển thị trên website và gửi qua email liên hệ khi đặt vé.",
    "Mã đặt chỗ là căn cứ để tra cứu, đổi vé hoặc yêu cầu hỗ trợ sau thanh toán.",
  ],
  3.1: [
    "Chính sách hoàn trả và đổi vé phụ thuộc vào thời điểm yêu cầu so với giờ tàu chạy.",
    "Một số vé khuyến mãi hoặc vé đã qua thời gian cho phép có thể không được đổi, trả.",
    "Phí đổi, trả vé sẽ được hiển thị trước khi người dùng xác nhận yêu cầu.",
  ],
  3.2: [
    "Hoàn tiền về ví GoTrain thường được xử lý nhanh sau khi yêu cầu được chấp thuận.",
    "Hoàn tiền qua ngân hàng có thể mất thêm thời gian tùy theo quy trình xử lý của ngân hàng.",
    "Trạng thái hoàn tiền có thể được theo dõi trong lịch sử giao dịch hoặc chi tiết vé.",
  ],
  3.3: [
    "Yêu cầu hủy vé cần cung cấp đúng mã vé, thông tin liên hệ và lý do hủy.",
    "Vé đã sử dụng, đã hết hiệu lực hoặc không đủ điều kiện sẽ không thể gửi yêu cầu hủy trực tuyến.",
    "GoTrain VN có quyền kiểm tra thông tin trước khi xác nhận hoàn tiền.",
  ],
  4.1: [
    "Thông tin hành khách được sử dụng để phát hành vé, kiểm tra hành trình và hỗ trợ sau bán.",
    "GoTrain VN áp dụng các biện pháp cần thiết để hạn chế truy cập trái phép vào dữ liệu cá nhân.",
    "Người dùng nên tránh chia sẻ mã vé, mã đặt chỗ hoặc thông tin tài khoản cho người khác.",
  ],
  4.2: [
    "Email và số điện thoại được dùng để gửi thông báo đặt vé, tra cứu vé và hỗ trợ xử lý giao dịch.",
    "Thông tin liên hệ cần chính xác để tránh thất lạc vé điện tử hoặc thông báo hoàn tiền.",
    "Người dùng có thể liên hệ bộ phận hỗ trợ khi cần kiểm tra hoặc cập nhật thông tin liên hệ.",
  ],
};

const notices = [
  "Hành khách cần kiểm tra kỹ thông tin ga đi, ga đến, ngày giờ chạy tàu và giấy tờ tùy thân trước khi thanh toán.",
  "Vé điện tử hợp lệ khi có mã đặt chỗ hoặc mã vé do hệ thống GoTrain VN phát hành.",
  "Các yêu cầu đổi, trả vé được xử lý theo thời điểm gửi yêu cầu so với giờ tàu chạy.",
];

export function Regulations() {
  const [openItem, setOpenItem] = useState("1.1");

  const handleItemClick = (itemKey) => {
    setOpenItem((current) => (current === itemKey ? null : itemKey));
  };

  return (
    <div className="pb-14">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-[#00629d] via-[#0b84c6] to-[#29a8df] px-6 py-8 text-white sm:px-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                <BadgeCheck className="h-4 w-4" />
                Thông tin hành khách
              </div>
              <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">
                Các Quy Định
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">
                Tổng hợp quy định mua vé, thanh toán, đổi trả vé và bảo mật
                thông tin khi sử dụng dịch vụ đặt vé tàu tại GoTrain VN.
              </p>
            </div>

            <div className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-semibold text-white backdrop-blur">
              Cập nhật năm 2026
            </div>
          </div>
        </div>

        <div className="grid gap-6 bg-slate-50/70 p-4 lg:grid-cols-[220px_minmax(0,1fr)_220px] lg:p-6">
          <aside className="hidden lg:block">
            <div className="rounded-lg bg-gradient-to-b from-[#0b84c6] to-[#06b6d4] p-5 text-center text-white shadow-sm">
              <AlertTriangle className="mx-auto mb-4 h-12 w-12 text-yellow-200" />
              <p className="text-base font-extrabold leading-7">
                Khuyến cáo người dân mua vé tại website chính thức của GoTrain
                VN để tránh mua nhầm vé giả, vé không đúng giá.
              </p>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-4 inline-flex items-center rounded-r-full bg-[#00629d] px-4 py-2 text-sm font-extrabold uppercase tracking-wide text-white">
              Các Quy Định
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              {regulationGroups.map((group) => {
                const Icon = group.icon;

                return (
                  <div
                    key={group.id}
                    className="border-b border-slate-200 last:border-b-0"
                  >
                    <div className="flex items-center gap-3 bg-white px-4 py-3">
                      <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#29a8df] text-xs font-extrabold text-white">
                        {group.id}
                      </span>
                      <Icon className="h-4 w-4 text-[#00629d]" />
                      <h2 className="text-sm font-bold text-[#00629d] sm:text-base">
                        {group.title}
                      </h2>
                    </div>

                    {group.items.map((item, index) => {
                      const itemKey = `${group.id}.${index + 1}`;
                      const isOpen = openItem === itemKey;

                      return (
                        <div
                          key={itemKey}
                          className="border-t border-slate-200"
                        >
                          <button
                            type="button"
                            aria-expanded={isOpen}
                            aria-controls={`regulation-detail-${itemKey}`}
                            onClick={() => handleItemClick(itemKey)}
                            className={`flex w-full items-center justify-between gap-3 px-6 py-3 text-left text-sm font-medium transition sm:px-9 ${
                              isOpen
                                ? "bg-blue-50 text-[#00629d]"
                                : "bg-white text-blue-600 hover:bg-blue-50/70"
                            }`}
                          >
                            <span>
                              {itemKey}. {item}
                            </span>
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4 shrink-0 text-[#00629d]" />
                            ) : (
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                            )}
                          </button>

                          {isOpen && (
                            <div
                              id={`regulation-detail-${itemKey}`}
                              className="bg-blue-50/60 px-6 pb-5 pt-1 sm:px-9"
                            >
                              <div className="rounded-lg border border-blue-100 bg-white p-4 shadow-sm">
                                <ul className="space-y-2 text-sm leading-6 text-slate-600">
                                  {regulationDetails[itemKey].map((detail) => (
                                    <li key={detail} className="flex gap-2">
                                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#29a8df]" />
                                      <span>{detail}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 rounded-lg border border-sky-200 bg-sky-100 px-5 py-4">
              <p className="text-sm font-extrabold uppercase tracking-wide text-[#00629d]">
                Chính sách giá vé, quy định đổi - trả vé tàu và hướng dẫn tải
                hóa đơn vé tàu hỏa - Năm 2026
              </p>
            </div>

            <div className="mt-6 grid gap-3">
              {notices.map((notice) => (
                <div
                  key={notice}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600"
                >
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-[#00629d]" />
                  <p>{notice}</p>
                </div>
              ))}
            </div>
          </main>

          <aside className="hidden lg:block">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-[#00629d] text-white">
                <ShieldCheck className="h-10 w-10" />
              </div>
              <p className="text-xl font-extrabold uppercase leading-8 text-[#00629d]">
                GoTrain Vn
              </p>
              <div className="my-5 h-1 rounded-full bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500" />
              <p className="text-lg font-black uppercase italic leading-7 text-cyan-600">
                Hướng tới tương lai
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
