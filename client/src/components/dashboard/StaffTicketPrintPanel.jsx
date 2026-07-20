import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import { staffSearchApi } from "../../services/staffSearchApi";
import { QRCodeSVG } from "qrcode.react";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function formatTime(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
function formatCurrency(n) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(n || 0);
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
  return station?.stationName || station?.city || "Chưa xác định";
}

function stationCity(station) {
  return station?.city || "";
}

const STATUS_BADGE = {
  CONFIRMED: "bg-green-100 text-green-700 border-green-200",
  CANCELLED: "bg-red-100 text-red-700 border-red-200",
  REFUNDED: "bg-purple-100 text-purple-700 border-purple-200",
  COMPLETED: "bg-gray-100 text-gray-600 border-gray-200",
  PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
};
const STATUS_LABEL = {
  CONFIRMED: "Đã xác nhận",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
  COMPLETED: "Hoàn thành",
  PENDING: "Chờ xử lý",
};

function ticketsFromStaffSearch(data) {
  const tickets = [];
  const seen = new Set();

  (data.tickets || []).forEach((ticket) => {
    if (!ticket?.id || seen.has(ticket.id)) return;
    seen.add(ticket.id);
    tickets.push(ticket);
  });

  (data.bookings || []).forEach((booking) => {
    (booking.passengers || []).forEach((passenger) => {
      if (!passenger?.id || seen.has(passenger.id)) return;
      seen.add(passenger.id);
      tickets.push({
        ...passenger,
        booking,
      });
    });
  });

  return tickets;
}

