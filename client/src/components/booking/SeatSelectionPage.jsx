import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Armchair,
  Check,
  Clock3,
  DoorOpen,
  Gauge,
  Luggage,
  PlugZap,
  Radio,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TrainFront,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  createSeatSocket,
  seatSelectionApi,
} from "../../services/seatSelectionApi";
import "./seatBlueprint.css";

const STATE_META = {
  AVAILABLE: {
    label: "Còn trống",
    className:
      "border-[#35e69a] text-[#35e69a] bg-[#35e69a]/8 hover:bg-[#35e69a]/18 hover:shadow-[0_0_18px_rgba(53,230,154,0.18)]",
  },
  DRAFT_SELECTED: {
    label: "Đang chọn · chưa giữ",
    className:
      "border-[#60a5fa] text-white bg-[#2563eb] shadow-[0_0_20px_rgba(59,130,246,0.4)]",
  },
  SELECTED: {
    label: "Đã giữ cho bạn",
    className:
      "border-[#60a5fa] text-white bg-[#2563eb] shadow-[0_0_20px_rgba(59,130,246,0.4)]",
  },
  LOCKED: {
    label: "Người khác đang giữ",
    className: "border-[#f6c453] text-[#f6c453] bg-[#f6c453]/12",
  },
  SOLD: {
    label: "Đã bán",
    className: "border-[#d85b55] text-[#f09a94] bg-[#d85b55]/14",
  },
  BLOCKED: {
    label: "Tạm khóa",
    className: "border-slate-500 text-slate-500 bg-slate-700/30",
  },
  UNPRICED: {
    label: "Chưa có giá",
    className: "border-slate-600 text-slate-500 bg-slate-800/40",
  },
};

const CARRIAGE_SHORT_NAMES = {
  NORMAL_SEAT: "Ghế thường",
  AC_SEAT: "Ghế điều hòa",
  SLEEPER_6: "Khoang 6",
  SLEEPER_4: "Khoang 4",
};

function money(value) {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function dateTime(value) {
  return new Date(value).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function countdown(expiresAt, now) {
  if (!expiresAt) return "10:00";
  const seconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 1000),
  );
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(
    seconds % 60,
  ).padStart(2, "0")}`;
}

function heatColor(occupancy) {
  if (occupancy >= 80) return "bg-[#d85b55]";
  if (occupancy >= 40) return "bg-[#f6c453]";
  return "bg-[#35e69a]";
}

function SeatNode({ seat, onToggle, busy, selectionLocked }) {
  const meta = STATE_META[seat.state] || STATE_META.BLOCKED;
  const disabled =
    selectionLocked ||
    !["AVAILABLE", "DRAFT_SELECTED"].includes(seat.state) ||
    busy;
  const typeName = {
    WINDOW: "Cửa sổ",
    MIDDLE: "Tầng giữa",
    AISLE: "Lối đi",
  }[seat.seatType];

  return (
    <div className="group relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onToggle(seat)}
        aria-label={`Ghế ${seat.seatNumber}, ${typeName}, ${meta.label}${
          seat.price ? `, ${money(seat.price)}` : ""
        }`}
        className={`seat-node relative flex h-12 w-full min-w-[48px] items-center justify-center rounded-lg border font-utility-mono text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#071a2b] disabled:cursor-not-allowed ${meta.className}`}
      >
        {["SELECTED", "DRAFT_SELECTED"].includes(seat.state) && (
          <Check className="absolute right-1 top-1 h-3 w-3" />
        )}
        {seat.state === "LOCKED" && (
          <Clock3 className="absolute right-1 top-1 h-3 w-3" />
        )}
        {seat.state === "SOLD" && (
          <span className="absolute inset-x-1 top-1/2 h-px rotate-[-24deg] bg-current" />
        )}
        <span>{seat.seatNumber}</span>
      </button>

      <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-40 hidden w-56 -translate-x-1/2 rounded-xl border border-cyan-300/20 bg-[#0b2438] p-3 text-left text-white shadow-2xl group-hover:block group-focus-within:block">
        <p className="font-utility-mono text-[10px] uppercase tracking-[0.16em] text-cyan-300">
          Ghế {seat.seatNumber}
        </p>
        <p className="mt-1 text-sm font-bold">
          {typeName} · {meta.label}
        </p>
        <p className="mt-1 text-xs text-slate-300">
          {seat.price ? money(seat.price) : "Chưa mở bán"}
        </p>
        {seat.amenities?.length > 0 && (
          <p className="mt-2 text-[11px] text-slate-400">
            {seat.amenities.join(" · ")}
          </p>
        )}
      </div>
    </div>
  );
}

