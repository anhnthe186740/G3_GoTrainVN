import { useState, useEffect, useCallback, Fragment, useMemo } from "react";
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
// Hệ số 1.45 để tính đường sắt thực tế (dài hơn đường thẳng)
const RAIL_FACTOR = 1.45;
// Tốc độ trung bình Việt Nam ~55 km/h
const AVG_SPEED_KMH = 55;

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

// ─── On-route validation (Bearing deviation approach) ──────────
// Tính góc phương vị (bearing) từ điểm 1 đến điểm 2 (0° = Bắc, 90° = Đông, ...)
function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const φ1 = toRad(lat1);
  const φ2 = toRad(lat2);
  const y = Math.sin(dLng) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Tính góc lệch nhỏ nhất giữa 2 góc phương vị (0–180°)
function angleDiff(a, b) {
  let diff = Math.abs(a - b) % 360;
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// Ngưỡng lệch góc phương vị tối đa (45° để lọc các ga rẽ hướng quá nhiều)
const MAX_BEARING_DEV = 45;

function isStopOnRoute(startSt, endSt, stopSt) {
  // Chặn ga trùng với ga đầu/cuối tuyến
  if (stopSt.id === startSt.id || stopSt.id === endSt.id) return false;
  // Không có tọa độ → không thể validate, cho qua
  if (!startSt?.latitude || !endSt?.latitude || !stopSt?.latitude) return true;

  // Kiểm tra 1: Từ ga đầu, nhìn về ga trung gian phải cùng hướng với nhìn về ga cuối
  const bStartEnd = bearingDeg(
    startSt.latitude,
    startSt.longitude,
    endSt.latitude,
    endSt.longitude,
  );
  const bStartStop = bearingDeg(
    startSt.latitude,
    startSt.longitude,
    stopSt.latitude,
    stopSt.longitude,
  );
  if (angleDiff(bStartStop, bStartEnd) > MAX_BEARING_DEV) return false;

  // Kiểm tra 2: Từ ga cuối, nhìn về ga trung gian phải cùng hướng với nhìn về ga đầu
  const bEndStart = bearingDeg(
    endSt.latitude,
    endSt.longitude,
    startSt.latitude,
    startSt.longitude,
  );
  const bEndStop = bearingDeg(
    endSt.latitude,
    endSt.longitude,
    stopSt.latitude,
    stopSt.longitude,
  );
  if (angleDiff(bEndStop, bEndStart) > MAX_BEARING_DEV) return false;

  return true;
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
  const [selectedStopIds, setSelectedStopIds] = useState(new Set());
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
    let newForm = { ...routeForm, [field]: value };

    // Đảm bảo ga bắt đầu và ga kết thúc không bao giờ trùng nhau
    if (field === "startStationId" && value === routeForm.endStationId) {
      newForm.endStationId = "";
    } else if (field === "endStationId" && value === routeForm.startStationId) {
      newForm.startStationId = "";
    }

    setRouteForm(newForm);
    setAutoCalcDistance(false);
    setSelectedStopIds(new Set()); // Reset ga trung gian khi đổi ga đầu/cuối
    const startId = newForm.startStationId;
    const endId = newForm.endStationId;
    calcAndFill(startId, endId);
  };

  // ── Eligible intermediate stops (auto-computed) ───────────────
  // Tất cả ga nằm trên tuyến (theo Haversine), trừ ga đầu và ga cuối
  const eligibleStops = useMemo(() => {
    const startSt = stations.find((s) => s.id === routeForm.startStationId);
    const endSt = stations.find((s) => s.id === routeForm.endStationId);
    if (!startSt || !endSt || startSt.id === endSt.id) return [];

    return stations
      .filter((s) => isStopOnRoute(startSt, endSt, s))
      .map((s) => ({
        ...s,
        distanceFromStart:
          startSt.latitude && s.latitude
            ? haversineKm(
                startSt.latitude,
                startSt.longitude,
                s.latitude,
                s.longitude,
              )
            : 0,
      }))
      .sort((a, b) => a.distanceFromStart - b.distanceFromStart);
  }, [stations, routeForm.startStationId, routeForm.endStationId]);

  const toggleStop = (stationId) => {
    setSelectedStopIds((prev) => {
      const next = new Set(prev);
      if (next.has(stationId)) next.delete(stationId);
      else next.add(stationId);
      return next;
    });
  };

  // ── Submit Route ──────────────────────────────────────────────
  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (routeForm.startStationId === routeForm.endStationId) {
      toast.error("Ga khởi hành và ga kết thúc không được trùng nhau.");
      return;
    }
    setRouteSubmitting(true);
    try {
      // Build stations array từ các ga đã chọn, giữ thứ tự theo distanceFromStart
      const selectedStops = eligibleStops
        .filter((s) => selectedStopIds.has(s.id))
        .map((s, idx) => ({
          stationId: s.id,
          stationName: s.stationName,
          stopOrder: idx + 1,
          distanceFromStart: s.distanceFromStart,
        }));

      const payload = {
        ...routeForm,
        distance: parseInt(routeForm.distance),
        estimatedDuration: parseInt(routeForm.estimatedDuration),
        stations: selectedStops,
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
      setSelectedStopIds(new Set());
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
                    {stations
                      .filter((s) => s.id !== routeForm.endStationId)
                      .map((s) => (
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
                    {stations
                      .filter((s) => s.id !== routeForm.startStationId)
                      .map((s) => (
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

              {/* Ga trung gian — Checkbox list tự động */}
              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-2 flex items-center gap-2">
                  Ga dừng trung gian
                  {selectedStopIds.size > 0 && (
                    <span className="bg-[#00629d] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                      {selectedStopIds.size} đã chọn
                    </span>
                  )}
                </label>

                {!routeForm.startStationId || !routeForm.endStationId ? (
                  <p className="text-xs text-[#3f4852]/60 italic text-center py-4 border border-dashed border-[#bec7d4] rounded-xl">
                    Chọn ga khởi hành và ga kết thúc để xem danh sách ga trung
                    gian.
                  </p>
                ) : eligibleStops.length === 0 ? (
                  <p className="text-xs text-[#3f4852]/60 italic text-center py-4 border border-dashed border-[#bec7d4] rounded-xl">
                    Không có ga trung gian phù hợp với tuyến này.
                  </p>
                ) : (
                  <div className="border border-[#bec7d4]/40 rounded-xl overflow-hidden">
                    <div className="max-h-52 overflow-y-auto divide-y divide-[#bec7d4]/20">
                      {eligibleStops.map((s) => {
                        const checked = selectedStopIds.has(s.id);
                        return (
                          <label
                            key={s.id}
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              checked ? "bg-[#cfe5ff]/30" : "hover:bg-[#f7f9fb]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleStop(s.id)}
                              className="accent-[#00629d] w-4 h-4 flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[#191c1e] truncate">
                                {s.stationName}
                              </p>
                              {s.city && (
                                <p className="text-[10px] text-[#3f4852]/70">
                                  {s.city}
                                </p>
                              )}
                            </div>
                            {s.distanceFromStart > 0 && (
                              <span className="text-[10px] text-[#00629d] font-semibold bg-[#cfe5ff]/50 px-1.5 py-0.5 rounded-full flex-shrink-0 whitespace-nowrap">
                                {s.distanceFromStart} km
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <div className="px-3 py-2 bg-[#f7f9fb] border-t border-[#bec7d4]/20 flex items-center justify-between">
                      <span className="text-[10px] text-[#3f4852]/60">
                        {eligibleStops.length} ga khả dụng · Sắp theo khoảng
                        cách
                      </span>
                      {selectedStopIds.size > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedStopIds(new Set())}
                          className="text-[10px] text-[#ba1a1a] hover:underline font-semibold"
                        >
                          Bỏ chọn tất cả
                        </button>
                      )}
                    </div>
                  </div>
                )}
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
                          <div className="flex flex-col gap-1.5">
                            <span className="font-semibold text-xs text-[#00629d]">
                              {(r.stations?.length || 0) + 2} ga dừng:
                            </span>
                            <div className="flex flex-wrap gap-1 items-center max-w-[300px]">
                              {/* Ga khởi hành */}
                              <span className="px-1.5 py-0.5 bg-[#f2f4f6] text-[#3f4852] rounded text-[10px] font-medium">
                                {r.startStation?.stationName || "Ga đi"}
                              </span>

                              {/* Các ga trung gian */}
                              {r.stations &&
                                r.stations.length > 0 &&
                                [...r.stations]
                                  .sort((a, b) => a.stopOrder - b.stopOrder)
                                  .map((s, idx) => (
                                    <Fragment key={idx}>
                                      <span className="text-[10px] text-[#6f7883]">
                                        →
                                      </span>
                                      <span
                                        className="px-1.5 py-0.5 bg-[#cfe5ff]/50 text-[#00629d] rounded text-[10px] font-medium cursor-help"
                                        title={`Cách ga khởi hành ${s.distanceFromStart} km`}
                                      >
                                        {s.stationName}
                                      </span>
                                    </Fragment>
                                  ))}

                              {/* Ga kết thúc */}
                              <span className="text-[10px] text-[#6f7883]">
                                →
                              </span>
                              <span className="px-1.5 py-0.5 bg-[#f2f4f6] text-[#3f4852] rounded text-[10px] font-medium">
                                {r.endStation?.stationName || "Ga đến"}
                              </span>
                            </div>
                          </div>
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
                  Thời gian nghỉ tại mỗi ga (phút)
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
                  Thời gian dừng nghỉ tại mỗi ga (bao gồm ga trung gian và ga
                  cuối).
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
