import { useState, useEffect, useCallback } from "react";
import { api } from "../../services/api";

const STATUS_MAP = {
  PENDING: { label: "Chờ xử lý", color: "bg-yellow-100 text-yellow-700" },
  CONFIRMED: { label: "Đã xác nhận", color: "bg-green-100 text-green-700" },
  CANCELLED: { label: "Đã hủy", color: "bg-red-100 text-red-700" },
  REFUNDED: { label: "Đã hoàn tiền", color: "bg-purple-100 text-purple-700" },
  COMPLETED: { label: "Hoàn thành", color: "bg-blue-100 text-blue-700" },
};

const PAYMENT_STATUS_MAP = {
  PENDING: { label: "Chờ thanh toán", color: "bg-yellow-100 text-yellow-700" },
  COMPLETED: { label: "Đã thanh toán", color: "bg-green-100 text-green-700" },
  FAILED: { label: "Thất bại", color: "bg-red-100 text-red-700" },
  REFUNDED: { label: "Đã hoàn", color: "bg-purple-100 text-purple-700" },
};

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminBookingPanel() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const limit = 10;

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (paymentFilter) params.paymentStatus = paymentFilter;

      const { data } = await api.get("/bookings/admin", { params });
      setBookings(data.bookings || []);
      setPagination(data.pagination || { total: 0, totalPages: 1 });
    } catch (err) {
      // Fallback to mock data if API not ready
      setBookings([]);
      setPagination({ total: 0, totalPages: 1 });
      console.error("Error fetching bookings:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, paymentFilter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchBookings();
  };

  const openDetail = (booking) => {
    setSelectedBooking(booking);
    setShowDetail(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e]">Quản Lý Đặt Vé</h2>
          <p className="text-sm text-[#3f4852] mt-1">
            Quản lý tất cả giao dịch đặt vé trên hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-[#cfe5ff]/30 rounded-xl border border-[#cfe5ff]">
          <span className="material-symbols-outlined text-[#00629d] text-sm">
            confirmation_number
          </span>
          <span className="text-[#00629d] font-bold text-sm">
            {pagination.total} vé
          </span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-4">
        <form
          onSubmit={handleSearch}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7883] text-[20px]">
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo mã đặt vé, tên khách hàng..."
              className="w-full pl-10 pr-4 py-2.5 bg-[#f7f9fb] border border-[#bec7d4]/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00629d]/30 focus:border-[#00629d]"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-[#f7f9fb] border border-[#bec7d4]/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00629d]/30"
          >
            <option value="">Tất cả trạng thái</option>
            {Object.entries(STATUS_MAP).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
          <select
            value={paymentFilter}
            onChange={(e) => {
              setPaymentFilter(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2.5 bg-[#f7f9fb] border border-[#bec7d4]/40 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#00629d]/30"
          >
            <option value="">Tất cả thanh toán</option>
            {Object.entries(PAYMENT_STATUS_MAP).map(([key, val]) => (
              <option key={key} value={key}>
                {val.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-5 py-2.5 bg-[#00629d] hover:bg-[#00629d]/90 text-white rounded-xl font-semibold text-sm transition-all"
          >
            Tìm
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f7f9fb] border-b border-[#bec7d4]/20">
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                  Mã đặt vé
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                  Khách hàng
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                  Hành trình
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                  Ngày đặt
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                  Tổng tiền
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                  Thanh toán
                </th>
                <th className="px-6 py-4 text-xs font-bold text-[#3f4852] uppercase tracking-wider text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#bec7d4]/10">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-3 border-[#00629d] border-t-transparent rounded-full animate-spin" />
                      <p className="text-sm text-[#3f4852]">Đang tải...</p>
                    </div>
                  </td>
                </tr>
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <span className="material-symbols-outlined text-4xl text-[#bec7d4]">
                      inbox
                    </span>
                    <p className="mt-2 text-sm text-[#3f4852]">
                      Không tìm thấy đặt vé nào
                    </p>
                  </td>
                </tr>
              ) : (
                bookings.map((booking) => {
                  const statusInfo =
                    STATUS_MAP[booking.status] || STATUS_MAP.PENDING;
                  const payInfo =
                    PAYMENT_STATUS_MAP[booking.paymentStatus] ||
                    PAYMENT_STATUS_MAP.PENDING;
                  return (
                    <tr
                      key={booking.id}
                      className="hover:bg-[#f7f9fb]/80 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <span className="font-bold text-[#00629d] text-sm font-mono">
                          {booking.bookingCode}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-semibold text-[#191c1e]">
                            {booking.user?.fullName || "Khách vãng lai"}
                          </p>
                          <p className="text-xs text-[#6f7883]">
                            {booking.user?.email || "—"}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-[#191c1e]">
                          <span>
                            {booking.schedule?.startStation?.stationName || "—"}
                          </span>
                          <span className="material-symbols-outlined text-[14px] text-[#6f7883]">
                            arrow_forward
                          </span>
                          <span>
                            {booking.schedule?.endStation?.stationName || "—"}
                          </span>
                        </div>
                        <p className="text-xs text-[#6f7883] mt-0.5">
                          {formatDate(booking.schedule?.departureTime)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#3f4852]">
                        {formatDate(booking.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-[#191c1e]">
                          {formatCurrency(booking.totalAmount)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${statusInfo.color}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${payInfo.color}`}
                        >
                          {payInfo.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => openDetail(booking)}
                          className="p-2 text-[#00629d] hover:bg-[#cfe5ff]/50 rounded-lg transition-all"
                          title="Xem chi tiết"
                        >
                          <span className="material-symbols-outlined text-[20px]">
                            visibility
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

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="p-4 flex justify-between items-center border-t border-[#bec7d4]/10 bg-[#f7f9fb]/30">
            <p className="text-xs text-[#3f4852]">
              Hiển thị {(page - 1) * limit + 1}–
              {Math.min(page * limit, pagination.total)} trong{" "}
              {pagination.total} kết quả
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-white disabled:opacity-40 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>
              {Array.from({ length: Math.min(5, pagination.totalPages) }).map(
                (_, i) => {
                  const p = i + 1;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg font-semibold text-xs ${
                        page === p
                          ? "bg-[#00629d] text-white"
                          : "border border-[#bec7d4] hover:bg-white"
                      }`}
                    >
                      {p}
                    </button>
                  );
                },
              )}
              <button
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                disabled={page === pagination.totalPages}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-white disabled:opacity-40 transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetail && selectedBooking && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowDetail(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-[#bec7d4]/20 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-bold text-[#191c1e]">
                  Chi Tiết Đặt Vé
                </h3>
                <p className="text-sm text-[#00629d] font-mono font-bold">
                  #{selectedBooking.bookingCode}
                </p>
              </div>
              <button
                onClick={() => setShowDetail(false)}
                className="p-2 hover:bg-[#f7f9fb] rounded-xl transition-all"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Journey */}
              <div className="bg-[#f7f9fb] rounded-2xl p-4">
                <p className="text-xs font-bold text-[#3f4852] uppercase tracking-wider mb-3">
                  Hành Trình
                </p>
                <div className="flex items-center gap-3">
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-[#191c1e]">
                      {selectedBooking.schedule?.startStation?.stationName ||
                        "—"}
                    </p>
                    <p className="text-xs text-[#6f7883]">
                      {formatDate(selectedBooking.schedule?.departureTime)}
                    </p>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="flex-1 border-t-2 border-dashed border-[#bec7d4]" />
                    <span className="material-symbols-outlined text-[#00629d]">
                      train
                    </span>
                    <div className="flex-1 border-t-2 border-dashed border-[#bec7d4]" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-extrabold text-[#191c1e]">
                      {selectedBooking.schedule?.endStation?.stationName || "—"}
                    </p>
                    <p className="text-xs text-[#6f7883]">
                      {formatDate(selectedBooking.schedule?.arrivalTime)}
                    </p>
                  </div>
                </div>
                {selectedBooking.schedule?.train && (
                  <p className="text-center text-xs text-[#6f7883] mt-2">
                    Tàu:{" "}
                    <span className="font-bold text-[#00629d]">
                      {selectedBooking.schedule.train.trainName}
                    </span>
                  </p>
                )}
              </div>

              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-bold text-[#3f4852] uppercase tracking-wider mb-2">
                    Khách hàng
                  </p>
                  <p className="font-semibold text-[#191c1e]">
                    {selectedBooking.user?.fullName || "Khách vãng lai"}
                  </p>
                  <p className="text-sm text-[#6f7883]">
                    {selectedBooking.user?.email || "—"}
                  </p>
                  <p className="text-sm text-[#6f7883]">
                    {selectedBooking.user?.phoneNumber || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#3f4852] uppercase tracking-wider mb-2">
                    Thanh toán
                  </p>
                  <p className="font-bold text-2xl text-[#00629d]">
                    {formatCurrency(selectedBooking.totalAmount)}
                  </p>
                  <p className="text-sm text-[#6f7883] mt-1">
                    PP: {selectedBooking.paymentMethod || "—"}
                  </p>
                  <span
                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold mt-1 ${
                      PAYMENT_STATUS_MAP[selectedBooking.paymentStatus]
                        ?.color || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {PAYMENT_STATUS_MAP[selectedBooking.paymentStatus]?.label ||
                      selectedBooking.paymentStatus}
                  </span>
                </div>
              </div>

              {/* Passengers */}
              {selectedBooking.passengers &&
                selectedBooking.passengers.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-[#3f4852] uppercase tracking-wider mb-3">
                      Hành Khách ({selectedBooking.passengers.length})
                    </p>
                    <div className="space-y-2">
                      {selectedBooking.passengers.map((p, i) => (
                        <div
                          key={p.id || i}
                          className="flex items-center justify-between bg-[#f7f9fb] rounded-xl p-3"
                        >
                          <div>
                            <p className="font-semibold text-sm text-[#191c1e]">
                              {p.fullName}
                            </p>
                            <p className="text-xs text-[#6f7883]">
                              {p.passengerType} ·{" "}
                              {p.ticketCode && (
                                <span className="font-mono text-[#00629d]">
                                  {p.ticketCode}
                                </span>
                              )}
                            </p>
                          </div>
                          {p.carriageNumber && (
                            <span className="text-xs font-bold bg-[#cfe5ff] text-[#00629d] px-2 py-1 rounded-lg">
                              Toa {p.carriageNumber}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Status */}
              <div className="flex items-center justify-between bg-[#f7f9fb] rounded-2xl p-4">
                <div>
                  <p className="text-xs font-bold text-[#3f4852] uppercase tracking-wider">
                    Trạng thái đặt vé
                  </p>
                  <span
                    className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold mt-1 ${
                      STATUS_MAP[selectedBooking.status]?.color ||
                      "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {STATUS_MAP[selectedBooking.status]?.label ||
                      selectedBooking.status}
                  </span>
                </div>
                <p className="text-xs text-[#6f7883]">
                  Đặt lúc: {formatDate(selectedBooking.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
