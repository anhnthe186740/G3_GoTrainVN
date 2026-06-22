import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Eye,
  LoaderCircle,
  RotateCcw,
  Search,
  TicketCheck,
  TrainFront,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";
import { getStations } from "../../services/referenceDataApi";
import { staffSearchApi } from "../../services/staffSearchApi";
import { ScheduleCard } from "../booking/ScheduleCard";
import { SeatSelectionPage } from "../booking/SeatSelectionPage";
import { PassengerDetailsPage } from "../booking/PassengerDetailsPage";
import { StaffTicketPrintPanel } from "./StaffTicketPrintPanel";
import { StaffTicketDetailModal } from "./StaffTicketDetailModal";

function todayInput() {
  return new Date().toISOString().slice(0, 10);
}

function stationLabel(station) {
  if (!station) return "";
  return station.stationName || station.name || station.city || "";
}

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function sortCounterSchedules(list) {
  return [...list].sort((a, b) => {
    const timeA = new Date(a.departureTime).getTime();
    const timeB = new Date(b.departureTime).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const seatsA = Number(a.availableSeats || 0);
    const seatsB = Number(b.availableSeats || 0);
    return seatsB - seatsA;
  });
}

function quickSummary(result) {
  if (!result) return "";
  if (result.total === 0) return "Không có kết quả";
  const parts = [
    result.bookings?.length ? `${result.bookings.length} booking` : "",
    result.tickets?.length ? `${result.tickets.length} vé` : "",
  ].filter(Boolean);
  return parts.join(" · ");
}

function bookingRoute(booking) {
  return `${stationLabel(booking?.fromStation || booking?.schedule?.startStation) || "Ga đi"} → ${
    stationLabel(booking?.toStation || booking?.schedule?.endStation) ||
    "Ga đến"
  }`;
}

function dateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function bookingActiveTickets(booking) {
  return (booking?.passengers || []).filter((passenger) => {
    const details = passenger.bookingDetails || [];
    return (
      details.length === 0 ||
      details.some((detail) => detail.status !== "CANCELLED")
    );
  }).length;
}

const STEPS = [
  ["search", "Chuyến"],
  ["seats", "Ghế"],
  ["passengers", "Hành khách"],
  ["complete", "Thanh toán & in"],
];

