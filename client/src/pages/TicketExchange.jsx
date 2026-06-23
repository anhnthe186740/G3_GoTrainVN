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

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount || 0)) + "đ";
}

function toInputDate(date = new Date()) {
  // Dùng UTC+7 cố định để khớp với múi giờ Việt Nam dù browser ở đâu
  const utc7 = new Date(new Date(date).getTime() + 7 * 60 * 60 * 1000);
  const month = String(utc7.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc7.getUTCDate()).padStart(2, "0");
  return `${utc7.getUTCFullYear()}-${month}-${day}`;
}

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

function minutesToDuration(minutes) {
  if (!Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
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

  // Tính số hành khách active (loại trừ vé đã bị partial-cancel)
  const activePassengerCount = useMemo(() => {
    if (!booking?.passengers?.length) return booking?.totalPassengers || 1;
    const hasDetails = booking.passengers[0]?.bookingDetails !== undefined;
    if (hasDetails) {
      const count = booking.passengers.filter((p) =>
        (p.bookingDetails || []).some((d) => d.status !== "CANCELLED"),
      ).length;
      return count || 1;
    }
    return booking.passengers.length || booking.totalPassengers || 1;
  }, [booking]);

  const paidAmount = booking?.totalAmount || 0;
  const newFare = selectedSchedule ? minFare(selectedSchedule) : 0;
  const fixedFee = selectedSchedule ? 20000 * activePassengerCount : 0;
  const percentFee = selectedSchedule ? Math.round(paidAmount * 0.1) : 0;
  const fareDifference = selectedSchedule ? newFare - paidAmount : 0; // signed
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
              "Không thể tải thông tin đổi vé. Vui lòng thử lại.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setInitialLoading(false);
      }
    }

    loadInitialData();
    return () => controller.abort();
  }, [bookingCode, ticket]);

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
      toast.error("Vui lòng chọn đầy đủ ga đi, ga đến và ngày đi mới.");
      return;
    }

    if (fromStationId === toStationId) {
      toast.error("Ga đến mới không được trùng với ga đi hiện tại.");
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
        toast.success(`Tìm thấy ${outbound.length} chuyến tàu phù hợp.`);
      } else {
        toast.info("Không có chuyến phù hợp cho ngày đã chọn.");
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Không thể tải danh sách chuyến tàu.",
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    departureDate,
    fromStationId,
    hasAutoSearched,
    initialLoading,
    toStationId,
  ]);

  const handleConfirmExchange = () => {
    if (!selectedSchedule) {
      toast.error("Vui lòng chọn chuyến tàu mới trước khi xác nhận.");
      return;
    }

    const params = new URLSearchParams({
      outboundScheduleId: selectedSchedule.id,
      outboundFromStationId: fromStationId,
      outboundToStationId: toStationId,
      mode: isStaffMode ? "staff-exchange" : "exchange",
      exchangeBookingId: booking.id,
      exchangeBookingCode: booking.bookingCode || ticket.ticketCode || "",
      exchangePassengerCount: String(activePassengerCount),
      exchangePaidAmount: String(paidAmount),
    });

    navigate(`/booking/seats?${params.toString()}`);
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-slate-500">
          Đang tải thông tin đổi vé...
        </p>
      </div>
    );
  }

  if (!ticket || !booking) {
    return (
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <Ticket className="mx-auto h-12 w-12 text-slate-300" />
        <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
          Chưa có thông tin vé
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Vui lòng quay lại trang tra cứu vé và chọn vé cần đổi.
        </p>
        <button
          onClick={() => navigate("/tra-cuu-ve")}
          className="mt-6 rounded-2xl bg-primary px-5 py-3 text-sm font-bold text-white"
        >
          Quay lại tra cứu vé
        </button>
      </div>
    );
  }

  return (
    <div className="pb-12">
      {isStaffMode && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#00629d]/30 bg-[#cfe5ff]/40 px-5 py-3">
          <span className="material-symbols-outlined text-[#00629d]">
            badge
          </span>
          <p className="text-sm font-bold text-[#00629d]">
            Nhân viên đang đổi vé thay cho khách — mọi thay đổi áp dụng trực
            tiếp trên booking của khách.
          </p>
        </div>
      )}
      <section className="mb-10">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary">
          Đổi Vé Trực Tuyến
        </h1>
        <p className="mt-3 text-base text-slate-600">
          Chọn ga đến, ngày đi mới và chuyến tàu phù hợp với hành trình của bạn.
        </p>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.35fr_0.95fr]">
        <div className="space-y-8">
          <section>
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-extrabold text-slate-900">
              <Ticket className="h-6 w-6 text-primary" />
              Thông tin vé hiện tại
            </h2>

            <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-50" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-50" />

              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <span className="inline-flex rounded-full bg-sky-500 px-4 py-1.5 text-sm font-bold text-white">
                    {currentSchedule?.train?.trainName || "Chuyến tàu"}
                  </span>
                  <h3 className="mt-4 text-2xl font-extrabold text-slate-950">
                    {stationName(tripStations.from)} →{" "}
                    {stationName(tripStations.to)}
                  </h3>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-sm font-semibold text-slate-400">
                    Mã đặt chỗ
                  </p>
                  <p className="text-2xl font-black tracking-wide text-primary">
                    {booking.bookingCode || ticket.ticketCode}
                  </p>
                </div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-5 border-b border-dashed border-slate-300 pb-6 md:grid-cols-4">
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    Ngày đi
                  </p>
                  <p className="font-bold text-slate-900">
                    {formatDate(currentSchedule?.departureTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    Giờ khởi hành
                  </p>
                  <p className="font-bold text-slate-900">
                    {formatTime(currentSchedule?.departureTime)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    Toa / Ghế
                  </p>
                  <p className="font-bold text-slate-900">
                    Toa {ticket.carriageNumber || "—"} / Ghế{" "}
                    {ticket.seat?.seatNumber || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-400">
                    Loại vé
                  </p>
                  <p className="font-bold text-slate-900">
                    {ticket.seat?.carriage?.carriageType || "Tiêu chuẩn"}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <span className="text-base text-slate-700">
                  Giá vé đã thanh toán
                </span>
                <span className="text-2xl font-black text-slate-950">
                  {formatCurrency(paidAmount)}
                </span>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-extrabold text-slate-900">
              <Search className="h-6 w-6 text-primary" />
              Tìm hành trình mới
            </h2>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Ga đến mới
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
                      className="h-full w-full appearance-none bg-transparent text-base font-semibold text-slate-800 outline-none"
                    >
                      <option value="">Chọn ga đến</option>
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
                <label className="space-y-2">
                  <span className="text-sm font-semibold text-slate-700">
                    Ngày đi mới
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
                      className="h-full flex-1 bg-transparent text-base font-semibold text-slate-800 outline-none"
                    />
                  </span>
                </label>
              </div>

              <button
                onClick={handleSearchSchedules}
                disabled={searchLoading}
                className="mt-6 flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-sky-500 to-primary text-base font-extrabold text-white shadow-lg shadow-primary/20 disabled:opacity-60"
              >
                {searchLoading ? (
                  <LoaderCircle className="h-5 w-5 animate-spin" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                Kiểm tra chỗ trống
              </button>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-3 text-2xl font-extrabold text-slate-900">
                <Train className="h-6 w-6 text-primary" />
                Các chuyến tàu khả dụng
              </h2>
              <span className="text-sm font-semibold text-primary">
                {departureDate ? formatDate(departureDate) : ""}
              </span>
            </div>

            {schedules.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm font-semibold text-slate-500">
                Chọn ga đến, ngày đi mới rồi nhấn “Kiểm tra chỗ trống”.
              </div>
            ) : (
              <div className="space-y-4">
                {schedules.map((schedule) => {
                  const selected = selectedScheduleId === schedule.id;
                  const fare = minFare(schedule);

                  return (
                    <button
                      key={schedule.id}
                      onClick={() => setSelectedScheduleId(schedule.id)}
                      className={`relative flex w-full items-center gap-5 rounded-xl border bg-white p-5 text-left transition ${
                        selected
                          ? "border-primary ring-1 ring-primary"
                          : "border-slate-200 hover:border-primary/50"
                      }`}
                    >
                      {selected && (
                        <span className="absolute right-0 top-0 rounded-bl-lg rounded-tr-xl bg-primary px-4 py-1 text-xs font-black text-white">
                          ĐANG CHỌN
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

                      <span className="font-bold text-slate-950">
                        {formatTime(schedule.departureTime)}
                        <small className="block text-sm font-medium text-slate-500">
                          {schedule.fromStation?.name}
                        </small>
                      </span>

                      <span className="hidden flex-1 items-center gap-3 md:flex">
                        <span className="h-2 w-2 rounded-full border border-primary" />
                        <span className="flex-1 border-t border-slate-300" />
                        <span className="text-xs font-semibold text-slate-400">
                          {minutesToDuration(schedule.duration)}
                        </span>
                        <span className="flex-1 border-t border-slate-300" />
                        <span className="h-2 w-2 rounded-full bg-primary" />
                      </span>

                      <span className="font-bold text-slate-950">
                        {formatTime(schedule.arrivalTime)}
                        <small className="block text-sm font-medium text-slate-500">
                          {schedule.toStation?.name}
                        </small>
                      </span>

                      <span className="ml-auto text-right">
                        <small className="block text-sm font-semibold text-slate-500">
                          Giá vé từ
                        </small>
                        <strong className="text-2xl font-black text-primary">
                          {formatCurrency(fare)}
                        </strong>
                        <small className="block text-xs font-semibold text-slate-400">
                          {schedule.availability?.reduce(
                            (sum, item) => sum + item.availableSeats,
                            0,
                          ) || 0}{" "}
                          ghế trống
                        </small>
                      </span>

                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                          selected
                            ? "border-primary text-primary"
                            : "border-slate-300"
                        }`}
                      >
                        {selected && <CheckCircle2 className="h-5 w-5" />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <section>
            <h2 className="mb-4 flex items-center gap-3 text-2xl font-extrabold text-slate-900">
              <Landmark className="h-6 w-6 text-primary" />
              Chi tiết thay đổi
            </h2>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="space-y-6 p-6 text-lg">
                <div className="flex justify-between">
                  <span className="text-slate-700">Giá vé mới (ước tính)</span>
                  <strong>
                    {selectedSchedule ? formatCurrency(newFare) : "—"}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Giá vé đã thanh toán</span>
                  <strong>{formatCurrency(paidAmount)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Chênh lệch giá vé</span>
                  <strong
                    className={fareDifference < 0 ? "text-emerald-600" : ""}
                  >
                    {selectedSchedule
                      ? fareDifference < 0
                        ? `−${formatCurrency(-fareDifference)}`
                        : fareDifference > 0
                          ? `+${formatCurrency(fareDifference)}`
                          : formatCurrency(0)
                      : "—"}
                  </strong>
                </div>
                <div className="border-t border-dashed border-slate-300" />
                <div className="flex justify-between">
                  <span className="text-slate-700">Phí đổi vé (cố định)</span>
                  <strong>{formatCurrency(fixedFee)}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700">Phí đổi vé (10%)</span>
                  <strong>{formatCurrency(percentFee)}</strong>
                </div>

                {refundSurplus > 0 ? (
                  <div className="rounded-xl bg-emerald-50 p-6 text-emerald-700">
                    <span className="text-lg font-extrabold">
                      Số tiền hoàn lại
                    </span>
                    <strong className="ml-3 text-5xl font-black">
                      {formatCurrency(refundSurplus)}
                    </strong>
                    <p className="mt-3 text-xs font-semibold">
                      * Hoàn vào ví GoTrainVN sau khi xác nhận đổi vé
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl bg-sky-100 p-6 text-primary">
                    <span className="text-lg font-extrabold">
                      Tổng thanh toán
                    </span>
                    <strong className="ml-3 text-5xl font-black">
                      {formatCurrency(amountDue)}
                    </strong>
                    <p className="mt-3 text-xs font-semibold">
                      * Thanh toán qua ví GoTrainVN
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-3 bg-slate-100 p-6">
                <button
                  onClick={handleConfirmExchange}
                  disabled={!selectedSchedule}
                  className="h-16 w-full rounded-xl bg-primary text-xl font-extrabold text-white shadow-lg shadow-primary/20 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                >
                  Chọn ghế mới
                </button>
                <button
                  onClick={() => navigate("/tra-cuu-ve")}
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white font-bold text-slate-700"
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-100/70 p-6">
            <h3 className="mb-3 flex items-center gap-3 text-base font-extrabold text-slate-700">
              <Info className="h-5 w-5" />
              Chính sách đổi vé
            </h3>
            <ul className="list-disc space-y-1 pl-8 text-sm leading-6 text-slate-700">
              <li>Vé cá nhân: Phí đổi vé 20,000đ + 10% giá vé gốc.</li>
              <li>Chỉ đổi vé cho chuyến chưa khởi hành.</li>
              <li>
                Giá vé hiển thị là mức tối thiểu; giá thực tế theo ghế chọn.
              </li>
              <li>
                Nếu vé mới rẻ hơn, chênh lệch sẽ được hoàn vào ví GoTrainVN sau
                khi trừ phí.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
