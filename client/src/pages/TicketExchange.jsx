import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Calendar,
  CheckCircle2,
  Info,
  Landmark,
  LoaderCircle,
  MapPin,
  Search,
  Ticket,
  Train,
} from "lucide-react";
import { api } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

function formatCurrency(amount, language = "vi") {
  return language === "vi"
    ? new Intl.NumberFormat("vi-VN").format(Math.round(amount || 0)) + "đ"
    : new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "VND",
      }).format(Math.round(amount || 0));
}

function toInputDate(date = new Date()) {
  const utc7 = new Date(new Date(date).getTime() + 7 * 60 * 60 * 1000);
  const month = String(utc7.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc7.getUTCDate()).padStart(2, "0");
  return `${utc7.getUTCFullYear()}-${month}-${day}`;
}

function formatDate(dateStr, language = "vi") {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(
    language === "vi" ? "vi-VN" : "en-US",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    },
  );
}

function formatTime(dateStr, language = "vi") {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleTimeString(
    language === "vi" ? "vi-VN" : "en-US",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    },
  );
}

function stationName(station, fallback = "Chưa xác định") {
  return station?.city || station?.stationName || station?.name || fallback;
}

function stationId(station) {
  return station?.id || station?.stationId;
}

function minFare(schedule) {
  const prices = (schedule?.pricing || []).map((item) => item.price);
  return prices.length > 0 ? Math.min(...prices) : 0;
}

