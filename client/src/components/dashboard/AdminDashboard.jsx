import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { toast } from "sonner";
import { RouteScheduleMgmt } from "./RouteScheduleMgmt";
import { AdminWalletPanel } from "./AdminWalletPanel.jsx";
import { UserManagement } from "./UserManagement";
import { AdminSchedulePanel } from "./AdminSchedulePanel.jsx";
import { AdminTrainPanel } from "./AdminTrainPanel.jsx";

export function AdminDashboard() {
  const { user, clearAuth } = useAuth();
  const navigate = useNavigate();

  // State management
  const [activeSidebar, setActiveSidebar] = useState("Tổng Quan");
  const [currentPage, setCurrentPage] = useState(1);
  const [searchFocused, setSearchFocused] = useState(false);
  const [showAiTooltip, setShowAiTooltip] = useState(false);

  // Sidebar links definition
  const sidebarLinks = [
    { label: "Tổng Quan", icon: "dashboard" },
    { label: "Quản Lý Tuyến", icon: "route" },
    { label: "Lịch Trình", icon: "calendar_month" },
    { label: "Quản Lý Tàu", icon: "train" },
    { label: "Giá Vé", icon: "payments" },
    { label: "Người Dùng", icon: "group" },
    { label: "Quản Lý Ví", icon: "account_balance_wallet" },
    { label: "Báo Cáo", icon: "analytics" },
  ];

  // Mock schedule data for pagination demonstration
  const scheduleData = {
    1: [
      {
        id: "SE1-HB",
        from: "Hà Nội",
        to: "Đà Nẵng",
        time: "06:30 | 12/10/2024",
        status: "Đúng giờ",
        statusType: "success",
      },
      {
        id: "TN2-SG",
        from: "Sài Gòn",
        to: "Nha Trang",
        time: "08:15 | 12/10/2024",
        status: "Trễ 15p",
        statusType: "danger",
      },
      {
        id: "SE3-LC",
        from: "Hà Nội",
        to: "Lào Cai",
        time: "21:30 | 12/10/2024",
        status: "Sắp tới",
        statusType: "secondary",
      },
      {
        id: "HD1-VT",
        from: "Hải Dương",
        to: "Vũng Tàu",
        time: "13:45 | 12/10/2024",
        status: "Đúng giờ",
        statusType: "success",
      },
    ],
    2: [
      {
        id: "SE5-DN",
        from: "Đà Nẵng",
        to: "Hà Nội",
        time: "10:00 | 12/10/2024",
        status: "Đúng giờ",
        statusType: "success",
      },
      {
        id: "SE2-SG",
        from: "Nha Trang",
        to: "Sài Gòn",
        time: "14:20 | 12/10/2024",
        status: "Đúng giờ",
        statusType: "success",
      },
      {
        id: "SP1-LC",
        from: "Hà Nội",
        to: "Sapa",
        time: "22:00 | 12/10/2024",
        status: "Sắp tới",
        statusType: "secondary",
      },
      {
        id: "QB1-DH",
        from: "Đồng Hới",
        to: "Huế",
        time: "17:30 | 12/10/2024",
        status: "Trễ 5p",
        statusType: "danger",
      },
    ],
    3: [
      {
        id: "SE7-SG",
        from: "Hà Nội",
        to: "Sài Gòn",
        time: "06:00 | 13/10/2024",
        status: "Sắp tới",
        statusType: "secondary",
      },
      {
        id: "TN1-HN",
        from: "Sài Gòn",
        to: "Hà Nội",
        time: "19:00 | 13/10/2024",
        status: "Sắp tới",
        statusType: "secondary",
      },
      {
        id: "HP1-HP",
        from: "Hà Nội",
        to: "Hải Phòng",
        time: "09:15 | 13/10/2024",
        status: "Đúng giờ",
        statusType: "success",
      },
      {
        id: "SE9-DN",
        from: "Vinh",
        to: "Đà Nẵng",
        time: "11:45 | 13/10/2024",
        status: "Trễ 20p",
        statusType: "danger",
      },
    ],
  };

  const handleLogout = () => {
    clearAuth();
    toast.success("Đăng xuất thành công!");
    navigate("/");
  };

  const handleTicketRequest = () => {
    toast.success(
      "Gửi yêu cầu hỗ trợ thành công! IT sẽ liên hệ lại bạn trong ít phút.",
    );
  };

  const handleAiAssistant = () => {
    toast.info(
      "Trợ lý AI đang được nâng cấp hệ thống dữ liệu. Vui lòng thử lại sau!",
    );
  };

  const handleActionClick = (action, code) => {
    toast.success(`Đã nhấn ${action} lịch trình chuyến tàu ${code}`);
  };

  const handleAddSchedule = () => {
    toast.success("Đang mở biểu mẫu thêm lịch trình mới...");
  };

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
              className={`w-full flex items-center px-4 py-3 rounded-xl transition-all ${
                activeSidebar === link.label
                  ? "sidebar-item-active text-[#00629d] font-bold"
                  : "text-[#3f4852] hover:bg-[#d3e2ed]/50 hover:text-[#00629d]"
              }`}
            >
              <span className="material-symbols-outlined mr-3">
                {link.icon}
              </span>
              <span className="font-label-md text-sm">{link.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto">
          <button
            onClick={handleLogout}
            className="w-full flex items-center px-4 py-3 mb-4 rounded-xl text-[#ba1a1a] hover:bg-[#ffdad6]/40 group transition-all text-left"
          >
            <span className="material-symbols-outlined mr-3">logout</span>
            <span className="font-label-md text-sm font-semibold">
              Đăng xuất
            </span>
          </button>

          <div className="bg-[#cfe5ff]/30 rounded-2xl p-4 border border-[#cfe5ff]">
            <p className="font-label-sm text-[#00629d] font-bold mb-2 text-xs">
              Hỗ Trợ Kỹ Thuật
            </p>
            <p className="text-[11px] text-[#3f4852] leading-tight">
              Gặp sự cố hệ thống? Liên hệ ngay đội ngũ IT 24/7.
            </p>
            <button
              onClick={handleTicketRequest}
              className="mt-3 w-full bg-[#00629d] hover:bg-[#00629d]/90 text-white py-2 rounded-lg font-label-sm text-xs hover:shadow-lg transition-all"
            >
              Gửi Ticket
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f7f9fb] overflow-hidden">
        {/* Header / Top Bar */}
        <header className="glass-panel shrink-0 z-30 flex items-center justify-between px-8 py-4 border-b border-[#bec7d4]/20 shadow-sm">
          <div className="flex items-center gap-6">
            <button
              onClick={() =>
                toast.info("Tính năng menu di động đang được phát triển")
              }
              className="md:hidden p-2 hover:bg-[#eceef0] rounded-full flex items-center justify-center"
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
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
                className="pl-10 pr-4 py-2 bg-white border border-[#bec7d4]/50 rounded-xl focus:ring-2 focus:ring-[#00a3ff] focus:border-[#00a3ff] outline-none w-64 text-sm transition-all"
                placeholder="Tìm kiếm hành trình, vé..."
                type="text"
              />
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative group cursor-pointer p-2 rounded-full hover:bg-[#eceef0] transition-colors">
              <span className="material-symbols-outlined text-[#3f4852]">
                notifications
              </span>
              <span className="absolute top-2 right-2 w-2 h-2 bg-[#ba1a1a] rounded-full"></span>
            </div>
            <div className="flex items-center gap-3 pl-6 border-l border-[#bec7d4]/30">
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
            </div>
          </div>
        </header>

        {/* Scrollable content area — sidebar & header stay fixed above */}
        <div className="flex-1 overflow-y-auto">
          {/* Dashboard Content */}
          <div className="p-8 space-y-8">
            {activeSidebar === "Quản Lý Tuyến" && (
              <RouteScheduleMgmt mode="route" />
            )}
            {activeSidebar === "Lịch Trình" && <AdminSchedulePanel />}
            {activeSidebar === "Quản Lý Ví" && <AdminWalletPanel />}
            {activeSidebar === "Người Dùng" && <UserManagement />}
            {activeSidebar === "Quản Lý Tàu" && <AdminTrainPanel />}

            {activeSidebar !== "Quản Lý Tuyến" &&
              activeSidebar !== "Lịch Trình" &&
              activeSidebar !== "Quản Lý Ví" &&
              activeSidebar !== "Quản Lý Tàu" &&
              activeSidebar !== "Người Dùng" && (
                <>
                  {/* Welcome Section */}
                  <section>
                    <h2 className="font-headline-lg text-2xl font-bold text-[#191c1e]">
                      Tổng Quan Hệ Thống
                    </h2>
                    <p className="text-[#3f4852] mt-1 text-sm">
                      Chào buổi sáng, cập nhật mới nhất từ hệ thống đường sắt
                      ngày hôm nay.
                    </p>
                  </section>

                  {/* Stats Grid */}
                  <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Revenue Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 relative overflow-hidden group">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-label-md text-[#3f4852] text-sm">
                            Doanh Thu (Tháng này)
                          </p>
                          <p className="font-headline-lg text-2xl font-extrabold text-[#00629d] mt-1">
                            1.240.000.000đ
                          </p>
                          <span className="text-xs text-green-600 font-bold flex items-center mt-2">
                            <span className="material-symbols-outlined text-[14px] mr-0.5">
                              trending_up
                            </span>
                            +12.5% so với tháng trước
                          </span>
                        </div>
                        <div className="p-3 bg-[#cfe5ff]/40 rounded-xl text-[#00629d]">
                          <span className="material-symbols-outlined">
                            account_balance_wallet
                          </span>
                        </div>
                      </div>
                      {/* Mini Chart Simulation */}
                      <div className="h-16 flex items-end gap-1.5 mt-4">
                        <div className="flex-1 bg-[#00a3ff]/20 h-[40%] rounded-t-sm"></div>
                        <div className="flex-1 bg-[#00a3ff]/30 h-[60%] rounded-t-sm"></div>
                        <div className="flex-1 bg-[#00a3ff]/40 h-[45%] rounded-t-sm"></div>
                        <div className="flex-1 bg-[#00a3ff]/50 h-[75%] rounded-t-sm"></div>
                        <div className="flex-1 bg-[#00a3ff]/60 h-[90%] rounded-t-sm"></div>
                        <div className="flex-1 bg-[#00a3ff] h-[100%] rounded-t-sm"></div>
                      </div>
                    </div>

                    {/* Bookings Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 group flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-label-md text-[#3f4852] text-sm">
                            Tổng Lượt Đặt Vé
                          </p>
                          <p className="font-headline-lg text-2xl font-extrabold text-[#191c1e] mt-1">
                            8.432
                          </p>
                          <span className="text-xs text-green-600 font-bold flex items-center mt-2">
                            <span className="material-symbols-outlined text-[14px] mr-0.5">
                              arrow_upward
                            </span>
                            542 lượt mới hôm nay
                          </span>
                        </div>
                        <div className="p-3 bg-[#bac9d3]/40 rounded-xl text-[#526069]">
                          <span className="material-symbols-outlined">
                            confirmation_number
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-[#bec7d4]/20 flex gap-6">
                        <div>
                          <p className="text-[10px] uppercase text-[#3f4852]/60 font-bold">
                            Thành Công
                          </p>
                          <p className="font-label-md text-sm font-semibold">
                            98.2%
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase text-[#3f4852]/60 font-bold">
                            Đã Hủy
                          </p>
                          <p className="font-label-md text-sm font-semibold">
                            1.8%
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Active Trains Card */}
                    <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 group flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="font-label-md text-[#3f4852] text-sm">
                            Tàu Đang Hoạt Động
                          </p>
                          <p className="font-headline-lg text-2xl font-extrabold text-[#191c1e] mt-1">
                            42{" "}
                            <span className="text-sm font-normal text-[#3f4852]">
                              / 48
                            </span>
                          </p>
                          <span className="text-xs text-[#00629d] font-bold flex items-center mt-2">
                            <span className="material-symbols-outlined text-[14px] mr-0.5">
                              sync
                            </span>
                            Cập nhật 2 phút trước
                          </span>
                        </div>
                        <div className="p-3 bg-[#b4cbce]/40 rounded-xl text-[#4d6265]">
                          <span className="material-symbols-outlined">
                            settings_input_component
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-[#eceef0] rounded-full h-2 mt-4">
                        <div
                          className="bg-[#00629d] h-2 rounded-full"
                          style={{ width: "85%" }}
                        ></div>
                      </div>
                      <p className="text-[11px] text-[#3f4852] mt-2">
                        85% công suất khai thác hiện tại
                      </p>
                    </div>
                  </section>

                  {/* Revenue Chart & Featured Info */}
                  <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Main Chart */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10">
                      <div className="flex justify-between items-center mb-6">
                        <div>
                          <h3 className="font-headline-md text-lg font-bold text-[#191c1e]">
                            Biểu Đồ Doanh Thu Tuần
                          </h3>
                          <p className="text-xs text-[#3f4852]">
                            Thống kê chi tiết từ Thứ Hai đến Chủ Nhật
                          </p>
                        </div>
                        <select className="bg-[#f2f4f6] text-xs font-semibold py-1.5 px-3 border-none rounded-lg focus:ring-0 outline-none">
                          <option>7 ngày qua</option>
                          <option>30 ngày qua</option>
                        </select>
                      </div>

                      {/* Simulated Chart Canvas */}
                      <div className="relative h-64 w-full bg-gradient-to-t from-[#00629d]/5 to-transparent rounded-xl flex items-end px-6 pb-2">
                        {/* SVG Path for Line Chart Simulation */}
                        <svg
                          className="absolute inset-0 w-full h-full p-4"
                          preserveAspectRatio="none"
                        >
                          <path
                            className="opacity-80"
                            d="M 0 180 Q 50 140 120 170 T 260 110 T 400 130 T 540 60 T 680 80 T 820 40 T 960 70"
                            fill="none"
                            stroke="#00629d"
                            strokeWidth="3"
                          ></path>
                          <path
                            className="opacity-10"
                            d="M 0 180 Q 50 140 120 170 T 260 110 T 400 130 T 540 60 T 680 80 T 820 40 T 960 70 L 960 250 L 0 250 Z"
                            fill="url(#grad1)"
                          ></path>
                          <defs>
                            <linearGradient
                              id="grad1"
                              x1="0%"
                              x2="0%"
                              y1="0%"
                              y2="100%"
                            >
                              <stop
                                offset="0%"
                                style={{
                                  stopColor: "#00a3ff",
                                  stopOpacity: 0.3,
                                }}
                              ></stop>
                              <stop
                                offset="100%"
                                style={{ stopColor: "#00a3ff", stopOpacity: 0 }}
                              ></stop>
                            </linearGradient>
                          </defs>
                        </svg>

                        {/* Grid Lines */}
                        <div className="absolute inset-0 flex flex-col justify-between py-6 pointer-events-none">
                          <div className="w-full border-b border-[#bec7d4]/10"></div>
                          <div className="w-full border-b border-[#bec7d4]/10"></div>
                          <div className="w-full border-b border-[#bec7d4]/10"></div>
                          <div className="w-full border-b border-[#bec7d4]/10"></div>
                        </div>

                        {/* X-Axis Labels */}
                        <div className="flex justify-between w-full font-label-sm text-xs text-[#3f4852]/60 relative z-10">
                          <span>T2</span>
                          <span>T3</span>
                          <span>T4</span>
                          <span>T5</span>
                          <span>T6</span>
                          <span>T7</span>
                          <span>CN</span>
                        </div>
                      </div>
                    </div>

                    {/* Route Performance */}
                    <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-col justify-between">
                      <h3 className="font-headline-md text-lg font-bold text-[#191c1e] mb-4">
                        Tuyến Phổ Biến
                      </h3>
                      <div className="space-y-4 flex-1 flex flex-col justify-center">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#d3e2ed] flex items-center justify-center text-[#00629d] font-bold">
                            1
                          </div>
                          <div className="flex-1">
                            <p className="font-label-md text-sm font-semibold">
                              Hà Nội - Đà Nẵng
                            </p>
                            <div className="w-full bg-[#eceef0] h-1.5 rounded-full mt-1">
                              <div
                                className="bg-[#00629d] h-1.5 rounded-full"
                                style={{ width: "92%" }}
                              ></div>
                            </div>
                          </div>
                          <p className="font-label-sm text-xs text-[#3f4852] font-semibold">
                            92%
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#eceef0] flex items-center justify-center text-[#3f4852] font-bold">
                            2
                          </div>
                          <div className="flex-1">
                            <p className="font-label-md text-sm font-semibold">
                              TP.HCM - Nha Trang
                            </p>
                            <div className="w-full bg-[#eceef0] h-1.5 rounded-full mt-1">
                              <div
                                className="bg-[#00629d] h-1.5 rounded-full"
                                style={{ width: "78%" }}
                              ></div>
                            </div>
                          </div>
                          <p className="font-label-sm text-xs text-[#3f4852] font-semibold">
                            78%
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#eceef0] flex items-center justify-center text-[#3f4852] font-bold">
                            3
                          </div>
                          <div className="flex-1">
                            <p className="font-label-md text-sm font-semibold">
                              Hà Nội - Lào Cai
                            </p>
                            <div className="w-full bg-[#eceef0] h-1.5 rounded-full mt-1">
                              <div
                                className="bg-[#00629d] h-1.5 rounded-full"
                                style={{ width: "65%" }}
                              ></div>
                            </div>
                          </div>
                          <p className="font-label-sm text-xs text-[#3f4852] font-semibold">
                            65%
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-[#eceef0] flex items-center justify-center text-[#3f4852] font-bold">
                            4
                          </div>
                          <div className="flex-1">
                            <p className="font-label-md text-sm font-semibold">
                              Huế - Quy Nhơn
                            </p>
                            <div className="w-full bg-[#eceef0] h-1.5 rounded-full mt-1">
                              <div
                                className="bg-[#00629d] h-1.5 rounded-full"
                                style={{ width: "42%" }}
                              ></div>
                            </div>
                          </div>
                          <p className="font-label-sm text-xs text-[#3f4852] font-semibold">
                            42%
                          </p>
                        </div>
                      </div>
                      <button className="w-full mt-4 py-2 text-[#00629d] hover:bg-[#00629d]/10 rounded-xl font-label-md text-sm font-semibold transition-all">
                        Xem tất cả báo cáo
                      </button>
                    </div>
                  </section>

                  {/* Management Table */}
                  <section className="bg-white rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 overflow-hidden">
                    <div className="p-6 border-b border-[#bec7d4]/10 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div>
                        <h3 className="font-headline-md text-lg font-bold text-[#191c1e]">
                          Lịch Trình Sắp Tới
                        </h3>
                        <p className="text-xs text-[#3f4852]">
                          Danh sách các chuyến tàu khởi hành trong 24h tới
                        </p>
                      </div>
                      <button
                        onClick={handleAddSchedule}
                        className="flex items-center gap-1.5 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-5 py-2.5 rounded-xl font-label-md text-sm hover:shadow-lg active:scale-95 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          add
                        </span>
                        Thêm Lịch Trình
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-[#f2f4f6]/50">
                            <th className="px-6 py-4 font-label-md text-[#3f4852] text-sm">
                              Mã Tàu
                            </th>
                            <th className="px-6 py-4 font-label-md text-[#3f4852] text-sm">
                              Tuyến
                            </th>
                            <th className="px-6 py-4 font-label-md text-[#3f4852] text-sm">
                              Giờ Khởi Hành
                            </th>
                            <th className="px-6 py-4 font-label-md text-[#3f4852] text-sm">
                              Trạng Thái
                            </th>
                            <th className="px-6 py-4 font-label-md text-[#3f4852] text-sm text-right">
                              Thao Tác
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#bec7d4]/10">
                          {scheduleData[currentPage].map((row, idx) => (
                            <tr
                              key={idx}
                              className="hover:bg-[#f7f9fb] transition-colors"
                            >
                              <td className="px-6 py-4 font-label-md text-sm text-[#00629d] font-bold">
                                {row.id}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-body-md text-sm font-semibold">
                                    {row.from}
                                  </span>
                                  <span className="material-symbols-outlined text-[16px] text-[#6f7883]">
                                    arrow_forward
                                  </span>
                                  <span className="font-body-md text-sm font-semibold">
                                    {row.to}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-[#3f4852] text-sm">
                                {row.time}
                              </td>
                              <td className="px-6 py-4">
                                <span
                                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold ${
                                    row.statusType === "success"
                                      ? "bg-green-100 text-green-700"
                                      : row.statusType === "danger"
                                        ? "bg-[#ffdad6] text-[#ba1a1a]"
                                        : "bg-[#eceef0] text-[#3f4852]"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      row.statusType === "success"
                                        ? "bg-green-600"
                                        : row.statusType === "danger"
                                          ? "bg-[#ba1a1a]"
                                          : "bg-[#3f4852]/40"
                                    }`}
                                  ></span>
                                  {row.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right space-x-2">
                                <button
                                  onClick={() =>
                                    handleActionClick("Sửa", row.id)
                                  }
                                  className="p-2 text-[#00629d] hover:bg-[#cfe5ff]/50 rounded-lg transition-all cursor-pointer"
                                  title="Sửa"
                                >
                                  <span className="material-symbols-outlined text-[20px]">
                                    edit
                                  </span>
                                </button>
                                <button
                                  onClick={() =>
                                    handleActionClick("Xóa", row.id)
                                  }
                                  className="p-2 text-[#ba1a1a] hover:bg-[#ffdad6]/60 rounded-lg transition-all cursor-pointer"
                                  title="Xóa"
                                >
                                  <span className="material-symbols-outlined text-[20px]">
                                    delete
                                  </span>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="p-6 flex flex-col sm:flex-row justify-between items-center gap-4 bg-[#f2f4f6]/30">
                      <p className="font-label-sm text-xs text-[#3f4852]">
                        Hiển thị 4 trong số 12 lịch trình
                      </p>
                      <div className="flex gap-1">
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.max(1, prev - 1))
                          }
                          disabled={currentPage === 1}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            chevron_left
                          </span>
                        </button>
                        {[1, 2, 3].map((page) => (
                          <button
                            key={page}
                            onClick={() => setCurrentPage(page)}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg font-label-sm text-xs ${
                              currentPage === page
                                ? "bg-[#00629d] text-white"
                                : "border border-[#bec7d4] hover:bg-white cursor-pointer"
                            }`}
                          >
                            {page}
                          </button>
                        ))}
                        <button
                          onClick={() =>
                            setCurrentPage((prev) => Math.min(3, prev + 1))
                          }
                          disabled={currentPage === 3}
                          className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-white disabled:opacity-50 transition-all cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            chevron_right
                          </span>
                        </button>
                      </div>
                    </div>
                  </section>
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
        {/* end scrollable wrapper */}
      </main>

      {/* Floating Action Button for Quick Actions */}
      <button
        onClick={handleAiAssistant}
        onMouseEnter={() => setShowAiTooltip(true)}
        onMouseLeave={() => setShowAiTooltip(false)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-tr from-[#00629d] to-[#00a3ff] text-white rounded-full shadow-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 animate-float group cursor-pointer"
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
