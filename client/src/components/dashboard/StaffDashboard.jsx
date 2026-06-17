import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { toast } from "sonner";
import { StaffTicketPrintPanel } from "./StaffTicketPrintPanel.jsx";

const SIDEBAR = [
  { label: "Soát Vé & In Vé", icon: "confirmation_number" },
  { label: "Tra Cứu Booking", icon: "search" },
];

export function StaffDashboard() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();
  const [active, setActive] = useState("Soát Vé & In Vé");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    clearAuth();
    toast.success("Đăng xuất thành công!");
    navigate("/");
  };

  return (
    <div className="flex h-screen bg-[#f7f9fb] overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${sidebarOpen ? "w-64" : "w-16"} shrink-0 bg-white border-r border-[#bec7d4]/20 shadow-sm flex flex-col transition-all duration-300 z-30`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#bec7d4]/10">
          <div className="w-9 h-9 rounded-xl bg-[#00629d] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-white text-[20px]">
              train
            </span>
          </div>
          {sidebarOpen && (
            <div>
              <p className="font-extrabold text-[#191c1e] text-sm leading-tight">
                GoTrain VN
              </p>
              <p className="text-[10px] text-[#6f7883] font-bold uppercase tracking-wider">
                Nhân Viên Ga
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {SIDEBAR.map(({ label, icon }) => (
            <button
              key={label}
              onClick={() => setActive(label)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                active === label
                  ? "bg-[#cfe5ff] text-[#00629d]"
                  : "text-[#3f4852] hover:bg-[#f7f9fb] hover:text-[#191c1e]"
              }`}
              title={!sidebarOpen ? label : ""}
            >
              <span className="material-symbols-outlined text-[22px] shrink-0">
                {icon}
              </span>
              {sidebarOpen && <span className="truncate">{label}</span>}
            </button>
          ))}
        </nav>

        {/* User Info */}
        <div className="border-t border-[#bec7d4]/10 p-3 space-y-2">
          {sidebarOpen && (
            <div className="flex items-center gap-2 px-2 py-2">
              <div className="w-8 h-8 rounded-full bg-[#cfe5ff] flex items-center justify-center">
                <span className="material-symbols-outlined text-[#00629d] text-[18px]">
                  person
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#191c1e] truncate">
                  {user?.name || user?.fullName || "Nhân viên"}
                </p>
                <p className="text-[10px] text-[#6f7883] truncate">STAFF</p>
              </div>
            </div>
          )}
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[#6f7883] hover:text-[#191c1e] hover:bg-[#f7f9fb] rounded-xl transition-all text-xs font-semibold"
          >
            <span className="material-symbols-outlined text-[18px]">
              {sidebarOpen ? "chevron_left" : "chevron_right"}
            </span>
            {sidebarOpen && "Thu gọn"}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl transition-all text-sm font-semibold"
            title="Đăng xuất"
          >
            <span className="material-symbols-outlined text-[20px]">
              logout
            </span>
            {sidebarOpen && "Đăng xuất"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-[#bec7d4]/20 px-6 py-3 flex items-center justify-between shrink-0">
          <div>
            <h1 className="font-extrabold text-[#191c1e] text-lg">{active}</h1>
            <p className="text-xs text-[#6f7883]">
              GoTrain VN — Nhân viên soát vé
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/tra-cuu-ve"
              target="_blank"
              className="flex items-center gap-1.5 px-4 py-2 border border-[#bec7d4] hover:border-[#00629d]/40 hover:bg-[#cfe5ff]/20 text-[#3f4852] hover:text-[#00629d] rounded-xl font-semibold text-sm transition-all"
            >
              <span className="material-symbols-outlined text-[18px]">
                open_in_new
              </span>
              Tra cứu công khai
            </Link>
          </div>
        </header>

        {/* Panel */}
        <main className="flex-1 overflow-y-auto p-6">
          {active === "Soát Vé & In Vé" && <StaffTicketPrintPanel />}
          {active === "Tra Cứu Booking" && <StaffBookingLookup />}
        </main>
      </div>
    </div>
  );
}

/* ─── Simple booking lookup for staff ─────────────── */
function StaffBookingLookup() {
  return (
    <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-8 text-center">
      <span className="material-symbols-outlined text-4xl text-[#bec7d4]">
        search
      </span>
      <p className="font-bold text-[#191c1e] mt-3">Tra Cứu Booking</p>
      <p className="text-sm text-[#6f7883] mt-1 mb-4">
        Sử dụng trang tra cứu công khai để kiểm tra thông tin vé
      </p>
      <Link
        to="/tra-cuu-ve"
        className="inline-flex items-center gap-2 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-all"
      >
        <span className="material-symbols-outlined text-[18px]">
          open_in_new
        </span>
        Mở trang tra cứu
      </Link>
    </div>
  );
}
