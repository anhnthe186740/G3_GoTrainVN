import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { StaffDirectBookingPanel } from "./StaffDirectBookingPanel.jsx";
import { StaffTicketPrintPanel } from "./StaffTicketPrintPanel.jsx";
import { StaffDelayReportPanel } from "./StaffDelayReportPanel.jsx";

const SIDEBAR = [
  { label: "Tổng quan", icon: "dashboard" },
  { label: "Đặt vé tại quầy", icon: "point_of_sale" },
  { label: "Soát vé & In vé", icon: "confirmation_number" },
  { label: "Báo trễ / Sự cố", icon: "warning" },
  { label: "Tra cứu Booking", icon: "manage_search" },
];

function StaffOverview({ onOpenBooking, onOpenPrint }) {
  const cards = [
    {
      label: "Phiên quầy",
      value: "Đang mở",
      helper: "Sẵn sàng giữ ghế realtime",
      icon: "bolt",
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Giữ ghế",
      value: "10 phút",
      helper: "Đồng bộ với booking online",
      icon: "timer",
      color: "text-[#00629d] bg-[#cfe5ff]",
    },
    {
      label: "Thanh toán",
      value: "Cash / QR",
      helper: "Xác nhận và in vé tại chỗ",
      icon: "payments",
      color: "text-amber-700 bg-amber-50",
    },
  ];

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-2xl font-extrabold text-[#191c1e]">
          Bàn làm việc lễ tân
        </h2>
        <p className="mt-1 text-sm font-medium text-[#6f7883]">
          Tìm chuyến, giữ ghế, nhận tiền và in vé trong cùng một luồng.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-[#bec7d4]/20 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-[#6f7883]">{card.label}</p>
                <p className="mt-1 text-2xl font-extrabold text-[#191c1e]">
                  {card.value}
                </p>
              </div>
              <span
                className={`material-symbols-outlined rounded-xl p-3 ${card.color}`}
              >
                {card.icon}
              </span>
            </div>
            <p className="mt-4 text-xs font-semibold text-[#6f7883]">
              {card.helper}
            </p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <button
          type="button"
          onClick={onOpenBooking}
          className="rounded-2xl border border-[#00629d]/20 bg-[#00629d] p-6 text-left text-white shadow-sm transition hover:bg-[#00527f]"
        >
          <span className="material-symbols-outlined text-3xl">
            point_of_sale
          </span>
          <h3 className="mt-4 text-xl font-extrabold">Đặt vé tại quầy</h3>
          <p className="mt-2 text-sm font-medium text-white/75">
            Luồng tối ưu cho khách đang đứng tại ga, có tra nhanh PNR và in vé
            ngay.
          </p>
        </button>
        <button
          type="button"
          onClick={onOpenPrint}
          className="rounded-2xl border border-[#bec7d4]/30 bg-white p-6 text-left text-[#191c1e] shadow-sm transition hover:border-[#00629d]/40 hover:text-[#00629d]"
        >
          <span className="material-symbols-outlined text-3xl">
            confirmation_number
          </span>
          <h3 className="mt-4 text-xl font-extrabold">Soát & in lại vé</h3>
          <p className="mt-2 text-sm font-medium text-[#6f7883]">
            Tra theo mã vé, mã booking hoặc thông tin liên hệ để in phôi giấy.
          </p>
        </button>
      </section>
    </div>
  );
}

function StaffBookingLookup() {
  return (
    <div className="rounded-2xl border border-[#bec7d4]/20 bg-white p-8 text-center shadow-sm">
      <span className="material-symbols-outlined text-4xl text-[#bec7d4]">
        manage_search
      </span>
      <p className="mt-3 font-bold text-[#191c1e]">Tra cứu booking</p>
      <p className="mb-4 mt-1 text-sm text-[#6f7883]">
        Dùng trang tra cứu công khai để kiểm tra trạng thái vé, hành trình và
        yêu cầu hủy.
      </p>
      <Link
        to="/tra-cuu-ve"
        className="inline-flex items-center gap-2 rounded-xl bg-[#00629d] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#00527f]"
      >
        <span className="material-symbols-outlined text-[18px]">
          open_in_new
        </span>
        Mở trang tra cứu
      </Link>
    </div>
  );
}

export function StaffDashboard() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState("Đặt vé tại quầy");
  const [searchFocused, setSearchFocused] = useState(false);

  const handleLogout = () => {
    clearAuth();
    toast.success("Đăng xuất thành công.");
    navigate("/");
  };

  const renderPanel = () => {
    if (active === "Đặt vé tại quầy") return <StaffDirectBookingPanel />;
    if (active === "Soát vé & In vé") return <StaffTicketPrintPanel />;
    if (active === "Báo trễ / Sự cố") return <StaffDelayReportPanel />;
    if (active === "Tra cứu Booking") return <StaffBookingLookup />;
    return (
      <StaffOverview
        onOpenBooking={() => setActive("Đặt vé tại quầy")}
        onOpenPrint={() => setActive("Soát vé & In vé")}
      />
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9fb] text-[#191c1e]">
      <aside className="hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-[#bec7d4]/30 bg-white md:flex">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-3xl font-bold text-[#00629d]">
              train
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-[#00629d]">
              GoTrain VN
            </span>
          </Link>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-[#3f4852]/60">
            Bảng điều khiển staff
          </p>
        </div>

        <nav className="flex-1 space-y-1 px-4">
          {SIDEBAR.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setActive(item.label)}
              className={`flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold transition ${
                active === item.label
                  ? "bg-[#cfe5ff] text-[#00629d]"
                  : "text-[#3f4852] hover:bg-[#f2f4f6] hover:text-[#00629d]"
              }`}
            >
              <span className="material-symbols-outlined mr-3 text-[22px]">
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-6">
          <button
            type="button"
            onClick={handleLogout}
            className="mb-4 flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold text-[#ba1a1a] transition hover:bg-[#ffdad6]/50"
          >
            <span className="material-symbols-outlined mr-3">logout</span>
            Đăng xuất
          </button>
          <div className="rounded-2xl border border-[#cfe5ff] bg-[#cfe5ff]/30 p-4">
            <p className="text-xs font-extrabold text-[#00629d]">
              Trực quầy ga
            </p>
            <p className="mt-2 text-[11px] leading-5 text-[#3f4852]">
              Ưu tiên thao tác nhanh, tránh làm mất phiên giữ ghế của khách.
            </p>
          </div>
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-[#bec7d4]/20 bg-white/95 px-6 py-4 shadow-sm backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00629d]">
              Staff
            </p>
            <h1 className="truncate text-xl font-extrabold text-[#191c1e]">
              {active}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <div
              className={`relative hidden transition sm:block ${
                searchFocused ? "scale-[1.02]" : ""
              }`}
            >
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7883]">
                search
              </span>
              <input
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="w-72 rounded-xl border border-[#bec7d4]/50 bg-[#f7f9fb] py-2 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[#00a3ff] focus:ring-4 focus:ring-[#cfe5ff]"
                placeholder="Tra nhanh mã vé, PNR, SĐT..."
              />
            </div>

            <div className="flex items-center gap-3 border-l border-[#bec7d4]/30 pl-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold text-[#191c1e]">
                  {user?.name || user?.fullName || "Nhân viên ga"}
                </p>
                <p className="text-xs font-semibold text-[#6f7883]">STAFF</p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#cfe5ff] text-[#00629d]">
                <span className="material-symbols-outlined">person</span>
              </span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-8">{renderPanel()}</div>
          <footer className="border-t border-[#bec7d4]/10 bg-[#f2f4f6]/30 px-8 py-5 text-center text-xs font-semibold text-[#6f7883]">
            © 2026 GoTrain VN · Staff counter workspace
          </footer>
        </div>
      </main>
    </div>
  );
}
