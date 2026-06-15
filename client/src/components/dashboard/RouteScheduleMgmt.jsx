import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../../services/api";
import {
  getRoutes,
  getSchedules,
  getStations,
  getTrains,
} from "../../services/referenceDataApi";

// ─── Helpers ───────────────────────────────────────────────────
const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDuration = (minutes) => {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const STATUS_BADGE = {
  ACTIVE: "bg-green-100 text-green-700",
  CANCELLED: "bg-[#ffdad6] text-[#ba1a1a]",
  DELAYED: "bg-yellow-100 text-yellow-700",
};

// ─── Haversine distance calculator (returns km) ──────────────
// Hệ số 1.2 để tính đường sắt thực tế (dài hơn đường thẳng)
const RAIL_FACTOR = 1.2;
// Tốc độ tàu SE trung bình Việt Nam ~80 km/h
const AVG_SPEED_KMH = 80;

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * RAIL_FACTOR);
}

// ─── On-route validation (detour ratio) ────────────────────────
// Nếu đi qua ga trung gian làm tăng quãng đường > 50% so với đường thẳng
// thì ga đó không thuộc tuyến đường này.
const DETOUR_THRESHOLD = 1.5;

function isStopOnRoute(startSt, endSt, stopSt) {
  if (!startSt?.latitude || !endSt?.latitude || !stopSt?.latitude) return true; // không có tọa độ → bỏ qua
  const direct = haversineKm(
    startSt.latitude,
    startSt.longitude,
    endSt.latitude,
    endSt.longitude,
  );
  if (direct === 0) return true;
  const viaStop =
    haversineKm(
      startSt.latitude,
      startSt.longitude,
      stopSt.latitude,
      stopSt.longitude,
    ) +
    haversineKm(
      stopSt.latitude,
      stopSt.longitude,
      endSt.latitude,
      endSt.longitude,
    );
  return viaStop / direct <= DETOUR_THRESHOLD;
}

// ─── Tabs ───────────────────────────────────────────────────────
const TABS = ["Tuyến Đường", "Lịch Trình"];