function minutesToDuration(minutes, language = "vi") {
  if (!Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (language === "vi") {
    if (h > 0 && m > 0) return `${h} giờ ${m} phút`;
    if (h > 0) return `${h} giờ`;
    return `${m} phút`;
  } else {
    if (h > 0 && m > 0) return `${h}h ${m}m`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }
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

export function TicketExchange() {
  const { language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const bookingCode = searchParams.get("bookingCode") || "";
  const isStaffMode = Boolean(location.state?.staffMode);

  const [ticket, setTicket] = useState(location.state?.ticket || null);
  const [stations, setStations] = useState([]);
  const [toStationId, setToStationId] = useState("");
  const [departureDate, setDepartureDate] = useState(toInputDate());
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [initialLoading, setInitialLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  const booking = ticket?.booking;
  const currentSchedule = booking?.schedule;
  const tripStations = useMemo(() => getBookedTripStations(booking), [booking]);
  const fromStationId = stationId(tripStations.from);
  const selectedSchedule = schedules.find(
    (item) => item.id === selectedScheduleId,
  );

  const exchangeMode = location.state?.exchangeMode || "single";

  const activePassengerCount = useMemo(() => {
    if (exchangeMode === "single") return 1;
    if (!booking?.passengers?.length) return booking?.totalPassengers || 1;
    
    const seatedPassengers = booking.passengers.filter(
      (p) =>
        Boolean(p.seat || p.seatId) &&
        p.seatRequired !== false &&
        p.passengerType !== "CHILD_UNDER_6",
    );

    const hasDetails = booking.passengers[0]?.bookingDetails !== undefined;
    if (hasDetails) {
      const count = seatedPassengers.filter((p) =>
        (p.bookingDetails || []).some((d) => d.status !== "CANCELLED"),
      ).length;
      return count || 1;
    }
    return seatedPassengers.length || booking.totalPassengers || 1;
  }, [booking, exchangeMode]);

  const paidAmount =
    exchangeMode === "single" && booking?.totalPassengers > 1
      ? Math.round((booking?.totalAmount || 0) / booking.totalPassengers)
      : booking?.totalAmount || 0;

  const newFare = selectedSchedule ? minFare(selectedSchedule) : 0;
  const fixedFee = selectedSchedule ? 20000 * activePassengerCount : 0;
  const percentFee = selectedSchedule ? Math.round(paidAmount * 0.1) : 0;
  const fareDifference = selectedSchedule ? newFare - paidAmount : 0;
  const totalFees = fixedFee + percentFee;
  const netAmount = selectedSchedule ? totalFees + fareDifference : 0;
  const amountDue = Math.max(netAmount, 0);
  const refundSurplus = Math.max(-netAmount, 0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadInitialData() {
      setInitialLoading(true);
      try {
        const requests = [api.get("/stations", { signal: controller.signal })];

        if (!ticket && bookingCode) {
          requests.push(
            api.get("/bookings/lookup", {
              params: { ticketCode: bookingCode },
              signal: controller.signal,
            }),
          );
        }

        const [stationRes, ticketRes] = await Promise.all(requests);
        setStations(stationRes.data.stations || []);

        if (ticketRes?.data) {
          const nextTicket =
            ticketRes.data.ticket || ticketRes.data.tickets?.[0] || null;
          setTicket(nextTicket);
        }
      } catch (error) {
        if (error.code !== "ERR_CANCELED") {
          toast.error(
            error.response?.data?.message ||
              (language === "vi"
                ? "Không thể tải thông tin đổi vé. Vui lòng thử lại."
                : "Failed to load ticket exchange details. Please try again."),
          );
        }
      } finally {
        if (!controller.signal.aborted) setInitialLoading(false);
      }
    }

    loadInitialData();
    return () => controller.abort();
  }, [bookingCode, ticket, language]);

  useEffect(() => {
    const currentToId = stationId(tripStations.to);
    if (currentToId && !toStationId) setToStationId(currentToId);
  }, [toStationId, tripStations.to]);

  useEffect(() => {
    const departure = currentSchedule?.departureTime
      ? toInputDate(currentSchedule.departureTime)
      : toInputDate();
    const today = toInputDate();
    setDepartureDate(departure >= today ? departure : today);
  }, [currentSchedule?.departureTime]);

  const handleSearchSchedules = async () => {
    if (!fromStationId || !toStationId || !departureDate) {
      toast.error(
        language === "vi"
          ? "Vui lòng chọn đầy đủ ga đi, ga đến và ngày đi mới."
          : "Please select all origin, destination, and departure date.",
      );
      return;
    }

    if (fromStationId === toStationId) {
      toast.error(
        language === "vi"
          ? "Ga đến mới không được trùng với ga đi hiện tại."
          : "New destination cannot be the same as the origin.",
      );
      return;
    }

    setSearchLoading(true);
    setSelectedScheduleId("");
    try {
      const { data } = await api.get("/schedules/search", {
        params: {
          fromStationId,
          toStationId,
          departureDate,
        },
      });
      const outbound = data.outbound || [];
      setSchedules(outbound);
      if (outbound.length > 0) {
        setSelectedScheduleId(outbound[0].id);
        toast.success(
          language === "vi"
            ? `Tìm thấy ${outbound.length} chuyến tàu phù hợp.`
            : `Found ${outbound.length} matching trains.`,
        );
      } else {
        toast.info(
          language === "vi"
            ? "Không có chuyến phù hợp cho ngày đã chọn."
            : "No matching trains found for the selected date.",
        );
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          (language === "vi"
            ? "Không thể tải danh sách chuyến tàu."
            : "Failed to load train schedules."),
      );
      setSchedules([]);
    } finally {
      setSearchLoading(false);
    }
  };

  useEffect(() => {
    if (
      hasAutoSearched ||
      initialLoading ||
      !fromStationId ||
      !toStationId ||
      !departureDate
    ) {
      return;
    }

    setHasAutoSearched(true);
    handleSearchSchedules();
  }, [
    departureDate,
    fromStationId,
    hasAutoSearched,
    initialLoading,
    toStationId,
  ]);

  const handleConfirmExchange = () => {
    if (!selectedSchedule) {
      toast.error(
        language === "vi"
          ? "Vui lòng chọn chuyến tàu mới trước khi xác nhận."
          : "Please select a new train schedule before confirming.",
      );
      return;
    }

    const exchangePIds = exchangeMode === "single" 
      ? [ticket.id] 
      : booking.passengers
          .filter(p => p.bookingDetails?.every(d => d.status !== "CANCELLED") ?? true)
          .map(p => p.id);

    const params = new URLSearchParams({
      outboundScheduleId: selectedSchedule.id,
      outboundFromStationId: fromStationId,
      outboundToStationId: toStationId,
      mode: isStaffMode ? "staff-exchange" : "exchange",
      exchangeBookingId: booking.id,
      exchangeBookingCode: booking.bookingCode || ticket.ticketCode || "",
      exchangePassengerCount: String(activePassengerCount),
      exchangePaidAmount: String(paidAmount),
      exchangePassengerIds: exchangePIds.join(","),
    });

    navigate(`/booking/seats?${params.toString()}`);
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-slate-500">
          {language === "vi"
            ? "Đang tải thông tin đổi vé..."
            : "Loading ticket exchange details..."}
        </p>
      </div>
    );
  }

  if (!ticket || !booking) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm text-left">
        <Ticket className="mx-auto h-12 w-12 text-slate-300" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900 text-center">
          {language === "vi" ? "Chưa có thông tin vé" : "No Ticket Information"}
        </h1>
        <p className="mt-2 text-sm text-slate-500 text-center">
          {language === "vi"
            ? "Vui lòng quay lại trang tra cứu vé và chọn vé cần đổi."
            : "Please go back to the ticket lookup page and select the ticket you want to exchange."}
        </p>
        <button
          onClick={() => navigate("/tra-cuu-ve")}
          className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white border-none cursor-pointer w-full"
        >
          {language === "vi" ? "Quay lại tra cứu vé" : "Back to Ticket Lookup"}
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12 text-left">
      {isStaffMode && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#00629d]/30 bg-[#cfe5ff]/40 px-5 py-3">
          <span className="material-symbols-outlined text-[#00629d]">
            badge
          </span>
          <p className="text-sm font-bold text-[#00629d] mb-0">
            {language === "vi"
              ? "Nhân viên đang đổi vé thay cho khách — mọi thay đổi áp dụng trực tiếp trên booking của khách."
              : "Staff is exchanging tickets for the passenger — all changes apply directly to their booking."}
          </p>
        </div>
      )}
      <section className="mb-10 text-left">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">
          {language === "vi" ? "Đổi Vé Trực Tuyến" : "Online Ticket Exchange"}
        </h1>
        <p className="mt-3 text-base text-slate-600">
          {language === "vi"
            ? "Chọn ga đến, ngày đi mới và chuyến tàu phù hợp với hành trình của bạn."
            : "Select destination, new departure date, and a suitable train schedule for your trip."}
        </p>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_0.95fr] text-left">
        <div className="space-y-8">
          <section className="text-left">
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-extrabold text-slate-900 border-none bg-transparent">
              <Ticket className="h-6 w-6 text-primary" />
              {language === "vi"
                ? "Thông tin vé hiện tại"
                : "Current Ticket Details"}
            </h2>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-50" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-50" />

              <div className="flex flex-col justify-between gap-4 sm:flex-row text-left">
                <div>
                  <span className="inline-flex rounded-full bg-sky-500 px-4 py-1.5 text-sm font-bold text-white">
                    {currentSchedule?.train?.trainName ||
                      (language === "vi" ? "Chuyến tàu" : "Train")}
                  </span>
                  <h3 className="mt-4 text-2xl font-extrabold text-slate-950 text-left mb-0">
                    {stationName(tripStations.from)} →{" "}
                    {stationName(tripStations.to)}
                  </h3>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-slate-400 mb-1">
                    {language === "vi" ? "Mã đặt chỗ" : "Booking Code"}
                  </p>
                  <p className="text-2xl font-black tracking-wide text-primary mb-0">
                    {booking.bookingCode || ticket.ticketCode}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-5 border-b border-dashed border-slate-300 pb-6 md:grid-cols-4 text-left">
                <div>
                  <p className="text-sm font-semibold text-slate-400 mb-1">
                    {language === "vi" ? "Ngày đi" : "Departure Date"}
                  </p>
                  <p className="font-bold text-slate-900 mb-0">
                    {formatDate(currentSchedule?.departureTime, language)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-400 mb-1">
                    {language === "vi" ? "Giờ khởi hành" : "Departure Time"}
                  </p>
                  <p className="font-bold text-slate-900 mb-0">
                    {formatTime(currentSchedule?.departureTime, language)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-400 mb-1">
                    {language === "vi" ? "Toa / Ghế" : "Carriage / Seat"}
                  </p>
                  <p className="font-bold text-slate-900 mb-0">
                    {language === "vi"
                      ? `Toa ${ticket.carriageNumber || "—"} / Ghế ${ticket.seat?.seatNumber || "—"}`
                      : `Carriage ${ticket.carriageNumber || "—"} / Seat ${ticket.seat?.seatNumber || "—"}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-400 mb-1">
                    {language === "vi" ? "Loại vé" : "Ticket Type"}
                  </p>
                  <p className="font-bold text-slate-900 mb-0">
                    {ticket.seat?.carriage?.carriageType ||
                      (language === "vi" ? "Tiêu chuẩn" : "Standard")}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-base text-slate-700">
                  {language === "vi"
                    ? "Giá vé đã thanh toán"
                    : "Paid Ticket Fare"}
                </span>
                <span className="text-2xl font-black text-slate-950">
                  {formatCurrency(paidAmount, language)}
                </span>
              </div>
            </div>
          </section>

          <section className="text-left">
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-extrabold text-slate-900">
              <Search className="h-6 w-6 text-primary" />
              {language === "vi" ? "Tìm hành trình mới" : "Search New Route"}
            </h2>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-left">
              <div className="grid gap-5 md:grid-cols-2 text-left">
                <label className="space-y-2 text-left block">
                  <span className="text-sm font-semibold text-slate-700">
                    {language === "vi" ? "Ga đến mới" : "New Destination"}
                  </span>
                  <span className="relative flex h-14 items-center rounded-xl border border-slate-300 bg-white px-4">
                    <MapPin className="mr-3 h-5 w-5 shrink-0 text-primary" />
                    <select
                      value={toStationId}
                      onChange={(event) => {
                        setToStationId(event.target.value);
                        setSchedules([]);
                        setSelectedScheduleId("");
                      }}
                      className="h-full w-full appearance-none bg-transparent text-base font-semibold text-slate-800 outline-none cursor-pointer"
                    >
                      <option value="">
                        {language === "vi"
                          ? "Chọn ga đến"
                          : "Select Destination"}
                      </option>
                      {stations
                        .filter((station) => station.id !== fromStationId)
                        .map((station) => (
                          <option key={station.id} value={station.id}>
                            {station.stationName} ({station.city})
                          </option>
                        ))}
                    </select>
                  </span>
                </label>
                <label className="space-y-2 text-left block">
                  <span className="text-sm font-semibold text-slate-700">
                    {language === "vi" ? "Ngày đi mới" : "New Departure Date"}
                  </span>
                  <span className="flex h-14 items-center gap-4 rounded-xl border border-slate-300 px-4">
                    <Calendar className="h-5 w-5 text-primary" />
                    <input
                      type="date"
                      min={toInputDate()}
                      value={departureDate}
                      onChange={(event) => {
                        setDepartureDate(event.target.value);
                        setSchedules([]);
                        setSelectedScheduleId("");
                      }}
                      className="h-full flex-1 bg-transparent text-base font-semibold text-slate-800 outline-none cursor-pointer"
                    />
                  </span>
                </label>
              </div>

              <button
                onClick={handleSearchSchedules}
                disabled={searchLoading}
                className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-sky-500 to-primary text-base font-extrabold text-white shadow-lg shadow-primary/20 disabled:opacity-60 border-none cursor-pointer"
              >
                {searchLoading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin text-white" />
                ) : (
                  <Search className="h-5 w-5 text-white" />
                )}
                {language === "vi"
                  ? "Kiểm tra chỗ trống"
                  : "Check Availability"}
              </button>
            </div>
          </section>

          <section className="text-left">
            <div className="mb-4 flex items-center justify-between text-left">
              <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900 mb-0">
                <Train className="h-6 w-6 text-primary" />
                {language === "vi"
                  ? "Các chuyến tàu khả dụng"
                  : "Available Trains"}
              </h2>
              <span className="text-sm font-semibold text-primary">
                {departureDate ? formatDate(departureDate, language) : ""}
              </span>
            </div>

            {schedules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
                {language === "vi"
                  ? "Chọn ga đến, ngày đi mới rồi nhấn “Kiểm tra chỗ trống”."
                  : 'Choose destination and departure date, then click "Check Availability".'}
              </div>
            ) : (
              <div className="space-y-4 text-left">
                {schedules.map((schedule) => {
                  const selected = selectedScheduleId === schedule.id;
                  const fare = minFare(schedule);

                  return (
                    <button
                      key={schedule.id}
                      onClick={() => setSelectedScheduleId(schedule.id)}
                      className={`relative flex w-full items-center gap-5 rounded-xl border bg-white p-5 text-left transition cursor-pointer ${
                        selected
                          ? "border-primary ring-1 ring-primary"
                          : "border-slate-200 hover:border-primary/50"
                      }`}
                    >
                      {selected && (
                        <span className="absolute right-0 top-0 rounded-bl-lg rounded-tr-xl bg-primary px-4 py-1 text-xs font-black text-white uppercase tracking-wider">
                          {language === "vi" ? "ĐANG CHỌN" : "SELECTED"}
                        </span>
                      )}
                      <span className="flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-center">
                        <strong className="text-2xl leading-none text-slate-950">
                          {schedule.trainCode || schedule.trainName}
                        </strong>
                        <small className="mt-1 text-[11px] font-bold text-slate-700">
                          {schedule.trainType}
                        </small>
                      </span>

                      <span className="font-bold text-slate-950 text-left">
                        {formatTime(schedule.departureTime, language)}
                        <small className="block text-sm font-medium text-slate-500 text-left">
                          {schedule.fromStation?.name}
                        </small>
                      </span>

                      <span className="hidden flex-1 items-center gap-3 md:flex">
                        <span className="h-2 w-2 rounded-full border border-primary" />
                        <span className="flex-1 border-t border-slate-300" />
                        <span className="text-xs font-semibold text-slate-400">
                          {minutesToDuration(schedule.duration, language)}
                        </span>
                        <span className="flex-1 border-t border-slate-300" />
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      </span>

                      <span className="font-bold text-slate-950 text-left">
                        {formatTime(schedule.arrivalTime, language)}
                        <small className="block text-sm font-medium text-slate-500 text-left">
                          {schedule.toStation?.name}
                        </small>
                      </span>

                      <span className="ml-auto text-right">
                        <small className="block text-sm font-semibold text-slate-500 text-right">
                          {language === "vi" ? "Giá vé từ" : "Fare from"}
                        </small>
                        <strong className="text-2xl font-black text-primary block text-right">
                          {formatCurrency(fare, language)}
                        </strong>
                        <small className="block text-xs font-semibold text-slate-400 text-right">
                          {schedule.availability?.reduce(
                            (sum, item) => sum + item.availableSeats,
                            0,
                          ) || 0}{" "}
                          {language === "vi" ? "ghế trống" : "seats left"}
                        </small>
                      </span>

                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          selected
                            ? "border-primary text-primary"
                            : "border-slate-300"
                        }`}
                      >
                        {selected && (
                          <CheckCircle2 className="h-5 w-5 text-primary" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6 text-left">
          <section className="text-left">
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-extrabold text-slate-900 border-none bg-transparent">
              <Landmark className="h-6 w-6 text-primary" />
              {language === "vi" ? "Chi tiết thay đổi" : "Fare Breakdown"}
            </h2>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm text-left">
              <div className="space-y-6 p-6 text-lg text-left">
                <div className="flex justify-between">
                  <span className="text-slate-700">
                    {language === "vi"
                      ? "Giá vé mới (ước tính)"
                      : "New Ticket Fare (est)"}
                  </span>
                  <strong>
                    {selectedSchedule ? formatCurrency(newFare, language) : "—"}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">
                    {language === "vi"
                      ? "Giá vé đã thanh toán"
                      : "Paid Ticket Fare"}
                  </span>
                  <strong>{formatCurrency(paidAmount, language)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">
                    {language === "vi"
                      ? "Chênh lệch giá vé"
                      : "Fare Difference"}
                  </span>
                  <strong
                    className={
                      fareDifference < 0
                        ? "text-emerald-600 font-bold"
                        : "font-bold"
                    }
                  >
                    {selectedSchedule
                      ? fareDifference < 0
                        ? `−${formatCurrency(-fareDifference, language)}`
                        : fareDifference > 0
                          ? `+${formatCurrency(fareDifference, language)}`
                          : formatCurrency(0, language)
                      : "—"}
                  </strong>
                </div>
                <div className="border-t border-dashed border-slate-300" />
                <div className="flex justify-between">
                  <span className="text-slate-700">
                    {language === "vi"
                      ? "Phí đổi vé (cố định)"
                      : "Exchange Fee (fixed)"}
                  </span>
                  <strong>{formatCurrency(fixedFee, language)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">
                    {language === "vi"
                      ? "Phí đổi vé (10%)"
                      : "Exchange Fee (10%)"}
                  </span>
                  <strong>{formatCurrency(percentFee, language)}</strong>
                </div>

                {refundSurplus > 0 ? (
                  <div className="rounded-xl bg-emerald-50 p-6 text-emerald-700 text-left">
                    <span className="text-lg font-extrabold block text-left">
                      {language === "vi" ? "Số tiền hoàn lại" : "Refund Amount"}
                    </span>
                    <strong className="text-5xl font-black mt-2 block text-left">
                      {formatCurrency(refundSurplus, language)}
                    </strong>
                    <p className="mt-3 text-xs font-semibold mb-0 text-left">
                      {language === "vi"
                        ? "* Hoàn vào ví GoTrainVN sau khi xác nhận đổi vé"
                        : "* Refunded to GoTrainVN wallet upon exchange confirmation"}
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-sky-100 p-6 text-primary text-left">
                    <span className="text-lg font-extrabold block text-left">
                      {language === "vi" ? "Tổng thanh toán" : "Total Payment"}
                    </span>
                    <strong className="text-5xl font-black mt-2 block text-left">
                      {formatCurrency(amountDue, language)}
                    </strong>
                    <p className="mt-3 text-xs font-semibold mb-0 text-left">
                      {language === "vi"
                        ? "* Thanh toán qua ví GoTrainVN"
                        : "* Charged via GoTrainVN wallet"}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 bg-slate-100 p-6 text-left">
                <button
                  onClick={handleConfirmExchange}
                  disabled={!selectedSchedule}
                  className="h-16 w-full rounded-xl bg-primary text-xl font-extrabold text-white shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none border-none cursor-pointer"
                >
                  {language === "vi" ? "Chọn ghế mới" : "Select New Seat"}
                </button>
                <button
                  onClick={() => navigate("/tra-cuu-ve")}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white font-bold text-slate-700 cursor-pointer"
                >
                  {language === "vi" ? "Hủy bỏ" : "Cancel"}
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-100/70 p-6 text-left">
            <h3 className="mb-3 flex items-center gap-3 text-base font-extrabold text-slate-700 border-none bg-transparent">
              <Info className="h-5 w-5 text-slate-600" />
              {language === "vi"
                ? "Chính sách đổi vé"
                : "Ticket Exchange Policy"}
            </h3>
            <ul className="list-disc space-y-1 pl-5 text-sm leading-6 text-slate-700 mb-0">
              {language === "vi" ? (
                <>
                  <li>Vé cá nhân: Phí đổi vé 20,000đ + 10% giá vé gốc.</li>
                  <li>Chỉ đổi vé cho chuyến chưa khởi hành.</li>
                  <li>
                    Giá vé hiển thị là mức tối thiểu; giá thực tế theo ghế chọn.
                  </li>
                  <li>
                    Nếu vé mới rẻ hơn, chênh lệch sẽ được hoàn vào ví GoTrainVN
                    sau khi trừ phí.
                  </li>
                </>
              ) : (
                <>
                  <li>
                    Individual Ticket: Exchange fee is 20,000 VND + 10% of the
                    original ticket fare.
                  </li>
                  <li>
                    Exchanges are only allowed for trains that have not departed
                    yet.
                  </li>
                  <li>
                    Fares shown are minimums; actual prices vary based on
                    selected seats.
                  </li>
                  <li>
                    If the new ticket is cheaper, the difference is refunded to
                    your GoTrainVN wallet after fee deduction.
                  </li>
                </>
              )}
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
