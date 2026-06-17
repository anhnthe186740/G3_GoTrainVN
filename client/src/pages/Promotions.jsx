import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";

const PROMOTIONS = [
  {
    id: 1,
    code: "GOTRAINV20",
    title: "Giảm 20% cho người dùng mới",
    description:
      "Áp dụng cho lần đặt vé đầu tiên. Giảm tối đa 200.000đ trên tổng hóa đơn.",
    discount: "20%",
    type: "PERCENTAGE",
    color: "from-[#00629d] to-[#00a3ff]",
    icon: "local_activity",
    validTo: "2026-12-31",
    minOrder: "500.000đ",
    badge: "Mới nhất",
    badgeColor: "bg-green-500",
  },
  {
    id: 2,
    code: "GOTRAIN50K",
    title: "Hoàn tiền 50.000đ vào ví điện tử",
    description:
      "Áp dụng khi thanh toán bằng GoWallet. Không giới hạn số lần sử dụng.",
    discount: "50k",
    type: "FIXED",
    color: "from-[#5b4fc4] to-[#8b7cf8]",
    icon: "account_balance_wallet",
    validTo: "2026-12-31",
    minOrder: "300.000đ",
    badge: "Phổ biến",
    badgeColor: "bg-purple-500",
  },
  {
    id: 3,
    code: "WEEKEND30",
    title: "Giảm 30% vào cuối tuần",
    description:
      "Ưu đãi đặc biệt dành cho chuyến đi thứ 7 và chủ nhật. Áp dụng cho mọi tuyến đường.",
    discount: "30%",
    type: "PERCENTAGE",
    color: "from-[#d97706] to-[#f59e0b]",
    icon: "weekend",
    validTo: "2026-09-30",
    minOrder: "400.000đ",
    badge: "Giới hạn",
    badgeColor: "bg-orange-500",
  },
  {
    id: 4,
    code: "SUMMER2026",
    title: "Ưu đãi mùa hè 2026",
    description:
      "Tiết kiệm 15% cho các chuyến du lịch mùa hè. Áp dụng từ tháng 6 đến tháng 8.",
    discount: "15%",
    type: "PERCENTAGE",
    color: "from-[#059669] to-[#10b981]",
    icon: "beach_access",
    validTo: "2026-08-31",
    minOrder: "600.000đ",
    badge: "Mùa hè",
    badgeColor: "bg-teal-500",
  },
  {
    id: 5,
    code: "LOYALTY100",
    title: "Tặng 100 điểm thành viên",
    description:
      "Nhận ngay 100 điểm tích lũy cho đơn đặt vé đầu tiên trong tháng. Đổi điểm lấy vé miễn phí.",
    discount: "100 Điểm",
    type: "POINTS",
    color: "from-[#dc2626] to-[#f87171]",
    icon: "stars",
    validTo: "2026-12-31",
    minOrder: "Không giới hạn",
    badge: "Thành viên",
    badgeColor: "bg-red-500",
  },
  {
    id: 6,
    code: "FAMILY4",
    title: "Gia đình 4 người giảm 25%",
    description:
      "Đặt vé cho nhóm từ 4 người trở lên, giảm ngay 25% tổng đơn. Tận hưởng hành trình cùng cả gia đình.",
    discount: "25%",
    type: "PERCENTAGE",
    color: "from-[#7c3aed] to-[#a78bfa]",
    icon: "family_restroom",
    validTo: "2026-12-31",
    minOrder: "1.000.000đ",
    badge: "Gia đình",
    badgeColor: "bg-violet-500",
  },
];

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function Promotions() {
  const [copiedCode, setCopiedCode] = useState(null);
  const [filter, setFilter] = useState("ALL");

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.success(`Đã sao chép mã: ${code}`);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const filtered =
    filter === "ALL" ? PROMOTIONS : PROMOTIONS.filter((p) => p.type === filter);

  return (
    <div className="min-h-screen bg-[#f7f9fb] pb-16">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#004c7a] via-[#00629d] to-[#0082c8] text-white py-16 px-6 text-center">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 px-4 py-1.5 rounded-full text-sm font-semibold mb-4">
            <span className="material-symbols-outlined text-[16px]">
              local_offer
            </span>
            Khuyến Mãi Độc Quyền
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Tiết Kiệm Hơn Mỗi Chuyến Đi
          </h1>
          <p className="text-[#b3d4f0] text-lg">
            Khám phá các ưu đãi hấp dẫn từ GoTrain VN. Sao chép mã và áp dụng
            khi đặt vé để nhận ngay ưu đãi.
          </p>

          {/* Filter tabs */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "PERCENTAGE", label: "Giảm %" },
              { key: "FIXED", label: "Giảm tiền" },
              { key: "POINTS", label: "Tích điểm" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-5 py-2 rounded-full font-semibold text-sm transition-all ${
                  filter === key
                    ? "bg-white text-[#00629d] shadow-lg"
                    : "bg-white/15 text-white hover:bg-white/25 border border-white/20"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Promotions Grid */}
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((promo) => (
            <div
              key={promo.id}
              className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-[#bec7d4]/20 transition-all duration-300 group"
            >
              {/* Card Header */}
              <div
                className={`bg-gradient-to-br ${promo.color} p-6 relative overflow-hidden`}
              >
                <div className="flex justify-between items-start">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                    <span className="material-symbols-outlined text-white text-2xl">
                      {promo.icon}
                    </span>
                  </div>
                  <span
                    className={`${promo.badgeColor} text-white text-xs font-bold px-3 py-1 rounded-full`}
                  >
                    {promo.badge}
                  </span>
                </div>
                <div className="mt-4">
                  <p className="text-5xl font-extrabold text-white">
                    {promo.discount}
                  </p>
                  <p className="text-white/80 text-sm mt-1">
                    {promo.type === "PERCENTAGE"
                      ? "Giảm giá"
                      : promo.type === "FIXED"
                        ? "Hoàn tiền"
                        : "Tích điểm"}
                  </p>
                </div>
                {/* Decorative circle */}
                <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />
                <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full" />
              </div>

              {/* Card Body */}
              <div className="p-5">
                <h3 className="font-bold text-[#191c1e] text-base mb-2">
                  {promo.title}
                </h3>
                <p className="text-sm text-[#6f7883] leading-relaxed">
                  {promo.description}
                </p>

                {/* Details */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6f7883]">Đơn tối thiểu</span>
                    <span className="font-semibold text-[#191c1e]">
                      {promo.minOrder}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#6f7883]">Hạn sử dụng</span>
                    <span className="font-semibold text-[#191c1e]">
                      {formatDate(promo.validTo)}
                    </span>
                  </div>
                </div>

                {/* Code & Copy */}
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex-1 bg-[#f7f9fb] border border-dashed border-[#bec7d4] rounded-xl px-3 py-2.5 flex items-center justify-between">
                    <span className="font-mono font-bold text-[#00629d] text-sm tracking-wider">
                      {promo.code}
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopy(promo.code)}
                    className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
                      copiedCode === promo.code
                        ? "bg-green-500 text-white"
                        : "bg-[#00629d] hover:bg-[#00629d]/90 text-white"
                    }`}
                  >
                    {copiedCode === promo.code ? (
                      <span className="material-symbols-outlined text-[18px]">
                        check
                      </span>
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">
                        content_copy
                      </span>
                    )}
                  </button>
                </div>

                <Link
                  to="/"
                  className="mt-3 w-full py-2.5 rounded-xl border border-[#bec7d4] hover:border-[#00629d] hover:bg-[#cfe5ff]/20 text-[#00629d] font-semibold text-sm transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[16px]">
                    train
                  </span>
                  Đặt vé ngay
                </Link>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-12 bg-gradient-to-r from-[#00629d] to-[#00a3ff] rounded-3xl p-8 text-white text-center">
          <h2 className="text-2xl font-extrabold mb-2">
            Nhận ưu đãi độc quyền
          </h2>
          <p className="text-[#b3d4f0] mb-6">
            Đăng ký thành viên và nhận ngay mã giảm giá 20% cho chuyến đầu tiên!
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/register"
              className="bg-white text-[#00629d] font-bold px-8 py-3 rounded-xl hover:bg-[#f7f9fb] transition-all shadow-lg"
            >
              Đăng ký miễn phí
            </Link>
            <Link
              to="/"
              className="bg-white/15 border border-white/30 text-white font-bold px-8 py-3 rounded-xl hover:bg-white/25 transition-all"
            >
              Đặt vé ngay
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