// ═══════════════════════════════════════════════════════════════
export function RouteScheduleMgmt({ mode }) {
  const [activeTab, setActiveTab] = useState("Tuyến Đường");

  // Reference data
  const [stations, setStations] = useState([]);
  const [trains, setTrains] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loadingRef, setLoadingRef] = useState(true);

  // Route form state
  const [routeForm, setRouteForm] = useState({
    routeName: "",
    startStationId: "",
    endStationId: "",
    distance: "",
    estimatedDuration: "",
  });
  const [autoCalcDistance, setAutoCalcDistance] = useState(false);
  const [intermediateStops, setIntermediateStops] = useState([]);
  const [routeSubmitting, setRouteSubmitting] = useState(false);

  // Schedule form state
  const [schedForm, setSchedForm] = useState({
    routeId: "",
    trainId: "",
    startDate: "",
    endDate: "",
    departureTimes: "08:00",
    bufferMinutes: "60",
  });
  const [schedSubmitting, setSchedSubmitting] = useState(false);
  const [conflicts, setConflicts] = useState([]);

  // ── Load reference data ───────────────────────────────────────
  const loadAll = useCallback(async ({ force = false } = {}) => {
    setLoadingRef(true);
    const requests = [
      ["stations", getStations({ force })],
      ["trains", getTrains({ force })],
      ["routes", getRoutes({ force })],
      ["schedules", getSchedules({ force })],
    ];
    const results = await Promise.allSettled(
      requests.map(([, request]) => request),
    );
    const failed = [];

    results.forEach((result, index) => {
      const resource = requests[index][0];
      if (result.status === "rejected") {
        failed.push(resource);
        return;
      }

      if (resource === "stations") {
        setStations(result.value.stations || []);
      } else if (resource === "trains") {
        setTrains(result.value.trains || []);
      } else if (resource === "routes") {
        setRoutes(result.value.routes || []);
      } else {
        setSchedules(result.value.schedules || []);
      }
    });

    if (failed.length > 0) {
      toast.error(`Không thể tải: ${failed.join(", ")}.`);
    }
    setLoadingRef(false);
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Auto-calculate distance & duration when both stations selected ──
  const calcAndFill = useCallback(
    (startId, endId) => {
      if (!startId || !endId || startId === endId) return;
      const s = stations.find((x) => x.id === startId);
      const e = stations.find((x) => x.id === endId);
      if (!s?.latitude || !e?.latitude) return;

      const km = haversineKm(s.latitude, s.longitude, e.latitude, e.longitude);
      const mins = Math.round((km / AVG_SPEED_KMH) * 60);

      setRouteForm((prev) => ({
        ...prev,
        distance: String(km),
        estimatedDuration: String(mins),
      }));
      setAutoCalcDistance(true);
      toast.info(
        `📍 Tự động tính: ${km} km · ~${formatDuration(mins)} (tốc độ trung bình ${AVG_SPEED_KMH} km/h)`,
        {
          duration: 4000,
        },
      );
    },
    [stations],
  );

  const handleStationChange = (field, value) => {
    const newForm = { ...routeForm, [field]: value };
    setRouteForm(newForm);
    setAutoCalcDistance(false);
    // Trigger auto-calc when both are set
    const startId = field === "startStationId" ? value : newForm.startStationId;
    const endId = field === "endStationId" ? value : newForm.endStationId;
    calcAndFill(startId, endId);
  };

  // ── Intermediate stops helpers ────────────────────────────────
  const addStop = () =>
    setIntermediateStops((prev) => [
      ...prev,
      {
        stationId: "",
        stationName: "",
        stopOrder: prev.length + 1,
        distanceFromStart: "",
      },
    ]);

  const removeStop = (i) =>
    setIntermediateStops((prev) =>
      prev
        .filter((_, idx) => idx !== i)
        .map((s, idx) => ({ ...s, stopOrder: idx + 1 })),
    );

  const updateStop = (i, field, value) =>
    setIntermediateStops((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], [field]: value };
      if (field === "stationId") {
        const st = stations.find((s) => s.id === value);
        updated[i].stationName = st ? st.stationName : "";
        // Auto-fill distanceFromStart for stop based on haversine from start station
        if (st?.latitude && routeForm.startStationId) {
          const startSt = stations.find(
            (s) => s.id === routeForm.startStationId,
          );
          if (startSt?.latitude) {
            updated[i].distanceFromStart = String(
              haversineKm(
                startSt.latitude,
                startSt.longitude,
                st.latitude,
                st.longitude,
              ),
            );
          }
        }
      }
      return updated;
    });

  // ── Validate intermediate stops are geographically on route ──
  const getInvalidStops = useCallback(() => {
    const startSt = stations.find((s) => s.id === routeForm.startStationId);
    const endSt = stations.find((s) => s.id === routeForm.endStationId);
    if (!startSt || !endSt) return [];
    return intermediateStops
      .map((stop, i) => {
        const stopSt = stations.find((s) => s.id === stop.stationId);
        if (!stopSt) return null;
        return isStopOnRoute(startSt, endSt, stopSt)
          ? null
          : { i, name: stopSt.stationName };
      })
      .filter(Boolean);
  }, [
    stations,
    routeForm.startStationId,
    routeForm.endStationId,
    intermediateStops,
  ]);

  // ── Submit Route ──────────────────────────────────────────────
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (routeForm.startStationId === routeForm.endStationId) {
      toast.error("Ga khởi hành và ga kết thúc không được trùng nhau.");
      return;
    }
    // Validate intermediate stops are on route
    const invalidStops = getInvalidStops();
    if (invalidStops.length > 0) {
      toast.error(
        `Ga trung gian không nằm trên tuyến đường: ${invalidStops.map((s) => s.name).join(", ")}. Vui lòng chọn ga phù hợp với lộ trình.`,
        { duration: 6000 },
      );
      return;
    }
    setRouteSubmitting(true);
    try {
      const payload = {
        ...routeForm,
        distance: parseInt(routeForm.distance),
        estimatedDuration: parseInt(routeForm.estimatedDuration),
        stations: intermediateStops.map((s) => ({
          ...s,
          distanceFromStart: parseInt(s.distanceFromStart) || 0,
        })),
      };
      await api.post("/routes/auto-generate", payload);
      toast.success("Tuyến đường đã được tạo thành công!");
      setRouteForm({
        routeName: "",
        startStationId: "",
        endStationId: "",
        distance: "",
        estimatedDuration: "",
      });
      setIntermediateStops([]);
      setAutoCalcDistance(false);
      loadAll({ force: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi tạo tuyến đường.");
    } finally {
      setRouteSubmitting(false);
    }
  };

  // ── Submit Schedules ──────────────────────────────────────────
  const handleCreateSchedules = async (e) => {
    e.preventDefault();
    setConflicts([]);
    setSchedSubmitting(true);
    try {
      const departureTimes = schedForm.departureTimes
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await api.post("/schedules/auto-generate", {
        ...schedForm,
        departureTimes,
        bufferMinutes: parseInt(schedForm.bufferMinutes),
      });
      const { message, conflicts: c = [] } = res.data;
      toast.success(message);
      if (c.length > 0) setConflicts(c);
      setSchedForm({
        routeId: "",
        trainId: "",
        startDate: "",
        endDate: "",
        departureTimes: "08:00",
        bufferMinutes: "60",
      });
      loadAll({ force: true });
    } catch (err) {
      const { message, conflicts: c = [] } = err.response?.data || {};
      toast.error(message || "Lỗi khi tạo lịch trình.");
      if (c.length > 0) setConflicts(c);
    } finally {
      setSchedSubmitting(false);
    }
  };

  // ── Delete Route ──────────────────────────────────────────────
  const handleDeleteRoute = async (id, name) => {
    if (!window.confirm(`Vô hiệu hóa tuyến đường "${name}"?`)) return;
    try {
      await api.delete(`/routes/${id}`);
      toast.success("Đã vô hiệu hóa tuyến đường.");
      loadAll({ force: true });
    } catch {
      toast.error("Lỗi khi xóa tuyến đường.");
    }
  };

  // ═══════════════════════════════════════════════════════════════
  const isRouteMode = mode === "route";
  const isScheduleMode = mode === "schedule";
  const displayTitle = isRouteMode
    ? "Quản Lý Tuyến Đường"
    : isScheduleMode
      ? "Quản Lý Lịch Trình"
      : "Quản Lý Tuyến Đường & Lịch Trình";
  const displaySubtitle = isRouteMode
    ? "Quản lý lộ trình các tuyến tàu và các ga dừng trung gian."
    : isScheduleMode
      ? "Tự động sinh lịch trình chạy tàu với kiểm tra xung đột thông minh."
      : "Quản lý các tuyến đường và tự động tạo lịch trình chạy tàu.";

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e]">{displayTitle}</h2>
          <p className="text-sm text-[#3f4852] mt-1">{displaySubtitle}</p>
        </div>
        <button
          onClick={() => loadAll({ force: true })}
          className="flex items-center gap-1.5 bg-[#f2f4f6] hover:bg-[#eceef0] text-[#3f4852] px-4 py-2 rounded-xl font-semibold text-sm transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">refresh</span>
          Tải lại
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Tổng tuyến đường",
            value: routes.length,
            icon: "route",
            color: "text-[#00629d] bg-[#cfe5ff]/40",
            show: !mode || isRouteMode,
          },
          {
            label: "Tuyến đang hoạt động",
            value: routes.filter((r) => r.isActive).length,
            icon: "check_circle",
            color: "text-green-700 bg-green-100",
            show: !mode || isRouteMode,
          },
          {
            label: "Tổng lịch trình",
            value: schedules.length,
            icon: "calendar_month",
            color: "text-purple-700 bg-purple-100",
            show: !mode || isScheduleMode,
          },
          {
            label: "Chuyến ACTIVE",
            value: schedules.filter((s) => s.status === "ACTIVE").length,
            icon: "train",
            color: "text-[#00629d] bg-[#d6e5ef]",
            show: !mode || isScheduleMode,
          },
        ]
          .filter((stat) => stat.show)
          .map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-4 border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)]"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  <span className="material-symbols-outlined text-[22px]">
                    {stat.icon}
                  </span>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#191c1e]">
                    {stat.value}
                  </p>
                  <p className="text-xs text-[#3f4852]">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Tabs */}
      {!mode && (
        <div className="flex gap-1 bg-[#f2f4f6] p-1 rounded-xl w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
                activeTab === tab
                  ? "bg-white text-[#00629d] shadow-sm"
                  : "text-[#3f4852] hover:text-[#191c1e]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      )}

      {/* ── TAB 1: TUYẾN ĐƯỜNG ── */}
      {(isRouteMode || (!mode && activeTab === "Tuyến Đường")) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form tạo tuyến */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)]">
            <h3 className="font-bold text-lg text-[#191c1e] mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00629d]">
                add_road
              </span>
              Tạo Tuyến Đường Mới
            </h3>
            <form onSubmit={handleCreateRoute} className="space-y-4">
              {/* Tên tuyến */}
              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Tên tuyến đường *
                </label>
                <input
                  required
                  value={routeForm.routeName}
                  onChange={(e) =>
                    setRouteForm({ ...routeForm, routeName: e.target.value })
                  }
                  placeholder="VD: Hà Nội - Sài Gòn Express"
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                />
              </div>

              {/* Ga đi / Ga đến */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Ga khởi hành *
                  </label>
                  <select
                    required
                    value={routeForm.startStationId}
                    onChange={(e) =>
                      handleStationChange("startStationId", e.target.value)
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white"
                  >
                    <option value="">-- Chọn ga --</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.stationName}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Ga kết thúc *
                  </label>
                  <select
                    required
                    value={routeForm.endStationId}
                    onChange={(e) =>
                      handleStationChange("endStationId", e.target.value)
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white"
                  >
                    <option value="">-- Chọn ga --</option>
                    {stations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.stationName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Khoảng cách / Thời gian — auto-filled */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1 flex items-center gap-1">
                    Khoảng cách (km) *
                    {autoCalcDistance && (
                      <span className="text-[10px] bg-[#cfe5ff] text-[#00629d] px-1.5 py-0.5 rounded-full font-bold">
                        Tự động
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="1"
                      value={routeForm.distance}
                      onChange={(e) => {
                        setRouteForm({
                          ...routeForm,
                          distance: e.target.value,
                        });
                        setAutoCalcDistance(false);
                      }}
                      placeholder="Chọn ga để tự động tính"
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none transition-all ${
                        autoCalcDistance
                          ? "border-[#00629d]/40 bg-[#cfe5ff]/10 text-[#00629d] font-semibold"
                          : "border-[#bec7d4]/50"
                      }`}
                    />
                    {autoCalcDistance && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-[#00629d]">
                        location_on
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1 flex items-center gap-1">
                    Thời gian (phút) *
                    {autoCalcDistance && (
                      <span className="text-[10px] bg-[#cfe5ff] text-[#00629d] px-1.5 py-0.5 rounded-full font-bold">
                        Tự động
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      required
                      type="number"
                      min="1"
                      value={routeForm.estimatedDuration}
                      onChange={(e) => {
                        setRouteForm({
                          ...routeForm,
                          estimatedDuration: e.target.value,
                        });
                        setAutoCalcDistance(false);
                      }}
                      placeholder="Chọn ga để tự động tính"
                      className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none transition-all ${
                        autoCalcDistance
                          ? "border-[#00629d]/40 bg-[#cfe5ff]/10 text-[#00629d] font-semibold"
                          : "border-[#bec7d4]/50"
                      }`}
                    />
                    {autoCalcDistance && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-[16px] text-[#00629d]">
                        schedule
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Info banner khi đã auto-calc */}
              {autoCalcDistance && (
                <div className="flex items-start gap-2 p-3 bg-[#cfe5ff]/20 border border-[#00629d]/20 rounded-xl text-xs text-[#00629d]">
                  <span className="material-symbols-outlined text-[16px] flex-shrink-0 mt-0.5">
                    info
                  </span>
                  <span>
                    Khoảng cách và thời gian đã được tính tự động theo toạ độ
                    địa lý (hệ số đường sắt ×{RAIL_FACTOR}, tốc độ TB{" "}
                    {AVG_SPEED_KMH} km/h). Bạn có thể chỉnh sửa thủ công nếu
                    cần.
                  </span>
                </div>
              )}

              {/* Ga trung gian */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[#3f4852]">
                    Ga dừng trung gian
                  </label>
                  <button
                    type="button"
                    onClick={addStop}
                    className="flex items-center gap-1 text-[#00629d] hover:bg-[#cfe5ff]/40 px-2 py-1 rounded-lg text-xs font-semibold transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      add
                    </span>{" "}
                    Thêm ga
                  </button>
                </div>
                {intermediateStops.length === 0 && (
                  <p className="text-xs text-[#3f4852]/60 italic text-center py-3 border border-dashed border-[#bec7d4] rounded-xl">
                    Chưa có ga trung gian. Nhấn "Thêm ga" để bổ sung.
                  </p>
                )}
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {intermediateStops.map((stop, i) => {
                    const stopSt = stations.find(
                      (s) => s.id === stop.stationId,
                    );
                    const startSt = stations.find(
                      (s) => s.id === routeForm.startStationId,
                    );
                    const endSt = stations.find(
                      (s) => s.id === routeForm.endStationId,
                    );
                    const isOffRoute =
                      stop.stationId && startSt && endSt && stopSt
                        ? !isStopOnRoute(startSt, endSt, stopSt)
                        : false;
                    return (
                      <div
                        key={i}
                        className={`flex items-center gap-2 rounded-xl p-2 transition-all ${
                          isOffRoute
                            ? "bg-[#ffdad6]/40 border border-[#ba1a1a]/30"
                            : "bg-[#f2f4f6]"
                        }`}
                      >
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                            isOffRoute
                              ? "bg-[#ba1a1a] text-white"
                              : "bg-[#00629d] text-white"
                          }`}
                        >
                          {isOffRoute ? "!" : stop.stopOrder}
                        </span>
                        <div className="flex-1 min-w-0">
                          <select
                            value={stop.stationId}
                            onChange={(e) =>
                              updateStop(i, "stationId", e.target.value)
                            }
                            className={`w-full border rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 ${
                              isOffRoute
                                ? "border-[#ba1a1a]/40 bg-[#ffdad6]/20 focus:ring-[#ba1a1a]"
                                : "border-[#bec7d4]/40 bg-white focus:ring-[#00a3ff]"
                            }`}
                          >
                            <option value="">Chọn ga</option>
                            {stations.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.stationName}
                              </option>
                            ))}
                          </select>
                          {isOffRoute && (
                            <p className="text-[10px] text-[#ba1a1a] font-semibold mt-0.5 flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">
                                warning
                              </span>
                              Ga này không nằm trên tuyến đường!
                            </p>
                          )}
                        </div>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={stop.distanceFromStart}
                            onChange={(e) =>
                              updateStop(i, "distanceFromStart", e.target.value)
                            }
                            placeholder="km"
                            className="w-20 bg-white border border-[#bec7d4]/40 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-1 focus:ring-[#00a3ff]"
                          />
                          {stop.stationId && stop.distanceFromStart && (
                            <span
                              className="absolute -top-1 -right-1 w-2 h-2 bg-[#00629d] rounded-full"
                              title="Đã tính tự động"
                            />
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeStop(i)}
                          className="text-[#ba1a1a] hover:bg-[#ffdad6]/60 p-1 rounded-lg transition-all"
                        >
                          <span className="material-symbols-outlined text-[16px]">
                            close
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={routeSubmitting || stations.length === 0}
                className="w-full bg-[#00629d] hover:bg-[#00629d]/90 disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {routeSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      add_road
                    </span>
                    Tạo Tuyến Đường
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Danh sách tuyến đường */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#bec7d4]/10">
              <h3 className="font-bold text-lg text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00629d]">
                  route
                </span>
                Danh Sách Tuyến Đường ({routes.length})
              </h3>
            </div>
            {loadingRef ? (
              <div className="flex items-center justify-center py-16 text-[#3f4852]">
                <span className="material-symbols-outlined animate-spin mr-2">
                  progress_activity
                </span>
                Đang tải...
              </div>
            ) : routes.length === 0 ? (
              <div className="text-center py-16 text-[#3f4852]/60">
                <span className="material-symbols-outlined text-5xl block mb-2">
                  route
                </span>
                Chưa có tuyến đường nào.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f2f4f6]/50">
                    <tr>
                      {[
                        "Tuyến đường",
                        "Khoảng cách",
                        "Thời gian",
                        "Ga dừng",
                        "Trạng thái",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-xs font-semibold text-[#3f4852] uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#bec7d4]/10">
                    {routes.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-[#f7f9fb] transition-colors"
                      >
                        <td className="px-5 py-4">
                          <p className="font-semibold text-sm text-[#191c1e]">
                            {r.routeName}
                          </p>
                          <p className="text-xs text-[#3f4852] mt-0.5">
                            {r.startStation?.stationName} →{" "}
                            {r.endStation?.stationName}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-sm">{r.distance} km</td>
                        <td className="px-5 py-4 text-sm">
                          {formatDuration(r.estimatedDuration)}
                        </td>
                        <td className="px-5 py-4 text-sm">
                          {(r.stations?.length || 0) + 2} ga
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${r.isActive ? "bg-green-100 text-green-700" : "bg-[#ffdad6] text-[#ba1a1a]"}`}
                          >
                            {r.isActive ? "Hoạt động" : "Vô hiệu"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => handleDeleteRoute(r.id, r.routeName)}
                            disabled={!r.isActive}
                            className="p-1.5 text-[#ba1a1a] hover:bg-[#ffdad6]/60 rounded-lg disabled:opacity-30 transition-all"
                            title="Vô hiệu hóa"
                          >
                            <span className="material-symbols-outlined text-[18px]">
                              block
                            </span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 2: LỊCH TRÌNH ── */}
      {(isScheduleMode || (!mode && activeTab === "Lịch Trình")) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Form tạo lịch trình */}
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)]">
            <h3 className="font-bold text-lg text-[#191c1e] mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[#00629d]">
                auto_schedule
              </span>
              Tự Động Tạo Lịch Trình
            </h3>
            <form onSubmit={handleCreateSchedules} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Tuyến đường *
                </label>
                <select
                  required
                  value={schedForm.routeId}
                  onChange={(e) =>
                    setSchedForm({ ...schedForm, routeId: e.target.value })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white"
                >
                  <option value="">-- Chọn tuyến đường --</option>
                  {routes
                    .filter((r) => r.isActive)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.routeName} ({r.startStation?.stationName} →{" "}
                        {r.endStation?.stationName})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Tàu hỏa *
                </label>
                <select
                  required
                  value={schedForm.trainId}
                  onChange={(e) =>
                    setSchedForm({ ...schedForm, trainId: e.target.value })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white"
                >
                  <option value="">-- Chọn tàu hỏa --</option>
                  {trains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.trainName} ({t.trainCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Ngày bắt đầu *
                  </label>
                  <input
                    required
                    type="date"
                    value={schedForm.startDate}
                    onChange={(e) =>
                      setSchedForm({ ...schedForm, startDate: e.target.value })
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Ngày kết thúc *
                  </label>
                  <input
                    required
                    type="date"
                    value={schedForm.endDate}
                    min={schedForm.startDate}
                    onChange={(e) =>
                      setSchedForm({ ...schedForm, endDate: e.target.value })
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Giờ xuất phát hàng ngày *
                  <span className="text-[#3f4852]/60 font-normal ml-1">
                    (nhiều giờ cách nhau bằng dấu phẩy)
                  </span>
                </label>
                <input
                  required
                  value={schedForm.departureTimes}
                  onChange={(e) =>
                    setSchedForm({
                      ...schedForm,
                      departureTimes: e.target.value,
                    })
                  }
                  placeholder="08:00, 14:30, 20:00"
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Khoảng giãn cách dọn dẹp (phút)
                </label>
                <input
                  type="number"
                  min="0"
                  value={schedForm.bufferMinutes}
                  onChange={(e) =>
                    setSchedForm({
                      ...schedForm,
                      bufferMinutes: e.target.value,
                    })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                />
                <p className="text-[11px] text-[#3f4852]/60 mt-1">
                  Thời gian tối thiểu giữa 2 chuyến của cùng 1 tàu.
                </p>
              </div>

              <button
                type="submit"
                disabled={
                  schedSubmitting || routes.length === 0 || trains.length === 0
                }
                className="w-full bg-[#00629d] hover:bg-[#00629d]/90 disabled:opacity-60 text-white py-3 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2"
              >
                {schedSubmitting ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">
                      progress_activity
                    </span>
                    Đang tạo...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      auto_schedule
                    </span>
                    Tự Động Tạo Lịch Trình
                  </>
                )}
              </button>
            </form>

            {conflicts.length > 0 && (
              <div className="mt-5 p-4 bg-[#ffdad6]/30 border border-[#ba1a1a]/20 rounded-xl">
                <p className="text-sm font-bold text-[#ba1a1a] flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-[18px]">
                    warning
                  </span>
                  {conflicts.length} lịch trình bị xung đột tàu hỏa:
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {conflicts.map((c, i) => (
                    <div
                      key={i}
                      className="text-xs bg-white rounded-lg p-2 border border-[#ba1a1a]/10"
                    >
                      <p className="font-semibold">
                        Đề xuất: {formatDateTime(c.proposedDeparture)} →{" "}
                        {formatDateTime(c.proposedArrival)}
                      </p>
                      <p className="text-[#ba1a1a] mt-0.5">
                        Trùng với: {formatDateTime(c.conflictingDeparture)} →{" "}
                        {formatDateTime(c.conflictingArrival)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Danh sách lịch trình */}
          <div className="lg:col-span-3 bg-white rounded-2xl border border-[#bec7d4]/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#bec7d4]/10">
              <h3 className="font-bold text-lg text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00629d]">
                  calendar_month
                </span>
                Lịch Trình Đã Tạo ({schedules.length})
              </h3>
            </div>
            {loadingRef ? (
              <div className="flex items-center justify-center py-16 text-[#3f4852]">
                <span className="material-symbols-outlined animate-spin mr-2">
                  progress_activity
                </span>
                Đang tải...
              </div>
            ) : schedules.length === 0 ? (
              <div className="text-center py-16 text-[#3f4852]/60">
                <span className="material-symbols-outlined text-5xl block mb-2">
                  calendar_month
                </span>
                Chưa có lịch trình nào.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-[#f2f4f6]/50">
                    <tr>
                      {[
                        "Tàu",
                        "Tuyến đường",
                        "Khởi hành",
                        "Đến nơi",
                        "Trạng thái",
                      ].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-xs font-semibold text-[#3f4852] uppercase tracking-wide"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#bec7d4]/10">
                    {schedules.slice(0, 30).map((s) => (
                      <tr
                        key={s.id}
                        className="hover:bg-[#f7f9fb] transition-colors"
                      >
                        <td className="px-5 py-3">
                          <p className="font-semibold text-sm text-[#00629d]">
                            {s.train?.trainName}
                          </p>
                          <p className="text-[11px] text-[#3f4852]">
                            {s.train?.trainCode}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-sm">
                          <p className="font-medium">{s.route?.routeName}</p>
                          <p className="text-[11px] text-[#3f4852]">
                            {s.route?.startStation?.stationName} →{" "}
                            {s.route?.endStation?.stationName}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-xs text-[#3f4852]">
                          {formatDateTime(s.departureTime)}
                        </td>
                        <td className="px-5 py-3 text-xs text-[#3f4852]">
                          {formatDateTime(s.arrivalTime)}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${STATUS_BADGE[s.status] || "bg-[#eceef0] text-[#3f4852]"}`}
                          >
                            {s.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {schedules.length > 30 && (
                  <p className="text-center text-xs text-[#3f4852]/60 py-3 border-t border-[#bec7d4]/10">
                    Hiển thị 30/{schedules.length} lịch trình gần nhất.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
