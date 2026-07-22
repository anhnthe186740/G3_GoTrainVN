import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Compass,
  AlertTriangle,
  CheckCircle,
  Activity,
  Maximize2,
  Minimize2,
  RefreshCw,
  Clock,
  User,
  Thermometer,
  Navigation,
  MapPin,
} from "lucide-react";
import { api } from "../../services/api";
import { createSeatSocket } from "../../services/seatSelectionApi";
import { toast } from "sonner";

// Coordinates dictionary for SVG mapping
const STATION_COORDS = {
  HAN: { x: 140, y: 100, label: "Hà Nội" },
  LCA: { x: 50, y: 30, label: "Lào Cai" },
  HPH: { x: 190, y: 110, label: "Hải Phòng" },
  VIN: { x: 130, y: 220, label: "Vinh" },
  DHI: { x: 180, y: 290, label: "Đồng Hới" },
  HUE: { x: 220, y: 340, label: "Huế" },
  DAN: { x: 250, y: 370, label: "Đà Nẵng" },
  QNH: { x: 250, y: 490, label: "Quy Nhơn", align: "left" },
  NTR: { x: 240, y: 570, label: "Nha Trang", align: "left" },
  SGN: { x: 180, y: 640, label: "Sài Gòn" },
};

// Interpolate GPS coordinates and status of the train based on time
function getInterpolatedTracking(item, currentTime = new Date()) {
  const { schedule, tracking } = item;

  // If the schedule is cancelled, return current status
  if (schedule.status === "CANCELLED") {
    return {
      ...tracking,
      speed: 0,
      status: "CANCELLED",
      currentStation: "Lịch chạy bị hủy",
    };
  }

  const depTime = new Date(schedule.departureTime);
  const arrTime = new Date(schedule.arrivalTime);

  // Helper map coordinates fallback
  const mapX = (longitude) => {
    if (!longitude) return 140;
    return ((longitude - 103.0) / 7.0) * 260 + 30;
  };
  const mapY = (latitude) => {
    if (!latitude) return 100;
    return ((23.0 - latitude) / 13.0) * 600 + 40;
  };

  const startCode = schedule.route.startStation.stationCode;
  const startLat = schedule.route.startStation.latitude || 21.0245;
  const startLng = schedule.route.startStation.longitude || 105.8412;
  const startName = schedule.route.startStation.stationName;
  const startCoords = (startCode && STATION_COORDS[startCode]) || {
    x: mapX(startLng),
    y: mapY(startLat),
  };

  const endCode = schedule.route.endStation.stationCode;
  const endLat = schedule.route.endStation.latitude || 10.7769;
  const endLng = schedule.route.endStation.longitude || 106.6952;
  const endName = schedule.route.endStation.stationName;
  const endCoords = (endCode && STATION_COORDS[endCode]) || {
    x: mapX(endLng),
    y: mapY(endLat),
  };

  // 1. Not yet departed
  if (currentTime < depTime) {
    return {
      ...tracking,
      x: startCoords.x,
      y: startCoords.y,
      latitude: startLat,
      longitude: startLng,
      currentStation: startName,
      speed: 0.0,
      status: "CHƯA KHỞI HÀNH",
    };
  }

  // 2. Already completed
  if (currentTime > arrTime) {
    return {
      ...tracking,
      x: endCoords.x,
      y: endCoords.y,
      latitude: endLat,
      longitude: endLng,
      currentStation: endName,
      speed: 0.0,
      status: "COMPLETED",
    };
  }

  // 3. Train is running! Compile route nodes
  const rawNodes = [];
  rawNodes.push({
    code: startCode,
    lat: startLat,
    lng: startLng,
    x: startCoords.x,
    y: startCoords.y,
    name: startName,
    time: depTime,
    type: "START",
  });

  if (schedule.scheduleStops && schedule.scheduleStops.length > 0) {
    const sortedStops = [...schedule.scheduleStops].sort(
      (a, b) => a.stopOrder - b.stopOrder,
    );
    for (const stop of sortedStops) {
      const stopCode = stop.station.stationCode;
      const stopLat = stop.station.latitude || 16.0;
      const stopLng = stop.station.longitude || 108.0;
      const stopCoords = (stopCode && STATION_COORDS[stopCode]) || {
        x: mapX(stopLng),
        y: mapY(stopLat),
      };
      const stopArr = new Date(stop.arrivalTime);
      const stopDep = stop.departureTime
        ? new Date(stop.departureTime)
        : stopArr;
      rawNodes.push({
        code: stopCode,
        lat: stopLat,
        lng: stopLng,
        x: stopCoords.x,
        y: stopCoords.y,
        name: stop.station.stationName,
        time: stopArr,
        depTime: stopDep,
        type: "STOP",
      });
    }
  }

  rawNodes.push({
    code: endCode,
    lat: endLat,
    lng: endLng,
    x: endCoords.x,
    y: endCoords.y,
    name: endName,
    time: arrTime,
    type: "END",
  });

  // Inject HAN node visually if moving between branch stations (HPH, LCA) and southern stations without going through HAN
  const nodes = [];
  for (let i = 0; i < rawNodes.length; i++) {
    const current = rawNodes[i];
    nodes.push(current);

    if (i < rawNodes.length - 1) {
      const next = rawNodes[i + 1];
      const isBranchToMain =
        (current.code === "HPH" || current.code === "LCA") &&
        next.code !== "HAN";
      const isMainToBranch =
        current.code !== "HAN" && (next.code === "HPH" || next.code === "LCA");

      if (isBranchToMain || isMainToBranch) {
        const hanCoords = STATION_COORDS.HAN;
        const currentDepTime =
          current.type === "STOP" ? current.depTime : current.time;
        const d1 = Math.sqrt(
          Math.pow(current.x - hanCoords.x, 2) +
            Math.pow(current.y - hanCoords.y, 2),
        );
        const d2 = Math.sqrt(
          Math.pow(hanCoords.x - next.x, 2) + Math.pow(hanCoords.y - next.y, 2),
        );
        const totalD = d1 + d2;
        const ratio = totalD > 0 ? d1 / totalD : 0.5;

        const currentTimeVal = currentDepTime.getTime();
        const nextTimeVal = next.time.getTime();
        const hanTimeVal =
          currentTimeVal + (nextTimeVal - currentTimeVal) * ratio;
        const hanTime = new Date(hanTimeVal);

        nodes.push({
          code: "HAN",
          lat: 21.0245,
          lng: 105.8412,
          x: hanCoords.x,
          y: hanCoords.y,
          name: "Ga Hà Nội",
          time: hanTime,
          depTime: hanTime,
          type: "STOP",
        });
      }
    }
  }

  // Interpolate current segment
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];

    const currentDep = current.type === "STOP" ? current.depTime : current.time;
    const nextArr = next.time;

    // Check if currently stopped at a station stop
    if (
      current.type === "STOP" &&
      currentTime >= current.time &&
      currentTime < current.depTime
    ) {
      return {
        ...tracking,
        x: current.x,
        y: current.y,
        latitude: current.lat,
        longitude: current.lng,
        currentStation: current.name,
        speed: 0.0,
        status: "ĐANG DỪNG GA",
      };
    }

    // Check if traveling in this segment
    if (currentTime >= currentDep && currentTime < nextArr) {
      const segmentDuration = nextArr.getTime() - currentDep.getTime();
      const elapsed = currentTime.getTime() - currentDep.getTime();
      const progress = segmentDuration > 0 ? elapsed / segmentDuration : 0;

      const x = current.x + (next.x - current.x) * progress;
      const y = current.y + (next.y - current.y) * progress;

      const lat = current.lat + (next.lat - current.lat) * progress;
      const lng = current.lng + (next.lng - current.lng) * progress;

      return {
        ...tracking,
        x,
        y,
        latitude: lat,
        longitude: lng,
        currentStation: `Giữa ${current.name.replace("Ga ", "")} & ${next.name.replace("Ga ", "")}`,
        speed: 55.0,
        status: "ĐANG CHẠY",
      };
    }
  }

  return tracking;
}

