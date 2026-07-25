import { useState, useEffect, useCallback } from "react";
import { useSearchParams, Navigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { AdminDashboard } from "../components/dashboard/AdminDashboard";
import { StaffDashboard } from "../components/dashboard/StaffDashboard";
import { api } from "../services/api";
import { bookingApi } from "../services/bookingApi";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import { CancellationPolicyModal } from "../components/booking/CancellationPolicyModal";
import { useLanguage } from "../context/LanguageContext";

function formatCurrency(amount, language = "vi") {
  return language === "vi"
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(amount || 0)
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "VND",
      }).format(amount || 0);
}

function resumeCountdown(expiresAt, nowMs) {
  const seconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - nowMs) / 1000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDate(dateStr, language = "vi") {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString(
    language === "vi" ? "vi-VN" : "en-US",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
}

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
  const { language } = useLanguage();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wallet, setWallet] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [policyBooking, setPolicyBooking] = useState(null);
  const [resumeBooking, setResumeBooking] = useState(null);
  const [resumeSubmitting, setResumeSubmitting] = useState(false);
  const [resumeNow, setResumeNow] = useState(() => Date.now());
  const [tab, setTab] = useState("upcoming");
  const [page, setPage] = useState(1);
  const LIMIT = 5;

  // Blog states
  const [blogs, setBlogs] = useState([]);
  const [blogsLoading, setBlogsLoading] = useState(true);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [isWriteModalOpen, setIsWriteModalOpen] = useState(false);
  const [newBlogTitle, setNewBlogTitle] = useState("");
  const [newBlogSummary, setNewBlogSummary] = useState("");
  const [newBlogContent, setNewBlogContent] = useState("");
  const [blogSubmitting, setBlogSubmitting] = useState(false);

  const BOOKING_STATUS = {
    PENDING: {
      label: language === "vi" ? "Chờ xử lý" : "Pending",
      color: "bg-yellow-100 text-yellow-700",
      dot: "bg-yellow-500",
    },
    CONFIRMED: {
      label: language === "vi" ? "Đã xác nhận" : "Confirmed",
      color: "bg-green-100 text-green-700",
      dot: "bg-green-500",
    },
    CANCELLED: {
      label: language === "vi" ? "Đã hủy" : "Cancelled",
      color: "bg-red-100 text-red-700",
      dot: "bg-red-500",
    },
    REFUNDED: {
      label: language === "vi" ? "Đã hoàn tiền" : "Refunded",
      color: "bg-purple-100 text-purple-700",
      dot: "bg-purple-500",
    },
    COMPLETED: {
      label: language === "vi" ? "Hoàn thành" : "Completed",
      color: "bg-blue-100 text-blue-700",
      dot: "bg-blue-500",
    },
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setBlogsLoading(true);
    try {
      const [bookingsRes, walletRes, blogsRes] = await Promise.allSettled([
        api.get("/bookings/my"),
        api.get("/wallet"),
        api.get("/blogs"),
      ]);
      if (bookingsRes.status === "fulfilled") {
        setBookings(bookingsRes.value.data.bookings || []);
      }
      if (walletRes.status === "fulfilled") {
        setWallet(walletRes.value.data.wallet);
      }
      if (blogsRes.status === "fulfilled") {
        setBlogs(blogsRes.value.data.posts || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
      setBlogsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!resumeBooking) return;
    const t = setInterval(() => setResumeNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [resumeBooking]);

  useEffect(() => {
    if (!resumeBooking) return;
    let active = true;
    const poll = async () => {
      try {
        const { data } = await bookingApi.paymentStatus(resumeBooking.id);
        if (!active) return;
        if (data.booking.paymentStatus === "COMPLETED") {
          toast.success(
            language === "vi"
              ? "Thanh toán thành công! Vé đã được xác nhận."
              : "Payment successful! Ticket has been confirmed.",
          );
          setResumeBooking(null);
          fetchData();
        }
      } catch {
        // silent
      }
    };
    const t = setInterval(poll, 4000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [resumeBooking, language, fetchData]);

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

  const handleCancel = async (booking) => {
    setPolicyBooking(null);
    setCancellingId(booking.id);
    try {
      const { data } = await api.post(`/bookings/${booking.id}/cancel`, {
        passengerIds: booking.passengers?.map((passenger) => passenger.id),
        reason: language === "vi" ? "Khách hàng tự hủy" : "Customer cancelled",
        refundMethod: "WALLET",
      });
      toast.success(data.message);
      fetchData();
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          (language === "vi"
            ? "Không thể hủy vé. Vui lòng thử lại."
            : "Could not cancel ticket. Please try again."),
      );
    } finally {
      setCancellingId(null);
    }
  };

  const confirmResumeQr = async () => {
    if (!resumeBooking || resumeSubmitting) return;
    setResumeSubmitting(true);
    try {
      const { data } = await bookingApi.paymentStatus(resumeBooking.id);
      if (data.booking.paymentStatus === "COMPLETED") {
        toast.success(
          language === "vi"
            ? "Thanh toán thành công! Vé đã được xác nhận."
            : "Payment successful! Ticket has been confirmed.",
        );
        setResumeBooking(null);
        fetchData();
      } else {
        toast.info(
          language === "vi"
            ? "Đang chờ PayOS xác nhận giao dịch."
            : "Waiting for PayOS to confirm the transaction.",
        );
      }
    } catch {
      toast.error(
        language === "vi"
          ? "Không thể kiểm tra trạng thái thanh toán."
          : "Could not check payment status.",
      );
    } finally {
      setResumeSubmitting(false);
    }
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (language === "vi") {
      if (h < 12) return "Chào buổi sáng";
      if (h < 18) return "Chào buổi chiều";
      return "Chào buổi tối";
    } else {
      if (h < 12) return "Good morning";
      if (h < 18) return "Good afternoon";
      return "Good evening";
    }
  };

  const handleCreateBlog = async (e) => {
    e.preventDefault();
    if (!newBlogTitle.trim() || !newBlogContent.trim()) {
      toast.error(
        language === "vi"
          ? "Vui lòng nhập đầy đủ tiêu đề và nội dung bài viết."
          : "Please enter both the title and content of the post.",
      );
      return;
    }
    setBlogSubmitting(true);
    try {
      await api.post("/blogs", {
        title: newBlogTitle,
        summary: newBlogSummary || newBlogContent.substring(0, 150) + "...",
        content: newBlogContent,
      });
      toast.success(
        language === "vi"
          ? "Đăng bài viết chia sẻ thành công!"
          : "Post published successfully!",
      );
      setNewBlogTitle("");
      setNewBlogSummary("");
      setNewBlogContent("");
      setIsWriteModalOpen(false);
      const { data } = await api.get("/blogs");
      setBlogs(data.posts || []);
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          (language === "vi"
            ? "Không thể đăng bài viết. Vui lòng thử lại."
            : "Could not publish post. Please try again."),
      );
    } finally {
      setBlogSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f7f9fb] pb-12 text-left">
      {/* Hero banner */}
      <div className="bg-gradient-to-br from-[#004c7a] to-[#00629d] text-white px-6 md:px-12 py-10 text-left">
        <div className="max-w-6xl mx-auto text-left">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
            <div className="text-left">
              <p className="text-[#b3d4f0] text-sm font-medium mb-1 text-left">
                {greeting()},
              </p>
              <h1 className="text-3xl font-extrabold mt-1 text-left mb-0">
                {user?.name ||
                  user?.fullName ||
                  (language === "vi" ? "Khách hàng" : "Customer")}
              </h1>
              <p className="text-[#b3d4f0] text-sm mt-1 text-left mb-0">
                {user?.email}
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <Link
                to="/"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all text-decoration-none"
              >
                <span className="material-symbols-outlined text-[18px]">
                  search
                </span>
                {language === "vi" ? "Đặt vé mới" : "Book New Ticket"}
              </Link>
              <Link
                to="/profile"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all text-decoration-none"
              >
                <span className="material-symbols-outlined text-[18px]">
                  person
                </span>
                {language === "vi" ? "Hồ sơ" : "Profile"}
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 text-left">
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15 text-left">
              <p className="text-[#b3d4f0] text-xs font-medium mb-1">
                {language === "vi" ? "Tổng đặt vé" : "Total Bookings"}
              </p>
              <p className="text-2xl font-extrabold mt-1 mb-1">
                {loading ? "—" : bookings.length}
              </p>
              <p className="text-[#b3d4f0] text-xs mb-0">
                {language === "vi" ? "lượt đặt" : "bookings"}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15 text-left">
              <p className="text-[#b3d4f0] text-xs font-medium mb-1">
                {language === "vi" ? "Chuyến sắp tới" : "Upcoming Trips"}
              </p>
              <p className="text-2xl font-extrabold mt-1 mb-1">
                {loading ? "—" : upcomingBookings.length}
              </p>
              <p className="text-[#b3d4f0] text-xs mb-0">
                {language === "vi" ? "chuyến" : "trips"}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15 text-left">
              <p className="text-[#b3d4f0] text-xs font-medium mb-1">
                {language === "vi" ? "Điểm tích lũy" : "Loyalty Points"}
              </p>
              <p className="text-2xl font-extrabold mt-1 mb-1">
                {user?.loyaltyPoints || 0}
              </p>
              <p className="text-[#b3d4f0] text-xs mb-0">
                {language === "vi" ? "điểm" : "pts"}
              </p>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-2xl p-4 border border-white/15 text-left">
              <p className="text-[#b3d4f0] text-xs font-medium mb-1">
                {language === "vi" ? "Số dư ví" : "Wallet Balance"}
              </p>
              <p className="text-xl font-extrabold mt-1 mb-1">
                {loading || wallet === null
                  ? "—"
                  : formatCurrency(wallet?.balance, language)}
              </p>
              <Link
                to="/wallet"
                className="text-[#b3d4f0] text-xs mt-1 hover:text-white transition-colors inline-flex items-center gap-0.5 text-decoration-none"
              >
                {language === "vi" ? "Nạp tiền →" : "Deposit →"}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 mt-8 space-y-6 text-left">
        {/* Next trip highlight */}
        {!loading && upcomingBookings.length > 0 && (
          <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm overflow-hidden text-left">
            <div className="bg-gradient-to-r from-[#00629d]/8 to-transparent px-6 py-4 border-b border-[#bec7d4]/10 flex items-center gap-2 text-left">
              <span className="material-symbols-outlined text-[#00629d] text-xl">
                train
              </span>
              <h2 className="font-bold text-[#191c1e] mb-0 text-left">
                {language === "vi" ? "Chuyến Đi Tiếp Theo" : "Next Trip"}
              </h2>
            </div>
            <div className="p-6 text-left">
              {(() => {
                const next = upcomingBookings[0];
                const status =
                  BOOKING_STATUS[next.status] || BOOKING_STATUS.PENDING;
                const tripStations = getBookedTripStations(next);
                return (
                  <div className="flex flex-col md:flex-row gap-6 items-start md:items-center text-left">
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-4 text-left">
                        <div className="text-center">
                          <p className="text-xl font-extrabold text-[#191c1e] mb-0 text-center">
                            {stationName(tripStations.from)}
                          </p>
                          <p className="text-xs text-[#6f7883] mt-0.5 text-center mb-0">
                            {new Date(
                              next.schedule?.departureTime,
                            ).toLocaleTimeString(
                              language === "vi" ? "vi-VN" : "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                        <div className="flex-1 flex flex-col items-center gap-1 text-center">
                          <div className="flex items-center gap-1 w-full text-center">
                            <div className="flex-1 border-t-2 border-dashed border-[#bec7d4]" />
                            <span className="material-symbols-outlined text-[#00629d] text-sm">
                              train
                            </span>
                            <div className="flex-1 border-t-2 border-dashed border-[#bec7d4]" />
                          </div>
                          {next.schedule?.train && (
                            <p className="text-[10px] text-[#6f7883] font-medium mb-0">
                              {next.schedule.train.trainName}
                            </p>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-extrabold text-[#191c1e] mb-0 text-center">
                            {stationName(tripStations.to)}
                          </p>
                          <p className="text-xs text-[#6f7883] mt-0.5 text-center mb-0">
                            {new Date(
                              next.schedule?.arrivalTime,
                            ).toLocaleTimeString(
                              language === "vi" ? "vi-VN" : "en-US",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-4 text-left">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.color}`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                          />
                          {status.label}
                        </span>
                        <span className="text-xs text-[#6f7883]">
                          {language === "vi" ? "Mã:" : "Code:"}{" "}
                          <span className="font-mono font-bold text-[#00629d]">
                            {next.bookingCode}
                          </span>
                        </span>
                        <span className="text-xs text-[#6f7883]">
                          {formatDate(next.schedule?.departureTime, language)}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0 w-full md:w-auto">
                      <Link
                        to="/tra-cuu-ve"
                        className="flex items-center justify-center gap-2 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-5 py-2.5 rounded-xl font-semibold text-sm transition-all text-decoration-none"
                      >
                        <span className="material-symbols-outlined text-[18px]">
                          qr_code_2
                        </span>
                        {language === "vi" ? "Xem vé" : "View Ticket"}
                      </Link>
                      {next.status === "PENDING" &&
                        next.paymentStatus === "PENDING" &&
                        next.expiresAt &&
                        new Date(next.expiresAt) > now && (
                          <button
                            onClick={() => setResumeBooking(next)}
                            className="flex items-center justify-center gap-2 border border-amber-400 bg-amber-50 hover:bg-amber-100 text-amber-700 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              payment
                            </span>
                            {language === "vi" ? "Thanh toán" : "Pay Now"}
                          </button>
                        )}
                      {next.cancellationRequest?.status === "PENDING" ? (
                        <span className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-xs font-bold text-amber-700">
                          {language === "vi"
                            ? "Đang xử lý hủy vé"
                            : "Processing cancellation"}
                        </span>
                      ) : (
                        next.status !== "CANCELLED" &&
                        next.status !== "REFUNDED" && (
                          <button
                            onClick={() => setPolicyBooking(next)}
                            disabled={cancellingId === next.id}
                            className="flex items-center justify-center gap-2 border border-red-200 hover:bg-red-50 text-red-600 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-50 cursor-pointer"
                          >
                            {cancellingId === next.id ? (
                              <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <span className="material-symbols-outlined text-[18px]">
                                cancel
                              </span>
                            )}
                            {language === "vi" ? "Hủy vé" : "Cancel Ticket"}
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
        <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm overflow-hidden text-left">
          <div className="px-6 py-4 border-b border-[#bec7d4]/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-left">
            <h2 className="font-bold text-[#191c1e] flex items-center gap-2 mb-0 text-left">
              <span className="material-symbols-outlined text-[#00629d]">
                history
              </span>
              {language === "vi" ? "Lịch Sử Đặt Vé" : "Booking History"}
            </h2>
            <div className="flex gap-1 bg-[#f7f9fb] rounded-xl p-1 text-left">
              {[
                {
                  key: "upcoming",
                  label: language === "vi" ? "Sắp tới" : "Upcoming",
                },
                { key: "past", label: language === "vi" ? "Đã qua" : "Past" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => {
                    setTab(key);
                    setPage(1);
                  }}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all cursor-pointer border-none ${
                    tab === key
                      ? "bg-white shadow text-[#00629d]"
                      : "text-[#6f7883] hover:text-[#191c1e] bg-transparent"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-8 h-8 border-3 border-[#00629d] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#3f4852] mb-0">
                {language === "vi" ? "Đang tải..." : "Loading..."}
              </p>
            </div>
          ) : pagedBookings.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 bg-[#f7f9fb] rounded-2xl flex items-center justify-center">
                <span className="material-symbols-outlined text-3xl text-[#bec7d4]">
                  {tab === "upcoming" ? "train" : "history"}
                </span>
              </div>
              <div>
                <p className="font-bold text-[#191c1e] mb-1">
                  {tab === "upcoming"
                    ? language === "vi"
                      ? "Không có chuyến đi sắp tới"
                      : "No upcoming journeys"
                    : language === "vi"
                      ? "Chưa có lịch sử đặt vé"
                      : "No booking history yet"}
                </p>
                <p className="text-sm text-[#6f7883] mt-1 mb-0 leading-relaxed">
                  {tab === "upcoming"
                    ? language === "vi"
                      ? "Hãy đặt vé ngay để có chuyến đi mới!"
                      : "Book tickets now for your next trip!"
                    : language === "vi"
                      ? "Các chuyến đã đi sẽ xuất hiện ở đây."
                      : "Your completed trips will appear here."}
                </p>
              </div>
              {tab === "upcoming" && (
                <Link
                  to="/"
                  className="bg-[#00629d] hover:bg-[#00629d]/90 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-all text-decoration-none"
                >
                  {language === "vi" ? "Đặt vé ngay" : "Book Now"}
                </Link>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-[#bec7d4]/10 text-left">
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
                      className="px-6 py-4 hover:bg-[#f7f9fb]/60 transition-colors text-left"
                    >
                      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between text-left">
                        <div className="flex items-center gap-4 flex-1 min-w-0 text-left">
                          <div className="w-12 h-12 rounded-xl bg-[#cfe5ff]/40 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[#00629d]">
                              train
                            </span>
                          </div>
                          <div className="min-w-0 text-left">
                            <div className="flex items-center gap-2 font-bold text-[#191c1e] text-sm text-left">
                              <span>{stationName(tripStations.from)}</span>
                              <span className="material-symbols-outlined text-[14px] text-[#6f7883]">
                                arrow_forward
                              </span>
                              <span>{stationName(tripStations.to)}</span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap text-left">
                              <span className="text-xs text-[#6f7883]">
                                {formatDate(
                                  booking.schedule?.departureTime,
                                  language,
                                )}
                              </span>
                              <span className="font-mono text-xs text-[#00629d] font-bold">
                                {booking.bookingCode}
                              </span>
                              {diffDays >= 0 && diffDays <= 3 && (
                                <span className="text-xs font-bold bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                                  {language === "vi"
                                    ? `Còn ${diffDays} ngày`
                                    : `${diffDays} days left`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 text-left">
                          <div className="text-left sm:text-right">
                            <p className="font-bold text-[#191c1e] text-sm mb-1 text-left sm:text-right">
                              {formatCurrency(booking.totalAmount, language)}
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
                              title={
                                language === "vi" ? "Xem vé" : "View Ticket"
                              }
                            >
                              <span className="material-symbols-outlined text-[20px]">
                                qr_code_2
                              </span>
                            </Link>
                            {booking.status === "PENDING" &&
                              booking.paymentStatus === "PENDING" &&
                              booking.expiresAt &&
                              new Date(booking.expiresAt) > now && (
                                <button
                                  onClick={() => setResumeBooking(booking)}
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-all cursor-pointer border-none bg-transparent"
                                  title={
                                    language === "vi"
                                      ? "Tiếp tục thanh toán"
                                      : "Pay Now"
                                  }
                                >
                                  <span className="material-symbols-outlined text-[20px]">
                                    payment
                                  </span>
                                </button>
                              )}
                            {booking.cancellationRequest?.status ===
                            "PENDING" ? (
                              <span
                                className="material-symbols-outlined p-1.5 text-amber-600"
                                title={
                                  language === "vi"
                                    ? "Vé đang được xử lý hủy và hoàn tiền"
                                    : "Cancellation is being processed"
                                }
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
                                  className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50 cursor-pointer border-none bg-transparent"
                                  title={
                                    language === "vi"
                                      ? "Hủy vé"
                                      : "Cancel Ticket"
                                  }
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
                <div className="px-6 py-4 border-t border-[#bec7d4]/10 flex justify-between items-center text-left">
                  <p className="text-xs text-[#6f7883] mb-0">
                    {language === "vi"
                      ? `Trang ${page}/${totalPages} · ${displayedBookings.length} kết quả`
                      : `Page ${page}/${totalPages} · ${displayedBookings.length} results`}
                  </p>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-[#f7f9fb] disabled:opacity-40 transition-all cursor-pointer bg-white"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        chevron_left
                      </span>
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => setPage(i + 1)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                          page === i + 1
                            ? "bg-[#00629d] text-white border-none"
                            : "border border-[#bec7d4] hover:bg-[#f7f9fb] bg-white"
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
                      className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#bec7d4] hover:bg-[#f7f9fb] disabled:opacity-40 transition-all cursor-pointer bg-white"
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

        {/* Blog section */}
        <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm overflow-hidden p-6 space-y-6 text-left">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 text-left">
            <div className="text-left">
              <h2 className="font-bold text-[#191c1e] flex items-center gap-2 text-lg mb-0 text-left">
                <span className="material-symbols-outlined text-[#00629d]">
                  rate_review
                </span>
                {language === "vi"
                  ? "Góc Chia Sẻ & Cẩm Nang Hành Trình"
                  : "Travel Handbook & Experience Corner"}
              </h2>
              <p className="text-xs text-[#6f7883] mt-1 mb-0 leading-relaxed text-left">
                {language === "vi"
                  ? "Khám phá những câu chuyện, kinh nghiệm du lịch bằng tàu hỏa và tin tức mới nhất từ GoTrain VN."
                  : "Explore stories, travel tips, and the latest train news from GoTrain VN."}
              </p>
            </div>
            <button
              onClick={() => setIsWriteModalOpen(true)}
              className="flex items-center gap-2 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-4 py-2 rounded-xl font-semibold text-xs transition-all shadow-sm cursor-pointer border-none"
            >
              <span className="material-symbols-outlined text-[16px] text-white">
                edit_note
              </span>
              {language === "vi" ? "Viết bài chia sẻ" : "Write a Post"}
            </button>
          </div>

          {blogsLoading ? (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <div className="w-8 h-8 border-3 border-[#00629d] border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-[#6f7883] mb-0">
                {language === "vi"
                  ? "Đang tải các bài viết..."
                  : "Loading articles..."}
              </p>
            </div>
          ) : blogs.length === 0 ? (
            <div className="py-12 flex flex-col items-center text-center gap-3 border border-dashed border-[#bec7d4]/30 rounded-2xl">
              <span className="material-symbols-outlined text-4xl text-[#bec7d4]">
                description
              </span>
              <div>
                <p className="font-semibold text-slate-800 text-sm mb-1">
                  {language === "vi"
                    ? "Chưa có bài viết chia sẻ nào"
                    : "No travel articles yet"}
                </p>
                <p className="text-xs text-[#6f7883] mt-1 mb-0">
                  {language === "vi"
                    ? "Hãy là người đầu tiên chia sẻ hành trình của bạn!"
                    : "Be the first to share your journey details!"}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              {blogs.slice(0, 3).map((post) => (
                <div
                  key={post.id}
                  onClick={() => setSelectedBlog(post)}
                  className="group cursor-pointer bg-slate-50 hover:bg-white rounded-2xl border border-slate-100 hover:border-[#00629d]/20 p-5 transition-all duration-300 hover:shadow-md flex flex-col justify-between h-48 text-left"
                >
                  <div className="space-y-2 text-left">
                    <h3 className="font-bold text-slate-800 group-hover:text-[#00629d] transition-colors text-sm line-clamp-2 leading-snug text-left mb-0">
                      {post.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed text-left mb-0">
                      {post.summary || post.content}
                    </p>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3 mt-3 text-[10px] text-[#6f7883] font-medium font-sans">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[12px] text-primary">
                        person
                      </span>
                      {post.author?.fullName ||
                        (language === "vi" ? "Hành khách" : "Passenger")}
                    </span>
                    <span>
                      {new Date(post.createdAt).toLocaleDateString(
                        language === "vi" ? "vi-VN" : "en-US",
                        {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal đọc chi tiết blog */}
        {selectedBlog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in fade-in zoom-in-95 duration-200 text-left">
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4 text-left">
                <div className="space-y-1 text-left">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#cfe5ff]/40 text-[#00629d]">
                    {language === "vi"
                      ? "Cẩm nang & Chia sẻ"
                      : "Guide & Experience"}
                  </span>
                  <h3 className="font-extrabold text-[#191c1e] text-lg leading-snug mt-1 text-left mb-0">
                    {selectedBlog.title}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-[#6f7883] mt-1 font-medium font-sans text-left">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-primary">
                        person
                      </span>
                      {selectedBlog.author?.fullName ||
                        (language === "vi" ? "Hành khách" : "Passenger")}
                    </span>
                    <span>•</span>
                    <span>
                      {new Date(selectedBlog.createdAt).toLocaleString(
                        language === "vi" ? "vi-VN" : "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBlog(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-[#6f7883] shrink-0 cursor-pointer border-none bg-transparent"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>

              {/* Content Body */}
              <div className="p-6 overflow-y-auto space-y-4 text-slate-700 leading-relaxed text-sm whitespace-pre-wrap max-h-[50vh] font-sans text-left">
                {selectedBlog.content}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end text-left">
                <button
                  onClick={() => setSelectedBlog(null)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-5 py-2 rounded-xl font-bold text-xs transition-all cursor-pointer border-none"
                >
                  {language === "vi" ? "Đóng bài viết" : "Close Article"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal viết blog mới */}
        {isWriteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between text-left">
                <div className="text-left">
                  <h3 className="font-bold text-[#191c1e] text-base mb-1">
                    {language === "vi"
                      ? "Chia sẻ hành trình của bạn"
                      : "Share Your Journey"}
                  </h3>
                  <p className="text-xs text-[#6f7883] mt-0.5 mb-0 text-left leading-normal">
                    {language === "vi"
                      ? "Viết bài viết mới để chia sẻ kinh nghiệm chuyến đi của bạn."
                      : "Write a new post to share your travel experiences with everyone."}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsWriteModalOpen(false);
                    setNewBlogTitle("");
                    setNewBlogSummary("");
                    setNewBlogContent("");
                  }}
                  className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors text-[#6f7883] cursor-pointer border-none bg-transparent"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    close
                  </span>
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleCreateBlog}>
                <div className="p-6 space-y-4 font-sans text-left">
                  <div className="space-y-1 text-left">
                    <label className="text-xs font-bold text-slate-700 block text-left">
                      {language === "vi" ? "Tiêu đề bài viết" : "Post Title"}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={
                        language === "vi"
                          ? "Ví dụ: Kinh nghiệm đi tàu Hà Nội - Lào Cai chi tiết từ A-Z"
                          : "e.g. Detailed travel guide for Hanoi to Sapa train trip"
                      }
                      value={newBlogTitle}
                      onChange={(e) => setNewBlogTitle(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-xs font-bold text-slate-700 block text-left">
                      {language === "vi"
                        ? "Tóm tắt ngắn (Không bắt buộc)"
                        : "Short Summary (Optional)"}
                    </label>
                    <textarea
                      placeholder={
                        language === "vi"
                          ? "Mô tả ngắn gọn về nội dung bài viết..."
                          : "A brief description of your post..."
                      }
                      rows={2}
                      value={newBlogSummary}
                      onChange={(e) => setNewBlogSummary(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none"
                    />
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-xs font-bold text-slate-700 block text-left">
                      {language === "vi" ? "Nội dung bài viết" : "Post Content"}{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      required
                      placeholder={
                        language === "vi"
                          ? "Nhập nội dung chia sẻ chi tiết của bạn tại đây..."
                          : "Write your detailed travel experience details here..."
                      }
                      rows={6}
                      value={newBlogContent}
                      onChange={(e) => setNewBlogContent(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                    />
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 font-sans text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setIsWriteModalOpen(false);
                      setNewBlogTitle("");
                      setNewBlogSummary("");
                      setNewBlogContent("");
                    }}
                    className="border border-slate-200 hover:bg-slate-100 text-slate-700 px-5 py-2.5 rounded-xl font-semibold text-xs transition-all cursor-pointer bg-white"
                  >
                    {language === "vi" ? "Hủy bỏ" : "Cancel"}
                  </button>
                  <button
                    type="submit"
                    disabled={blogSubmitting}
                    className="flex items-center gap-1.5 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-5 py-2.5 rounded-xl font-semibold text-xs transition-all shadow-sm disabled:opacity-50 cursor-pointer border-none"
                  >
                    {blogSubmitting ? (
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <span className="material-symbols-outlined text-[16px] text-white">
                        send
                      </span>
                    )}
                    {language === "vi" ? "Đăng bài chia sẻ" : "Publish Post"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Bottom quick actions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
          <Link
            to="/"
            className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-[#00629d]/30 transition-all group text-decoration-none text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-[#cfe5ff]/40 flex items-center justify-center group-hover:bg-[#00629d] transition-colors">
              <span className="material-symbols-outlined text-[#00629d] group-hover:text-white transition-colors">
                search
              </span>
            </div>
            <div className="text-left">
              <p className="font-bold text-[#191c1e] text-sm mb-0">
                {language === "vi" ? "Tìm chuyến tàu" : "Find Trains"}
              </p>
              <p className="text-xs text-[#6f7883] mt-0.5 mb-0">
                {language === "vi" ? "Đặt vé nhanh chóng" : "Quick reservation"}
              </p>
            </div>
          </Link>
          <Link
            to="/wallet"
            className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-[#00629d]/30 transition-all group text-decoration-none text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-500 transition-colors">
              <span className="material-symbols-outlined text-green-600 group-hover:text-white transition-colors">
                account_balance_wallet
              </span>
            </div>
            <div className="text-left">
              <p className="font-bold text-[#191c1e] text-sm mb-0">
                {language === "vi" ? "Ví của tôi" : "My Wallet"}
              </p>
              <p className="text-xs text-[#6f7883] mt-0.5 mb-0">
                {wallet
                  ? formatCurrency(wallet.balance, language)
                  : language === "vi"
                    ? "Xem số dư"
                    : "Check balance"}
              </p>
            </div>
          </Link>
          <Link
            to="/tra-cuu-ve"
            className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-[#00629d]/30 transition-all group text-decoration-none text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-500 transition-colors">
              <span className="material-symbols-outlined text-purple-600 group-hover:text-white transition-colors">
                qr_code_2
              </span>
            </div>
            <div className="text-left">
              <p className="font-bold text-[#191c1e] text-sm mb-0">
                {language === "vi" ? "Tra cứu vé" : "Ticket Lookup"}
              </p>
              <p className="text-xs text-[#6f7883] mt-0.5 mb-0">
                {language === "vi" ? "Xem thông tin vé" : "Check ticket info"}
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* Modal tiếp tục thanh toán */}
      {resumeBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 text-left">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-left">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between text-left">
              <div className="text-left">
                <h3 className="font-bold text-[#191c1e] mb-1">
                  {language === "vi"
                    ? "Tiếp tục thanh toán"
                    : "Continue Payment"}
                </h3>
                <p className="text-xs text-[#6f7883] mt-0.5 mb-0 text-left">
                  {language === "vi" ? "Mã đặt vé:" : "Booking Code:"}{" "}
                  <span className="font-mono font-bold text-[#00629d]">
                    {resumeBooking.bookingCode}
                  </span>
                </p>
              </div>
              <button
                onClick={() => setResumeBooking(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors text-[#6f7883] cursor-pointer border-none bg-transparent"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            </div>

            <div className="p-5 flex flex-col items-center gap-4 text-left">
              {/* QR Code */}
              {resumeBooking.payosQrCode ? (
                <div className="rounded-2xl bg-white p-3 shadow-[0_8px_30px_rgba(7,26,43,0.12)] border border-slate-100 text-center">
                  <QRCodeSVG
                    value={resumeBooking.payosQrCode}
                    size={192}
                    level="M"
                    marginSize={3}
                    bgColor="#ffffff"
                    fgColor="#071a2b"
                  />
                </div>
              ) : (
                <div className="w-48 h-48 flex items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-xs text-center text-slate-500 font-semibold leading-5 p-4">
                  {language === "vi"
                    ? "Không thể hiển thị QR. Vui lòng mở trang thanh toán PayOS."
                    : "Cannot display QR. Please open the PayOS checkout page."}
                </div>
              )}

              {/* Đếm ngược */}
              <div className="w-full rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex justify-between items-center text-left">
                <div className="flex items-center gap-1.5 text-amber-800 text-left">
                  <span className="material-symbols-outlined text-[18px]">
                    timer
                  </span>
                  <span className="text-sm font-semibold">
                    {language === "vi" ? "Thời gian còn lại" : "Time Remaining"}
                  </span>
                </div>
                <span className="font-mono font-bold text-amber-700 text-lg tracking-widest">
                  {resumeCountdown(resumeBooking.expiresAt, resumeNow)}
                </span>
              </div>

              {/* Thông tin đơn */}
              <div className="w-full rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 space-y-2 text-left">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {language === "vi" ? "Số tiền" : "Amount"}
                  </span>
                  <span className="font-bold text-[#191c1e]">
                    {formatCurrency(resumeBooking.totalAmount, language)}
                  </span>
                </div>
              </div>

              {/* Nút mở PayOS */}
              {resumeBooking.payosCheckoutUrl && (
                <a
                  href={resumeBooking.payosCheckoutUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#00629d] hover:bg-[#00629d]/90 text-white px-5 py-3 rounded-xl font-semibold text-sm transition-all text-decoration-none"
                >
                  <span className="material-symbols-outlined text-[18px] text-white">
                    open_in_new
                  </span>
                  {language === "vi"
                    ? "Mở trang thanh toán PayOS"
                    : "Open PayOS Checkout Page"}
                </a>
              )}

              {/* Nút kiểm tra trạng thái */}
              <button
                type="button"
                disabled={resumeSubmitting}
                onClick={confirmResumeQr}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 cursor-pointer"
              >
                {resumeSubmitting ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[18px]">
                    check_circle
                  </span>
                )}
                {language === "vi"
                  ? "Tôi đã thanh toán, kiểm tra ngay"
                  : "I have paid, check now"}
              </button>

              <p className="text-[11px] text-slate-400 text-center mb-0 leading-normal">
                {language === "vi"
                  ? "Hệ thống tự động cập nhật khi PayOS xác nhận giao dịch."
                  : "The system updates automatically when PayOS confirms the transaction."}
              </p>
            </div>
          </div>
        </div>
      )}

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

  const isBookingFlow = searchParams.get("from") && searchParams.get("to");
  if (isBookingFlow) {
    return <Navigate to={`/schedule?${searchParams.toString()}`} replace />;
  }

  return <CustomerDashboard user={user} />;
}
