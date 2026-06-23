import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "../../hooks/useAuth";
import { staffSearchApi } from "../../services/staffSearchApi";
import { StaffDirectBookingPanel } from "./StaffDirectBookingPanel.jsx";
import { StaffTicketPrintPanel } from "./StaffTicketPrintPanel.jsx";
import { StaffDelayReportPanel } from "./StaffDelayReportPanel.jsx";
import { StaffTicketCheckInPanel } from "./StaffTicketCheckInPanel.jsx";
import { StaffTicketDetailModal } from "./StaffTicketDetailModal.jsx";

const SIDEBAR = [
  { label: "Tổng quan", icon: "dashboard" },
  { label: "Đặt vé tại quầy", icon: "point_of_sale" },
  { label: "Soát vé & In vé", icon: "confirmation_number" },
  { label: "Soát vé (Quét QR)", icon: "qr_code_scanner" },
  { label: "Điều hành chuyến", icon: "schedule" },
  { label: "Tra cứu Booking", icon: "manage_search" },
];

// #10: StaffOverview với dữ liệu thực từ API stats
function StaffOverview({ onOpenBooking, onOpenPrint }) {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    staffSearchApi
      .getStats()
      .then((res) => setStats(res.data))
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, []);

  const cards = [
    {
      label: "Soát vé hôm nay",
      value: statsLoading ? "—" : String(stats?.checkInsToday ?? 0),
      helper: "Lượt hành khách đã soát vé trong ca",
      icon: "qr_code_scanner",
      color: "text-emerald-700 bg-emerald-50",
    },
    {
      label: "Hủy vé hôm nay",
      value: statsLoading ? "—" : String(stats?.cancellationsToday ?? 0),
      helper: "Booking đã xử lý hủy & hoàn tiền",
      icon: "cancel",
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

// #9: Panel tra cứu booking dùng staff API thay vì public page
function StaffSearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);

  const handleSearch = useCallback(
    async (e) => {
      e.preventDefault();
      const q = query.trim();
      if (q.length < 2) {
        toast.error("Nhập ít nhất 2 ký tự để tìm kiếm.");
        return;
      }
      setLoading(true);
      setResults(null);
      try {
        const res = await staffSearchApi.globalSearch(q);
        setResults(res.data);
      } catch (err) {
        toast.error(
          err.response?.data?.message || "Không tìm kiếm được. Thử lại sau.",
        );
      } finally {
        setLoading(false);
      }
    },
    [query],
  );

  const allBookings = results?.bookings ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-extrabold text-[#191c1e]">
          Tra cứu Booking
        </h2>
        <p className="mt-1 text-sm font-medium text-[#6f7883]">
          Tìm theo mã booking, mã vé, CCCD, SĐT hoặc email. Bao gồm cả booking
          đã hủy trong 30 ngày qua.
        </p>
      </div>

      <form
        onSubmit={handleSearch}
        className="flex gap-3 rounded-2xl border border-[#bec7d4]/30 bg-white p-5 shadow-sm"
      >
        <div className="relative flex-1">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7883]">
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Mã booking, mã vé, CCCD, SĐT, email hoặc họ tên..."
            className="w-full rounded-xl border border-[#bec7d4]/50 bg-[#f7f9fb] py-2.5 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-[#00a3ff] focus:ring-4 focus:ring-[#cfe5ff]"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="cursor-pointer rounded-xl bg-[#00629d] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#00527f] disabled:opacity-60"
        >
          {loading ? "Đang tìm..." : "Tìm kiếm"}
        </button>
      </form>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-4xl text-[#00629d]">
            sync
          </span>
        </div>
      )}

      {results && !loading && allBookings.length === 0 && (
        <div className="rounded-2xl border border-[#bec7d4]/20 bg-white py-16 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-[#bec7d4]">
            search_off
          </span>
          <p className="mt-3 font-bold text-[#191c1e]">
            Không tìm thấy kết quả
          </p>
          <p className="mt-1 text-sm text-[#6f7883]">
            Thử tìm bằng mã booking (GT...), mã vé (VE...) hoặc số CCCD.
          </p>
        </div>
      )}

      {allBookings.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#bec7d4]/20 bg-white shadow-sm">
          <div className="border-b border-[#bec7d4]/20 px-5 py-4">
            <p className="text-sm font-extrabold text-[#191c1e]">
              Tìm thấy {allBookings.length} kết quả
            </p>
          </div>
          <div className="divide-y divide-[#bec7d4]/10">
            {allBookings.map((booking) => {
              const pCount = booking.passengers?.length ?? 0;
              const dep = booking.schedule?.departureTime;
              const isPast = dep && new Date(dep) < new Date();
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => setSelectedBooking(booking)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-[#f7f9fb]"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-extrabold text-[#00629d]">
                        {booking.bookingCode}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          booking.status === "CONFIRMED"
                            ? "bg-green-100 text-green-700"
                            : booking.status === "CANCELLED"
                              ? "bg-red-100 text-red-700"
                              : booking.status === "REFUNDED"
                                ? "bg-purple-100 text-purple-700"
                                : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {booking.status}
                      </span>
                      {isPast && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">
                          ĐÃ QUA
                        </span>
                      )}
                    </div>
                    <p className="mt-1 truncate text-xs text-[#6f7883]">
                      {booking.schedule?.train?.trainName} ·{" "}
                      {dep
                        ? new Date(dep).toLocaleString("vi-VN", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                      {" · "}
                      {pCount} hành khách
                    </p>
                  </div>
                  <span className="material-symbols-outlined shrink-0 text-[#bec7d4]">
                    chevron_right
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedBooking && (
        <StaffTicketDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onCancelled={() => {
            setSelectedBooking(null);
            // Làm mới kết quả search sau khi hủy
            if (query.trim().length >= 2) {
              staffSearchApi
                .globalSearch(query.trim())
                .then((res) => setResults(res.data))
                .catch(() => {});
            }
          }}
        />
      )}
    </div>
  );
}

// #11: Sidebar content dùng chung cho desktop và mobile drawer
function SidebarContent({ active, onNavigate, onLogout }) {
  return (
    <>
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
            onClick={() => onNavigate(item.label)}
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
          onClick={onLogout}
          className="mb-4 flex w-full items-center rounded-xl px-4 py-3 text-left text-sm font-bold text-[#ba1a1a] transition hover:bg-[#ffdad6]/50"
        >
          <span className="material-symbols-outlined mr-3">logout</span>
          Đăng xuất
        </button>
        <div className="rounded-2xl border border-[#cfe5ff] bg-[#cfe5ff]/30 p-4">
          <p className="text-xs font-extrabold text-[#00629d]">Trực quầy ga</p>
          <p className="mt-2 text-[11px] leading-5 text-[#3f4852]">
            Ưu tiên thao tác nhanh, tránh làm mất phiên giữ ghế của khách.
          </p>
        </div>
      </div>
    </>
  );
}

export function StaffDashboard() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState("Tổng quan");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false); // #11

  const handleLogout = () => {
    clearAuth();
    toast.success("Đăng xuất thành công.");
    navigate("/");
  };

  const handleNavigate = (label) => {
    setActive(label);
    setMobileMenuOpen(false);
  };

  const renderPanel = () => {
    if (active === "Đặt vé tại quầy") return <StaffDirectBookingPanel />;
    if (active === "Soát vé & In vé") return <StaffTicketPrintPanel />;
    if (active === "Soát vé (Quét QR)") return <StaffTicketCheckInPanel />;
    if (active === "Điều hành chuyến") return <StaffDelayReportPanel />;
    if (active === "Tra cứu Booking") return <StaffSearchPanel />;
    return (
      <StaffOverview
        onOpenBooking={() => setActive("Đặt vé tại quầy")}
        onOpenPrint={() => setActive("Soát vé & In vé")}
      />
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f7f9fb] text-[#191c1e]">
      {/* Desktop sidebar */}
      <aside className="hidden h-screen w-72 shrink-0 flex-col overflow-y-auto border-r border-[#bec7d4]/30 bg-white md:flex">
        <SidebarContent
          active={active}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </aside>

      {/* #11: Mobile drawer overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col overflow-y-auto bg-white shadow-2xl transition-transform duration-300 md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="absolute right-4 top-4 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#f2f4f6] text-[#6f7883] hover:bg-[#bec7d4]/40"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
        <SidebarContent
          active={active}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
        />
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between border-b border-[#bec7d4]/20 bg-white/95 px-4 py-4 shadow-sm backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            {/* #11: Hamburger button on mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl bg-[#f2f4f6] text-[#3f4852] transition hover:bg-[#cfe5ff] hover:text-[#00629d] md:hidden"
            >
              <span className="material-symbols-outlined text-[22px]">
                menu
              </span>
            </button>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#00629d]">
                Staff
              </p>
              <h1 className="truncate text-xl font-extrabold text-[#191c1e]">
                {active}
              </h1>
            </div>
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
        </header>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6 lg:p-8">{renderPanel()}</div>
          <footer className="border-t border-[#bec7d4]/10 bg-[#f2f4f6]/30 px-8 py-5 text-center text-xs font-semibold text-[#6f7883]">
            © 2026 GoTrain VN · Staff counter workspace
          </footer>
        </div>
      </main>
    </div>
  );
}