// Calculate progress percentage on the horizontal timeline
function getTimelineProgress(item, currentTime = new Date()) {
  const { schedule } = item;
  const depTime = new Date(schedule.departureTime);
  const arrTime = new Date(schedule.arrivalTime);

  if (currentTime <= depTime) return 0;
  if (currentTime >= arrTime) return 100;

  const stops = [
    { time: depTime, type: "START" },
    ...(schedule.scheduleStops || []).map((stop) => ({
      time: new Date(stop.arrivalTime),
      depTime: stop.departureTime
        ? new Date(stop.departureTime)
        : new Date(stop.arrivalTime),
      type: "STOP",
    })),
    { time: arrTime, type: "END" },
  ];

  for (let i = 0; i < stops.length - 1; i++) {
    const currentStop = stops[i];
    const nextStop = stops[i + 1];
    const currentDep =
      currentStop.type === "STOP" ? currentStop.depTime : currentStop.time;
    const nextArr = nextStop.time;

    if (currentTime >= currentStop.time && currentTime < currentDep) {
      return (i / (stops.length - 1)) * 100;
    }

    if (currentTime >= currentDep && currentTime < nextArr) {
      const segDuration = nextArr.getTime() - currentDep.getTime();
      const elapsed = currentTime.getTime() - currentDep.getTime();
      const segProgress = segDuration > 0 ? elapsed / segDuration : 0;
      const totalProgress = i + segProgress;
      return (totalProgress / (stops.length - 1)) * 100;
    }
  }

  return 0;
}

