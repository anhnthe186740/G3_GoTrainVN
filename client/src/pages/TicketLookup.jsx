import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { api } from "../services/api";
import { toast } from "sonner";
import {
  Search,
  Ticket,
  User,
  Phone,
  Mail,
  ArrowRight,
  MapPin,
  Clock,
  Printer,
  X,
  CheckCircle,
  AlertCircle,
  Calendar,
  ShieldAlert,
  History,
  TrendingUp,
  AlertTriangle,
  HelpCircle,
  Repeat2,
} from "lucide-react";

export function TicketLookup() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Search state
  const [ticketCode, setTicketCode] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { type: 'single' | 'list', ticket?: any, tickets?: any[] }
  const [activeTicket, setActiveTicket] = useState(null); // The ticket details currently shown
  const [recentSearches, setRecentSearches] = useState([]);

  // Refund Modal state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState(
    "Thay đổi lịch trình cá nhân",
  );
  const [refundMethod, setRefundMethod] = useState("WALLET");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);

  // Load recent searches and pre-fill logged-in user info
  useEffect(() => {
    const saved = localStorage.getItem("recentTicketSearches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        setRecentSearches([]);
      }
    }

    // Pre-fill email/phone if user is logged in
    if (user) {
      setContactInfo(user.email || user.phoneNumber || "");
      // Auto-load user's tickets on page mount
      autoLoadUserTickets(user.email || user.phoneNumber);
    }
  }, [user]);

  const autoLoadUserTickets = async (contact) => {
    if (!contact) return;
    setLoading(true);
    try {
      const { data } = await api.get(
        `/bookings/lookup?contactInfo=${encodeURIComponent(contact)}`,
      );
      setResult(data);
      if (data.type === "single") {
        setActiveTicket(data.ticket);
      } else if (data.type === "list" && data.tickets?.length > 0) {
        // Find if there is an active future ticket, else show the first one
        const active =
          data.tickets.find((t) => t.booking?.status === "CONFIRMED") ||
          data.tickets[0];
        setActiveTicket(active);
      }
    } catch (err) {
      // Don't toast on auto-load to avoid annoying user if they have no tickets yet
      console.log("Auto-load tickets: No tickets found or server error.");
    } finally {
      setLoading(false);
    }
  };

  // Save search to local storage
  const saveRecentSearch = (code) => {
    if (!code) return;
    const cleanCode = code.trim().toUpperCase();
    const updated = [
      cleanCode,
      ...recentSearches.filter((c) => c !== cleanCode),
    ].slice(0, 3);
    setRecentSearches(updated);
    localStorage.setItem("recentTicketSearches", JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem("recentTicketSearches");
    toast.success("Đã xóa lịch sử tra cứu");
  };

  // Perform search
  const handleSearch = async (e, forcedCode = null) => {
    if (e) e.preventDefault();
    setError("");
    setResult(null);
    setActiveTicket(null);

    const searchCode = forcedCode || ticketCode;
    const searchContact = contactInfo;

    if (!searchCode && !searchContact) {
      setError("Vui lòng nhập Mã vé hoặc Email/Số điện thoại để tìm kiếm.");
      return;
    }

    if (!user && (!searchCode || !searchContact)) {
      setError(
        "Khách vãng lai cần nhập cả mã vé và Email/Số điện thoại liên hệ.",
      );
      return;
    }

    setLoading(true);
    try {
      let url = "/bookings/lookup";
      if (searchCode && searchContact) {
        url += `?ticketCode=${encodeURIComponent(searchCode)}&contactInfo=${encodeURIComponent(searchContact)}`;
      } else if (searchCode) {
        url += `?ticketCode=${encodeURIComponent(searchCode)}`;
      } else {
        url += `?contactInfo=${encodeURIComponent(searchContact)}`;
      }

      const { data } = await api.get(url);
      setResult(data);

      if (data.type === "single") {
        setActiveTicket(data.ticket);
        saveRecentSearch(
          searchCode ||
            data.ticket.ticketCode ||
            data.ticket.booking?.bookingCode,
        );
      } else if (data.type === "list" && data.tickets?.length > 0) {
        setActiveTicket(data.tickets[0]);
        if (searchCode) saveRecentSearch(searchCode);
      }
      toast.success("Đã tìm thấy thông tin vé!");
    } catch (err) {
      console.error(err);
      const msg =
        err.response?.data?.message ||
        "Không thể tải thông tin vé. Vui lòng kiểm tra lại.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Quick chip click
  const handleQuickSearch = (code) => {
    setTicketCode(code);
    handleSearch(null, code);
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const getBookedTripStations = (booking) => {
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
  };

  const stationName = (station) =>
    station?.stationName || station?.city || "Chưa xác định";

  const stationCity = (station) => station?.city || "";

  const getStationId = (station) => station?.id || station?.stationId;

  const getJourneyPoints = (booking) => {
    const schedule = booking?.schedule;
    if (!schedule) return [];
    return [
      {
        stationId: getStationId(schedule.startStation),
        departureTime: schedule.departureTime,
        arrivalTime: schedule.departureTime,
        stopOrder: 0,
      },
      ...(schedule.scheduleStops || []).map((stop) => ({
        ...stop,
        stationId: stop.stationId || stop.station?.id,
      })),
      {
        stationId: getStationId(schedule.endStation),
        departureTime: schedule.arrivalTime,
        arrivalTime: schedule.arrivalTime,
        stopOrder: Number.MAX_SAFE_INTEGER,
      },
    ];
  };

  const getBookedTripTimes = (booking, tripStations) => {
    const points = getJourneyPoints(booking);
    const fromId = getStationId(tripStations.from);
    const toId = getStationId(tripStations.to);
    const fromPoint = points.find((point) => point.stationId === fromId);
    const toPoint = points.find((point) => point.stationId === toId);

    return {
      departureTime:
        fromPoint?.departureTime ||
        fromPoint?.arrivalTime ||
        booking?.schedule?.departureTime,
      arrivalTime:
        toPoint?.arrivalTime ||
        toPoint?.departureTime ||
        booking?.schedule?.arrivalTime,
      fromOrder: fromPoint?.stopOrder ?? 0,
      toOrder: toPoint?.stopOrder ?? Number.MAX_SAFE_INTEGER,
    };
  };

  const getJourneyState = (booking, tripStations) => {
    if (["CANCELLED", "REFUNDED"].includes(booking?.status)) {
      return "CANCELLED";
    }

    const { departureTime, arrivalTime } = getBookedTripTimes(
      booking,
      tripStations,
    );
    const now = Date.now();
    const departure = departureTime ? new Date(departureTime).getTime() : null;
    const arrival = arrivalTime ? new Date(arrivalTime).getTime() : null;

    if (arrival && now >= arrival) return "COMPLETED";
    if (departure && now >= departure) return "IN_PROGRESS";
    return "UPCOMING";
  };

  const getJourneyStateBadge = (booking, tripStations) => {
    const state = getJourneyState(booking, tripStations);
    if (state === "COMPLETED") {
      return (
        <span className="text-xs font-semibold text-green-600 bg-green-50 border border-green-100 px-2.5 py-1 rounded-full">
          Chuyến tàu đã hoàn thành
        </span>
      );
    }
    if (state === "CANCELLED") {
      return (
        <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-2.5 py-1 rounded-full">
          Chuyến đi đã bị hủy
        </span>
      );
    }
    if (state === "IN_PROGRESS") {
      return (
        <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-full">
          Tàu đang trong hành trình
        </span>
      );
    }
    return (
      <span className="text-xs font-semibold text-primary bg-primary/5 border border-primary/10 px-2.5 py-1 rounded-full flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
        Chưa khởi hành
      </span>
    );
  };

  const getVisibleIntermediateStops = (booking, tripStations) => {
    const { fromOrder, toOrder } = getBookedTripTimes(booking, tripStations);
    return (booking?.schedule?.scheduleStops || []).filter((stop) => {
      const order = stop.stopOrder ?? 0;
      return order > fromOrder && order < toOrder;
    });
  };

  const getSeatLayout = (ticket) => {
    const carriageType = ticket?.seat?.carriage?.carriageType || "NORMAL_SEAT";
    const totalSeats =
      ticket?.seat?.carriage?.totalSeats ||
      { NORMAL_SEAT: 40, AC_SEAT: 28, SLEEPER_6: 24, SLEEPER_4: 16 }[
        carriageType
      ] ||
      40;
    const currentSeat = ticket?.seat?.seatNumber;

    if (carriageType === "NORMAL_SEAT" || carriageType === "AC_SEAT") {
      return Array.from({ length: totalSeats }, (_, index) => ({
        seatNumber: String(index + 1),
        seatType: index % 4 === 0 || index % 4 === 3 ? "WINDOW" : "AISLE",
        isMine: String(index + 1) === String(currentSeat),
      }));
    }

    if (currentSeat && !/^\d+$/.test(String(currentSeat))) {
      const floors =
        carriageType === "SLEEPER_6" ? ["1", "2", "3"] : ["1", "2"];
      return Array.from({ length: 4 }, (_, compartmentIndex) =>
        floors.flatMap((floor) =>
          ["A", "B"].map((side) => {
            const seatNumber = `K${compartmentIndex + 1}-T${floor}-${side}`;
            return {
              seatNumber,
              seatType: floor === "1" ? "WINDOW" : "AISLE",
              isMine: seatNumber === currentSeat,
            };
          }),
        ),
      ).flat();
    }

    return [];
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case "CONFIRMED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Đã xác nhận
          </span>
        );
      case "CANCELLED":
      case "REFUNDED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
            Đã hủy / Hoàn tiền
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-50 text-green-700 border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
            Đã xác nhận
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            {status}
          </span>
        );
    }
  };

  // Calculate refund policy parameters
  const calculateRefundPolicy = (ticket) => {
    if (!ticket || !ticket.booking || !ticket.booking.schedule) return null;
    const departureTime = new Date(ticket.booking.schedule.departureTime);
    const now = new Date();
    const diffMs = departureTime.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    const price = ticket.booking.totalAmount || 0;

    if (diffHours < 0) {
      return {
        allowed: false,
        message: "Tàu đã khởi hành. Không thể hoàn vé.",
        rate: 0,
        refund: 0,
      };
    } else if (diffHours < 4) {
      return {
        allowed: false,
        message:
          "Hủy vé sát giờ khởi hành (dưới 4 tiếng). Không thể hoàn vé trực tuyến.",
        rate: 0,
        refund: 0,
      };
    } else if (diffHours >= 4 && diffHours < 24) {
      return {
        allowed: true,
        message:
          "Hoàn 50% giá trị vé (Từ 4h đến dưới 24h trước khi khởi hành).",
        rate: 50,
        refund: price * 0.5,
      };
    } else {
      return {
        allowed: true,
        message: "Hoàn 80% giá trị vé (Hơn 24h trước khi khởi hành).",
        rate: 80,
        refund: price * 0.8,
      };
    }
  };

  const refundInfo = calculateRefundPolicy(activeTicket);
  const activeTripStations = getBookedTripStations(activeTicket?.booking);
  const activeTripTimes = getBookedTripTimes(
    activeTicket?.booking,
    activeTripStations,
  );
  const activeIntermediateStops = getVisibleIntermediateStops(
    activeTicket?.booking,
    activeTripStations,
  );
  const activeSeatLayout = getSeatLayout(activeTicket);
  const activeJourneyState = getJourneyState(
    activeTicket?.booking,
    activeTripStations,
  );
  const isVerifiedLookup = Boolean(user) || result?.isMasked !== true;
  const canRequestRefund =
    ["CONFIRMED", "COMPLETED"].includes(activeTicket?.booking?.status) &&
    activeTicket?.booking?.paymentStatus === "COMPLETED" &&
    isVerifiedLookup &&
    activeJourneyState === "UPCOMING";
  const canExchangeTicket =
    activeTicket?.booking?.status === "CONFIRMED" &&
    activeJourneyState === "UPCOMING";

  // Print ticket boarding pass handler
  const handlePrint = () => {
    window.print();
  };

  const handleExchangeTicket = () => {
    if (!activeTicket?.booking) return;

    navigate(
      `/doi-ve?bookingCode=${encodeURIComponent(
        activeTicket.booking.bookingCode || activeTicket.ticketCode || "",
      )}`,
      { state: { ticket: activeTicket } },
    );
  };

  // Refund submission
  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!activeTicket || !activeTicket.booking) return;

    setRefundLoading(true);
    try {
      const response = await api.post(
        `/bookings/${activeTicket.booking.id}/cancel`,
        {
          passengerIds: [activeTicket.id],
          ticketCode:
            activeTicket.ticketCode ||
            activeTicket.booking.bookingCode ||
            ticketCode,
          contactInfo,
          reason: refundReason,
          refundMethod: refundMethod,
          bankName: refundMethod === "BANK" ? bankName : undefined,
          bankAccount: refundMethod === "BANK" ? bankAccount : undefined,
        },
      );
      toast.success(
        response.data.message || "Đã hủy vé và hoàn tiền thành công!",
      );
      setIsRefundModalOpen(false);

      // Refresh current lookup search to show updated status
      if (ticketCode) {
        handleSearch(null, ticketCode);
      } else {
        autoLoadUserTickets(contactInfo);
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Lỗi khi gửi yêu cầu hủy vé.");
    } finally {
      setRefundLoading(false);
    }
  };

  return (
    <div className="pb-16">
      {/* Styles for printing only the Boarding Pass */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-boarding-pass, #printable-boarding-pass * {
            visibility: visible;
          }
          #printable-boarding-pass {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            border: none;
            box-shadow: none;
            background: white !important;
            color: black !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `,
        }}
      />

      <div className="max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* ============================================================== */}
        {/* LEFT COLUMN: Search Form & Helpers                             */}
        {/* ============================================================== */}
        <div className="lg:col-span-4 flex flex-col gap-6 no-print">
          {/* Header text */}
          <div className="mb-2">
            <h1 className="text-3xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Ticket className="h-7 w-7 text-primary" />
              Tra Cứu Vé Tàu
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              Nhập mã vé hoặc thông tin liên hệ để kiểm tra hành trình của bạn.
            </p>
          </div>

          {/* Search Card */}
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-2 h-full bg-primary" />

            <form onSubmit={handleSearch} className="flex flex-col gap-5">
              {/* Ticket Code input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                  Mã vé (Ticket Code)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Ticket className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={ticketCode}
                    onChange={(e) => setTicketCode(e.target.value)}
                    placeholder="Ví dụ: GT2026A02"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  />
                </div>
              </div>

              {/* OR Separator */}
              <div className="relative my-1 flex items-center justify-center">
                <div className="absolute w-full border-t border-dashed border-slate-200" />
                <span className="relative px-3 bg-white text-[10px] font-extrabold text-slate-400 tracking-widest uppercase">
                  Hoặc tra cứu bằng
                </span>
              </div>

              {/* Email/Phone input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                  Email hoặc Số điện thoại
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={contactInfo}
                    onChange={(e) => setContactInfo(e.target.value)}
                    placeholder="Nhập email hoặc SĐT mua vé"
                    className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 placeholder-slate-400 font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm"
                  />
                </div>
              </div>

              {/* Search button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/95 text-white py-3.5 px-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/15 transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
              >
                {loading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5" />
                    <span>Tra cứu vé</span>
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-2 text-red-600 text-xs font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Recent Searches (Local Storage History) */}
          {recentSearches.length > 0 && (
            <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <History className="h-4 w-4 text-slate-400" />
                  Lịch sử tra cứu gần đây
                </span>
                <button
                  onClick={clearRecentSearches}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 cursor-pointer"
                >
                  Xóa tất cả
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((code) => (
                  <button
                    key={code}
                    onClick={() => handleQuickSearch(code)}
                    className="px-3.5 py-1.5 bg-slate-50 hover:bg-primary/5 text-slate-600 hover:text-primary border border-slate-200 hover:border-primary/20 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center gap-1"
                  >
                    <Ticket className="h-3.5 w-3.5 opacity-60" />
                    {code}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Helper Instructions Card */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50/30 rounded-3xl p-6 border border-blue-100/50 flex flex-col gap-3">
            <span className="text-xs font-extrabold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <HelpCircle className="h-4.5 w-4.5 text-primary" />
              Hướng dẫn tra cứu
            </span>
            <ul className="text-xs text-slate-600 space-y-2 list-disc list-inside">
              <li>
                Mã vé bao gồm 10 ký tự in hoa được gửi về email của bạn sau khi
                thanh toán thành công.
              </li>
              <li>
                Nếu không tìm thấy, vui lòng kiểm tra kỹ cả hộp thư rác (Spam).
              </li>
              <li>
                Bạn cũng có thể tra cứu nhanh bằng Email hoặc Số điện thoại để
                liệt kê toàn bộ vé đã mua.
              </li>
            </ul>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: Results Section                                  */}
        {/* ============================================================== */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Loading Placeholder */}
          {loading && (
            <div className="bg-white rounded-3xl p-12 shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[400px]">
              <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-slate-500 font-medium">
                Đang tải thông tin vé...
              </p>
            </div>
          )}

          {/* Default Empty State */}
          {!loading && !result && (
            <div className="bg-white rounded-3xl p-10 shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                <Search className="h-8 w-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-bold text-slate-800">
                Kết quả tra cứu
              </h3>
              <p className="text-slate-400 text-sm mt-1 max-w-[340px]">
                Thông tin chi tiết vé của bạn sẽ được hiển thị tại đây sau khi
                bạn nhập và nhấn nút Tra cứu.
              </p>
            </div>
          )}

          {/* List state (Multiple tickets found for email/phone) */}
          {!loading && result && result.type === "list" && (
            <div className="flex flex-col gap-4 no-print">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-slate-800">
                  Danh sách vé tìm thấy ({result.tickets.length})
                </h2>
                <span className="text-xs text-slate-400 font-semibold">
                  Click để xem thông tin chi tiết từng vé
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.tickets.map((t) => {
                  const schedule = t.booking?.schedule;
                  const tripStations = getBookedTripStations(t.booking);
                  const isCurrent = activeTicket?.id === t.id;

                  return (
                    <div
                      key={t.id}
                      onClick={() => setActiveTicket(t)}
                      className={`p-5 rounded-3xl border cursor-pointer transition-all flex flex-col gap-3 bg-white relative overflow-hidden ${
                        isCurrent
                          ? "border-primary shadow-md shadow-primary/5 ring-1 ring-primary"
                          : "border-slate-100 hover:border-slate-200 shadow-sm"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                            {schedule?.train?.trainName}
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-400 block uppercase">
                              Mã vé
                            </span>
                            <span className="text-sm font-extrabold text-slate-800">
                              {t.ticketCode || t.booking?.bookingCode}
                            </span>
                          </div>
                        </div>
                        {getStatusBadge(t.booking?.status || "CONFIRMED")}
                      </div>

                      <div className="flex justify-between items-center py-2 border-t border-b border-dashed border-slate-100">
                        <div className="text-left">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">
                            Ga đi
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {stationCity(tripStations.from) ||
                              stationName(tripStations.from)}
                          </span>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">
                            Ga đến
                          </span>
                          <span className="text-xs font-bold text-slate-700">
                            {stationCity(tripStations.to) ||
                              stationName(tripStations.to)}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-xs font-semibold text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 opacity-70" />
                          {formatDate(schedule?.departureTime)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 opacity-70" />
                          {formatTime(schedule?.departureTime)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Active Ticket Detailed Info */}
          {!loading && activeTicket && (
            <div className="flex flex-col gap-6">
              {/* ============================================================== */}
              {/* 1. VISUAL BOARDING PASS CARD                                   */}
              {/* ============================================================== */}
              <div
                id="printable-boarding-pass"
                className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col md:flex-row"
              >
                {/* Main Pass Info */}
                <div className="flex-1 p-6 flex flex-col gap-6 relative">
                  {/* Brand Header */}
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white">
                        <Ticket className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-base font-extrabold text-slate-800 block leading-tight">
                          GOTRAIN VN
                        </span>
                        <span className="text-[10px] font-bold text-slate-400 tracking-wider block uppercase">
                          Thẻ Lên Tàu Hỏa / Boarding Pass
                        </span>
                      </div>
                    </div>
                    {getStatusBadge(
                      activeTicket.booking?.status || "CONFIRMED",
                    )}
                  </div>

                  {/* Trip details */}
                  <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-4 relative">
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-primary uppercase tracking-wider block">
                        Ga đi / From
                      </span>
                      <span className="text-lg font-black text-slate-800">
                        {stationName(activeTripStations.from)}
                      </span>
                      <span className="text-xs font-bold text-slate-500 mt-0.5">
                        {stationCity(activeTripStations.from)}
                      </span>
                    </div>

                    <div className="flex flex-col items-center gap-1.5 px-4">
                      <span className="text-xs font-bold text-slate-400">
                        {activeTicket.booking?.schedule?.train?.trainName}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <div className="w-12 border-t-2 border-primary/20 border-dashed" />
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      </div>
                      <span className="text-[10px] font-semibold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                        Một chiều
                      </span>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="text-xs font-extrabold text-primary uppercase tracking-wider block">
                        Ga đến / To
                      </span>
                      <span className="text-lg font-black text-slate-800">
                        {stationName(activeTripStations.to)}
                      </span>
                      <span className="text-xs font-bold text-slate-500 mt-0.5">
                        {stationCity(activeTripStations.to)}
                      </span>
                    </div>
                  </div>

                  {/* Ticket core metadata */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Hành khách
                      </span>
                      <span className="text-sm font-extrabold text-slate-800 truncate block">
                        {activeTicket.fullName}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Giờ khởi hành
                      </span>
                      <span className="text-sm font-extrabold text-slate-800 block">
                        {formatTime(activeTripTimes.departureTime)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 block">
                        {formatDate(activeTripTimes.departureTime)}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Toa tàu
                      </span>
                      <span className="text-sm font-extrabold text-slate-800 block">
                        Toa {activeTicket.carriageNumber || "0"}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">
                        {activeTicket.seat?.carriage?.carriageType || "AC SEAT"}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Ghế ngồi
                      </span>
                      <span className="text-sm font-extrabold text-slate-800 block">
                        {activeTicket.seat?.seatNumber}
                      </span>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase">
                        {activeTicket.seat?.seatType === "WINDOW"
                          ? "Cửa sổ"
                          : "Lối đi"}
                      </span>
                    </div>
                  </div>

                  {/* Safety cutout curves for paper look */}
                  <div className="absolute top-1/2 -right-4 w-8 h-8 bg-slate-50 rounded-full border border-slate-100 hidden md:block -translate-y-1/2 z-10" />
                </div>

                {/* Dashed Separator on Desktop */}
                <div className="border-r-2 border-dashed border-slate-200 relative my-6 hidden md:block" />

                {/* Ticket Stub (Barcode/QR code section) */}
                <div className="w-full md:w-56 p-6 bg-slate-50/50 flex flex-col items-center justify-between gap-4 border-t md:border-t-0 md:border-l border-slate-100 relative">
                  {/* Left cutout for paper look */}
                  <div className="absolute top-1/2 -left-4 w-8 h-8 bg-white rounded-full border border-slate-100 hidden md:block -translate-y-1/2 z-10" />

                  <div className="text-center w-full">
                    <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                      Mã vạch soát vé
                    </span>
                    <span className="text-sm font-black text-slate-800 tracking-wider">
                      {activeTicket.ticketCode ||
                        activeTicket.booking?.bookingCode}
                    </span>
                  </div>

                  {/* Stylized QR Code placeholder */}
                  <div className="w-28 h-28 bg-white border border-slate-200 rounded-2xl p-2 flex items-center justify-center shadow-inner relative overflow-hidden group">
                    <div className="grid grid-cols-5 gap-1.5 w-full h-full opacity-80">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className={`rounded-sm ${(i * 7 + 13) % 5 === 0 || i % 3 === 0 ? "bg-slate-800" : "bg-transparent"}`}
                        />
                      ))}
                    </div>
                    {/* QR Code corners */}
                    <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-slate-800" />
                    <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-slate-800" />
                    <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-slate-800" />
                    <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-slate-800" />
                  </div>

                  <div className="w-full flex flex-col gap-1 text-center text-[10px] font-bold text-slate-400">
                    <span>Vui lòng xuất trình thẻ này</span>
                    <span>khi quét vé lên tàu.</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for ticket */}
              <div className="flex flex-wrap gap-4 no-print">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white font-bold px-5 py-3 rounded-2xl shadow-md transition-all hover:-translate-y-0.5 cursor-pointer text-sm"
                >
                  <Printer className="h-4.5 w-4.5" />
                  <span>In vé / Tải Thẻ Lên Tàu</span>
                </button>

                {canRequestRefund && (
                  <button
                    onClick={() => {
                      if (refundInfo.allowed) {
                        setIsRefundModalOpen(true);
                      } else {
                        toast.error(refundInfo.message);
                      }
                    }}
                    className={`flex items-center gap-2 font-bold px-5 py-3 rounded-2xl shadow-md transition-all hover:-translate-y-0.5 cursor-pointer text-sm border ${
                      refundInfo.allowed
                        ? "bg-white hover:bg-red-50 text-red-600 border-red-200"
                        : "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed"
                    }`}
                  >
                    <AlertTriangle className="h-4.5 w-4.5" />
                    <span>Yêu cầu hoàn vé & Hủy</span>
                  </button>
                )}

                {canExchangeTicket && (
                  <button
                    onClick={handleExchangeTicket}
                    className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white font-bold px-5 py-3 rounded-2xl shadow-md shadow-primary/20 transition-all hover:-translate-y-0.5 cursor-pointer text-sm"
                  >
                    <Repeat2 className="h-4.5 w-4.5" />
                    <span>Đổi vé</span>
                  </button>
                )}
              </div>

              {/* ============================================================== */}
              {/* 2. JOURNEY TIMELINE / ROUTE PROGRESS                           */}
              {/* ============================================================== */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-5 no-print">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Thông Tin Hành Trình & Lịch Trình
                  </h3>

                  {getJourneyStateBadge(
                    activeTicket.booking,
                    activeTripStations,
                  )}
                </div>

                {/* Station stop list / timeline */}
                <div className="flex flex-col gap-4 pl-4 border-l-2 border-slate-100 ml-4 relative mt-2">
                  {/* Start Station Stop */}
                  <div className="relative pl-6">
                    <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-primary bg-white flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-800 uppercase">
                        {stationName(activeTripStations.from)}
                      </span>
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mt-1">
                        <span>Ga đi khởi hành</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          Giờ đi: {formatTime(
                            activeTripTimes.departureTime,
                          )} - {formatDate(activeTripTimes.departureTime)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dummy Intermediate stations (if no scheduleStops fetched) */}
                  {activeIntermediateStops.length === 0 ? (
                    <div className="relative pl-6 py-2">
                      <div className="absolute -left-[24px] top-2.5 w-2 h-2 rounded-full bg-slate-300" />
                      <div className="flex flex-col text-slate-400">
                        <span className="text-xs font-bold uppercase">
                          Ga trung gian
                        </span>
                        <span className="text-[10px] mt-0.5">
                          Không dừng đón khách tại ga lẻ
                        </span>
                      </div>
                    </div>
                  ) : (
                    activeIntermediateStops.map((stop) => (
                      <div key={stop.id} className="relative pl-6 py-1">
                        <div className="absolute -left-[25px] top-1.5 w-2.5 h-2.5 rounded-full border border-slate-300 bg-white" />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-600 uppercase">
                            {stop.station?.stationName ||
                              `Ga ${stop.stationId}`}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            Đến lúc: {formatTime(stop.arrivalTime)} | Đi lúc:{" "}
                            {stop.departureTime
                              ? formatTime(stop.departureTime)
                              : "Chạy tiếp"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}

                  {/* End Station Stop */}
                  <div className="relative pl-6 mt-1">
                    <div className="absolute -left-[27px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-primary bg-white flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-extrabold text-slate-800 uppercase">
                        {stationName(activeTripStations.to)}
                      </span>
                      <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 mt-1">
                        <span>Ga đích kết thúc</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          Giờ đến: {formatTime(
                            activeTripTimes.arrivalTime,
                          )} - {formatDate(activeTripTimes.arrivalTime)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ============================================================== */}
              {/* 3. SEAT MAP VISUALIZER                                         */}
              {/* ============================================================== */}
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col gap-4 no-print">
                <h3 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  Sơ Đồ Vị Trí Ghế Ngồi trên Tàu
                </h3>
                <p className="text-slate-500 text-xs">
                  Vị trí ghế{" "}
                  <span className="font-bold text-primary">
                    {activeTicket.seat?.seatNumber}
                  </span>{" "}
                  của bạn được tô màu cam nổi bật trong Toa số{" "}
                  <span className="font-bold text-slate-800">
                    {activeTicket.carriageNumber || "1"}
                  </span>
                  .
                </p>

                {/* carriage diagram wrapper */}
                <div className="mt-2 border border-slate-200/80 bg-slate-50 rounded-2xl p-4 flex flex-col gap-4 overflow-x-auto">
                  <div className="flex items-center justify-center gap-2 min-w-[500px]">
                    {/* Locomotive (Tầu kéo) */}
                    <div className="w-12 h-16 bg-slate-800 text-white rounded-l-2xl flex flex-col items-center justify-center text-[10px] font-black tracking-tighter shrink-0 border-r border-slate-700">
                      <span>ĐẦU</span>
                      <span>MÁY</span>
                    </div>

                    {/* Carriage label */}
                    <div className="flex items-center gap-2 py-2 px-3 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-extrabold text-slate-700 uppercase shrink-0">
                      Toa {activeTicket.carriageNumber || "1"} (
                      {activeTicket.seat?.carriage?.carriageType || "AC SEAT"})
                    </div>

                    {/* Seats Layout */}
                    <div className="flex-1 bg-white border border-slate-200 rounded-xl p-3 relative">
                      {activeSeatLayout.length > 0 ? (
                        <div className="grid grid-cols-[repeat(2,32px)_minmax(28px,1fr)_repeat(2,32px)] gap-1.5 justify-center">
                          {activeSeatLayout.map((seat, idx) => {
                            const column = idx % 4;
                            const gridColumn =
                              column < 2 ? column + 1 : column + 2;
                            return (
                              <div
                                key={seat.seatNumber}
                                style={{ gridColumn }}
                                className={`w-8 h-8 rounded-lg text-[10px] font-bold flex items-center justify-center border transition-all ${
                                  seat.isMine
                                    ? "bg-amber-500 border-amber-600 text-white shadow shadow-amber-500/20 scale-110"
                                    : "bg-slate-50 border-slate-200 text-slate-400 hover:bg-slate-100"
                                }`}
                                title={`Ghế ${seat.seatNumber} (${seat.seatType === "WINDOW" ? "Cửa sổ" : "Lối đi"})`}
                              >
                                {seat.seatNumber}
                              </div>
                            );
                          })}
                          <div className="col-start-3 row-start-1 row-end-[99] flex items-center justify-center border-x border-dashed border-slate-100 text-[8px] font-black text-slate-300 tracking-widest uppercase [writing-mode:vertical-rl] select-none">
                            Lối đi
                          </div>
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs font-semibold text-slate-400">
                          Chưa có sơ đồ cho loại ghế này.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Map legends */}
                <div className="flex justify-start gap-4 text-xs font-semibold text-slate-500 mt-1 pl-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-600" />
                    <span>Ghế của bạn</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3.5 h-3.5 rounded bg-slate-50 border border-slate-200" />
                    <span>Ghế trống / Khác</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Support Section Bottom */}
      <div className="max-w-[1200px] mx-auto mt-12 no-print">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50/50 rounded-[2rem] p-8 border border-blue-100/50 flex flex-col md:flex-row justify-between items-center gap-8 relative overflow-hidden">
          <div className="flex flex-col gap-3 max-w-[500px]">
            <h3 className="text-xl font-extrabold text-slate-800 leading-tight">
              Gặp khó khăn khi tra cứu vé?
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed">
              Đội ngũ hỗ trợ của GoTrain VN luôn sẵn sàng giúp bạn tìm lại thông
              tin hành trình một cách nhanh nhất.
            </p>

            <div className="flex flex-wrap gap-4 mt-2">
              <a
                href="tel:19001234"
                className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 px-5 py-3 rounded-2xl border border-slate-200/80 shadow-sm font-bold text-sm transition-all"
              >
                <Phone className="h-4.5 w-4.5 text-primary" />
                <span>Hotline: 1900 1234</span>
              </a>
              <button
                onClick={() =>
                  toast.info("Hệ thống chat trực tuyến đang bảo trì.")
                }
                className="flex items-center gap-2 bg-primary hover:bg-primary/95 text-white px-5 py-3 rounded-2xl shadow-md font-bold text-sm transition-all cursor-pointer"
              >
                <Mail className="h-4.5 w-4.5" />
                <span>Hỗ trợ trực tuyến</span>
              </button>
            </div>
          </div>

          <div className="relative w-44 h-44 md:w-52 md:h-52 shrink-0 flex items-center justify-center">
            {/* Styled customer representative avatar */}
            <div className="w-36 h-36 md:w-44 md:h-44 rounded-full bg-gradient-to-tr from-primary to-indigo-500 p-1 shadow-lg relative overflow-hidden flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-white flex flex-col items-center justify-center p-4 text-center">
                <User className="h-14 w-14 text-primary mb-1 opacity-80" />
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  Trực tuyến
                </span>
                <span className="text-xs font-bold text-slate-700 block mt-0.5">
                  CSKH GoTrain
                </span>
              </div>
            </div>
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* REFUND REQUEST MODAL                                           */}
      {/* ============================================================== */}
      {isRefundModalOpen && activeTicket && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 no-print animate-fade-in">
          <div className="bg-white rounded-[2rem] w-full max-w-[500px] p-6 shadow-2xl relative border border-slate-100 flex flex-col gap-6">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-red-50 text-red-500 flex items-center justify-center">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-800 block">
                    Yêu Cầu Hủy Vé & Hoàn Tiền
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 tracking-wide uppercase">
                    Mã vé: {activeTicket.ticketCode}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setIsRefundModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-50 hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 cursor-pointer transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleRefundSubmit} className="flex flex-col gap-4">
              {/* Alert policy */}
              <div className="p-4 bg-amber-50/50 border border-amber-100 rounded-2xl flex items-start gap-2.5 text-amber-800 text-xs font-semibold leading-relaxed">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span>{refundInfo.message}</span>
                  <span className="text-[10px] text-amber-600 block font-normal">
                    * Quyết định hoàn tiền được tính toán tự động dựa trên thời
                    gian thực tế so với giờ khởi hành của tàu.
                  </span>
                </div>
              </div>

              {/* Price Calculation details */}
              <div className="bg-slate-50 rounded-2xl p-4 flex flex-col gap-2 text-xs font-semibold text-slate-600 border border-slate-100">
                <div className="flex justify-between items-center">
                  <span>Giá trị mua vé gốc:</span>
                  <span className="text-slate-800 font-bold">
                    {(activeTicket.booking?.totalAmount || 0).toLocaleString(
                      "vi-VN",
                    )}{" "}
                    VND
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Tỉ lệ hoàn tiền áp dụng:</span>
                  <span className="text-slate-800 font-bold">
                    {refundInfo.rate}%
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200">
                  <span className="text-slate-800 font-bold">
                    Số tiền hoàn thực tế:
                  </span>
                  <span className="text-red-600 font-black text-sm">
                    {refundInfo.refund.toLocaleString("vi-VN")} VND
                  </span>
                </div>
              </div>

              {/* Refund method */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                  Hình thức nhận tiền hoàn
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setRefundMethod("WALLET")}
                    className={`p-3.5 rounded-2xl border cursor-pointer text-center flex flex-col items-center justify-center gap-1 transition-all ${
                      refundMethod === "WALLET"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="text-sm font-extrabold">
                      Ví điện tử GoTrain
                    </span>
                    <span className="text-[10px] opacity-80 block">
                      Nhận ngay lập tức
                    </span>
                  </div>
                  <div
                    onClick={() => setRefundMethod("BANK")}
                    className={`p-3.5 rounded-2xl border cursor-pointer text-center flex flex-col items-center justify-center gap-1 transition-all ${
                      refundMethod === "BANK"
                        ? "border-primary bg-primary/5 text-primary ring-1 ring-primary"
                        : "border-slate-200 hover:border-slate-300 text-slate-600"
                    }`}
                  >
                    <span className="text-sm font-extrabold">
                      Tài khoản ngân hàng
                    </span>
                    <span className="text-[10px] opacity-80 block">
                      Xử lý trong 1-3 ngày
                    </span>
                  </div>
                </div>
              </div>

              {/* Conditional Bank inputs */}
              {refundMethod === "BANK" && (
                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-2xl border border-slate-100 animate-slide-down">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Tên ngân hàng
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: Vietcombank"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">
                      Số tài khoản
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nhập số tài khoản"
                      value={bankAccount}
                      onChange={(e) => setBankAccount(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>
              )}

              {/* Reason input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-500 tracking-wide uppercase">
                  Lý do hoàn vé
                </label>
                <select
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-700 focus:outline-none focus:border-primary transition-all"
                >
                  <option value="Thay đổi lịch trình cá nhân">
                    Thay đổi lịch trình cá nhân
                  </option>
                  <option value="Sức khỏe gặp sự cố">Sức khỏe gặp sự cố</option>
                  <option value="Thời tiết hoặc giao thông trễ giờ">
                    Thời tiết hoặc giao thông trễ giờ
                  </option>
                  <option value="Đặt nhầm thông tin vé (ngày/giờ/ga)">
                    Đặt nhầm thông tin vé (ngày/giờ/ga)
                  </option>
                  <option value="Khác">Lý do khác...</option>
                </select>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={refundLoading}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg shadow-red-600/15 cursor-pointer hover:-translate-y-0.5 transition-all text-sm flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                {refundLoading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4.5 w-4.5" />
                    <span>Xác nhận hoàn & Hủy vé</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
