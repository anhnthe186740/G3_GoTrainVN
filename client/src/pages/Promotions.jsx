import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { api } from "../services/api";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function Promotions() {
  const [promotionsList, setPromotionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(null);
  const [filter, setFilter] = useState("ALL");

  useEffect(() => {
    const fetchPromotions = async () => {
      try {
        setLoading(true);
        const { data } = await api.get("/promotions");

        // Map vouchers from DB
        const mappedVouchers = (data.vouchers || []).map((v, index) => {
          const discountStr =
            v.discountType === "PERCENTAGE"
              ? `${v.discountValue}%`
              : `${v.discountValue / 1000}k`;

          return {
            id: `voucher-${v.id || index}`,
            code: v.voucherCode,
            title: `Mã giảm giá ${v.voucherCode}`,
            description:
              v.description ||
              `Giảm ngay ${v.discountValue.toLocaleString("vi-VN")} ${v.discountType === "PERCENTAGE" ? "%" : "VND"} cho đơn hàng của bạn.`,
            discount: discountStr,
            type: v.discountType, // PERCENTAGE, FIXED_AMOUNT
            color:
              v.discountType === "PERCENTAGE"
                ? "from-[#00629d] to-[#00a3ff]"
                : "from-[#5b4fc4] to-[#8b7cf8]",
            icon:
              v.discountType === "PERCENTAGE"
                ? "local_activity"
                : "account_balance_wallet",
            validTo: v.validTo,
            minOrder: v.minBookingAmount
              ? `${v.minBookingAmount.toLocaleString("vi-VN")}đ`
              : "Không giới hạn",
            badge: "Voucher",
            badgeColor: "bg-green-500",
            isVoucher: true,
          };
        });

        // Map automatic promotions from DB
        const mappedPromotions = (data.promotions || []).map((p, index) => {
          const discountStr =
            p.discountType === "PERCENTAGE"
              ? `${p.discountValue}%`
              : p.discountType === "FREE_UPGRADE"
                ? "Nâng hạng"
                : `${p.discountValue / 1000}k`;

          return {
            id: `promo-${p.id || index}`,
            code: "Tự động áp dụng",
            title: p.title,
            description:
              p.description ||
              "Ưu đãi tự động áp dụng trực tiếp cho các chặng/chuyến tàu đủ điều kiện.",
            discount: discountStr,
            type: p.discountType, // PERCENTAGE, FIXED_AMOUNT, FREE_UPGRADE
            color: "from-[#d97706] to-[#f59e0b]",
            icon: "stars",
            validTo: p.validTo,
            minOrder: "Chuyến tàu quy định",
            badge: "Khuyến mãi",
            badgeColor: "bg-orange-500",
            isVoucher: false,
          };
        });

        setPromotionsList([...mappedVouchers, ...mappedPromotions]);
      } catch (err) {
        console.error("Lỗi khi tải khuyến mãi:", err);
        toast.error("Không thể tải danh sách khuyến mãi.");
      } finally {
        setLoading(false);
      }
    };

    fetchPromotions();
  }, []);

  const handleCopy = (code) => {
    if (code === "Tự động áp dụng") return;
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      toast.success(`Đã sao chép mã: ${code}`);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const filtered = promotionsList.filter((p) => {
    if (filter === "ALL") return true;
    if (filter === "PERCENTAGE") return p.type === "PERCENTAGE";
    if (filter === "FIXED")
      return p.type === "FIXED_AMOUNT" || p.type === "FIXED";
    if (filter === "AUTO") return !p.isVoucher;
    return true;
  });

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
            Khám phá các ưu đãi hấp dẫn từ GoTrain VN. Sao chép mã voucher và
            nhập ở bước thanh toán để nhận ngay giảm giá.
          </p>

          {/* Filter tabs */}
          <div className="flex flex-wrap justify-center gap-2 mt-8">
            {[
              { key: "ALL", label: "Tất cả" },
              { key: "PERCENTAGE", label: "Giảm %" },
              { key: "FIXED", label: "Giảm tiền" },
              { key: "AUTO", label: "Tự động áp dụng" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-5 py-2 rounded-full font-semibold text-sm transition-all cursor-pointer ${
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
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-slate-500 font-bold text-sm">
              Đang tải danh sách khuyến mãi...
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 shadow-sm border border-[#bec7d4]/20 text-center">
            <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">
              local_offer
            </span>
            <h3 className="font-bold text-[#191c1e] text-lg">
              Không có ưu đãi nào phù hợp
            </h3>
            <p className="text-sm text-[#6f7883]">
              Hiện không có khuyến mãi nào đang hoạt động cho danh mục này.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((promo) => (
              <div
                key={promo.id}
                className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl border border-[#bec7d4]/20 transition-all duration-300 group flex flex-col justify-between"
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
                      className={`${promo.badgeColor} text-white text-[10px] font-extrabold px-3 py-1 rounded-full uppercase tracking-wider`}
                    >
                      {promo.badge}
                    </span>
                  </div>
                  <div className="mt-4">
                    <p className="text-5xl font-extrabold text-white">
                      {promo.discount}
                    </p>
                    <p className="text-white/80 text-sm mt-1">
                      {promo.isVoucher ? "Mã ưu đãi" : "Khuyến mãi hệ thống"}
                    </p>
                  </div>
                  {/* Decorative circle */}
                  <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/10 rounded-full" />
                  <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-white/10 rounded-full" />
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-bold text-[#191c1e] text-base mb-2">
                      {promo.title}
                    </h3>
                    <p className="text-sm text-[#6f7883] leading-relaxed mb-4">
                      {promo.description}
                    </p>

                    {/* Details */}
                    <div className="space-y-2 border-t border-slate-50 pt-3">
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
                  </div>

                  <div className="mt-5">
                    {/* Code & Copy */}
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex-1 bg-[#f7f9fb] border border-dashed border-[#bec7d4] rounded-xl px-3 py-2.5 flex items-center justify-between">
                        <span className="font-mono font-bold text-[#00629d] text-sm tracking-wider">
                          {promo.code}
                        </span>
                      </div>
                      {promo.isVoucher && (
                        <button
                          onClick={() => handleCopy(promo.code)}
                          className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
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
                      )}
                    </div>

                    <Link
                      to="/"
                      className="w-full py-2.5 rounded-xl border border-[#bec7d4] hover:border-[#00629d] hover:bg-[#cfe5ff]/20 text-[#00629d] font-semibold text-sm transition-all flex items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        train
                      </span>
                      Đặt vé ngay
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CTA Section */}
        <div className="mt-12 bg-gradient-to-r from-[#00629d] to-[#00a3ff] rounded-3xl p-8 text-white text-center">
          <h2 className="text-2xl font-extrabold mb-2">
            Nhận ưu đãi độc quyền
          </h2>
          <p className="text-[#b3d4f0] mb-6">
            Đăng ký thành viên và nhận ngay mã giảm giá cho chuyến đi đầu tiên
            của bạn!
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
