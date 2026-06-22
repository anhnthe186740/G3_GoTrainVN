import { useState, useEffect } from "react";
import { api } from "../../services/api";

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount || 0);
}

const panelClass =
  "rounded-2xl border border-[#bec7d4]/20 bg-white shadow-[0px_10px_30px_rgba(0,163,255,0.05)]";
const periodLabels = {
  daily: {
    button: "Ngày",
    revenueTitle: "Doanh Thu Theo Ngày",
    revenueSubtitle: "Thống kê doanh thu 7 ngày gần nhất",
    bookingSubtitle: "Lượng vé phát sinh theo thứ trong kỳ hiện tại",
    trendSuffix: "so với ngày trước",
  },
  monthly: {
    button: "Tháng",
    revenueTitle: "Doanh Thu Theo Tháng",
    revenueSubtitle: "Thống kê doanh thu 6 tháng gần nhất",
    bookingSubtitle: "Lượng vé phát sinh theo thứ trong tháng hiện tại",
    trendSuffix: "so với tháng trước",
  },
  yearly: {
    button: "Năm",
    revenueTitle: "Doanh Thu Theo Năm",
    revenueSubtitle: "Thống kê doanh thu 5 năm gần nhất",
    bookingSubtitle: "Lượng vé phát sinh theo thứ trong năm hiện tại",
    trendSuffix: "so với năm trước",
  },
};

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <h3 className="text-base font-bold text-[#191c1e]">{title}</h3>
        {subtitle && (
          <p className="mt-1 text-xs leading-5 text-[#6f7883]">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

function StatCard({ title, value, subtitle, icon, tone, trend, trendSuffix }) {
  return (
    <div className={`${panelClass} min-h-[132px] p-5`}>
      <div className="flex h-full items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[#3f4852]">{title}</p>
          <p className="mt-2 truncate text-2xl font-extrabold leading-none text-[#191c1e]">
            {value}
          </p>
          {subtitle && (
            <p className="mt-2 truncate text-xs text-[#6f7883]">{subtitle}</p>
          )}
          {trend && (
            <span
              className={`mt-3 flex items-center text-xs font-bold ${trend >= 0 ? "text-emerald-600" : "text-[#ba1a1a]"}`}
            >
              <span className="material-symbols-outlined text-[14px] mr-0.5">
                {trend >= 0 ? "trending_up" : "trending_down"}
              </span>
              {trend >= 0 ? "+" : ""}
              {trend}% {trendSuffix || "so với kỳ trước"}
            </span>
          )}
        </div>
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
        >
          <span className="material-symbols-outlined text-[22px]">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, maxValue, compact = false }) {
  return (
    <div className={`relative ${compact ? "h-36" : "h-44"}`}>
      <div className="absolute inset-x-0 top-2 bottom-7 flex flex-col justify-between">
        {[0, 1, 2, 3].map((line) => (
          <div key={line} className="border-t border-[#bec7d4]/20" />
        ))}
      </div>
      <div className="relative flex h-full items-end gap-3">
        {data.map((item, i) => {
          const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
          return (
            <div
              key={i}
              className="group flex h-full flex-1 flex-col items-center justify-end gap-2"
            >
              <div className="relative flex h-[calc(100%-28px)] w-full flex-col justify-end">
                <div
                  className="w-full rounded-t-lg bg-[#00629d] transition-all duration-500 group-hover:bg-[#0086cf]"
                  style={{ height: `${Math.max(pct, 4)}%` }}
                />
                <div className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 rounded-lg bg-[#191c1e] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 whitespace-nowrap">
                  {typeof item.value === "number" && item.value > 100000
                    ? formatCurrency(item.value)
                    : item.value.toLocaleString("vi-VN")}
                </div>
              </div>
              <span className="h-4 text-[10px] font-semibold text-[#6f7883]">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const MOCK_STATS = {
  overview: {
    totalBookings: 8432,
    confirmedBookings: 7890,
    cancelledBookings: 421,
    pendingBookings: 121,
    totalRevenue: 1240000000,
    netRevenue: 1115000000,
    totalRefunds: 125000000,
    totalPassengers: 12847,
    avgBookingValue: 820000,
  },
  adminOverview: {
    totalUsers: 128,
    totalCustomers: 121,
    totalAdmins: 7,
    totalTrains: 42,
    totalRoutes: 18,
    totalSchedules: 326,
    activeSchedules: 301,
    delayedSchedules: 4,
    totalWalletBalance: 920000000,
    pendingWithdrawals: 6,
    refundThisMonth: 125000000,
  },
  monthly: [
    { label: "T1", value: 142000000 },
    { label: "T2", value: 98000000 },
    { label: "T3", value: 165000000 },
    { label: "T4", value: 190000000 },
    { label: "T5", value: 210000000 },
    { label: "T6", value: 240000000 },
  ],
  topRoutes: [
    { name: "Hà Nội → Đà Nẵng", bookings: 2341, revenue: 320000000 },
    { name: "TP.HCM → Nha Trang", bookings: 1892, revenue: 280000000 },
    { name: "Hà Nội → Lào Cai", bookings: 1203, revenue: 180000000 },
    { name: "Huế → Quy Nhơn", bookings: 987, revenue: 145000000 },
    { name: "Đà Nẵng → TP.HCM", bookings: 756, revenue: 120000000 },
  ],
  trainTypes: [
    { name: "Tàu Nhanh SE", count: 4120, pct: 48.9 },
    { name: "Tàu Thường TN", count: 2310, pct: 27.4 },
    { name: "Tàu Đêm", count: 1456, pct: 17.3 },
    { name: "Tàu Đặc Biệt", count: 546, pct: 6.4 },
  ],
  bookingByDay: [
    { label: "T2", value: 1230 },
    { label: "T3", value: 980 },
    { label: "T4", value: 1450 },
    { label: "T5", value: 1890 },
    { label: "T6", value: 2100 },
    { label: "T7", value: 2450 },
    { label: "CN", value: 1980 },
  ],
};

export function AdminReportsPanel() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("monthly");

  useEffect(() => {
    setLoading(true);
    // Try to fetch from API, fallback to mock
    api
      .get("/bookings/admin/stats", { params: { period } })
      .then(({ data }) => setStats(data.stats || MOCK_STATS))
      .catch(() => setStats(MOCK_STATS))
      .finally(() => setLoading(false));
  }, [period]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-10 h-10 border-3 border-[#00629d] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-[#3f4852]">Đang tải báo cáo...</p>
      </div>
    );
  }

  const s = stats?.overview || MOCK_STATS.overview;
  const admin = stats?.adminOverview || MOCK_STATS.adminOverview;
  const revenueSeries =
    stats?.revenueSeries || stats?.monthly || MOCK_STATS.monthly;
  const topRoutes = stats?.topRoutes || MOCK_STATS.topRoutes;
  const trainTypes = stats?.trainTypes || MOCK_STATS.trainTypes;
  const byDay = stats?.bookingByDay || MOCK_STATS.bookingByDay;
  const currentPeriod =
    periodLabels[stats?.period || period] || periodLabels.monthly;

  const maxRevenue = Math.max(...revenueSeries.map((m) => m.value), 0);
  const maxByDay = Math.max(...byDay.map((d) => d.value));
  const totalBookings = Math.max(s.totalBookings || 0, 1);
  const circumference = 251.2;
  const confirmedArc = (s.confirmedBookings / totalBookings) * circumference;
  const pendingArc = (s.pendingBookings / totalBookings) * circumference;
  const cancelledArc = (s.cancelledBookings / totalBookings) * circumference;
  const successRate = Math.round((s.confirmedBookings / totalBookings) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e]">
            Báo Cáo & Thống Kê
          </h2>
          <p className="text-sm text-[#3f4852] mt-1">
            Tổng quan hoạt động kinh doanh từ toàn bộ phân hệ admin
          </p>
        </div>
        <div className="flex rounded-2xl border border-[#bec7d4]/30 bg-white p-1 shadow-sm">
          {["daily", "monthly", "yearly"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`h-9 min-w-[72px] rounded-xl px-4 text-sm font-semibold transition-all ${
                period === p
                  ? "bg-[#00629d] text-white shadow-sm"
                  : "text-[#3f4852] hover:bg-[#f7f9fb]"
              }`}
            >
              {periodLabels[p].button}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Người Dùng"
          value={admin.totalUsers?.toLocaleString("vi-VN")}
          subtitle={`${admin.totalCustomers?.toLocaleString("vi-VN")} khách hàng, ${admin.totalAdmins?.toLocaleString("vi-VN")} quản trị`}
          icon="manage_accounts"
          tone="bg-[#f0f4f8] text-[#526069]"
        />
        <StatCard
          title="Tuyến Hoạt Động"
          value={admin.totalRoutes?.toLocaleString("vi-VN")}
          subtitle={`${admin.totalTrains?.toLocaleString("vi-VN")} đoàn tàu đang quản lý`}
          icon="route"
          tone="bg-[#cfe5ff]/50 text-[#00629d]"
        />
        <StatCard
          title="Lịch Trình"
          value={admin.totalSchedules?.toLocaleString("vi-VN")}
          subtitle={`${admin.activeSchedules?.toLocaleString("vi-VN")} đang hoạt động, ${admin.delayedSchedules?.toLocaleString("vi-VN")} trễ`}
          icon="calendar_month"
          tone="bg-emerald-50 text-emerald-600"
        />
        <StatCard
          title="Số Dư Ví"
          value={formatCurrency(admin.totalWalletBalance)}
          subtitle={`${admin.pendingWithdrawals?.toLocaleString("vi-VN")} yêu cầu rút chờ duyệt`}
          icon="account_balance_wallet"
          tone="bg-amber-50 text-amber-600"
        />
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng Doanh Thu"
          value={formatCurrency(s.totalRevenue)}
          subtitle={`Doanh thu thuần: ${formatCurrency(s.netRevenue)}`}
          icon="account_balance_wallet"
          tone="bg-[#cfe5ff]/50 text-[#00629d]"
          trend={12.5}
          trendSuffix={currentPeriod.trendSuffix}
        />
        <StatCard
          title="Tổng Đặt Vé"
          value={s.totalBookings?.toLocaleString("vi-VN")}
          subtitle={`${s.confirmedBookings?.toLocaleString("vi-VN")} đã xác nhận`}
          icon="confirmation_number"
          tone="bg-emerald-50 text-emerald-600"
          trend={8.3}
          trendSuffix={currentPeriod.trendSuffix}
        />
        <StatCard
          title="Tổng Hành Khách"
          value={s.totalPassengers?.toLocaleString("vi-VN")}
          subtitle="Lượt hành khách phục vụ"
          icon="group"
          tone="bg-[#f0f4f8] text-[#526069]"
          trend={5.2}
          trendSuffix={currentPeriod.trendSuffix}
        />
        <StatCard
          title="Giá Trị Đặt Bình Quân"
          value={formatCurrency(s.avgBookingValue)}
          subtitle={`Đã hoàn tiền: ${formatCurrency(s.totalRefunds)}`}
          icon="analytics"
          tone="bg-amber-50 text-amber-600"
          trend={-2.1}
          trendSuffix={currentPeriod.trendSuffix}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className={`${panelClass} p-5 lg:col-span-2`}>
          <SectionHeader
            title={currentPeriod.revenueTitle}
            subtitle={currentPeriod.revenueSubtitle}
            action={
              <span className="rounded-full bg-[#cfe5ff]/40 px-3 py-1 text-xs font-bold text-[#00629d]">
                VNĐ
              </span>
            }
          />
          <BarChart data={revenueSeries} maxValue={maxRevenue} />
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#bec7d4]/10">
            <div className="text-center">
              <p className="text-xs text-[#6f7883]">Cao nhất</p>
              <p className="font-bold text-sm text-[#00629d]">
                {formatCurrency(
                  Math.max(...revenueSeries.map((m) => m.value), 0),
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#6f7883]">Thấp nhất</p>
              <p className="font-bold text-sm text-[#3f4852]">
                {formatCurrency(
                  Math.min(...revenueSeries.map((m) => m.value), 0),
                )}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#6f7883]">Trung bình</p>
              <p className="font-bold text-sm text-[#3f4852]">
                {formatCurrency(
                  revenueSeries.length > 0
                    ? revenueSeries.reduce((a, b) => a + b.value, 0) /
                        revenueSeries.length
                    : 0,
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Booking by status donut */}
        <div className={`${panelClass} p-5`}>
          <SectionHeader
            title="Tỷ Lệ Trạng Thái Vé"
            subtitle="Phân bổ vé theo trạng thái"
          />
          <div className="flex items-center justify-center mb-4">
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
                  stroke="#eceef0"
                  strokeWidth="12"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#16a34a"
                  strokeWidth="12"
                  strokeDasharray={`${confirmedArc} ${circumference}`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#f59e0b"
                  strokeWidth="12"
                  strokeDasharray={`${pendingArc} ${circumference}`}
                  strokeDashoffset={`-${confirmedArc}`}
                  strokeLinecap="round"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="12"
                  strokeDasharray={`${cancelledArc} ${circumference}`}
                  strokeDashoffset={`-${confirmedArc + pendingArc}`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-extrabold text-[#191c1e]">
                  {successRate}%
                </p>
                <p className="text-[10px] text-[#6f7883]">Thành công</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block" />
                Đã xác nhận
              </span>
              <span className="font-bold">
                {s.confirmedBookings?.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />
                Chờ xử lý
              </span>
              <span className="font-bold">
                {s.pendingBookings?.toLocaleString("vi-VN")}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
                Đã hủy
              </span>
              <span className="font-bold">
                {s.cancelledBookings?.toLocaleString("vi-VN")}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Routes */}
        <div className={`${panelClass} p-5`}>
          <SectionHeader
            title="Tuyến Đường Phổ Biến"
            subtitle="Các tuyến có lượng đặt vé cao nhất"
          />
          <div className="space-y-4">
            {topRoutes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#bec7d4]/40 p-8 text-center text-sm text-[#6f7883]">
                Chưa có dữ liệu tuyến từ các đơn đặt vé.
              </div>
            ) : (
              topRoutes.map((route, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      i === 0
                        ? "bg-[#cfe5ff] text-[#00629d]"
                        : "bg-[#f7f9fb] text-[#3f4852]"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between mb-1">
                      <p className="text-sm font-semibold text-[#191c1e] truncate">
                        {route.name}
                      </p>
                      <span className="text-xs font-bold text-[#00629d] ml-2 shrink-0">
                        {route.bookings.toLocaleString("vi-VN")} vé
                      </span>
                    </div>
                    <div className="w-full bg-[#eceef0] rounded-full h-1.5">
                      <div
                        className="bg-[#00629d] h-1.5 rounded-full"
                        style={{
                          width: `${
                            topRoutes[0].bookings > 0
                              ? (route.bookings / topRoutes[0].bookings) * 100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <p className="text-[10px] text-[#6f7883] mt-1">
                      {formatCurrency(route.revenue)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Booking by day & Train types */}
        <div className="space-y-6">
          <div className={`${panelClass} p-5`}>
            <SectionHeader
              title="Đặt Vé Theo Ngày Trong Tuần"
              subtitle={currentPeriod.bookingSubtitle}
            />
            <BarChart data={byDay} maxValue={maxByDay} compact />
          </div>

          <div className={`${panelClass} p-5`}>
            <SectionHeader
              title="Phân Loại Toa Tàu"
              subtitle="Tỷ trọng đặt vé theo loại toa"
            />
            <div className="space-y-3">
              {trainTypes.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#bec7d4]/40 p-6 text-center text-sm text-[#6f7883]">
                  Chưa có dữ liệu loại toa từ vé đã bán.
                </div>
              ) : (
                trainTypes.map((t, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <p className="text-sm text-[#3f4852] w-28 shrink-0 truncate">
                      {t.name}
                    </p>
                    <div className="flex-1 bg-[#f7f9fb] rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-gradient-to-r from-[#00629d] to-[#00a3ff]"
                        style={{ width: `${t.pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[#00629d] w-10 text-right">
                      {t.pct}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
