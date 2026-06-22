import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminDashboard } from "../components/dashboard/AdminDashboard";
import { StaffDashboard } from "../components/dashboard/StaffDashboard";
import { api } from "../services/api";
import { toast } from "sonner";
import { CancellationPolicyModal } from "../components/booking/CancellationPolicyModal";

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount || 0);
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

const BOOKING_STATUS = {
  PENDING: {
    label: "Chờ xử lý",
    color: "bg-yellow-100 text-yellow-700",
    dot: "bg-yellow-500",
  },
  CONFIRMED: {
    label: "Đã xác nhận",
    color: "bg-green-100 text-green-700",
    dot: "bg-green-500",
  },
  CANCELLED: {
    label: "Đã hủy",
    color: "bg-red-100 text-red-700",
    dot: "bg-red-500",
  },
  REFUNDED: {
    label: "Đã hoàn tiền",
    color: "bg-purple-100 text-purple-700",
    dot: "bg-purple-500",
  },
  COMPLETED: {
    label: "Hoàn thành",
    color: "bg-blue-100 text-blue-700",
    dot: "bg-blue-500",
  },
};

function getBookedTripStations(booking) {
  if (!booking) return { from: null, to: null };
  const hasBookedSegment =
    booking.fromStation ||
    booking.toStation ||
    booking.fromStationId ||
    booking.toStationId;

  return {
    from:
      booking.fromStation ||
      (!hasBookedSegment ? booking.schedule?.startStation : null),
    to:
      booking.toStation ||
      (!hasBookedSegment ? booking.schedule?.endStation : null),
  };
}

function stationName(station) {
  return station?.stationName || station?.city || "—";
}