export function StaffDirectBookingPanel() {
  const [stations, setStations] = useState([]);
  const [fromStationId, setFromStationId] = useState("");
  const [fromStationQuery, setFromStationQuery] = useState("");
  const [toStationId, setToStationId] = useState("");
  const [toStationQuery, setToStationQuery] = useState("");
  const [departureDate, setDepartureDate] = useState(todayInput());
  const [schedules, setSchedules] = useState([]);
  const [searchingSchedules, setSearchingSchedules] = useState(false);
  const [scheduleError, setScheduleError] = useState("");
  const [stage, setStage] = useState("search");
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [seatSession, setSeatSession] = useState(null);
  const [completedBooking, setCompletedBooking] = useState(null);
  const [quickQuery, setQuickQuery] = useState("");
  const [quickResult, setQuickResult] = useState(null);
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickResultOpen, setQuickResultOpen] = useState(false);
  const [detailBooking, setDetailBooking] = useState(null);

  useEffect(() => {
    getStations()
      .then(({ stations: stationList = [] }) => {
        setStations(stationList);
        const defaultFrom =
          stationList.find((station) =>
            /hà nội|ha noi/i.test(station.stationName || station.city || ""),
          ) || stationList[0];
        const defaultTo =
          stationList.find((station) =>
            /sài gòn|sai gon|hồ chí minh|ho chi minh/i.test(
              station.stationName || station.city || "",
            ),
          ) || stationList.find((station) => station.id !== defaultFrom?.id);
        setFromStationId(defaultFrom?.id || "");
        setFromStationQuery(stationLabel(defaultFrom));
        setToStationId(defaultTo?.id || "");
        setToStationQuery(stationLabel(defaultTo));
      })
      .catch(() => {
        toast.error("Không thể tải danh sách ga.");
      });
  }, []);

  const selectedFrom = useMemo(
    () => stations.find((station) => station.id === fromStationId),
    [fromStationId, stations],
  );
  const selectedTo = useMemo(
    () => stations.find((station) => station.id === toStationId),
    [stations, toStationId],
  );

  const journeyPayload = selectedSchedule
    ? {
        outbound: {
          scheduleId: selectedSchedule.id,
          fromStationId,
          toStationId,
        },
        return: null,
      }
    : null;

  const updateStationQuery = (value, setQuery, setId) => {
    setQuery(value);
    const normalized = value.trim().toLowerCase();
    const exact = stations.find(
      (station) => stationLabel(station).trim().toLowerCase() === normalized,
    );
    setId(exact?.id || "");
  };

  const searchSchedules = async (event) => {
    event?.preventDefault();
    if (!fromStationId || !toStationId || !departureDate) {
      toast.error("Chọn đủ ga đi, ga đến và ngày đi.");
      return;
    }
    if (fromStationId === toStationId) {
      toast.error("Ga đi và ga đến phải khác nhau.");
      return;
    }

    setSearchingSchedules(true);
    setScheduleError("");
    setSchedules([]);
    setSelectedSchedule(null);
    setSeatSession(null);
    setCompletedBooking(null);
    setStage("search");

    try {
      const { data } = await api.get("/schedules/search", {
        params: { fromStationId, toStationId, departureDate },
      });
      const nextSchedules = sortCounterSchedules(data.outbound || []);
      setSchedules(nextSchedules);
      if ((data.outbound || []).length === 0) {
        setScheduleError("Không có chuyến phù hợp với yêu cầu.");
      }
    } catch (error) {
      setScheduleError(
        error.response?.data?.message || "Không thể tải danh sách chuyến.",
      );
    } finally {
      setSearchingSchedules(false);
    }
  };

  const quickLookup = async (event) => {
    event?.preventDefault();
    const query = quickQuery.trim();
    if (!query) return;
    setQuickLoading(true);
    setQuickResult(null);
    try {
      const { data } = await staffSearchApi.globalSearch(query);
      setQuickResult(data);
      setQuickResultOpen(true);
      if (data.total === 0) {
        toast.info("Không tìm thấy kết quả phù hợp.");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Không thể tra cứu.");
    } finally {
      setQuickLoading(false);
    }
  };
  const selectSchedule = (schedule) => {
    setSelectedSchedule(schedule);
    setSeatSession(null);
    setCompletedBooking(null);
    setStage("seats");
  };

  const resetFlow = () => {
    setSelectedSchedule(null);
    setSeatSession(null);
    setCompletedBooking(null);
    setSchedules([]);
    setStage("search");
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#bec7d4]/30 bg-white shadow-sm">
        <div className="grid gap-4 border-b border-[#bec7d4]/20 p-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <form
            onSubmit={quickLookup}
            className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-xl border border-[#bec7d4]/60 bg-[#f7f9fb] px-3 py-2.5">
              <Search className="h-4 w-4 shrink-0 text-[#00629d]" />
              <input
                value={quickQuery}
                onChange={(event) => setQuickQuery(event.target.value)}
                placeholder="Tra nhanh PNR, mã vé, CCCD, SĐT"
                className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#191c1e] outline-none placeholder:text-[#6f7883]"
              />
            </div>
            <button
              type="submit"
              disabled={quickLoading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#00629d] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#00527f] disabled:opacity-60"
            >
              {quickLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Tra cứu
            </button>
          </form>

          <div className="flex min-h-[42px] items-center justify-between gap-3 rounded-xl border border-dashed border-[#bec7d4]/60 bg-[#f7f9fb] px-3 py-2 text-xs font-semibold text-[#3f4852]">
            {quickResult ? (
              <>
                <span className="min-w-0">
                  Tìm thấy{" "}
                  <strong className="text-[#00629d]">
                    {quickSummary(quickResult)}
                  </strong>
                  {!quickResultOpen && (
                    <span className="text-[#6f7883]"> · đã thu gọn</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setQuickResultOpen((current) => !current)}
                  className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-[#bec7d4]/60 bg-white px-2.5 text-[11px] font-bold text-[#3f4852] transition hover:border-[#00629d] hover:text-[#00629d]"
                  title={quickResultOpen ? "Đóng kết quả" : "Mở lại kết quả"}
                >
                  {quickResultOpen ? (
                    <>
                      <X className="h-3.5 w-3.5" />
                      Đóng
                    </>
                  ) : (
                    "Mở lại"
                  )}
                </button>
              </>
            ) : (
              "Thanh tra nhanh luôn sẵn sàng, không làm mất phiên đặt vé."
            )}
          </div>
        </div>

        {quickResult?.total > 0 && quickResultOpen && (
          <div className="grid gap-3 border-b border-[#bec7d4]/20 bg-[#f7f9fb]/70 p-4 lg:grid-cols-2">
            <div className="rounded-xl border border-[#bec7d4]/30 bg-white p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#00629d]">
                Booking
              </p>
              {quickResult.bookings?.length ? (
                quickResult.bookings.slice(0, 3).map((booking) => (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={() => setDetailBooking(booking)}
                    className="mt-2 block w-full rounded-lg border border-[#bec7d4]/30 bg-[#f7f9fb] px-3 py-2 text-left text-xs transition hover:border-[#00629d] hover:bg-[#cfe5ff]/40"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#191c1e]">
                        {booking.bookingCode}
                      </span>
                      <Eye className="h-3.5 w-3.5 text-[#00629d]" />
                    </span>
                    <span className="mt-1 block font-semibold text-[#6f7883]">
                      {bookingRoute(booking)}
                    </span>
                    <span className="mt-1 block font-semibold text-[#00629d]">
                      {booking.schedule?.train?.trainName || "Tàu"} ·{" "}
                      {dateTime(booking.schedule?.departureTime)} ·{" "}
                      {bookingActiveTickets(booking)} vé hiệu lực
                    </span>
                  </button>
                ))
              ) : (
                <p className="mt-2 text-xs font-semibold text-[#6f7883]">
                  Không có booking
                </p>
              )}
            </div>

            <div className="rounded-xl border border-[#bec7d4]/30 bg-white p-3">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#00629d]">
                Vé
              </p>
              {quickResult.tickets?.length ? (
                quickResult.tickets.slice(0, 3).map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() =>
                      ticket.booking && setDetailBooking(ticket.booking)
                    }
                    className="mt-2 block w-full rounded-lg border border-[#bec7d4]/30 bg-[#f7f9fb] px-3 py-2 text-left text-xs transition hover:border-[#00629d] hover:bg-[#cfe5ff]/40"
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#191c1e]">
                        {ticket.ticketCode || ticket.booking?.bookingCode}
                      </span>
                      <Eye className="h-3.5 w-3.5 text-[#00629d]" />
                    </span>
                    <span className="mt-1 block font-semibold text-[#6f7883]">
                      {ticket.fullName} · {ticket.booking?.bookingCode}
                    </span>
                    <span className="mt-1 block font-semibold text-[#00629d]">
                      {ticket.booking?.schedule?.train?.trainName || "Tàu"} ·{" "}
                      {dateTime(ticket.booking?.schedule?.departureTime)}
                    </span>
                  </button>
                ))
              ) : (
                <p className="mt-2 text-xs font-semibold text-[#6f7883]">
                  Không có vé
                </p>
              )}
            </div>
          </div>
        )}

        <form
          onSubmit={searchSchedules}
          className="grid gap-3 p-4 lg:grid-cols-[1fr_1fr_180px_auto]"
        >
          <label className="space-y-1.5">
            <span className="text-xs font-bold text-[#3f4852]">Ga đi</span>
            <input
              list="staff-from-stations"
              value={fromStationQuery}
              onChange={(event) =>
                updateStationQuery(
                  event.target.value,
                  setFromStationQuery,
                  setFromStationId,
                )
              }
              placeholder="Nhập ga đi"
              className="w-full rounded-xl border border-[#bec7d4]/60 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff]"
            />
            <datalist id="staff-from-stations">
              {stations.map((station) => (
                <option key={station.id} value={stationLabel(station)} />
              ))}
            </datalist>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold text-[#3f4852]">Ga đến</span>
            <input
              list="staff-to-stations"
              value={toStationQuery}
              onChange={(event) =>
                updateStationQuery(
                  event.target.value,
                  setToStationQuery,
                  setToStationId,
                )
              }
              placeholder="Nhập ga đến"
              className="w-full rounded-xl border border-[#bec7d4]/60 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff]"
            />
            <datalist id="staff-to-stations">
              {stations.map((station) => (
                <option key={station.id} value={stationLabel(station)} />
              ))}
            </datalist>
          </label>

          <label className="space-y-1.5">
            <span className="text-xs font-bold text-[#3f4852]">Ngày đi</span>
            <input
              type="date"
              value={departureDate}
              min={todayInput()}
              onChange={(event) => setDepartureDate(event.target.value)}
              className="w-full rounded-xl border border-[#bec7d4]/60 bg-white px-3 py-3 text-sm font-semibold outline-none focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff]"
            />
          </label>

          <button
            type="submit"
            disabled={searchingSchedules}
            className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#071a2b] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0f2a43] disabled:opacity-60 lg:mt-auto"
          >
            {searchingSchedules ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <TrainFront className="h-4 w-4" />
            )}
            Tìm chuyến
          </button>
        </form>
      </section>

      <section className="flex flex-wrap items-center gap-2">
        {STEPS.map(([key, label]) => {
          const active = stage === key;
          const done =
            STEPS.findIndex(([step]) => step === stage) >
            STEPS.findIndex(([step]) => step === key);
          return (
            <span
              key={key}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                active
                  ? "border-[#00629d] bg-[#cfe5ff] text-[#00629d]"
                  : done
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-[#bec7d4]/50 bg-white text-[#6f7883]"
              }`}
            >
              {done ? (
                <BadgeCheck className="h-3.5 w-3.5" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-current" />
              )}
              {label}
            </span>
          );
        })}
      </section>

      {stage === "search" && (
        <div className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-extrabold text-[#191c1e]">
                  Chọn chuyến cho khách
                </h2>
                <p className="text-sm font-medium text-[#6f7883]">
                  {stationLabel(selectedFrom) || "Ga đi"} đến{" "}
                  {stationLabel(selectedTo) || "ga đến"} · {departureDate}
                </p>
              </div>
              {schedules.length > 0 && (
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-[#00629d] shadow-sm">
                  {schedules.length} chuyến
                </span>
              )}
            </div>

            {searchingSchedules ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center">
                <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-[#00629d]" />
                <p className="mt-3 text-sm font-semibold text-[#6f7883]">
                  Đang tìm chuyến phù hợp...
                </p>
              </div>
            ) : scheduleError ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-semibold text-amber-800">
                {scheduleError}
              </div>
            ) : schedules.length > 0 ? (
              <div className="space-y-4">
                {schedules.map((schedule) => (
                  <ScheduleCard
                    key={schedule.id}
                    schedule={schedule}
                    onSelect={selectSchedule}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#bec7d4] bg-white p-10 text-center">
                <CalendarDays className="mx-auto h-9 w-9 text-[#bec7d4]" />
                <p className="mt-3 font-bold text-[#191c1e]">
                  Nhập tuyến và tìm chuyến để bắt đầu
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {stage === "seats" && journeyPayload && (
        <SeatSelectionPage
          embedded
          journeyOverride={journeyPayload}
          onBack={() => setStage("search")}
          onSessionReady={(session) => {
            setSeatSession(session);
            setStage("passengers");
          }}
        />
      )}

      {stage === "passengers" && seatSession && (
        <PassengerDetailsPage
          embedded
          mode="staff"
          sessionIdOverride={seatSession.id}
          onBack={() => setStage("seats")}
          onComplete={(result) => {
            setCompletedBooking(result);
            setStage("complete");
          }}
        />
      )}

      {stage === "complete" && completedBooking && (
        <div className="space-y-5">
          <section className="rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                  <TicketCheck className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
                    Đã hoàn tất tại quầy
                  </p>
                  <h2 className="mt-1 text-xl font-extrabold text-[#191c1e]">
                    {completedBooking.booking.bookingCode}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-[#6f7883]">
                    Tổng tiền {money(completedBooking.booking.totalAmount)} ·
                    sẵn sàng in vé
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetFlow}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#bec7d4] bg-white px-4 py-2.5 text-sm font-bold text-[#3f4852] transition hover:border-[#00629d] hover:text-[#00629d]"
              >
                <RotateCcw className="h-4 w-4" />
                Đặt vé mới
              </button>
            </div>
          </section>

          <StaffTicketPrintPanel
            initialQuery={completedBooking.booking.bookingCode}
          />
        </div>
      )}

      <StaffTicketDetailModal
        booking={detailBooking}
        onClose={() => setDetailBooking(null)}
        onCancelled={() => {
          if (quickQuery.trim()) {
            quickLookup();
          }
        }}
      />
    </div>
  );
}
