import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { toast } from "sonner";
import { api } from "../../services/api";
import { RouteScheduleMgmt } from "./RouteScheduleMgmt";
import { AdminWalletPanel } from "./AdminWalletPanel.jsx";
import { UserManagement } from "./UserManagement";
import { AdminSchedulePanel } from "./AdminSchedulePanel.jsx";
import { AdminTrainPanel } from "./AdminTrainPanel.jsx";
import { AdminPricingPanel } from "./AdminPricingPanel.jsx";
import { AdminBookingPanel } from "./AdminBookingPanel.jsx";
import { AdminReportsPanel } from "./AdminReportsPanel.jsx";
import { AdminPromotionPanel } from "./AdminPromotionPanel.jsx";
import { AdminAuditLogsPanel } from "./AdminAuditLogsPanel.jsx";
import { AdminLiveTrackingPanel } from "./AdminLiveTrackingPanel.jsx";

// ─── Helpers ───────────────────────────────────────────────────
const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getScheduleStatus = (s) => {
  if (s.status === "CANCELLED" || s.status === "Hủy bỏ") return "Hủy bỏ";
  if (s.status === "Hoàn thành") return "Hoàn thành";
  if (s.status === "Đang chạy") return "Đang chạy";
  if (s.status === "Chưa chạy") return "Chưa chạy";

  const now = new Date();
  const delayMs = (s.delayMinutes || 0) * 60 * 1000;
  const dep = new Date(new Date(s.departureTime).getTime() + delayMs);
  const arr = s.arrivalTime
    ? new Date(s.arrivalTime)
    : new Date(dep.getTime() + 6 * 3600 * 1000);

  if (now >= dep && now <= arr) return "Đang chạy";
  if (now > arr) return "Hoàn thành";
  return "Chưa chạy";
};

const STATUS_BADGE_CLASS = {
  "Đang chạy": "bg-green-50 text-green-600 border-green-100",
  "Chưa chạy": "bg-amber-50 text-amber-600 border-amber-100",
  "Hoàn thành": "bg-slate-100 text-slate-600 border-slate-200",
  "Hủy bỏ": "bg-red-50 text-red-600 border-red-200",
};