/* ─── Boarding Pass component (dùng để in) ─────────────── */
function BoardingPass({ ticket, booking }) {
  const dep = booking?.schedule;
  const tripStations = getBookedTripStations(booking);
  return (
    <div className="bg-white border-2 border-dashed border-slate-300 rounded-3xl overflow-hidden flex flex-col md:flex-row shadow-sm print:shadow-none print:border-solid">
      {/* Main section */}
      <div className="flex-1 p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#00629d] rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[18px]">
                train
              </span>
            </div>
            <div>
              <p className="font-extrabold text-[#191c1e] leading-tight">
                GOTRAIN VN
              </p>
              <p className="text-[10px] text-[#6f7883] font-bold uppercase tracking-wider">
                Thẻ Lên Tàu / Boarding Pass
              </p>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_BADGE[booking?.status] || STATUS_BADGE.PENDING}`}
          >
            {STATUS_LABEL[booking?.status] || booking?.status}
          </span>
        </div>

        {/* Route */}
        <div className="flex items-center justify-between bg-[#f7f9fb] rounded-2xl p-4">
          <div>
            <p className="text-[10px] text-[#00629d] font-extrabold uppercase tracking-wider">
              Ga Đi
            </p>
            <p className="text-lg font-extrabold text-[#191c1e]">
              {stationName(tripStations.from)}
            </p>
            <p className="text-xs text-[#6f7883] font-semibold">
              {stationCity(tripStations.from)}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs font-bold text-[#6f7883]">
              {dep?.train?.trainName}
            </p>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-[#00629d]" />
              <div className="w-16 border-t-2 border-dashed border-[#bec7d4]" />
              <span className="material-symbols-outlined text-[#00629d] text-[18px]">
                train
              </span>
              <div className="w-16 border-t-2 border-dashed border-[#bec7d4]" />
              <div className="w-2 h-2 rounded-full bg-[#00629d]" />
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#00629d] font-extrabold uppercase tracking-wider">
              Ga Đến
            </p>
            <p className="text-lg font-extrabold text-[#191c1e]">
              {stationName(tripStations.to)}
            </p>
            <p className="text-xs text-[#6f7883] font-semibold">
              {stationCity(tripStations.to)}
            </p>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Hành Khách", value: ticket?.fullName || "—" },
            {
              label: "Ngày & Giờ",
              value: `${formatDate(dep?.departureTime)} ${formatTime(dep?.departureTime)}`,
            },
            { label: "Toa Tàu", value: `Toa ${ticket?.carriageNumber || "—"}` },
            { label: "Ghế Số", value: ticket?.seat?.seatNumber || "—" },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-[10px] font-extrabold text-[#6f7883] uppercase tracking-wider">
                {label}
              </p>
              <p className="text-sm font-extrabold text-[#191c1e] mt-0.5">
                {value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stub / Barcode section */}
      <div className="w-full md:w-48 p-5 bg-[#f7f9fb] flex flex-col items-center justify-between gap-3 border-t md:border-t-0 md:border-l-2 md:border-dashed border-[#bec7d4]">
        <div className="text-center">
          <p className="text-[10px] font-extrabold text-[#6f7883] uppercase tracking-wider">
            Mã Soát Vé
          </p>
          <p className="text-sm font-black text-[#191c1e] tracking-wider mt-1">
            {ticket?.ticketCode || booking?.bookingCode}
          </p>
        </div>

        {/* Dynamic QR Code */}
        <div className="w-36 h-36 bg-white border border-[#bec7d4] rounded-2xl p-2 flex items-center justify-center relative overflow-hidden">
          <QRCodeSVG
            value={ticket?.ticketCode || booking?.bookingCode || ""}
            size={128}
            level="H"
            includeMargin={true}
            bgColor="#ffffff"
            fgColor="#191c1e"
            title="Mã QR soát vé"
          />
        </div>

        <p className="text-[10px] text-center text-[#6f7883] font-bold leading-relaxed">
          Xuất trình vé khi
          <br />
          nhân viên soát vé
        </p>
      </div>
    </div>
  );
}

/* ─── Main Staff Ticket Print Panel ───────────────────────── */
export function StaffTicketPrintPanel({ initialQuery = "" }) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null); // { type, ticket?, tickets? }
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const printRef = useRef(null);
  const inputRef = useRef(null);
  const autoSearchRef = useRef("");

  const handleSearch = async (e) => {
    e?.preventDefault();
    const q = query.trim();
    if (!q) return;

    setLoading(true);
    setResult(null);
    setSelectedTicket(null);
    setSelectedBooking(null);

    try {
      const { data } = await staffSearchApi.globalSearch(q);
      const tickets = ticketsFromStaffSearch(data);
      const nextResult = {
        ...data,
        type: tickets.length === 1 ? "single" : "list",
        ticket: tickets[0] || null,
        tickets,
      };
      setResult(nextResult);

      if (tickets.length > 0) {
        setSelectedTicket(tickets[0]);
        setSelectedBooking(tickets[0]?.booking);
        toast.success("Tim thay thong tin ve.");
      } else {
        toast.info("Khong tim thay ve phu hop.");
      }
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        "Khong tim thay ve. Kiem tra lai ma ve hoac thong tin lien he.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialQuery) return;
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!initialQuery || query !== initialQuery) return;
    if (autoSearchRef.current === initialQuery) return;
    autoSearchRef.current = initialQuery;
    handleSearch();
    // Run once per completed booking code; handleSearch reads the query state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, query]);

  const handlePrint = () => {
    if (!selectedTicket) {
      toast.error("Vui lòng chọn vé trước khi in.");
      return;
    }
    window.print();
  };

  const handleClear = () => {
    setQuery("");
    setResult(null);
    setSelectedTicket(null);
    setSelectedBooking(null);
    inputRef.current?.focus();
  };

  return (
    <>
      {/* Print styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body * { visibility: hidden; }
          #staff-printable-pass, #staff-printable-pass * { visibility: visible; }
          #staff-printable-pass {
            position: fixed;
            top: 0; left: 0;
            width: 100%;
            padding: 32px;
            background: white !important;
          }
        }
      `,
        }}
      />

      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-2xl font-bold text-[#191c1e]">
              In Vé & Soát Vé
            </h2>
            <p className="text-sm text-[#3f4852] mt-1">
              Tra cứu mã vé hoặc thông tin khách hàng để in vé lên tàu
            </p>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[#cfe5ff]/30 rounded-xl border border-[#cfe5ff]">
            <span className="material-symbols-outlined text-[#00629d] text-sm">
              badge
            </span>
            <span className="text-[#00629d] font-bold text-sm">
              Nhân Viên Ga
            </span>
          </div>
        </div>

        {/* Search Form */}
        <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5">
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7883]">
                search
              </span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nhập mã vé (GT2026...), email hoặc số điện thoại..."
                className="w-full pl-10 pr-4 py-3 bg-[#f7f9fb] border border-[#bec7d4]/40 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#00629d]/30 focus:border-[#00629d] transition-all"
                autoFocus
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-[#00629d] hover:bg-[#00629d]/90 text-white rounded-xl font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="material-symbols-outlined text-[20px]">
                  search
                </span>
              )}
              Tra cứu
            </button>
            {result && (
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-3 border border-[#bec7d4] hover:bg-[#f7f9fb] text-[#6f7883] rounded-xl font-semibold text-sm transition-all"
              >
                <span className="material-symbols-outlined text-[20px]">
                  close
                </span>
              </button>
            )}
          </form>

          {/* Quick tip */}
          <p className="text-xs text-[#6f7883] mt-3 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            Hỗ trợ tra cứu bằng: <strong>Mã vé</strong>, <strong>Email</strong>,
            hoặc <strong>Số điện thoại</strong>
          </p>
        </div>

        {/* Ticket list if multiple */}
        {result?.type === "list" && result.tickets?.length > 1 && (
          <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5">
            <p className="text-sm font-bold text-[#191c1e] mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00629d]">
                list
              </span>
              Tìm thấy {result.tickets.length} vé — chọn vé cần in:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {result.tickets.map((t) => {
                const dep = t.booking?.schedule;
                const tripStations = getBookedTripStations(t.booking);
                const isSelected = selectedTicket?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setSelectedBooking(t.booking);
                    }}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-[#00629d] bg-[#cfe5ff]/20 ring-2 ring-[#00629d]/20"
                        : "border-[#bec7d4]/40 hover:border-[#00629d]/40 hover:bg-[#f7f9fb]"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <p className="font-mono font-extrabold text-[#00629d] text-sm">
                        {t.ticketCode || t.booking?.bookingCode}
                      </p>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border ${STATUS_BADGE[t.booking?.status] || ""}`}
                      >
                        {STATUS_LABEL[t.booking?.status] || "—"}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-[#191c1e]">
                      {t.fullName}
                    </p>
                    <p className="text-xs text-[#6f7883] mt-1">
                      {stationName(tripStations.from)} →{" "}
                      {stationName(tripStations.to)}
                    </p>
                    <p className="text-xs text-[#6f7883]">
                      {formatDate(dep?.departureTime)}{" "}
                      {formatTime(dep?.departureTime)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Boarding Pass Preview */}
        {selectedTicket && selectedBooking && (
          <div className="space-y-4">
            {/* Action buttons */}
            <div className="flex flex-wrap gap-3 items-center justify-between">
              <h3 className="font-bold text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00629d]">
                  confirmation_number
                </span>
                Boarding Pass — {selectedTicket.fullName}
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-2 bg-[#191c1e] hover:bg-[#191c1e]/90 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-md"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    print
                  </span>
                  In Vé
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      selectedTicket.ticketCode || selectedBooking.bookingCode,
                    );
                    toast.success("Đã sao chép mã vé!");
                  }}
                  className="flex items-center gap-2 border border-[#bec7d4] hover:bg-[#f7f9fb] text-[#3f4852] px-4 py-2.5 rounded-xl font-semibold text-sm transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    content_copy
                  </span>
                  Sao chép mã
                </button>
              </div>
            </div>

            {/* Printable pass */}
            <div id="staff-printable-pass" ref={printRef}>
              <BoardingPass ticket={selectedTicket} booking={selectedBooking} />
            </div>

            {/* Booking details for staff */}
            <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-extrabold text-[#6f7883] uppercase tracking-wider mb-1">
                  Khách Hàng
                </p>
                <p className="font-bold text-[#191c1e]">
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
                <p className="text-xs font-extrabold text-[#6f7883] uppercase tracking-wider mb-1">
                  Thanh Toán
                </p>
                <p className="text-xl font-extrabold text-[#00629d]">
                  {formatCurrency(selectedBooking.totalAmount)}
                </p>
                <p className="text-sm text-[#6f7883]">
                  {selectedBooking.paymentMethod || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-extrabold text-[#6f7883] uppercase tracking-wider mb-1">
                  Ngày Đặt
                </p>
                <p className="font-semibold text-[#191c1e]">
                  {formatDate(selectedBooking.createdAt)}
                </p>
                <p className="text-sm text-[#6f7883]">
                  {formatTime(selectedBooking.createdAt)}
                </p>
                <p className="text-xs font-bold text-[#6f7883] mt-1">
                  Mã booking:{" "}
                  <span className="font-mono text-[#00629d]">
                    {selectedBooking.bookingCode}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !result && (
          <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-[#f7f9fb] rounded-2xl flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl text-[#bec7d4]">
                confirmation_number
              </span>
            </div>
            <div>
              <p className="font-bold text-[#191c1e]">Sẵn sàng tra cứu vé</p>
              <p className="text-sm text-[#6f7883] mt-1">
                Nhập mã vé hoặc thông tin khách hàng để bắt đầu
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