function SeatGrid({ carriage, onToggle, busySeatId, selectionLocked }) {
  const withCarriage = (seat) => ({
    ...seat,
    carriageNumber: carriage.carriageNumber,
    carriageType: carriage.carriageType,
  });
  if (carriage.carriageType.startsWith("SLEEPER")) {
    const compartments = carriage.seats.reduce((groups, seat) => {
      const compartment = seat.seatNumber.split("-")[0];
      if (!groups[compartment]) groups[compartment] = [];
      groups[compartment].push(seat);
      return groups;
    }, {});
    return (
      <div className="grid gap-5 lg:grid-cols-2">
        {Object.entries(compartments).map(([compartment, seats]) => (
          <section
            key={compartment}
            className="rounded-xl border border-cyan-200/20 bg-cyan-300/[0.025] p-4"
          >
            <div className="mb-3 flex items-center justify-between font-utility-mono text-[10px] uppercase tracking-[0.16em] text-cyan-200/70">
              <span>{compartment.replace("K", "Khoang ")}</span>
              <span>{seats.length} giường</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {seats.map((seat) => (
                <SeatNode
                  key={seat.id}
                  seat={withCarriage(seat)}
                  onToggle={onToggle}
                  busy={busySeatId === seat.id}
                  selectionLocked={selectionLocked}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-xl grid-cols-[1fr_1fr_44px_1fr_1fr] gap-3">
      {carriage.seats.map((seat, index) => {
        const column = index % 4;
        const gridColumn = column < 2 ? column + 1 : column + 2;
        return (
          <div key={seat.id} style={{ gridColumn }}>
            <SeatNode
              seat={withCarriage(seat)}
              onToggle={onToggle}
              busy={busySeatId === seat.id}
              selectionLocked={selectionLocked}
            />
          </div>
        );
      })}
    </div>
  );
}

function JourneyHeader({
  schedule,
  expiresAt,
  now,
  connectionState,
  sessionActive,
}) {
  if (!schedule) return null;
  const timer = countdown(expiresAt, now);
  const urgent = sessionActive && timer <= "02:00";

  return (
    <header className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#071a2b] text-cyan-300">
            <TrainFront className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-utility-mono text-xs font-bold uppercase tracking-[0.16em] text-primary">
                {schedule.trainCode}
              </span>
              <span className="text-xs text-slate-400">
                {schedule.routeName}
              </span>
            </div>
            <h1 className="mt-1 truncate font-headline-md text-xl font-bold text-slate-900">
              {schedule.fromStation.name} → {schedule.toStation.name}
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {dateTime(schedule.departureTime)} · {schedule.distance} km
            </p>
          </div>
        </div>

        <div
          className={`flex min-w-[210px] items-center justify-between rounded-2xl border px-4 py-3 ${
            urgent
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-cyan-100 bg-cyan-50/70 text-[#075b72]"
          }`}
        >
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]">
              {sessionActive ? "Thời gian giữ ghế" : "Trạng thái lựa chọn"}
            </p>
            <p className="font-utility-mono text-2xl font-bold tracking-wider">
              {sessionActive ? timer : "CHƯA GIỮ"}
            </p>
          </div>
          <div className="text-right">
            {connectionState === "connected" ? (
              <Radio className="ml-auto h-5 w-5 text-emerald-500" />
            ) : (
              <WifiOff className="ml-auto h-5 w-5 text-amber-500" />
            )}
            <span className="mt-1 block text-[10px] font-bold">
              {connectionState === "connected"
                ? "Đang đồng bộ"
                : "Đang kết nối lại"}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

function TrainOverview({ carriages, activeId, onSelect }) {
  return (
    <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="font-utility-mono text-[10px] uppercase tracking-[0.18em] text-primary">
            Tổng thể đoàn tàu
          </p>
          <h2 className="mt-1 font-headline-md text-lg font-bold text-slate-900">
            Chọn toa để xem bản vẽ chi tiết
          </h2>
        </div>
        <Gauge className="h-5 w-5 text-slate-400" />
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        <div className="flex min-w-[88px] items-center justify-center rounded-2xl bg-[#071a2b] px-4 text-cyan-300">
          <TrainFront className="h-7 w-7" />
        </div>
        {carriages.map((carriage) => {
          const active = carriage.id === activeId;
          return (
            <button
              key={carriage.id}
              type="button"
              onClick={() => onSelect(carriage.id)}
              className={`min-w-[150px] rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-primary ${
                active
                  ? "border-primary bg-primary text-white shadow-lg shadow-primary/15"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-utility-mono text-xs font-bold">
                  TOA {String(carriage.carriageNumber).padStart(2, "0")}
                </span>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${heatColor(
                    carriage.occupancyPercentage,
                  )}`}
                />
              </div>
              <p className="mt-2 truncate text-xs font-bold">
                {CARRIAGE_SHORT_NAMES[carriage.carriageType] ||
                  carriage.carriageType}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className={`h-full ${heatColor(
                    carriage.occupancyPercentage,
                  )}`}
                  style={{ width: `${100 - carriage.occupancyPercentage}%` }}
                />
              </div>
              <p
                className={`mt-1.5 text-[10px] font-semibold ${
                  active ? "text-white/75" : "text-slate-500"
                }`}
              >
                Còn {carriage.availableSeats} chỗ
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-cyan-50/70">
      {Object.entries(STATE_META)
        .filter(([state]) => state !== "UNPRICED")
        .map(([state, meta]) => (
          <span key={state} className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-sm border ${meta.className
                .split(" ")
                .slice(0, 3)
                .join(" ")}`}
            />
            {meta.label}
          </span>
        ))}
    </div>
  );
}

function BookingCart({
  items,
  activeLeg,
  onRemove,
  onPrimary,
  canPrimary,
  held,
  onChangeSeats,
}) {
  const currentItems = items.filter((item) => item.leg === activeLeg);
  const total = items.reduce((sum, item) => sum + Number(item.price), 0);

  return (
    <aside className="sticky top-24 hidden h-fit rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm xl:block">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-utility-mono text-[10px] uppercase tracking-[0.16em] text-primary">
            Giỏ vé
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Ghế đã chọn</h2>
        </div>
        <ShoppingBag className="h-5 w-5 text-slate-400" />
      </div>

      <div className="mt-5 space-y-3">
        {currentItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center">
            <Armchair className="mx-auto h-6 w-6 text-slate-300" />
            <p className="mt-2 text-xs font-semibold text-slate-500">
              Chọn ghế trống trên bản vẽ
            </p>
          </div>
        ) : (
          currentItems.map((item) => (
            <div
              key={`${item.scheduleId}-${item.id}`}
              className="flex items-center justify-between rounded-2xl bg-slate-50 p-3"
            >
              <div>
                <p className="font-utility-mono text-xs font-bold text-slate-900">
                  Toa {item.carriageNumber} · Ghế {item.seatNumber}
                </p>
                <p className="mt-1 text-xs font-bold text-primary">
                  {money(item.price)}
                </p>
              </div>
              {!held && (
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white hover:text-red-600"
                  aria-label={`Bỏ ghế ${item.seatNumber}`}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <div className="mt-5 border-t border-slate-100 pt-4">
        <div className="flex items-end justify-between">
          <span className="text-xs font-semibold text-slate-500">
            Tổng tạm tính
          </span>
          <span className="text-xl font-extrabold text-slate-900">
            {money(total)}
          </span>
        </div>
        <button
          type="button"
          disabled={!canPrimary}
          onClick={onPrimary}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-container disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {held ? "Nhập thông tin hành khách" : `Giữ ${items.length} ghế`}
          <ArrowRight className="h-4 w-4" />
        </button>
        {held && (
          <button
            type="button"
            onClick={onChangeSeats}
            className="mt-2 w-full rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-50 hover:text-primary"
          >
            Thay đổi ghế
          </button>
        )}
      </div>
    </aside>
  );
}

/*
function LegacySeatSelectionPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [session, setSession] = useState(null);
  const [seatMaps, setSeatMaps] = useState({});
  const [activeLeg, setActiveLeg] = useState("outbound");
  const [activeCarriageId, setActiveCarriageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busySeatId, setBusySeatId] = useState("");
  const [now, setNow] = useState(Date.now());
  const [connectionState, setConnectionState] = useState("connecting");
  const [expired, setExpired] = useState(false);

  const journeyPayload = useMemo(() => {
    const outbound = {
      scheduleId: searchParams.get("outboundScheduleId"),
      fromStationId: searchParams.get("outboundFromStationId"),
      toStationId: searchParams.get("outboundToStationId"),
    };
    const returnScheduleId = searchParams.get("returnScheduleId");
    return {
      outbound,
      return: returnScheduleId
        ? {
            scheduleId: returnScheduleId,
            fromStationId: searchParams.get("returnFromStationId"),
            toStationId: searchParams.get("returnToStationId"),
          }
        : null,
    };
  }, [searchParams]);

  const currentJourney =
    activeLeg === "outbound" ? journeyPayload.outbound : journeyPayload.return;
  const currentMap = seatMaps[activeLeg];
  const carriages = currentMap?.carriages || [];
  const activeCarriage =
    carriages.find((carriage) => carriage.id === activeCarriageId) ||
    carriages[0];

  const loadSession = useCallback(async (sessionId) => {
    const { data } = await seatSelectionApi.getSession(sessionId);
    setSession(data.session);
    return data.session;
  }, []);

  const loadMap = useCallback(
    async (leg, sessionId) => {
      const journey =
        leg === "outbound" ? journeyPayload.outbound : journeyPayload.return;
      if (!journey) return;
      const { data } = await seatSelectionApi.getSeatMap({
        ...journey,
        sessionId,
      });
      setSeatMaps((previous) => ({ ...previous, [leg]: data }));
      setActiveCarriageId((current) => current || data.carriages[0]?.id || "");
    },
    [journeyPayload],
  );

  useEffect(() => {
    const controller = new AbortController();
    const start = async () => {
      if (
        !journeyPayload.outbound.scheduleId ||
        !journeyPayload.outbound.fromStationId ||
        !journeyPayload.outbound.toStationId
      ) {
        setError("Thông tin chuyến chưa đầy đủ. Hãy chọn lại chuyến tàu.");
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const { data } = await seatSelectionApi.createSession(journeyPayload);
        if (controller.signal.aborted) return;
        setSession(data.session);
        await loadMap("outbound", data.session.id);
        if (journeyPayload.return) {
          await loadMap("return", data.session.id);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(
            requestError.response?.data?.message ||
              "Không thể mở sơ đồ ghế của chuyến.",
          );
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    start();
    return () => controller.abort();
  }, [journeyPayload, loadMap]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session?.expiresAt && new Date(session.expiresAt).getTime() <= now) {
      setExpired(true);
    }
  }, [now, session?.expiresAt]);

  useEffect(() => {
    if (!session) return undefined;
    const socket = createSeatSocket();
    const scheduleIds = [
      session.outboundScheduleId,
      session.returnScheduleId,
    ].filter(Boolean);

    socket.on("connect", () => {
      setConnectionState("connected");
      scheduleIds.forEach((scheduleId) =>
        socket.emit("schedule:join", scheduleId),
      );
      loadMap("outbound", session.id);
      if (session.returnScheduleId) loadMap("return", session.id);
    });
    socket.on("disconnect", () => setConnectionState("reconnecting"));
    socket.on("connect_error", () => setConnectionState("reconnecting"));
    socket.on("seat:state", ({ scheduleId }) => {
      if (scheduleId === session.outboundScheduleId) {
        loadMap("outbound", session.id);
      }
      if (scheduleId === session.returnScheduleId) {
        loadMap("return", session.id);
      }
    });
    socket.on("session:expired", ({ sessionId }) => {
      if (sessionId === session.id) setExpired(true);
    });

    return () => {
      scheduleIds.forEach((scheduleId) =>
        socket.emit("schedule:leave", scheduleId),
      );
      socket.disconnect();
    };
  }, [loadMap, session]);

  useEffect(() => {
    if (activeCarriage?.id) setActiveCarriageId(activeCarriage.id);
  }, [activeCarriage?.id]);

  const toggleSeat = async (seat) => {
    if (!session || !currentJourney || expired) return;
    setBusySeatId(seat.id);
    try {
      if (seat.state === "AVAILABLE") {
        await seatSelectionApi.holdSeat(session.id, {
          scheduleId: currentJourney.scheduleId,
          seatId: seat.id,
        });
        toast.success(`Đã giữ ghế ${seat.seatNumber} trong 10 phút.`);
      } else if (seat.state === "SELECTED") {
        const hold = session.holds.find(
          (item) =>
            item.scheduleId === currentJourney.scheduleId &&
            item.seatId === seat.id,
        );
        if (hold) await seatSelectionApi.releaseHold(session.id, hold.id);
      }
      await Promise.all([
        loadSession(session.id),
        loadMap(activeLeg, session.id),
      ]);
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message ||
          "Không thể cập nhật ghế đã chọn.",
      );
      await loadMap(activeLeg, session.id);
    } finally {
      setBusySeatId("");
    }
  };

  const removeHold = async (hold) => {
    if (!session) return;
    await seatSelectionApi.releaseHold(session.id, hold.id);
    await Promise.all([
      loadSession(session.id),
      loadMap(
        hold.scheduleId === session.outboundScheduleId ? "outbound" : "return",
        session.id,
      ),
    ]);
  };

  const holdCounts = useMemo(() => {
    const holds = session?.holds || [];
    return {
      outbound: holds.filter(
        (hold) => hold.scheduleId === session?.outboundScheduleId,
      ).length,
      return: holds.filter(
        (hold) => hold.scheduleId === session?.returnScheduleId,
      ).length,
    };
  }, [session]);
  const canContinue =
    holdCounts.outbound > 0 &&
    (!session?.returnScheduleId ||
      (holdCounts.return > 0 && holdCounts.return === holdCounts.outbound)) &&
    !expired;

  const continueBooking = () => {
    if (!canContinue) {
      toast.error(
        session?.returnScheduleId
          ? "Số ghế lượt đi và lượt về phải bằng nhau."
          : "Hãy chọn ít nhất một ghế.",
      );
      return;
    }
    navigate(`/booking/passengers?sessionId=${session.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-[24px] bg-white" />
        <div className="h-40 animate-pulse rounded-[24px] bg-white" />
        <div className="h-[520px] animate-pulse rounded-[24px] bg-[#071a2b]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-white p-10 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Không thể mở sơ đồ ghế
        </h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white"
        >
          Quay lại danh sách chuyến
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 xl:pb-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Chọn chuyến khác
      </button>

      <JourneyHeader
        schedule={currentMap?.schedule}
        expiresAt={session?.expiresAt}
        now={now}
        connectionState={connectionState}
      />

      {session?.returnScheduleId && (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["outbound", `Lượt đi · ${holdCounts.outbound} ghế`],
            ["return", `Lượt về · ${holdCounts.return} ghế`],
          ].map(([leg, label]) => (
            <button
              key={leg}
              type="button"
              onClick={() => {
                setActiveLeg(leg);
                const nextMap = seatMaps[leg];
                setActiveCarriageId(nextMap?.carriages[0]?.id || "");
              }}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                activeLeg === leg
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <TrainOverview
        carriages={carriages}
        activeId={activeCarriage?.id}
        onSelect={setActiveCarriageId}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="blueprint-board overflow-hidden rounded-[28px] border border-cyan-300/20 text-white shadow-[0_24px_80px_rgba(7,26,43,0.18)]">
          <div className="flex flex-col gap-4 border-b border-cyan-200/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-utility-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                Mặt bằng kỹ thuật · Toa{" "}
                {String(activeCarriage?.carriageNumber || "").padStart(2, "0")}
              </p>
              <h2 className="mt-1 font-headline-md text-xl font-bold">
                {activeCarriage?.carriageTypeName}
              </h2>
            </div>
            <div className="flex items-center gap-4 font-utility-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100/60">
              <span className="flex items-center gap-1.5">
                <DoorOpen className="h-4 w-4" /> Cửa lên tàu
              </span>
              <span className="flex items-center gap-1.5">
                <Luggage className="h-4 w-4" /> Hành lý
              </span>
            </div>
          </div>

          <div className="blueprint-dimension h-2 opacity-40" />
          <div className="p-4 sm:p-6">
            <div className="blueprint-carriage rounded-[38px] border border-cyan-200/25 px-4 py-7 sm:px-8">
              <div className="mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 text-cyan-100/55">
                <DoorOpen className="h-5 w-5" />
                <div className="border-t border-dashed border-cyan-200/30" />
                <div className="flex items-center gap-2">
                  <PlugZap className="h-4 w-4" />
                  <Luggage className="h-4 w-4" />
                </div>
              </div>

              {activeCarriage ? (
                <SeatGrid
                  carriage={activeCarriage}
                  onToggle={toggleSeat}
                  busySeatId={busySeatId}
                />
              ) : (
                <div className="py-20 text-center text-cyan-100/50">
                  Toa này chưa có sơ đồ ghế.
                </div>
              )}

              <div className="mt-7 flex items-center gap-4 text-cyan-100/45">
                <DoorOpen className="h-5 w-5" />
                <div className="flex-1 border-t border-dashed border-cyan-200/30" />
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="border-t border-cyan-200/15 px-5 py-4">
            <Legend />
          </div>
        </section>

        <BookingCart
          session={session}
          activeLeg={activeLeg}
          onRemove={removeHold}
          onContinue={continueBooking}
          canContinue={canContinue}
        />
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur xl:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900">
              {session?.holds?.length || 0} ghế ·{" "}
              {money(
                session?.holds?.reduce(
                  (sum, hold) => sum + Number(hold.priceSnapshot),
                  0,
                ),
              )}
            </p>
            <p className="truncate text-[10px] font-semibold text-slate-500">
              {session?.returnScheduleId
                ? `Lượt đi ${holdCounts.outbound} · Lượt về ${holdCounts.return}`
                : "Giữ chỗ đến khi đồng hồ kết thúc"}
            </p>
          </div>
          <button
            type="button"
            disabled={!canContinue}
            onClick={continueBooking}
            className="rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            Tiếp tục
          </button>
        </div>
      </div>

      {expired && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 text-center shadow-2xl">
            <Clock3 className="mx-auto h-9 w-9 text-amber-500" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Phiên giữ ghế đã hết hạn
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Các ghế đã được trả lại để hành khách khác có thể đặt.
            </p>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Chọn lại chuyến
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
*/

export function SeatSelectionPage({
  embedded = false,
  journeyOverride = null,
  restoredSessionIdOverride = "",
  onBack,
  onSessionReady,
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const outboundScheduleId =
    journeyOverride?.outbound?.scheduleId ||
    searchParams.get("outboundScheduleId");
  const outboundFromStationId =
    journeyOverride?.outbound?.fromStationId ||
    searchParams.get("outboundFromStationId");
  const outboundToStationId =
    journeyOverride?.outbound?.toStationId ||
    searchParams.get("outboundToStationId");
  const returnScheduleId =
    journeyOverride?.return?.scheduleId || searchParams.get("returnScheduleId");
  const returnFromStationId =
    journeyOverride?.return?.fromStationId ||
    searchParams.get("returnFromStationId");
  const returnToStationId =
    journeyOverride?.return?.toStationId ||
    searchParams.get("returnToStationId");
  const restoredSessionId =
    restoredSessionIdOverride || searchParams.get("sessionId");

  const journeyPayload = useMemo(
    () => ({
      outbound: {
        scheduleId: outboundScheduleId,
        fromStationId: outboundFromStationId,
        toStationId: outboundToStationId,
      },
      return: returnScheduleId
        ? {
            scheduleId: returnScheduleId,
            fromStationId: returnFromStationId,
            toStationId: returnToStationId,
          }
        : null,
    }),
    [
      outboundScheduleId,
      outboundFromStationId,
      outboundToStationId,
      returnScheduleId,
      returnFromStationId,
      returnToStationId,
    ],
  );

  const [session, setSession] = useState(null);
  const [draftSelections, setDraftSelections] = useState({
    outbound: [],
    return: [],
  });
  const [seatMaps, setSeatMaps] = useState({});
  const [activeLeg, setActiveLeg] = useState("outbound");
  const [activeCarriageId, setActiveCarriageId] = useState("");
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [connectionState, setConnectionState] = useState("connecting");
  const [expired, setExpired] = useState(false);

  const currentJourney =
    activeLeg === "outbound" ? journeyPayload.outbound : journeyPayload.return;
  const currentMap = seatMaps[activeLeg];
  const carriages = currentMap?.carriages || [];
  const activeCarriage =
    carriages.find((carriage) => carriage.id === activeCarriageId) ||
    carriages[0];
  const activeDraftIds = useMemo(
    () => new Set(draftSelections[activeLeg].map((seat) => seat.id)),
    [activeLeg, draftSelections],
  );
  const displayCarriage = activeCarriage
    ? {
        ...activeCarriage,
        seats: activeCarriage.seats.map((seat) => ({
          ...seat,
          state: activeDraftIds.has(seat.id) ? "DRAFT_SELECTED" : seat.state,
        })),
      }
    : null;

  const setSessionQuery = useCallback(
    (sessionId) => {
      if (embedded) return;
      const next = new URLSearchParams(searchParams);
      if (sessionId) next.set("sessionId", sessionId);
      else next.delete("sessionId");
      setSearchParams(next, { replace: true });
    },
    [embedded, searchParams, setSearchParams],
  );

  const loadMap = useCallback(
    async (leg, sessionId = null) => {
      const journey =
        leg === "outbound" ? journeyPayload.outbound : journeyPayload.return;
      if (!journey) return;
      const { data } = await seatSelectionApi.getSeatMap({
        ...journey,
        sessionId,
      });
      setSeatMaps((previous) => ({ ...previous, [leg]: data }));
      setActiveCarriageId((current) => current || data.carriages[0]?.id || "");
    },
    [journeyPayload],
  );

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      if (
        !outboundScheduleId ||
        !outboundFromStationId ||
        !outboundToStationId
      ) {
        setError("Thông tin chuyến chưa đầy đủ. Hãy chọn lại chuyến tàu.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        let restored = null;
        if (restoredSessionId) {
          const { data } = await seatSelectionApi.getSession(restoredSessionId);
          if (
            data.session.status === "ACTIVE" &&
            new Date(data.session.expiresAt).getTime() > Date.now()
          ) {
            restored = data.session;
          }
        }
        if (cancelled) return;
        setSession(restored);
        if (restoredSessionId && !restored) setSessionQuery(null);
        await Promise.all([
          loadMap("outbound", restored?.id),
          journeyPayload.return
            ? loadMap("return", restored?.id)
            : Promise.resolve(),
        ]);
      } catch (requestError) {
        if (restoredSessionId && requestError.response?.status === 404) {
          setSessionQuery(null);
          await Promise.all([
            loadMap("outbound"),
            journeyPayload.return ? loadMap("return") : Promise.resolve(),
          ]);
        } else if (!cancelled) {
          setError(
            requestError.response?.data?.message ||
              "Không thể mở sơ đồ ghế của chuyến.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    start();
    return () => {
      cancelled = true;
    };
  }, [
    journeyPayload.return,
    loadMap,
    outboundFromStationId,
    outboundScheduleId,
    outboundToStationId,
    restoredSessionId,
    setSessionQuery,
  ]);

  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (session?.expiresAt && new Date(session.expiresAt).getTime() <= now) {
      setExpired(true);
    }
  }, [now, session?.expiresAt]);

  useEffect(() => {
    const socket = createSeatSocket();
    const scheduleIds = [
      journeyPayload.outbound.scheduleId,
      journeyPayload.return?.scheduleId,
    ].filter(Boolean);

    const refreshSchedule = (scheduleId) => {
      if (scheduleId === journeyPayload.outbound.scheduleId) {
        loadMap("outbound", session?.id);
      }
      if (scheduleId === journeyPayload.return?.scheduleId) {
        loadMap("return", session?.id);
      }
    };

    socket.on("connect", () => {
      setConnectionState("connected");
      scheduleIds.forEach((scheduleId) =>
        socket.emit("schedule:join", scheduleId),
      );
    });
    socket.on("disconnect", () => setConnectionState("reconnecting"));
    socket.on("connect_error", () => setConnectionState("reconnecting"));
    socket.on("seat:state", ({ scheduleId, seatId, state }) => {
      if (!session && ["LOCKED", "SOLD"].includes(state)) {
        const leg =
          scheduleId === journeyPayload.outbound.scheduleId
            ? "outbound"
            : "return";
        setDraftSelections((previous) => {
          const wasSelected = previous[leg].some((seat) => seat.id === seatId);
          if (!wasSelected) return previous;
          toast.warning("Một ghế đang chọn vừa được người khác giữ.");
          return {
            ...previous,
            [leg]: previous[leg].filter((seat) => seat.id !== seatId),
          };
        });
      }
      refreshSchedule(scheduleId);
    });
    socket.on("session:expired", ({ sessionId }) => {
      if (sessionId === session?.id) setExpired(true);
    });

    return () => {
      scheduleIds.forEach((scheduleId) =>
        socket.emit("schedule:leave", scheduleId),
      );
      socket.disconnect();
    };
  }, [journeyPayload, loadMap, session]);

  useEffect(() => {
    if (activeCarriage?.id) setActiveCarriageId(activeCarriage.id);
  }, [activeCarriage?.id]);

  const toggleSeat = (seat) => {
    if (session || expired || !currentJourney) return;
    setDraftSelections((previous) => {
      const selected = previous[activeLeg];
      const exists = selected.some((item) => item.id === seat.id);
      if (!exists && selected.length >= 4) {
        toast.error("Mỗi lượt chỉ được chọn tối đa 4 ghế.");
        return previous;
      }
      return {
        ...previous,
        [activeLeg]: exists
          ? selected.filter((item) => item.id !== seat.id)
          : [
              ...selected,
              {
                ...seat,
                scheduleId: currentJourney.scheduleId,
              },
            ],
      };
    });
  };

  const counts = {
    outbound: session
      ? session.holds.filter(
          (hold) => hold.scheduleId === session.outboundScheduleId,
        ).length
      : draftSelections.outbound.length,
    return: session
      ? session.holds.filter(
          (hold) => hold.scheduleId === session.returnScheduleId,
        ).length
      : draftSelections.return.length,
  };
  const canConfirm =
    !session &&
    counts.outbound > 0 &&
    (!journeyPayload.return ||
      (counts.return > 0 && counts.return === counts.outbound));

  const cartItems = session
    ? session.holds.map((hold) => ({
        id: hold.seatId,
        scheduleId: hold.scheduleId,
        leg:
          hold.scheduleId === session.outboundScheduleId
            ? "outbound"
            : "return",
        carriageNumber: hold.seat.carriage.carriageNumber,
        seatNumber: hold.seat.seatNumber,
        price: hold.priceSnapshot,
      }))
    : ["outbound", "return"].flatMap((leg) =>
        draftSelections[leg].map((seat) => ({
          ...seat,
          leg,
        })),
      );
  const total = cartItems.reduce((sum, item) => sum + Number(item.price), 0);

  const confirmSelection = async () => {
    if (!canConfirm) return;
    setConfirming(true);
    try {
      const payload = {
        outbound: {
          ...journeyPayload.outbound,
          seatIds: draftSelections.outbound.map((seat) => seat.id),
        },
        return: journeyPayload.return
          ? {
              ...journeyPayload.return,
              seatIds: draftSelections.return.map((seat) => seat.id),
            }
          : null,
      };
      const { data } = await seatSelectionApi.confirmSelection(payload);
      setSession(data.session);
      setDraftSelections({ outbound: [], return: [] });
      setConfirmOpen(false);
      setSessionQuery(data.session.id);
      setNow(Date.now());
      await Promise.all([
        loadMap("outbound", data.session.id),
        journeyPayload.return
          ? loadMap("return", data.session.id)
          : Promise.resolve(),
      ]);
      toast.success("Đã giữ toàn bộ ghế trong 10 phút.");
    } catch (requestError) {
      const conflictSeatIds =
        requestError.response?.data?.conflictSeatIds || [];
      if (conflictSeatIds.length > 0) {
        const conflicts = new Set(conflictSeatIds);
        setDraftSelections((previous) => ({
          outbound: previous.outbound.filter((seat) => !conflicts.has(seat.id)),
          return: previous.return.filter((seat) => !conflicts.has(seat.id)),
        }));
      }
      setConfirmOpen(false);
      await Promise.all([
        loadMap("outbound"),
        journeyPayload.return ? loadMap("return") : Promise.resolve(),
      ]);
      toast.error(
        requestError.response?.data?.message ||
          "Không thể giữ toàn bộ ghế đã chọn.",
      );
    } finally {
      setConfirming(false);
    }
  };

  const changeSeats = async () => {
    if (!session) return;
    try {
      await seatSelectionApi.releaseSession(session.id);
      setSession(null);
      setExpired(false);
      setSessionQuery(null);
      await Promise.all([
        loadMap("outbound"),
        journeyPayload.return ? loadMap("return") : Promise.resolve(),
      ]);
      toast.success("Đã giải phóng ghế. Bạn có thể chọn lại.");
    } catch (requestError) {
      toast.error(
        requestError.response?.data?.message || "Không thể giải phóng ghế.",
      );
    }
  };

  const resetExpired = async () => {
    setSession(null);
    setExpired(false);
    setSessionQuery(null);
    setDraftSelections({ outbound: [], return: [] });
    await Promise.all([
      loadMap("outbound"),
      journeyPayload.return ? loadMap("return") : Promise.resolve(),
    ]);
  };

  const continueBooking = () => {
    if (!session || expired) return;
    if (onSessionReady) {
      onSessionReady(session);
      return;
    }
    navigate(`/booking/passengers?sessionId=${session.id}`);
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-28 animate-pulse rounded-[24px] bg-white" />
        <div className="h-40 animate-pulse rounded-[24px] bg-white" />
        <div className="h-[520px] animate-pulse rounded-[24px] bg-[#071a2b]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[24px] border border-red-200 bg-white p-10 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-red-500" />
        <h1 className="mt-4 text-xl font-bold text-slate-900">
          Không thể mở sơ đồ ghế
        </h1>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white"
        >
          Quay lại danh sách chuyến
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-24 xl:pb-8">
      <button
        type="button"
        onClick={() => (onBack ? onBack() : navigate(-1))}
        className="flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" />
        Chọn chuyến khác
      </button>

      <JourneyHeader
        schedule={currentMap?.schedule}
        expiresAt={session?.expiresAt}
        now={now}
        connectionState={connectionState}
        sessionActive={Boolean(session) && !expired}
      />

      {journeyPayload.return && (
        <div className="grid grid-cols-2 gap-3">
          {[
            ["outbound", `Lượt đi · ${counts.outbound} ghế`],
            ["return", `Lượt về · ${counts.return} ghế`],
          ].map(([leg, label]) => (
            <button
              key={leg}
              type="button"
              onClick={() => {
                setActiveLeg(leg);
                setActiveCarriageId(seatMaps[leg]?.carriages[0]?.id || "");
              }}
              className={`rounded-2xl border px-4 py-3 text-sm font-bold ${
                activeLeg === leg
                  ? "border-primary bg-primary text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <TrainOverview
        carriages={carriages}
        activeId={activeCarriage?.id}
        onSelect={setActiveCarriageId}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="blueprint-board overflow-hidden rounded-[28px] border border-cyan-300/20 text-white shadow-[0_24px_80px_rgba(7,26,43,0.18)]">
          <div className="flex flex-col gap-4 border-b border-cyan-200/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-utility-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300">
                Mặt bằng kỹ thuật · Toa{" "}
                {String(activeCarriage?.carriageNumber || "").padStart(2, "0")}
              </p>
              <h2 className="mt-1 font-headline-md text-xl font-bold">
                {activeCarriage?.carriageTypeName}
              </h2>
            </div>
            <div className="flex items-center gap-4 font-utility-mono text-[10px] uppercase tracking-[0.12em] text-cyan-100/60">
              <span className="flex items-center gap-1.5">
                <DoorOpen className="h-4 w-4" /> Cửa lên tàu
              </span>
              <span className="flex items-center gap-1.5">
                <Luggage className="h-4 w-4" /> Hành lý
              </span>
            </div>
          </div>

          <div className="blueprint-dimension h-2 opacity-40" />
          <div className="p-4 sm:p-6">
            <div className="blueprint-carriage rounded-[38px] border border-cyan-200/25 px-4 py-7 sm:px-8">
              <div className="mb-6 grid grid-cols-[auto_1fr_auto] items-center gap-4 text-cyan-100/55">
                <DoorOpen className="h-5 w-5" />
                <div className="border-t border-dashed border-cyan-200/30" />
                <div className="flex items-center gap-2">
                  <PlugZap className="h-4 w-4" />
                  <Luggage className="h-4 w-4" />
                </div>
              </div>

              {displayCarriage ? (
                <SeatGrid
                  carriage={displayCarriage}
                  onToggle={toggleSeat}
                  busySeatId=""
                  selectionLocked={Boolean(session)}
                />
              ) : (
                <div className="py-20 text-center text-cyan-100/50">
                  Toa này chưa có sơ đồ ghế.
                </div>
              )}

              <div className="mt-7 flex items-center gap-4 text-cyan-100/45">
                <DoorOpen className="h-5 w-5" />
                <div className="flex-1 border-t border-dashed border-cyan-200/30" />
                <ShieldCheck className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="border-t border-cyan-200/15 px-5 py-4">
            <Legend />
          </div>
        </section>

        <BookingCart
          items={cartItems}
          activeLeg={activeLeg}
          onRemove={(item) =>
            setDraftSelections((previous) => ({
              ...previous,
              [item.leg]: previous[item.leg].filter(
                (seat) => seat.id !== item.id,
              ),
            }))
          }
          onPrimary={session ? continueBooking : () => setConfirmOpen(true)}
          canPrimary={session ? !expired : canConfirm}
          held={Boolean(session)}
          onChangeSeats={changeSeats}
        />
      </div>

      <div className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-2xl backdrop-blur xl:hidden">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-900">
              {cartItems.length} ghế · {money(total)}
            </p>
            <p className="truncate text-[10px] font-semibold text-slate-500">
              {session
                ? "Ghế đã được giữ, đồng hồ đang chạy"
                : journeyPayload.return
                  ? `Lượt đi ${counts.outbound} · Lượt về ${counts.return}`
                  : "Chưa giữ ghế · xác nhận để bắt đầu 10 phút"}
            </p>
          </div>
          <button
            type="button"
            disabled={session ? expired : !canConfirm}
            onClick={session ? continueBooking : () => setConfirmOpen(true)}
            className="rounded-xl bg-primary px-4 py-3 text-xs font-bold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {session ? "Tiếp tục" : "Xác nhận giữ"}
          </button>
        </div>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-utility-mono text-[10px] uppercase tracking-[0.16em] text-primary">
                  Xác nhận giữ chỗ
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">
                  Giữ {cartItems.length} ghế trong 10 phút?
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-sm">
              <div className="flex justify-between font-semibold text-slate-600">
                <span>Lượt đi</span>
                <span>{counts.outbound} ghế</span>
              </div>
              {journeyPayload.return && (
                <div className="mt-2 flex justify-between font-semibold text-slate-600">
                  <span>Lượt về</span>
                  <span>{counts.return} ghế</span>
                </div>
              )}
              <div className="mt-4 flex justify-between border-t border-slate-200 pt-4 font-bold text-slate-900">
                <span>Tổng tạm tính</span>
                <span>{money(total)}</span>
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              Đồng hồ 10 phút chỉ bắt đầu sau khi toàn bộ ghế được giữ thành
              công. Nếu một ghế vừa có người khác giữ, giao dịch sẽ hủy toàn bộ
              và bạn có thể chọn lại.
            </p>
            <button
              type="button"
              disabled={confirming}
              onClick={confirmSelection}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {confirming ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Clock3 className="h-4 w-4" />
              )}
              Xác nhận và bắt đầu giữ chỗ
            </button>
          </div>
        </div>
      )}

      {expired && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[24px] bg-white p-6 text-center shadow-2xl">
            <Clock3 className="mx-auto h-9 w-9 text-amber-500" />
            <h2 className="mt-4 text-xl font-bold text-slate-900">
              Phiên giữ ghế đã hết hạn
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Các ghế đã được trả lại. Bạn có thể chọn ghế mới ngay trên sơ đồ.
            </p>
            <button
              type="button"
              onClick={resetExpired}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white"
            >
              <RefreshCw className="h-4 w-4" />
              Chọn lại ghế
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