export function AdminLiveTrackingPanel() {
  const [activeTrackings, setActiveTrackings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedTrainId, setSelectedTrainId] = useState(null);

  // Time reference clock for real-time recalculations
  const [timeRef, setTimeRef] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRef(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Map coordinate conversion helpers
  const mapX = useCallback((longitude) => {
    if (!longitude) return 140;
    const minLng = 103.0;
    const maxLng = 110.0;
    return ((longitude - minLng) / (maxLng - minLng)) * 260 + 30;
  }, []);

  const mapY = useCallback((latitude) => {
    if (!latitude) return 100;
    const minLat = 10.0;
    const maxLat = 23.0;
    return ((maxLat - latitude) / (maxLat - minLat)) * 600 + 40;
  }, []);

  // Fetch active trains tracking data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/schedules/active-tracking");
      setActiveTrackings(res.data?.activeTrackings || []);
    } catch (err) {
      toast.error("Không thể tải dữ liệu điều hành tàu thời gian thực.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Fallback polling every 10 seconds
    const interval = setInterval(() => {
      loadData();
    }, 10000);

    return () => clearInterval(interval);
  }, [loadData]);

  // Real-time updates via Socket.io
  useEffect(() => {
    const socket = createSeatSocket();

    socket.on("connect", () => {
      console.log("[Socket.io] Connected for Live Tracking updates");
    });

    socket.on("live-tracking:update", (updatedTracking) => {
      console.log(
        "[Socket.io] Received live tracking update:",
        updatedTracking,
      );
      setActiveTrackings((prev) =>
        prev.map((item) => {
          if (item.schedule.id === updatedTracking.scheduleId) {
            return {
              ...item,
              tracking: {
                ...item.tracking,
                ...updatedTracking,
                lastUpdated: new Date(),
              },
            };
          }
          return item;
        }),
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Process coordinates & telemetry linearly based on current clock time
  const processedTrackings = useMemo(() => {
    return activeTrackings.map((item) => {
      // If we are actively simulating or have explicit overrides, let them stand
      // Otherwise, interpolate location dynamically by timeline
      const interpolated = getInterpolatedTracking(item, timeRef);
      return {
        ...item,
        tracking: {
          ...item.tracking,
          ...interpolated,
        },
      };
    });
  }, [activeTrackings, timeRef]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const total = processedTrackings.length;
    let onTime = 0;
    let delayed = 0;

    processedTrackings.forEach(({ schedule, tracking }) => {
      const isDelayed =
        schedule?.status === "DELAYED" ||
        Boolean(schedule?.delayMinutes && schedule.delayMinutes > 0) ||
        tracking?.status === "DELAYED";

      if (isDelayed) {
        delayed++;
      } else {
        onTime++;
      }
    });

    const performance = total > 0 ? Math.round((onTime / total) * 100) : 100;

    return { total, onTime, delayed, performance };
  }, [processedTrackings]);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    return processedTrackings.find(
      (item) => item.schedule.id === selectedTrainId,
    );
  }, [processedTrackings, selectedTrainId]);

  // Render Horizontal Timeline for active train progress
  const renderProgressTimeline = (item) => {
    if (!item) return null;
    const { schedule, tracking } = item;

    // Compile stops: Start Station, Stops, End Station
    const stops = [
      {
        stationCode: schedule.route.startStation.stationCode || "START",
        stationName: schedule.route.startStation.stationName,
        time: new Date(schedule.departureTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
      ...(schedule.scheduleStops || []).map((stop) => ({
        stationCode: stop.station.stationCode,
        stationName: stop.station.stationName,
        time: new Date(stop.arrivalTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
      {
        stationCode: schedule.route.endStation.stationCode || "END",
        stationName: schedule.route.endStation.stationName,
        time: new Date(schedule.arrivalTime).toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ];

    const progressPercent = getTimelineProgress(item, timeRef);

    return (
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 text-white text-left space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h4 className="font-extrabold text-sm text-[#00a3ff]">
              HÀNH TRÌNH TUYẾN: {schedule.route.routeName}
            </h4>
            <p className="text-xs text-slate-400 font-semibold">
              Tàu đang di chuyển giữa các ga dừng
            </p>
          </div>
          <span className="px-3 py-1 bg-slate-800 text-xs font-bold rounded-lg text-slate-300">
            {schedule.train.trainCode}
          </span>
        </div>

        <div className="relative pt-6 pb-2">
          {/* Track Line */}
          <div className="absolute top-9 left-2 right-2 h-1 bg-slate-800 rounded-full" />
          <div
            className="absolute top-9 left-2 h-1 bg-emerald-500 rounded-full transition-all duration-500"
            style={{
              width: `${progressPercent}%`,
            }}
          />

          {/* Floating train pulsing indicator */}
          <div
            className="absolute top-6 w-6.5 h-6.5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center shadow-[0_0_12px_#10b981] transition-all duration-300 z-20"
            style={{
              left: `calc(${progressPercent}% - 13px)`,
            }}
          >
            <Compass className="h-3.5 w-3.5 text-white animate-spin-slow" />
          </div>

          {/* Stops Points */}
          <div className="relative flex justify-between">
            {stops.map((stop, idx) => {
              const stopPercent = (idx / (stops.length - 1)) * 100;
              const isPassed = progressPercent >= stopPercent - 0.1;
              const isCurrent = Math.abs(progressPercent - stopPercent) < 2.0;

              return (
                <div
                  key={idx}
                  className="flex flex-col items-center relative z-10"
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-all ${
                      isCurrent
                        ? "bg-emerald-500 border-white shadow-[0_0_12px_#10b981]"
                        : isPassed
                          ? "bg-emerald-800 border-emerald-500 text-white"
                          : "bg-slate-950 border-slate-700 text-slate-500"
                    }`}
                  >
                    {isCurrent ? (
                      <MapPin className="h-3.5 w-3.5 text-white" />
                    ) : (
                      <span className="text-[10px] font-bold">{idx + 1}</span>
                    )}
                  </div>
                  <p
                    className={`text-[11px] font-bold mt-2 truncate max-w-[80px] text-center ${
                      isCurrent
                        ? "text-emerald-400"
                        : isPassed
                          ? "text-slate-300"
                          : "text-slate-500"
                    }`}
                  >
                    {stop.stationName.replace("Ga ", "")}
                  </p>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    {stop.time}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sensor details */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <p className="text-slate-400">Vị trí hiện tại</p>
            <p className="font-bold text-slate-200 mt-1">
              {tracking.currentStation || "Đang chạy trên tuyến"}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Vận tốc cảm biến</p>
            <p className="font-bold text-emerald-400 mt-1 flex items-center gap-1">
              <Compass className="h-3.5 w-3.5" />
              {tracking.speed ? `${Math.round(tracking.speed)} km/h` : "0 km/h"}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Nhiệt độ điều hòa</p>
            <p className="font-bold text-blue-400 mt-1 flex items-center gap-1">
              <Thermometer className="h-3.5 w-3.5" />
              {tracking.temperature
                ? `${tracking.temperature.toFixed(1)}°C`
                : "25°C"}
            </p>
          </div>
          <div>
            <p className="text-slate-400">Lượng khách hàng</p>
            <p className="font-bold text-slate-200 mt-1 flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {tracking.passengerCount || 0} hành khách
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`space-y-6 text-left flex flex-col ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-slate-950 p-8 overflow-y-auto w-screen h-screen"
          : ""
      }`}
    >
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2
            className={`text-2xl font-extrabold tracking-tight ${
              isFullscreen ? "text-white" : "text-[#191c1e]"
            }`}
          >
            Quản Lý Vận Hành Tàu (Real-time tracking)
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Bản đồ dispatch điều phối trực quan mạng lưới đường sắt quốc gia
            Việt Nam, cập nhật GPS cảm biến 10 giây một lần.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-none cursor-pointer disabled:opacity-55"
          >
            <RefreshCw
              className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`}
            />
            Làm mới
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center gap-1.5 bg-[#00629d] hover:bg-[#00527f] text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-none cursor-pointer"
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="h-4.5 w-4.5" />
                Thu nhỏ
              </>
            ) : (
              <>
                <Maximize2 className="h-4.5 w-4.5" />
                Toàn màn hình
              </>
            )}
          </button>
        </div>
      </div>

      {/* KPI Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase">
            Đang chạy hôm nay
          </p>
          <h3 className="text-2xl font-extrabold text-[#191c1e] dark:text-white mt-1">
            {kpis.total} đoàn tàu
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase">
            Đúng lịch (On Schedule)
          </p>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
            {kpis.onTime}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase">
            Chậm chuyến (Delayed)
          </p>
          <h3 className="text-2xl font-extrabold text-amber-500 mt-1">
            {kpis.delayed}
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-sm">
          <p className="text-xs text-slate-500 font-bold uppercase">
            Hiệu suất đúng giờ
          </p>
          <h3 className="text-2xl font-extrabold text-[#00629d] mt-1">
            {kpis.performance}%
          </h3>
        </div>
      </div>

      {/* Main Workspace: SVG Map + Sidebar Details */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Map Canvas */}
        <div className="lg:col-span-2 bg-[#090d16] border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex justify-center items-center shadow-lg">
          {/* Blueprint Grid background lines */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b1a_1px,transparent_1px),linear-gradient(to_bottom,#1e293b1a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

          <svg
            width="320"
            height="680"
            viewBox="0 0 320 680"
            className="z-10 relative"
          >
            {/* Railroad Track connections */}
            {/* Lào Cai to Hà Nội */}
            <line
              x1={STATION_COORDS.LCA.x}
              y1={STATION_COORDS.LCA.y}
              x2={STATION_COORDS.HAN.x}
              y2={STATION_COORDS.HAN.y}
              stroke="#475569"
              strokeWidth={3}
              strokeDasharray="4 3"
            />

            {/* Hà Nội to Hải Phòng */}
            <line
              x1={STATION_COORDS.HAN.x}
              y1={STATION_COORDS.HAN.y}
              x2={STATION_COORDS.HPH.x}
              y2={STATION_COORDS.HPH.y}
              stroke="#475569"
              strokeWidth={3}
              strokeDasharray="4 3"
            />

            {/* North-South Backbone Main Line */}
            <path
              d={`M ${STATION_COORDS.HAN.x} ${STATION_COORDS.HAN.y}
                  L ${STATION_COORDS.VIN.x} ${STATION_COORDS.VIN.y}
                  L ${STATION_COORDS.DHI.x} ${STATION_COORDS.DHI.y}
                  L ${STATION_COORDS.HUE.x} ${STATION_COORDS.HUE.y}
                  L ${STATION_COORDS.DAN.x} ${STATION_COORDS.DAN.y}
                  L ${STATION_COORDS.QNH.x} ${STATION_COORDS.QNH.y}
                  L ${STATION_COORDS.NTR.x} ${STATION_COORDS.NTR.y}
                  L ${STATION_COORDS.SGN.x} ${STATION_COORDS.SGN.y}`}
              fill="none"
              stroke="#38bdf8"
              strokeWidth={4}
              className="opacity-70"
            />

            {/* Glow Path Line overlay */}
            <path
              d={`M ${STATION_COORDS.HAN.x} ${STATION_COORDS.HAN.y}
                  L ${STATION_COORDS.VIN.x} ${STATION_COORDS.VIN.y}
                  L ${STATION_COORDS.DHI.x} ${STATION_COORDS.DHI.y}
                  L ${STATION_COORDS.HUE.x} ${STATION_COORDS.HUE.y}
                  L ${STATION_COORDS.DAN.x} ${STATION_COORDS.DAN.y}
                  L ${STATION_COORDS.QNH.x} ${STATION_COORDS.QNH.y}
                  L ${STATION_COORDS.NTR.x} ${STATION_COORDS.NTR.y}
                  L ${STATION_COORDS.SGN.x} ${STATION_COORDS.SGN.y}`}
              fill="none"
              stroke="#0ea5e9"
              strokeWidth={1}
              strokeDasharray="5 5"
              className="animate-pulse"
            />

            {/* Stations Pins */}
            {Object.entries(STATION_COORDS).map(([code, data]) => {
              const isLeft = data.align === "left";
              return (
                <g key={code} className="group cursor-pointer">
                  {/* Station circle */}
                  <circle
                    cx={data.x}
                    cy={data.y}
                    r={5}
                    fill="#020617"
                    stroke="#cbd5e1"
                    strokeWidth={2}
                  />
                  <circle cx={data.x} cy={data.y} r={2} fill="#64748b" />
                  {/* Station Name text */}
                  <text
                    x={isLeft ? data.x - 9 : data.x + 9}
                    y={data.y + 4}
                    textAnchor={isLeft ? "end" : "start"}
                    fill="#94a3b8"
                    fontSize="10"
                    fontWeight="bold"
                    className="select-none font-sans group-hover:fill-white transition-colors"
                  >
                    {data.label}
                  </text>
                </g>
              );
            })}

            {/* Active Trains (Real-time pins) */}
            {processedTrackings.map((item) => {
              const { schedule, tracking } = item;
              const isDelayed =
                schedule?.status === "DELAYED" ||
                Boolean(schedule?.delayMinutes && schedule.delayMinutes > 0) ||
                tracking?.status === "DELAYED";

              // Resolve coordinates: SVG x, y -> GPS -> station label fallback
              let trainX = STATION_COORDS.HAN.x;
              let trainY = STATION_COORDS.HAN.y;

              if (tracking?.x !== undefined && tracking?.y !== undefined) {
                trainX = tracking.x;
                trainY = tracking.y;
              } else if (tracking?.latitude && tracking?.longitude) {
                trainX = mapX(tracking.longitude);
                trainY = mapY(tracking.latitude);
              } else if (tracking?.currentStation) {
                // Find matching coordinates for named station
                const matched = Object.values(STATION_COORDS).find(
                  (val) =>
                    val.label === tracking.currentStation ||
                    `Ga ${val.label}` === tracking.currentStation,
                );
                if (matched) {
                  trainX = matched.x;
                  trainY = matched.y;
                }
              }

              const isSelected = selectedTrainId === schedule.id;

              return (
                <g
                  key={schedule.id}
                  onClick={() => setSelectedTrainId(schedule.id)}
                  className="cursor-pointer"
                >
                  {/* Glowing pulse rings */}
                  <circle
                    cx={trainX}
                    cy={trainY}
                    r={isSelected ? 16 : 10}
                    fill={
                      isDelayed
                        ? "rgba(245, 158, 11, 0.2)"
                        : "rgba(16, 185, 129, 0.2)"
                    }
                    className="animate-ping"
                    style={{ animationDuration: "1.5s" }}
                  />

                  {/* Outer circle */}
                  <circle
                    cx={trainX}
                    cy={trainY}
                    r={isSelected ? 8 : 6}
                    fill={isDelayed ? "#f59e0b" : "#10b981"}
                    stroke="#ffffff"
                    strokeWidth={isSelected ? 2 : 1.5}
                    className="transition-all"
                  />

                  {/* Inner dot */}
                  <circle cx={trainX} cy={trainY} r={2} fill="#ffffff" />

                  {/* Train Label ID */}
                  <text
                    x={trainX}
                    y={trainY - (isSelected ? 14 : 10)}
                    textAnchor="middle"
                    fill={isSelected ? "#38bdf8" : "#f1f5f9"}
                    fontSize="9"
                    fontWeight="extrabold"
                    className="select-none filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  >
                    {schedule.train.trainCode}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Full Screen Mode indicator */}
          {isFullscreen && (
            <div className="absolute top-4 left-4 bg-slate-900/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-300 font-bold flex items-center gap-1.5 backdrop-blur">
              <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
              Real-time monitoring active
            </div>
          )}
        </div>

        {/* Sidebar Panel Details */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="font-extrabold text-base text-slate-800 dark:text-white flex items-center gap-2">
              <Compass className="h-5 w-5 text-[#00629d]" />
              Đội Tàu Đang Vận Hành ({processedTrackings.length})
            </h3>

            {processedTrackings.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                <p className="font-bold text-sm">Không có tàu nào đang chạy</p>
                <p className="text-xs mt-1">
                  Các tàu chạy trong ngày hôm nay sẽ hiển thị tại đây.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto pr-1">
                {processedTrackings.map((item) => {
                  const { schedule, tracking } = item;
                  const isDelayed =
                    schedule?.status === "DELAYED" ||
                    Boolean(
                      schedule?.delayMinutes && schedule.delayMinutes > 0,
                    ) ||
                    tracking?.status === "DELAYED";
                  const isSelected = selectedTrainId === schedule.id;

                  return (
                    <button
                      key={schedule.id}
                      onClick={() => setSelectedTrainId(schedule.id)}
                      className={`w-full text-left py-3 px-3 flex items-center justify-between rounded-xl transition-all border-none bg-transparent cursor-pointer ${
                        isSelected
                          ? "bg-slate-50 dark:bg-slate-800/50"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                            {schedule.train.trainCode}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">
                            {schedule.route.routeName}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 font-semibold truncate mt-1">
                          Vị trí: {tracking?.currentStation || "Đang chạy"}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isDelayed
                              ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                              : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400"
                          }`}
                        >
                          {isDelayed
                            ? `Trễ ${schedule.delayMinutes}m`
                            : "Đúng giờ"}
                        </span>
                        <p className="text-[10px] text-slate-400 font-semibold mt-1">
                          {tracking?.speed
                            ? `${Math.round(tracking.speed)} km/h`
                            : "0 km/h"}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selected Train detailed Telemetry */}
          {selectedItem ? (
            renderProgressTimeline(selectedItem)
          ) : (
            <div className="bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-800 rounded-2xl p-6 text-center text-slate-400 text-xs font-semibold">
              <Compass className="mx-auto h-8 w-8 opacity-40 mb-2" />
              Chọn một đoàn tàu trên bản đồ hoặc danh sách để xem chi tiết tốc
              độ, nhiệt độ toa xe và lộ trình các ga.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
