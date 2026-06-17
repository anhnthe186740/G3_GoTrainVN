import { useState, useEffect } from "react";
import { api } from "../../services/api";

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount || 0);
}

function StatCard({ title, value, subtitle, icon, color, trend }) {
  return (
    <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-6 relative overflow-hidden">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-[#3f4852] font-medium">{title}</p>
          <p className="text-2xl font-extrabold text-[#191c1e] mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-[#6f7883] mt-1">{subtitle}</p>
          )}
          {trend && (
            <span
              className={`text-xs font-bold flex items-center mt-2 ${trend >= 0 ? "text-green-600" : "text-red-500"}`}
            >
              <span className="material-symbols-outlined text-[14px] mr-0.5">
                {trend >= 0 ? "trending_up" : "trending_down"}
              </span>
              {trend >= 0 ? "+" : ""}
              {trend}% so với tháng trước
            </span>
          )}
        </div>
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}
        >
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
    </div>
  );
}

function BarChart({ data, maxValue, label }) {
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((item, i) => {
        const pct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
        return (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1 group"
          >
            <div className="relative w-full flex flex-col justify-end h-32">
              <div
                className="w-full bg-[#00629d] rounded-t-md transition-all duration-500 group-hover:bg-[#00a3ff]"
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#191c1e] text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                {typeof item.value === "number" && item.value > 100000
                  ? formatCurrency(item.value)
                  : item.value.toLocaleString("vi-VN")}
              </div>
            </div>
            <span className="text-[10px] text-[#6f7883] font-medium">
              {item.label}
            </span>
          </div>
        );
      })}
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
      .get("/bookings/admin/stats")
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
  const monthly = stats?.monthly || MOCK_STATS.monthly;
  const topRoutes = stats?.topRoutes || MOCK_STATS.topRoutes;
  const trainTypes = stats?.trainTypes || MOCK_STATS.trainTypes;
  const byDay = stats?.bookingByDay || MOCK_STATS.bookingByDay;

  const maxMonthly = Math.max(...monthly.map((m) => m.value));
  const maxByDay = Math.max(...byDay.map((d) => d.value));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e]">
            Báo Cáo & Thống Kê
          </h2>
          <p className="text-sm text-[#3f4852] mt-1">
            Tổng quan hoạt động kinh doanh và doanh thu
          </p>
        </div>
        <div className="flex gap-2">
          {["daily", "monthly", "yearly"].map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                period === p
                  ? "bg-[#00629d] text-white shadow-md"
                  : "bg-white border border-[#bec7d4]/40 text-[#3f4852] hover:bg-[#f7f9fb]"
              }`}
            >
              {p === "daily" ? "Ngày" : p === "monthly" ? "Tháng" : "Năm"}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Tổng Doanh Thu"
          value={formatCurrency(s.totalRevenue)}
          subtitle={`Doanh thu thuần: ${formatCurrency(s.netRevenue)}`}
          icon="account_balance_wallet"
          color="bg-[#cfe5ff]/40 text-[#00629d]"
          trend={12.5}
        />
        <StatCard
          title="Tổng Đặt Vé"
          value={s.totalBookings?.toLocaleString("vi-VN")}
          subtitle={`${s.confirmedBookings?.toLocaleString("vi-VN")} đã xác nhận`}
          icon="confirmation_number"
          color="bg-green-50 text-green-600"
          trend={8.3}
        />
        <StatCard
          title="Tổng Hành Khách"
          value={s.totalPassengers?.toLocaleString("vi-VN")}
          subtitle="Lượt hành khách phục vụ"
          icon="group"
          color="bg-purple-50 text-purple-600"
          trend={5.2}
        />
        <StatCard
          title="Giá Trị Đặt Bình Quân"
          value={formatCurrency(s.avgBookingValue)}
          subtitle={`Đã hoàn tiền: ${formatCurrency(s.totalRefunds)}`}
          icon="analytics"
          color="bg-orange-50 text-orange-600"
          trend={-2.1}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-[#191c1e]">Doanh Thu Theo Tháng</h3>
              <p className="text-xs text-[#6f7883] mt-0.5">
                Thống kê doanh thu 6 tháng gần nhất
              </p>
            </div>
            <span className="text-xs font-bold text-[#00629d] bg-[#cfe5ff]/30 px-3 py-1 rounded-full">
              VNĐ
            </span>
          </div>
          <BarChart data={monthly} maxValue={maxMonthly} />
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#bec7d4]/10">
            <div className="text-center">
              <p className="text-xs text-[#6f7883]">Cao nhất</p>
              <p className="font-bold text-sm text-[#00629d]">
                {formatCurrency(Math.max(...monthly.map((m) => m.value)))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#6f7883]">Thấp nhất</p>
              <p className="font-bold text-sm text-[#3f4852]">
                {formatCurrency(Math.min(...monthly.map((m) => m.value)))}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-[#6f7883]">Trung bình</p>
              <p className="font-bold text-sm text-[#3f4852]">
                {formatCurrency(
                  monthly.reduce((a, b) => a + b.value, 0) / monthly.length,
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Booking by status donut */}
        <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-6">
          <h3 className="font-bold text-[#191c1e] mb-4">Tỷ Lệ Trạng Thái Vé</h3>
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
                  stroke="#e5e7eb"
                  strokeWidth="12"
                />
                {/* Confirmed */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="12"
                  strokeDasharray={`${(s.confirmedBookings / s.totalBookings) * 251.2} 251.2`}
                  strokeDashoffset="0"
                />
                {/* Cancelled overlay */}
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="12"
                  strokeDasharray={`${(s.cancelledBookings / s.totalBookings) * 251.2} 251.2`}
                  strokeDashoffset={`-${(s.confirmedBookings / s.totalBookings) * 251.2}`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-xl font-extrabold text-[#191c1e]">
                  {Math.round((s.confirmedBookings / s.totalBookings) * 100)}%
                </p>
                <p className="text-[10px] text-[#6f7883]">Thành công</p>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
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
        <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-6">
          <h3 className="font-bold text-[#191c1e] mb-4">
            Tuyến Đường Phổ Biến
          </h3>
          <div className="space-y-3">
            {topRoutes.map((route, i) => (
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
                  <div className="w-full bg-[#f7f9fb] rounded-full h-1.5">
                    <div
                      className="bg-[#00629d] h-1.5 rounded-full"
                      style={{
                        width: `${(route.bookings / topRoutes[0].bookings) * 100}%`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-[#6f7883] mt-1">
                    {formatCurrency(route.revenue)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Booking by day & Train types */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-6">
            <h3 className="font-bold text-[#191c1e] mb-4">
              Đặt Vé Theo Ngày Trong Tuần
            </h3>
            <BarChart data={byDay} maxValue={maxByDay} />
          </div>

          <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-6">
            <h3 className="font-bold text-[#191c1e] mb-4">Phân Loại Toa Tàu</h3>
            <div className="space-y-2">
              {trainTypes.map((t, i) => (
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
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