export function AdminDashboard() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  // State management
  const [activeSidebar, setActiveSidebar] = useState("Tổng Quan");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);

  // Dynamic Dashboard statistics and schedules
  const [stats, setStats] = useState(null);
  const [statsPeriod, setStatsPeriod] = useState("monthly"); // daily, monthly, yearly
  const [statsLoading, setStatsLoading] = useState(true);
  const [upcomingSchedules, setUpcomingSchedules] = useState([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);
  const [delayedAlerts, setDelayedAlerts] = useState([]);
  const [quickSearch, setQuickSearch] = useState("");
  const [isExporting, setIsExporting] = useState(false);
  const [autoRefreshTime, setAutoRefreshTime] = useState(120); // 2 minutes in seconds
  const autoRefreshTimerRef = useRef(null);

  // Sidebar links definition
  const sidebarLinks = [
    { label: "Tổng Quan", icon: "dashboard" },
    { label: "Quản Lý Tuyến", icon: "route" },
    { label: "Lịch Trình", icon: "calendar_month" },
    { label: "Điều Hành Tàu", icon: "explore" },
    { label: "Quản Lý Tàu", icon: "train" },
    { label: "Giá Vé", icon: "payments" },
    { label: "Khuyến Mãi", icon: "local_offer" },
    { label: "Đặt Vé", icon: "confirmation_number" },
    { label: "Người Dùng", icon: "group" },
    { label: "Quản Lý Ví", icon: "account_balance_wallet" },
    { label: "Báo Cáo", icon: "analytics" },
    { label: "Lịch Sử Hệ Thống", icon: "history" },
  ];

  // Helper formatting methods
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat("vi-VN").format(num || 0);
  };

  // Fetch Dashboard statistics
  const loadStats = async (period) => {
    setStatsLoading(true);
    try {
      const res = await api.get("/bookings/admin/stats", {
        params: { period },
      });
      if (res.data && res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (err) {
      console.error("Lỗi khi tải số liệu thống kê:", err);
      toast.error("Không thể tải số liệu thống kê từ server.");
    } finally {
      setStatsLoading(false);
    }
  };

  // Fetch all schedules and process upcoming ones
  const loadUpcomingSchedules = async () => {
    setUpcomingLoading(true);
    try {
      const res = await api.get("/schedules");
      if (res.data && res.data.schedules) {
        const schedulesList = res.data.schedules;
        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);
        const next24 = new Date(now.getTime() + 24 * 60 * 60 * 1000);

        // Today & tomorrow schedules
        const filtered = schedulesList.filter((s) => {
          const depTime = new Date(s.departureTime);
          return depTime >= startOfToday && depTime <= next24;
        });
        filtered.sort(
          (a, b) => new Date(a.departureTime) - new Date(b.departureTime),
        );
        setUpcomingSchedules(filtered);

        // Incident/Delay Warnings > 10 mins
        const delays = schedulesList.filter(
          (s) =>
            s.delayMinutes > 10 &&
            getScheduleStatus(s) !== "Hoàn thành" &&
            getScheduleStatus(s) !== "Hủy bỏ",
        );
        setDelayedAlerts(delays);
      }
    } catch (err) {
      console.error("Lỗi khi tải danh sách lịch trình:", err);
    } finally {
      setUpcomingLoading(false);
    }
  };

  // Trigger loading on period change
  useEffect(() => {
    loadStats(statsPeriod);
    loadUpcomingSchedules();
  }, [statsPeriod]);

  // Set up auto-refresh timer countdown (runs every 1 second, triggers load every 120s)
  useEffect(() => {
    autoRefreshTimerRef.current = setInterval(() => {
      setAutoRefreshTime((prev) => {
        if (prev <= 1) {
          loadStats(statsPeriod);
          loadUpcomingSchedules();
          toast.success("Dữ liệu dashboard đã được tự động cập nhật!");
          return 120;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (autoRefreshTimerRef.current)
        clearInterval(autoRefreshTimerRef.current);
    };
  }, [statsPeriod]);

  // Role validation (RBAC) - placed after all hooks
  if (!user || user.role !== "ADMIN") {
    return (
      <div className="flex h-screen items-center justify-center bg-[#f7f9fb] p-8 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-lg max-w-sm border border-red-100">
          <span className="material-symbols-outlined text-red-500 text-5xl mb-4">
            gpp_maybe
          </span>
          <h3 className="text-lg font-bold text-slate-800 mb-2">
            Quyền truy cập bị từ chối
          </h3>
          <p className="text-sm text-slate-500 mb-6">
            Trang này chỉ dành cho tài khoản có quyền Quản trị viên (ADMIN).
          </p>
          <button
            onClick={() => navigate("/")}
            className="w-full bg-[#00629d] hover:bg-[#00629d]/90 text-white py-2.5 rounded-xl font-semibold transition-all border-none cursor-pointer"
          >
            Về trang chủ
          </button>
        </div>
      </div>
    );
  }

  // Handle Logout
  const handleLogout = () => {
    clearAuth();
    toast.success("Đăng xuất thành công!");
    navigate("/");
  };

  // Mock handlers
  const handleTicketRequest = () => {
    toast.success(
      "Gửi yêu cầu hỗ trợ thành công! IT sẽ liên hệ lại bạn trong ít phút.",
    );
  };

  const handleAiAssistant = () => {
    window.dispatchEvent(new CustomEvent("open-chatbot"));
  };

  const handleActionClick = (action, code) => {
    toast.success(`Đã nhấn ${action} lịch trình chuyến tàu ${code}`);
  };

  const handleQuickAddSchedule = () => {
    setActiveSidebar("Lịch Trình");
    toast.success("Đã chuyển hướng đến trang Quản lý Lịch Trình.");
  };

  const handleExportReport = () => {
    setIsExporting(true);
    toast.info("Đang tạo file báo cáo phân tích...");
    setTimeout(() => {
      const csvContent =
        "BAO CAO DOANH THU & VAN HANH GOTRAIN VN\n" +
        `Ngay bao cao: ${new Date().toLocaleDateString("vi-VN")}\n` +
        `Ky bao cao: ${statsPeriod === "daily" ? "Theo Ngay" : statsPeriod === "monthly" ? "Theo Thang" : "Theo Nam"}\n\n` +
        `Tong doanh thu: ${overviewStats.totalRevenue} VND\n` +
        `Tong so don hang: ${overviewStats.totalBookings}\n` +
        `Don hang thanh cong: ${overviewStats.confirmedBookings}\n` +
        `Don hang da huy: ${overviewStats.cancelledBookings}\n` +
        `Gia tri don hang trung binh: ${overviewStats.avgBookingValue} VND\n\n` +
        "TOP 5 TUYEN DUONG PHO BIEN:\n" +
        topRoutes
          .map(
            (r, i) => `${i + 1}. ${r.name}, ${r.bookings} ve, ${r.revenue} VND`,
          )
          .join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `GoTrain_BaoCaoAdmin_${statsPeriod}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setIsExporting(false);
      toast.success("Đã xuất báo cáo CSV thành công!");
    }, 1500);
  };

  // Fallback structures for stats
  const overviewStats = stats?.overview || {
    totalBookings: 8432,
    confirmedBookings: 7890,
    cancelledBookings: 421,
    pendingBookings: 121,
    totalRevenue: 1240000000,
    netRevenue: 1115000000,
    totalRefunds: 125000000,
    totalPassengers: 12847,
    avgBookingValue: 820000,
  };

  const adminOverview = stats?.adminOverview || {
    totalUsers: 128,
    totalCustomers: 121,
    totalAdmins: 7,
    totalTrains: 48,
    totalRoutes: 18,
    totalSchedules: 326,
    activeSchedules: 301,
    delayedSchedules: 4,
    totalWalletBalance: 920000000,
    pendingWithdrawals: 6,
    refundThisMonth: 125000000,
  };

  const revenueSeries = stats?.revenueSeries ||
    stats?.monthly || [
      { label: "T1", value: 142000000 },
      { label: "T2", value: 98000000 },
      { label: "T3", value: 165000000 },
      { label: "T4", value: 190000000 },
      { label: "T5", value: 210000000 },
      { label: "T6", value: 240000000 },
    ];

  const topRoutes = stats?.topRoutes || [
    {
      name: "Hà Nội → Đà Nẵng",
      bookings: 2341,
      revenue: 320000000,
      occupancy: 92,
    },
    {
      name: "TP.HCM → Nha Trang",
      bookings: 1892,
      revenue: 280000000,
      occupancy: 78,
    },
    {
      name: "Hà Nội → Lào Cai",
      bookings: 1203,
      revenue: 180000000,
      occupancy: 65,
    },
    {
      name: "Huế → Quy Nhơn",
      bookings: 987,
      revenue: 145000000,
      occupancy: 42,
    },
    {
      name: "Đà Nẵng → TP.HCM",
      bookings: 756,
      revenue: 120000000,
      occupancy: 81,
    },
  ];

  const trainTypes = stats?.trainTypes || [
    { name: "Giường nằm (Sleeper)", count: 4120, pct: 48.9 },
    { name: "Ghế mềm điều hòa (AC Soft)", count: 2310, pct: 27.4 },
    { name: "Ghế cứng (Hard Seat)", count: 1456, pct: 17.3 },
    { name: "Khác (Others)", count: 546, pct: 6.4 },
  ];

  const totalTrains = adminOverview.totalTrains || 48;
  const activeTrains =
    Math.min(totalTrains, Math.round(totalTrains * 0.88)) || 42;
  const trainUtilization = overviewStats.avgUtilization || 85; // Average utilization rate

  const circumference = 251.2;
  const totalBookingsVal = Math.max(overviewStats.totalBookings || 1, 1);
  const successPct = Math.round(
    (overviewStats.confirmedBookings / totalBookingsVal) * 100,
  );
  const cancelledPct = Math.round(
    (overviewStats.cancelledBookings / totalBookingsVal) * 100,
  );
  const pendingPct = Math.max(0, 100 - successPct - cancelledPct);

  const sleeperPct = trainTypes[0]?.pct || 48.9;
  const seatPct = trainTypes[1]?.pct || 27.4;
  const hardPct = trainTypes[2]?.pct || 17.3;
  const otherPct = 100 - sleeperPct - seatPct - hardPct;

  const sleeperArc = (sleeperPct / 100) * circumference;
  const seatArc = (seatPct / 100) * circumference;
  const hardArc = (hardPct / 100) * circumference;
  const otherArc = (otherPct / 100) * circumference;

  // Heatmap Data (Days vs 4 slots)
  const heatmapData = stats?.heatmap || [
    { day: "Thứ 2", slots: [32, 54, 45, 60] },
    { day: "Thứ 3", slots: [28, 48, 40, 52] },
    { day: "Thứ 4", slots: [35, 52, 42, 58] },
    { day: "Thứ 5", slots: [40, 62, 50, 68] },
    { day: "Thứ 6", slots: [55, 82, 75, 89] },
    { day: "Thứ 7", slots: [78, 94, 90, 96] },
    { day: "Chủ Nhật", slots: [82, 96, 92, 98] },
  ];
  const slotLabels = [
    "00:00-06:00",
    "06:00-12:00",
    "12:00-18:00",
    "18:00-24:00",
  ];

  // Filter schedules based on quickSearch input
  const filteredUpcoming = upcomingSchedules.filter((s) => {
    if (!quickSearch) return true;
    const term = quickSearch.toLowerCase();
    const trainCode = (s.train?.trainCode || "").toLowerCase();
    const routeName = (s.route?.routeName || "").toLowerCase();
    const scheduleId = (s.id || "").toLowerCase();
    return (
      trainCode.includes(term) ||
      routeName.includes(term) ||
      scheduleId.includes(term)
    );
  });

  return (
    <div className="flex h-screen bg-[#f7f9fb] text-[#191c1e] font-body-md overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="hidden md:flex flex-col w-72 bg-white border-r border-[#bec7d4]/30 h-screen shrink-0 overflow-y-auto z-40 transition-all duration-300">
        <div className="p-6">
          <Link to="/" className="flex items-center gap-2 select-none">
            <span className="material-symbols-outlined text-[#00629d] text-3xl font-bold">
              train
            </span>
            <span className="font-display-lg text-2xl font-bold text-[#00629d] tracking-tight">
              GoTrain VN
            </span>
          </Link>
          <p className="font-label-sm text-[#3f4852]/60 mt-1 text-[11px] uppercase tracking-widest font-semibold">
            Hệ Thống Quản Trị
          </p>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {sidebarLinks.map((link) => (
            <button
              key={link.label}
              onClick={() => {
                setActiveSidebar(link.label);
                toast.info(`Đang chuyển sang phân hệ: ${link.label}`);
              }}
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all border-none text-left cursor-pointer ${
                activeSidebar === link.label
                  ? "bg-[#00629d]/10 text-[#00629d] font-bold"
                  : "bg-transparent text-[#3f4852] hover:bg-[#d3e2ed]/50 hover:text-[#00629d]"
              }`}
            >
              <span className="material-symbols-outlined mr-3">
                {link.icon}
              </span>
              <span className="font-label-md text-sm">{link.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto"></div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f7f9fb] overflow-hidden">
        {/* Header / Top Bar */}
        <header className="bg-white shrink-0 z-30 flex items-center justify-between px-8 py-4 border-b border-[#bec7d4]/20 shadow-sm">
          <div className="flex items-center gap-6">
            <button
              onClick={() =>
                toast.info("Tính năng menu di động đang được phát triển")
              }
              className="md:hidden p-2 hover:bg-[#eceef0] rounded-full flex items-center justify-center border-none bg-transparent cursor-pointer"
            >
              <span className="material-symbols-outlined">menu</span>
            </button>
            <div
              className={`relative hidden sm:block transition-all duration-300 ${searchFocused ? "scale-105" : ""}`}
            >
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7883]">
                search
              </span>
              <input
                value={quickSearch}
                onChange={(e) => setQuickSearch(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="pl-10 pr-4 py-2 bg-white border border-[#bec7d4]/50 rounded-xl focus:ring-2 focus:ring-[#00a3ff] focus:border-[#00a3ff] outline-none w-64 text-sm transition-all"
                placeholder="Tìm kiếm mã tàu, tuyến..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Auto Refresh Progress bar indicator */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-[#3f4852] font-semibold bg-slate-50 border border-slate-200/50 py-1.5 px-3 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                Làm mới: {Math.floor(autoRefreshTime / 60)}:
                {(autoRefreshTime % 60).toString().padStart(2, "0")}
              </span>
            </div>

            <div className="relative">
              <button
                onClick={() => setAdminMenuOpen(!adminMenuOpen)}
                className="flex items-center gap-3 pl-6 border-l border-[#bec7d4]/30 bg-transparent border-none cursor-pointer focus:outline-none"
              >
                <div className="text-right hidden sm:block">
                  <p className="font-label-md text-[#191c1e] text-sm font-semibold">
                    {user?.name || user?.fullName || "Admin GoTrain"}
                  </p>
                  <p className="font-label-sm text-[#3f4852] text-xs">
                    Quản trị viên
                  </p>
                </div>
                <img
                  alt="Admin Profile"
                  className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAfHN2yz-0iI2baB3WRjPg1bG00TEOS4zEIC-_MMJaFStnTcC0zWsOJRzo05kkMT30wzec88PazR4407fD0JMLUf6aEguOUXT28jtqTn0Rppw6dqlVZY96RFnp_j4wJU8OL5ENS9qcKji6IwE3B9d55EhH4MjQcAW0PetRgFyhnwy9hJ6eo5xfLxjKey03rgCU9CLJ4b-PbGVKud_E1HdOJSSudsbtVltInmYm6grX6Ei_aSg7Wv-Ty2aVcfSK5OYIoFIn6MW6QjKhH"
                />
              </button>

              {adminMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-[#bec7d4]/20 rounded-xl shadow-xl py-2 z-50">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center px-4 py-2.5 text-sm text-[#ba1a1a] hover:bg-[#ffdad6]/40 transition-colors border-none bg-transparent cursor-pointer text-left font-semibold"
                  >
                    <span className="material-symbols-outlined mr-3 text-lg">
                      logout
                    </span>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-8 space-y-8">
            {activeSidebar === "Quản Lý Tuyến" && (
              <RouteScheduleMgmt mode="route" />
            )}
            {activeSidebar === "Lịch Trình" && <AdminSchedulePanel />}
            {activeSidebar === "Quản Lý Ví" && <AdminWalletPanel />}
            {activeSidebar === "Người Dùng" && <UserManagement />}
            {activeSidebar === "Quản Lý Tàu" && <AdminTrainPanel />}
            {activeSidebar === "Giá Vé" && <AdminPricingPanel />}
            {activeSidebar === "Khuyến Mãi" && <AdminPromotionPanel />}
            {activeSidebar === "Đặt Vé" && <AdminBookingPanel />}
            {activeSidebar === "Báo Cáo" && <AdminReportsPanel />}
            {activeSidebar === "Lịch Sử Hệ Thống" && <AdminAuditLogsPanel />}
            {activeSidebar === "Điều Hành Tàu" && <AdminLiveTrackingPanel />}

            {/* DEFAULT TAB: TỔNG QUAN */}
            {activeSidebar === "Tổng Quan" && (
              <>
                {/* Delayed incident alerts */}
                {delayedAlerts.length > 0 && (
                  <div className="bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-2xl p-4 flex flex-col gap-2.5 shadow-sm">
                    <h4 className="text-sm font-bold text-[#ba1a1a] flex items-center gap-1.5">
                      <span className="material-symbols-outlined">warning</span>
                      Cảnh báo: Phát hiện {delayedAlerts.length} chuyến tàu trễ
                      &gt; 10 phút
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {delayedAlerts.slice(0, 3).map((da) => (
                        <div
                          key={da.id}
                          className="bg-white rounded-xl p-3 border border-[#ffdad6] flex items-center justify-between text-xs font-semibold"
                        >
                          <div>
                            <p className="text-[#ba1a1a] font-bold">
                              {da.train?.trainCode || "Tàu"} (
                              {da.route?.routeName || "Tuyến"})
                            </p>
                            <p className="text-[#3f4852] mt-0.5">
                              Thời gian trễ:{" "}
                              <strong className="text-red-600">
                                {da.delayMinutes} phút
                              </strong>
                            </p>
                          </div>
                          <button
                            onClick={() => setActiveSidebar("Điều Hành Tàu")}
                            className="px-2.5 py-1 bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 text-white rounded-lg text-[10px] font-bold border-none cursor-pointer"
                          >
                            Điều hành
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Welcome section with Quick Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-[#191c1e] tracking-tight">
                      Tổng Quan Hệ Thống
                    </h2>
                    <p className="text-sm text-[#3f4852] mt-1">
                      Chào buổi sáng! Cập nhật thời gian thực từ hệ thống liên
                      tuyến GoTrain VN.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleQuickAddSchedule}
                      className="px-4 py-2.5 bg-[#00629d] hover:bg-[#00629d]/90 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:shadow-lg active:scale-95 transition-all border-none cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        add
                      </span>
                      Tạo Lịch Trình
                    </button>
                    <button
                      onClick={handleExportReport}
                      disabled={isExporting}
                      className="px-4 py-2.5 bg-white border border-[#bec7d4]/50 hover:bg-[#f2f4f6] text-[#3f4852] rounded-xl font-semibold text-xs flex items-center gap-1.5 hover:shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      {isExporting ? (
                        <span className="material-symbols-outlined text-[16px] animate-spin">
                          progress_activity
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[16px]">
                          download
                        </span>
                      )}
                      Xuất Báo Cáo
                    </button>
                  </div>
                </div>

                {/* 1. Nhóm chỉ số KPI chính (KPI Summary Cards) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Monthly Revenue Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-[#6f7883] uppercase tracking-wide">
                          Doanh Thu Tháng
                        </p>
                        <p className="text-xl font-extrabold text-[#00629d] mt-2">
                          {formatCurrency(overviewStats.totalRevenue)}
                        </p>
                        <span className="text-[11px] text-green-600 font-bold flex items-center mt-2">
                          <span className="material-symbols-outlined text-[12px] mr-0.5">
                            trending_up
                          </span>
                          +12.5% so với tháng trước
                        </span>
                      </div>
                      <div className="p-2.5 bg-[#cfe5ff]/40 rounded-xl text-[#00629d]">
                        <span className="material-symbols-outlined">
                          payments
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Bookings Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-[#6f7883] uppercase tracking-wide">
                          Tổng Vé Đặt
                        </p>
                        <p className="text-xl font-extrabold text-slate-800 mt-2">
                          {formatNumber(overviewStats.totalBookings)} vé
                        </p>
                        <div className="flex gap-3 text-[10px] text-[#3f4852] font-semibold mt-2.5">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            Success: {successPct}%
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                            Cancelled: {cancelledPct}%
                          </span>
                          {pendingPct > 0 && (
                            <span className="flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                              Pending: {pendingPct}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                        <span className="material-symbols-outlined">
                          confirmation_number
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Active Trains Status Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-[#6f7883] uppercase tracking-wide">
                          Trạng Thái Đội Tàu
                        </p>
                        <p className="text-xl font-extrabold text-slate-800 mt-2">
                          {activeTrains}{" "}
                          <span className="text-xs text-[#6f7883] font-normal">
                            / {totalTrains} đang chạy
                          </span>
                        </p>
                        <span className="text-[11px] text-[#00629d] font-bold flex items-center mt-2.5">
                          <span className="material-symbols-outlined text-[12px] mr-0.5">
                            percent
                          </span>
                          Tỷ lệ lấp đầy ghế: {trainUtilization}%
                        </span>
                      </div>
                      <div className="p-2.5 bg-violet-50 rounded-xl text-violet-600">
                        <span className="material-symbols-outlined">train</span>
                      </div>
                    </div>
                  </div>

                  {/* Average Ticket Value Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-[#6f7883] uppercase tracking-wide">
                          Giá Vé Trung Bình
                        </p>
                        <p className="text-xl font-extrabold text-slate-800 mt-2">
                          {formatCurrency(overviewStats.avgBookingValue)}
                        </p>
                        <span className="text-[11px] text-[#6f7883] font-medium flex items-center mt-2.5">
                          Tính trên vé đặt thành công
                        </span>
                      </div>
                      <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
                        <span className="material-symbols-outlined">
                          analytics
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Biểu đồ xu hướng và Cơ cấu hạng vé (Visual Analytics Row 1) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Revenue Trend Chart Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 lg:col-span-2">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-base text-[#191c1e]">
                          Biểu Đồ Xu Hướng Doanh Thu
                        </h3>
                        <p className="text-xs text-[#3f4852] mt-0.5">
                          Thống kê thống kê biểu diễn doanh thu từ bán vé
                        </p>
                      </div>

                      {/* Period Selection Controls */}
                      <div className="flex bg-[#f2f4f6] p-0.5 rounded-lg border border-[#bec7d4]/30">
                        {["daily", "monthly", "yearly"].map((p) => (
                          <button
                            key={p}
                            onClick={() => setStatsPeriod(p)}
                            className={`py-1 px-3.5 rounded-md text-xs font-bold transition-all border-none ${
                              statsPeriod === p
                                ? "bg-white text-[#00629d] shadow-sm"
                                : "text-[#3f4852] hover:text-[#00629d] bg-transparent cursor-pointer"
                            }`}
                          >
                            {p === "daily"
                              ? "Ngày"
                              : p === "monthly"
                                ? "Tháng"
                                : "Năm"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic Bar Chart representation */}
                    <div className="relative h-60 w-full mt-4 flex items-end">
                      {/* Grid Lines background */}
                      <div className="absolute inset-0 flex flex-col justify-between py-6 pointer-events-none border-b border-[#bec7d4]/10">
                        <div className="w-full border-t border-[#bec7d4]/5"></div>
                        <div className="w-full border-t border-[#bec7d4]/5"></div>
                        <div className="w-full border-t border-[#bec7d4]/5"></div>
                      </div>

                      {statsLoading ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-[#00629d]">
                          <span className="material-symbols-outlined animate-spin text-2xl mb-1">
                            progress_activity
                          </span>
                          <span className="text-xs font-semibold">
                            Đang cập nhật biểu đồ...
                          </span>
                        </div>
                      ) : (
                        <div className="relative flex h-full w-full items-end gap-4 px-2">
                          {revenueSeries.map((item, i) => {
                            const maxVal = Math.max(
                              ...revenueSeries.map((r) => r.value),
                              1,
                            );
                            const pct = (item.value / maxVal) * 100;
                            return (
                              <div
                                key={i}
                                className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
                              >
                                <div className="relative flex h-[calc(100%-24px)] w-full flex-col justify-end">
                                  <div
                                    className="w-full rounded-t-lg bg-gradient-to-t from-[#00629d] to-[#00a3ff] transition-all duration-500 group-hover:from-[#0086cf] group-hover:to-[#00c2ff]"
                                    style={{ height: `${Math.max(pct, 6)}%` }}
                                  />
                                  <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-lg bg-[#191c1e] px-2.5 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 whitespace-nowrap z-20">
                                    {formatCurrency(item.value)}
                                  </div>
                                </div>
                                <span className="h-4 text-[10px] font-bold text-[#6f7883]">
                                  {item.label}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Donut Chart Card: Ticket Class Structure */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-base text-[#191c1e]">
                        Cơ Cấu Hạng Vé
                      </h3>
                      <p className="text-xs text-[#3f4852] mt-0.5">
                        Tỷ trọng đặt vé theo loại chỗ trên tàu
                      </p>
                    </div>

                    <div className="flex items-center justify-center my-4">
                      <div className="relative w-36 h-36">
                        <svg
                          viewBox="0 0 100 100"
                          className="transform -rotate-90 w-full h-full"
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#f2f4f6"
                            strokeWidth="12"
                          />
                          {/* Sleeper */}
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="12"
                            strokeDasharray={`${sleeperArc} ${circumference}`}
                            strokeDashoffset="0"
                            strokeLinecap="round"
                          />
                          {/* AC Soft Seat */}
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="12"
                            strokeDasharray={`${seatArc} ${circumference}`}
                            strokeDashoffset={`-${sleeperArc}`}
                            strokeLinecap="round"
                          />
                          {/* Hard Seat */}
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#f59e0b"
                            strokeWidth="12"
                            strokeDasharray={`${hardArc} ${circumference}`}
                            strokeDashoffset={`-${sleeperArc + seatArc}`}
                            strokeLinecap="round"
                          />
                          {/* Other */}
                          <circle
                            cx="50"
                            cy="50"
                            r="40"
                            fill="none"
                            stroke="#9ca3af"
                            strokeWidth="12"
                            strokeDasharray={`${otherArc} ${circumference}`}
                            strokeDashoffset={`-${sleeperArc + seatArc + hardArc}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <p className="text-lg font-extrabold text-[#191c1e] leading-none">
                            {sleeperPct}%
                          </p>
                          <p className="text-[9px] text-[#6f7883] font-bold uppercase mt-1">
                            Nằm
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <span className="w-2 h-2 rounded-full bg-[#10b981]" />
                        <span className="truncate">Nằm: {sleeperPct}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
                        <span className="truncate">Mềm: {seatPct}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                        <span className="truncate">Cứng: {hardPct}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                        <span className="w-2 h-2 rounded-full bg-[#9ca3af]" />
                        <span className="truncate">
                          Khác: {otherPct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Phân tuyến phổ biến & Bản đồ nhiệt lấp đầy (Visual Analytics Row 2) */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Popular Routes Column */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 lg:col-span-1">
                    <h3 className="font-bold text-base text-[#191c1e] mb-4">
                      Tuyến Đường Phổ Biến
                    </h3>
                    <div className="space-y-4">
                      {topRoutes.slice(0, 4).map((route, i) => (
                        <div key={i} className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 ${
                              i === 0
                                ? "bg-[#cfe5ff] text-[#00629d]"
                                : "bg-slate-100 text-[#3f4852]"
                            }`}
                          >
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between mb-1 text-xs">
                              <p className="font-semibold text-slate-800 truncate">
                                {route.name}
                              </p>
                              <span className="font-bold text-[#00629d]">
                                {route.bookings} vé
                              </span>
                            </div>
                            <div className="w-full bg-[#eceef0] rounded-full h-1.5">
                              <div
                                className="bg-[#00629d] h-1.5 rounded-full"
                                style={{ width: `${route.occupancy ?? 0}%` }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 font-semibold">
                              <span>{formatCurrency(route.revenue)}</span>
                              <span className="text-[#00629d]">
                                Lấp đầy: {route.occupancy ?? 0}%
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Seat/Occupancy Heatmap Card */}
                  <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 lg:col-span-2">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-base text-[#191c1e]">
                          Bản Đồ Nhiệt Tỷ Lệ Lấp Đầy (Seat Heatmap)
                        </h3>
                        <p className="text-xs text-[#3f4852] mt-0.5">
                          Tỷ lệ đặt ghế theo ngày trong tuần và các khung giờ đi
                          tàu
                        </p>
                      </div>

                      {/* Mini color legend */}
                      <div className="flex gap-2 text-[10px] font-bold text-[#6f7883]">
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-sky-500/10 border border-sky-100" />
                          &lt;40%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-sky-500/30" />
                          40-70%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-[#cfe5ff]" />
                          70-90%
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded bg-[#00629d]" />
                          &gt;90%
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="min-w-[480px]">
                        {/* Headers */}
                        <div className="grid grid-cols-5 gap-2 mb-2 text-[10px] font-bold text-[#3f4852] text-center">
                          <div className="text-left pl-2">Ngày</div>
                          {slotLabels.map((lbl) => (
                            <div key={lbl}>{lbl}</div>
                          ))}
                        </div>

                        {/* Heatmap Grid */}
                        <div className="space-y-2">
                          {heatmapData.map((dayRow, idx) => (
                            <div
                              key={idx}
                              className="grid grid-cols-5 gap-2 items-center text-center"
                            >
                              <div className="text-xs font-bold text-slate-700 text-left pl-2 shrink-0">
                                {dayRow.day}
                              </div>
                              {dayRow.slots.map((pct, sIdx) => {
                                let bgClass =
                                  "bg-sky-500/10 text-sky-700 border border-sky-200/20";
                                if (pct >= 40 && pct < 70)
                                  bgClass = "bg-sky-500/30 text-sky-800";
                                if (pct >= 70 && pct < 90)
                                  bgClass =
                                    "bg-[#cfe5ff] text-[#00629d] font-bold";
                                if (pct >= 90)
                                  bgClass = "bg-[#00629d] text-white font-bold";

                                return (
                                  <div
                                    key={sIdx}
                                    className={`py-2 rounded-xl text-xs transition-all hover:scale-[1.03] shadow-sm select-none ${bgClass}`}
                                    title={`Tỷ lệ lấp đầy slot này: ${pct}%`}
                                  >
                                    {pct}%
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Live Dispatching Banner & 4. Upcoming Schedules (Live Operations) */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Live Dispatching full map callout */}
                  <div className="bg-gradient-to-r from-[#0b1b2b] to-[#12283f] rounded-2xl p-6 border border-cyan-500/10 flex flex-col md:flex-row items-center justify-between gap-6 shadow-md relative overflow-hidden group">
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 pointer-events-none opacity-20 group-hover:opacity-30 transition-opacity">
                      {/* Radar pulse effect visualization */}
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-cyan-500 animate-ping"></div>
                      <div className="absolute right-10 top-1/2 -translate-y-1/2 w-32 h-32 rounded-full border border-cyan-500/40"></div>
                      <div className="absolute right-18 top-1/2 -translate-y-1/2 w-16 h-16 rounded-full border border-cyan-500/60"></div>
                    </div>

                    <div className="space-y-1.5 relative z-10">
                      <span className="px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 rounded-md text-[10px] font-bold uppercase tracking-wider">
                        Định Vị Tàu Thời Gian Thực
                      </span>
                      <h3 className="text-lg font-bold text-white">
                        Bản đồ điều phối toàn mạng lưới đường sắt
                      </h3>
                      <p className="text-xs text-slate-300">
                        Theo dõi tọa độ GPS, tốc độ vận hành, nhiệt độ toa xe và
                        hỗ trợ kiểm soát delay ga trung gian trực tiếp trên bản
                        đồ mạng lưới.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setActiveSidebar("Điều Hành Tàu");
                        toast.success("Đang mở Bản đồ điều phối GPS...");
                      }}
                      className="px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-[#0b1b2b] rounded-xl font-bold text-sm shadow-lg shadow-cyan-500/10 hover:shadow-cyan-500/20 hover:scale-105 active:scale-95 transition-all shrink-0 border-none cursor-pointer"
                    >
                      Mở Bản Đồ Toàn Màn Hình
                    </button>
                  </div>

                  {/* Upcoming Schedules Table */}
                  <div className="bg-white rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 overflow-hidden">
                    <div className="p-6 border-b border-[#bec7d4]/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                        <h3 className="font-bold text-base text-[#191c1e]">
                          Lịch Trình Sắp Tới (Upcoming Schedules)
                        </h3>
                        <p className="text-xs text-[#3f4852] mt-0.5">
                          Các chuyến tàu dự kiến khởi hành trong vòng 24 giờ tới
                          (nạp trực tiếp từ DB)
                        </p>
                      </div>

                      <button
                        onClick={handleQuickAddSchedule}
                        className="flex items-center gap-1.5 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-4 py-2 rounded-xl font-semibold text-xs hover:shadow-md transition-all border-none cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          add
                        </span>
                        Thêm Lịch Trình
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200/50">
                            <th className="px-6 py-3.5 font-bold text-[#3f4852] text-xs">
                              Mã Tàu
                            </th>
                            <th className="px-6 py-3.5 font-bold text-[#3f4852] text-xs">
                              Tuyến & Lộ Trình
                            </th>
                            <th className="px-6 py-3.5 font-bold text-[#3f4852] text-xs">
                              Giờ Khởi Hành
                            </th>
                            <th className="px-6 py-3.5 font-bold text-[#3f4852] text-xs">
                              Trạng Thái
                            </th>
                            <th className="px-6 py-3.5 font-bold text-[#3f4852] text-xs text-right">
                              Thao Tác
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {upcomingLoading ? (
                            <tr>
                              <td
                                colSpan="5"
                                className="py-12 text-center text-xs text-slate-400 font-semibold"
                              >
                                <span className="material-symbols-outlined animate-spin text-xl mb-1.5">
                                  progress_activity
                                </span>
                                <p>Đang tải danh sách lịch trình thực tế...</p>
                              </td>
                            </tr>
                          ) : filteredUpcoming.length === 0 ? (
                            <tr>
                              <td
                                colSpan="5"
                                className="py-12 text-center text-xs text-slate-400"
                              >
                                Không tìm thấy lịch trình nào sắp khởi hành phù
                                hợp.
                              </td>
                            </tr>
                          ) : (
                            filteredUpcoming.map((row) => {
                              const schedStatus = getScheduleStatus(row);
                              return (
                                <tr
                                  key={row.id}
                                  className="hover:bg-slate-50/50 transition-colors text-xs font-semibold text-slate-700"
                                >
                                  <td className="px-6 py-4 text-[#00629d] font-bold">
                                    {row.train?.trainCode || "TÀU"}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-1">
                                      <span>
                                        {row.route?.routeName || "Hành trình"}
                                      </span>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      {row.startStation?.stationName || "Ga đi"}{" "}
                                      →{" "}
                                      {row.endStation?.stationName || "Ga đến"}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    {formatDateTime(row.departureTime)}
                                    {row.delayMinutes > 0 && (
                                      <span className="text-red-500 ml-1.5">
                                        (+{row.delayMinutes}p trễ)
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <span
                                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE_CLASS[schedStatus] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                                    >
                                      <span
                                        className={`w-1.5 h-1.5 rounded-full ${
                                          schedStatus === "Đang chạy"
                                            ? "bg-green-500 animate-pulse"
                                            : schedStatus === "Hủy bỏ"
                                              ? "bg-red-500"
                                              : schedStatus === "Hoàn thành"
                                                ? "bg-slate-400"
                                                : "bg-amber-500"
                                        }`}
                                      />
                                      {schedStatus}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4 text-right space-x-1.5">
                                    <button
                                      onClick={() => {
                                        setActiveSidebar("Lịch Trình");
                                        toast.success(
                                          `Đang mở quản lý lịch trình cho ${row.train?.trainCode}`,
                                        );
                                      }}
                                      className="p-1.5 text-[#00629d] hover:bg-[#cfe5ff]/50 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                                      title="Quản lý"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">
                                        edit
                                      </span>
                                    </button>
                                    <button
                                      onClick={() => {
                                        setActiveSidebar("Điều Hành Tàu");
                                        toast.success(
                                          `Đang mở điều hành live cho ${row.train?.trainCode}`,
                                        );
                                      }}
                                      className="p-1.5 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-all border-none bg-transparent cursor-pointer"
                                      title="Điều hành"
                                    >
                                      <span className="material-symbols-outlined text-[18px]">
                                        explore
                                      </span>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer Section */}
          <footer className="mt-auto py-6 border-t border-[#bec7d4]/10 px-8 bg-[#f2f4f6]/20">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 max-w-[1200px] mx-auto w-full text-xs">
              <p className="font-label-sm text-[#3f4852]">
                © 2026 GoTrain VN. Tất cả quyền được bảo lưu.
              </p>
              <div className="flex gap-6">
                <a
                  className="font-label-sm text-[#3f4852] hover:text-[#00629d] transition-colors"
                  href="#"
                >
                  Về Chúng Tôi
                </a>
                <a
                  className="font-label-sm text-[#3f4852] hover:text-[#00629d] transition-colors"
                  href="#"
                >
                  Chính Sách
                </a>
                <a
                  className="font-label-sm text-[#3f4852] hover:text-[#00629d] transition-colors"
                  href="#"
                >
                  Hỗ Trợ
                </a>
                <a
                  className="font-label-sm text-[#3f4852] hover:text-[#00629d] transition-colors"
                  href="#"
                >
                  Điều Khoản
                </a>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Floating AI Assistant Button */}
      <button
        onClick={handleAiAssistant}
        onMouseEnter={() => setShowAiTooltip(true)}
        onMouseLeave={() => setShowAiTooltip(false)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-tr from-[#00629d] to-[#00a3ff] text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 animate-float group border-none cursor-pointer"
      >
        <span className="material-symbols-outlined text-[28px]">smart_toy</span>
        <div
          className={`absolute right-full mr-4 bg-white px-4 py-2 rounded-xl shadow-lg border border-[#bec7d4]/20 pointer-events-none transition-opacity duration-300 whitespace-nowrap ${showAiTooltip ? "opacity-100" : "opacity-0"}`}
        >
          <p className="font-label-md text-[#00629d] text-sm font-semibold">
            Hỏi AI Trợ Lý
          </p>
        </div>
      </button>
    </div>
  );
}