function CustomerDashboard({ user }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [policyBooking, setPolicyBooking] = useState(null);
  const [tab, setTab] = useState("upcoming");
  const [page, setPage] = useState(1);
  const LIMIT = 5;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bookingsRes, walletRes] = await Promise.allSettled([
        api.get("/bookings/my"),
        api.get("/wallet"),
      ]);
      if (bookingsRes.status === "fulfilled") {
        setBookings(bookingsRes.value.data.bookings || []);
      }
      if (walletRes.status === "fulfilled") {
        setWallet(walletRes.value.data.wallet);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const now = new Date();
  const upcomingBookings = bookings.filter(
    (b) =>
      b.status !== "CANCELLED" &&
      b.status !== "REFUNDED" &&
      new Date(b.schedule?.departureTime) > now,
  );
  const pastBookings = bookings.filter(
    (b) =>
      b.status === "COMPLETED" ||
      b.status === "CANCELLED" ||
      b.status === "REFUNDED" ||
      new Date(b.schedule?.departureTime) <= now,
  );

  const displayedBookings =
    tab === "upcoming" ? upcomingBookings : pastBookings;
  const totalPages = Math.ceil(displayedBookings.length / LIMIT);
  const pagedBookings = displayedBookings.slice(
    (page - 1) * LIMIT,
    page * LIMIT,
  );

  const totalSpent = bookings
    .filter((b) => b.status === "CONFIRMED" || b.status === "COMPLETED")
    .reduce((sum, b) => sum + (b.totalAmount || 0), 0);

  const handleCancel = async (booking) => {
    setPolicyBooking(null);
    setCancellingId(booking.id);
    try {
      const { data } = await api.post(`/bookings/${booking.id}/cancel`, {
        passengerIds: booking.passengers?.map((passenger) => passenger.id),
        reason: "Khách hàng tự hủy",
        refundMethod: "WALLET",
      });
      toast.success(data.message);
      fetchData();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể hủy vé. Vui lòng thử lại.",
      );
    } finally {
      setCancellingId(null);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Chào buổi sáng";
    if (h < 18) return "Chào buổi chiều";
    return "Chào buổi tối";
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] pb-12">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-[#004c7a] to-[#00629d] text-white px-6 md:px-12 py-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <p className="text-[#b3d4f0] text-sm font-medium">
                {greeting()},
              </p>
              <h1 className="text-3xl font-extrabold mt-1">
                {user?.name || user?.fullName || "Khách hàng"}
              </h1>
              <p className="text-[#b3d4f0] text-sm mt-1">{user?.email}</p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link
                to="/"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">
                  search
                </span>
                Đặt vé mới
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
              >
                <span className="material-symbols-outlined text-[18px]">
                  person
                </span>
                Hồ sơ
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
              <p className="text-[#b3d4f0] text-xs font-medium">Tổng đặt vé</p>
              <p className="text-2xl font-extrabold mt-1">
                {loading ? "—" : bookings.length}
              </p>
              <p className="text-[#b3d4f0] text-xs mt-1">lượt đặt</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
              <p className="text-[#b3d4f0] text-xs font-medium">
                Chuyến sắp tới
              </p>
              <p className="text-2xl font-extrabold mt-1">
                {loading ? "—" : upcomingBookings.length}
              </p>
              <p className="text-[#b3d4f0] text-xs mt-1">chuyến</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
              <p className="text-[#b3d4f0] text-xs font-medium">
                Điểm tích lũy
              </p>
              <p className="text-2xl font-extrabold mt-1">
                {user?.loyaltyPoints || 0}
              </p>
              <p className="text-[#b3d4f0] text-xs mt-1">điểm</p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15">
              <p className="text-[#b3d4f0] text-xs font-medium">Số dư ví</p>
              <p className="text-xl font-extrabold mt-1">
                {loading || wallet === null
                  ? "—"
                  : formatCurrency(wallet?.balance)}
              </p>
              <Link
                to="/wallet"
                className="text-[#b3d4f0] text-xs mt-1 hover:text-white transition-colors inline-flex items-center gap-0.5"
              >
                Nạp tiền →
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 mt-8 space-y-6">
        {/* Next trip highlight */}
        {!loading && upcomingBookings.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-[#00629d]/8 to-transparent px-6 py-4 border-b border-[#bec7d4]/10 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00629d] text-xl">
                train
              </span>
              <h2 className="font-bold text-[#191c1e]">Chuyến Đi Tiếp Theo</h2>
            </div>
            <div className="p-6">
              {(() => {
                const next = upcomingBookings[0];
                const status =
                  BOOKING_STATUS[next.status] || BOOKING_STATUS.PENDING;
                const tripStations = getBookedTripStations(next);
                return (
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
                    <div className="flex-1">
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xl font-extrabold text-[#191c1e]">
                            {stationName(tripStations.from)}
                          </p>
                          <p className="text-xs text-[#6f7883] mt-0.5">
                            {new Date(
                              next.schedule?.departureTime,
                            ).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1 w-full">
                            <div className="flex-1 border-t-2 border-dashed border-[#bec7d4]" />
                            <span className="material-symbols-outlined text-[#00629d] text-sm">
                              train
                            </span>
                            <div className="flex-1 border-t-2 border-dashed border-[#bec7d4]" />
                          </div>
                          {next.schedule?.train && (
                            <p className="text-[10px] text-[#6f7883] font-medium">
                              {next.schedule.train.trainName}
                            </p>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-extrabold text-[#191c1e]">
                            {stationName(tripStations.to)}
                          </p>
                          <p className="text-xs text-[#6f7883] mt-0.5">
                            {new Date(
                              next.schedule?.arrivalTime,
                            ).toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.color}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                          />
                          {status.label}
                        </span>
                        <span className="text-xs text-[#6f7883]">
                          Mã:{" "}
                          <span className="font-mono font-bold text-[#00629d]">
                            {next.bookingCode}
                          </span>
                        </span>
                        <span className="text-xs text-[#6f7883]">
                          {formatDate(next.schedule?.departureTime)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      <Link
                        to="/tra-cuu-ve"
                        className="flex items-center gap-2 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          qr_code_2
                        </span>
                        Xem vé
                      </Link>
                      {next.cancellationRequest?.status === "PENDING" ? (
                        <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs font-bold text-amber-700">
                          Chờ Admin duyệt hủy
                        </span>
                      ) : (
                        next.status !== "CANCELLED" &&
                        next.status !== "REFUNDED" && (
                          <button
                            onClick={() => setPolicyBooking(next)}
                            disabled={cancellingId === next.id}
                            className="flex items-center gap-2 border border-red-200 hover:bg-red-50 text-red-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50"
                          >
                            {cancellingId === next.id ? (
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">
                                cancel
                              </span>
                            )}
                            Hủy vé
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Booking History */}
        <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-[#bec7d4]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="font-bold text-[#191c1e] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00629d]">
                history
              </span>
              Lịch Sử Đặt Vé
            </h2>
            <div className="flex gap-1 bg-[#f7f9fb] rounded-xl p-1">
              {[
                { key: "upcoming", label: "Sắp tới" },
                { key: "past", label: "Đã qua" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setPage(1);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    tab === key
                      ? "bg-white shadow text-[#00629d]"
                      : "text-[#6f7883] hover:text-[#191c1e]"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-3 border-[#00629d] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#3f4852]">Đang tải...</p>
            </div>
          ) : pagedBookings.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-[#f7f9fb] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-[#bec7d4]">
                  {tab === "upcoming" ? "train" : "history"}
                </span>
              </div>
              <div>
                <p className="font-bold text-[#191c1e]">
                  {tab === "upcoming"
                    ? "Không có chuyến đi sắp tới"
                    : "Chưa có lịch sử đặt vé"}
                </p>
                <p className="text-sm text-[#6f7883] mt-1">
                  {tab === "upcoming"
                    ? "Hãy đặt vé ngay để có chuyến đi mới!"
                    : "Các chuyến đã đi sẽ xuất hiện ở đây."}
                </p>
              </div>
              {tab === "upcoming" && (
                <Link
                  to="/"
                  className="bg-[#00629d] hover:bg-[#00629d]/90 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all"
                >
                  Đặt vé ngay
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#bec7d4]/10">
                {pagedBookings.map((booking) => {
                  const status =
                    BOOKING_STATUS[booking.status] || BOOKING_STATUS.PENDING;
                  const depTime = booking.schedule?.departureTime;
                  const diffMs = depTime ? new Date(depTime) - now : -1;
                  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                  const tripStations = getBookedTripStations(booking);
                  return (
                    <div
                      key={booking.id}
                      className="px-6 py-4 hover:bg-[#f7f9fb]/60 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-[#cfe5ff]/40 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[#00629d]">
                              train
                            </span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 font-bold text-[#191c1e] text-sm">
                              <span>{stationName(tripStations.from)}</span>
                              <span className="material-symbols-outlined text-[14px] text-[#6f7883]">
                                arrow_forward
                              </span>
                              <span>{stationName(tripStations.to)}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              <span className="text-xs text-[#6f7883]">
                                {formatDate(booking.schedule?.departureTime)}
                              </span>
                              <span className="font-mono text-xs text-[#00629d] font-bold">
                                {booking.bookingCode}
                              </span>
                              {diffDays >= 0 && diffDays <= 3 && (
                                <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                                  Còn {diffDays} ngày
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-bold text-[#191c1e] text-sm">
                              {formatCurrency(booking.totalAmount)}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold mt-1 ${status.color}`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                              />
                              {status.label}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Link
                              to="/tra-cuu-ve"
                              className="p-1.5 text-[#00629d] hover:bg-[#cfe5ff]/50 rounded-lg transition-all"
                              title="Xem vé"
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                qr_code_2
                              </span>
                            </Link>
                            {booking.cancellationRequest?.status ===
                            "PENDING" ? (
                              <span
                                className="material-symbols-outlined p-1.5 text-amber-600"
                                title="Yêu cầu hủy đang chờ Admin duyệt"
                              >
                                pending_actions
                              </span>
                            ) : (
                              booking.status !== "CANCELLED" &&
                              booking.status !== "REFUNDED" &&
                              diffMs > 0 && (
                                <button
                                  onClick={() => setPolicyBooking(booking)}
                                  disabled={cancellingId === booking.id}
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
                                  title="Hủy vé"
                                >
                                  {cancellingId === booking.id ? (
                                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <span className="material-symbols-outlined text-[20px]">
                                      cancel
                                    </span>
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-[#bec7d4]/10 flex justify-between items-center">
                  <p className="text-xs text-[#6f7883]">
                    Trang {page}/{totalPages} · {displayedBookings.length} kết
                    quả
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-[#f7f9fb] disabled:opacity-40 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        chevron_left
                      </span>
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setPage(i + 1)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                          page === i + 1
                            ? "bg-[#00629d] text-white"
                            : "border border-[#bec7d4] hover:bg-[#f7f9fb]"
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-[#f7f9fb] disabled:opacity-40 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        chevron_right
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Bottom quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            to="/"
            className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-[#00629d]/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-[#cfe5ff]/40 flex items-center justify-center group-hover:bg-[#00629d] transition-colors">
              <span className="material-symbols-outlined text-[#00629d] group-hover:text-white transition-colors">
                search
              </span>
            </div>
            <div>
              <p className="font-bold text-[#191c1e] text-sm">Tìm chuyến tàu</p>
              <p className="text-xs text-[#6f7883] mt-0.5">
                Đặt vé nhanh chóng
              </p>
            </div>
          </Link>
          <Link
            to="/wallet"
            className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-[#00629d]/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-500 transition-colors">
              <span className="material-symbols-outlined text-green-600 group-hover:text-white transition-colors">
                account_balance_wallet
              </span>
            </div>
            <div>
              <p className="font-bold text-[#191c1e] text-sm">Ví của tôi</p>
              <p className="text-xs text-[#6f7883] mt-0.5">
                {wallet ? formatCurrency(wallet.balance) : "Xem số dư"}
              </p>
            </div>
          </Link>
          <Link
            to="/tra-cuu-ve"
            className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-[#00629d]/30 transition-all group"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
              <span className="material-symbols-outlined text-purple-600 group-hover:text-white transition-colors">
                qr_code_2
              </span>
            </div>
            <div>
              <p className="font-bold text-[#191c1e] text-sm">Tra cứu vé</p>
              <p className="text-xs text-[#6f7883] mt-0.5">Xem thông tin vé</p>
            </div>
          </Link>
        </div>
      </div>
      <CancellationPolicyModal
        open={Boolean(policyBooking)}
        audience="registered"
        onClose={() => setPolicyBooking(null)}
        onAccept={() => policyBooking && handleCancel(policyBooking)}
      />
    </div>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  if (user?.role === "ADMIN") {
    return <AdminDashboard />;
  }

  if (user?.role === "STAFF") {
    return <StaffDashboard />;
  }

  // Check if we are in the customer booking flow
  const isBookingFlow = searchParams.get("from") && searchParams.get("to");
  if (isBookingFlow) {
    return <Navigate to={`/schedule?${searchParams.toString()}`} replace />;
  }

  return <CustomerDashboard user={user} />;
}
