import { useState, useEffect, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
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
  Navigation,
  MapPin,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { api } from "../../services/api";
import { createSeatSocket } from "../../services/seatSelectionApi";
import { toast } from "sonner";

// Real GPS Coordinates of Vietnam Stations
const VIETNAM_STATIONS_GPS = [
  { code: "LCA", name: "Ga Lào Cai", lat: 22.4842, lng: 103.9782 },
  {
    code: "HAN",
    name: "Ga Hà Nội",
    lat: 21.0245,
    lng: 105.8412,
    isMajor: true,
  },
  { code: "HPH", name: "Ga Hải Phòng", lat: 20.8558, lng: 106.6881 },
  { code: "NDH", name: "Ga Nam Định", lat: 20.4285, lng: 106.1683 },
  { code: "THO", name: "Ga Thanh Hóa", lat: 19.8067, lng: 105.7852 },
  { code: "VIN", name: "Ga Vinh", lat: 18.6796, lng: 105.6813, isMajor: true },
  { code: "DHI", name: "Ga Đồng Hới", lat: 17.4697, lng: 106.6022 },
  { code: "HUE", name: "Ga Huế", lat: 16.4637, lng: 107.5909, isMajor: true },
  {
    code: "DAN",
    name: "Ga Đà Nẵng",
    lat: 16.0717,
    lng: 108.2144,
    isMajor: true,
  },
  { code: "QNG", name: "Ga Quảng Ngãi", lat: 15.1202, lng: 108.7923 },
  {
    code: "QNH",
    name: "Ga Quy Nhơn (Diêu Trì)",
    lat: 13.783,
    lng: 109.1558,
    isMajor: true,
  },
  { code: "TUH", name: "Ga Tuy Hòa", lat: 13.0882, lng: 109.3087 },
  {
    code: "NTR",
    name: "Ga Nha Trang",
    lat: 12.2492,
    lng: 109.1867,
    isMajor: true,
  },
  { code: "PTH", name: "Ga Phan Thiết", lat: 10.9333, lng: 108.1 },
  {
    code: "SGN",
    name: "Ga Sài Gòn",
    lat: 10.7828,
    lng: 106.6789,
    isMajor: true,
  },
];

// Vietnam Island Archipelagos (Hoàng Sa & Trường Sa)
const VIETNAM_ARCHIPELAGOS = [
  {
    code: "HOANG_SA",
    name: "Quần đảo Hoàng Sa (Đà Nẵng, Việt Nam)",
    lat: 16.5333,
    lng: 111.6,
  },
  {
    code: "TRUONG_SA",
    name: "Quần đảo Trường Sa (Khánh Hòa, Việt Nam)",
    lat: 8.6444,
    lng: 111.9194,
  },
];

// Railway Lines Polylines
const NORTH_SOUTH_RAILWAY_PATH = [
  [21.0245, 105.8412], // Ga Hà Nội
  [20.4285, 106.1683], // Ga Nam Định
  [19.8067, 105.7852], // Ga Thanh Hóa
  [18.6796, 105.6813], // Ga Vinh
  [17.4697, 106.6022], // Ga Đồng Hới
  [16.4637, 107.5909], // Ga Huế
  [16.0717, 108.2144], // Ga Đà Nẵng
  [15.1202, 108.7923], // Ga Quảng Ngãi
  [13.783, 109.1558], // Ga Quy Nhơn (Diêu Trì)
  [13.0882, 109.3087], // Ga Tuy Hòa
  [12.2492, 109.1867], // Ga Nha Trang
  [10.9333, 108.1], // Ga Phan Thiết
  [10.7828, 106.6789], // Ga Sài Gòn
];

const LAO_CAI_BRANCH_PATH = [
  [22.4842, 103.9782], // Ga Lào Cai
  [21.705, 104.875], // Ga Yên Bái
  [21.0245, 105.8412], // Ga Hà Nội
];

const HAI_PHONG_BRANCH_PATH = [
  [21.0245, 105.8412], // Ga Hà Nội
  [20.9381, 106.3152], // Ga Hải Dương
  [20.8558, 106.6881], // Ga Hải Phòng
];

const HANOI_HUB = [21.0245, 105.8412];

// Official Google Maps Tile Providers (Clean Vietnam Boundaries)
const MAP_TILES = {
  google_streets: {
    name: "Google Maps Giao Thông (Chuẩn Việt Nam)",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  google_hybrid: {
    name: "Google Maps Vệ Tinh (Chuẩn Việt Nam)",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  google_terrain: {
    name: "Google Maps Địa Hình (Chuẩn Việt Nam)",
    url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
};

// Custom Leaflet Icons
const createTrainMarkerIcon = (trainCode, isDelayed, isSelected) => {
  const bgColor = isDelayed ? "#f59e0b" : "#10b981";
  const glowColor = isDelayed
    ? "rgba(245, 158, 11, 0.4)"
    : "rgba(16, 185, 129, 0.4)";
  const size = isSelected ? 44 : 36;

  return L.divIcon({
    className: "leaflet-custom-train-marker",
    html: `
      <div style="position: relative; width: ${size}px; height: ${size}px; display: flex; align-items: center; justify-content: center;">
        <div style="position: absolute; width: 100%; height: 100%; border-radius: 50%; background: ${glowColor}; transform: scale(1.35); filter: blur(1.5px);"></div>
        <div style="position: relative; width: ${size - 8}px; height: ${size - 8}px; border-radius: 50%; background: ${bgColor}; border: 2.5px solid #ffffff; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4); transform: ${isSelected ? "scale(1.15)" : "scale(1)"}; transition: all 0.2s;">
          <span style="color: #ffffff; font-size: 10px; font-weight: 900; font-family: system-ui, -apple-system, sans-serif; text-shadow: 0 1px 2px rgba(0,0,0,0.6);">${trainCode}</span>
        </div>
      </div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const createStationMarkerIcon = (isMajor) => {
  const size = isMajor ? 12 : 8;
  const color = isMajor ? "#00629d" : "#64748b";
  return L.divIcon({
    className: "leaflet-custom-station-marker",
    html: `
      <div style="width: ${size}px; height: ${size}px; border-radius: 50%; background: ${color}; border: 2px solid #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
};

const createIslandMarkerIcon = () => {
  return L.divIcon({
    className: "leaflet-custom-island-marker",
    html: `
      <div style="position: relative; display: flex; align-items: center; justify-content: center;">
        <div style="width: 14px; height: 14px; border-radius: 50%; background: #da251d; border: 2px solid #ffde00; box-shadow: 0 0 10px rgba(218,37,29,0.8); display: flex; align-items: center; justify-content: center;">
          <span style="color: #ffde00; font-size: 8px; font-weight: 900;">★</span>
        </div>
      </div>
    `,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
};

// Map flyTo animation controller
function MapFlyTo({ selectedItem }) {
  const map = useMap();
  useEffect(() => {
    if (selectedItem?.tracking?.latitude && selectedItem?.tracking?.longitude) {
      map.flyTo(
        [selectedItem.tracking.latitude, selectedItem.tracking.longitude],
        8,
        { duration: 1.2 },
      );
    }
  }, [selectedItem, map]);
  return null;
}

// Helper distance calculation (Euclidean in degrees for GIS snapping)
function getDistanceDeg(lat1, lng1, lat2, lng2) {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

// Find closest vertex index on a polyline path to a given coordinate
function findClosestPathVertexIndex(path, lat, lng) {
  let minDistance = Infinity;
  let closestIndex = 0;
  for (let i = 0; i < path.length; i++) {
    const dist = getDistanceDeg(lat, lng, path[i][0], path[i][1]);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }
  return { index: closestIndex, distance: minDistance };
}

// Extract sub-path along a single polyline
function getSubPathAlongSinglePolyline(path, lat1, lng1, lat2, lng2) {
  const m1 = findClosestPathVertexIndex(path, lat1, lng1);
  const m2 = findClosestPathVertexIndex(path, lat2, lng2);
  const idx1 = m1.index;
  const idx2 = m2.index;

  const result = [];
  result.push([lat1, lng1]);

  if (idx1 !== idx2) {
    const step = idx1 < idx2 ? 1 : -1;
    let curr = idx1;
    while (curr !== idx2) {
      curr += step;
      result.push([path[curr][0], path[curr][1]]);
    }
  }

  result[result.length - 1] = [lat2, lng2];
  return result;
}

// Determine which railway branch line a coordinate belongs to
function getBranchOfCoord(lat, lng) {
  const dNS = findClosestPathVertexIndex(
    NORTH_SOUTH_RAILWAY_PATH,
    lat,
    lng,
  ).distance;
  const dLC = findClosestPathVertexIndex(
    LAO_CAI_BRANCH_PATH,
    lat,
    lng,
  ).distance;
  const dHP = findClosestPathVertexIndex(
    HAI_PHONG_BRANCH_PATH,
    lat,
    lng,
  ).distance;

  if (dHP < 0.35 && dHP < dNS && dHP < dLC)
    return { type: "HP", path: HAI_PHONG_BRANCH_PATH };
  if (dLC < 0.35 && dLC < dNS && dLC < dHP)
    return { type: "LC", path: LAO_CAI_BRANCH_PATH };
  return { type: "NS", path: NORTH_SOUTH_RAILWAY_PATH };
}

// Master Network Routing: Calculates exact detailed railway polyline between ANY two stations in Vietnam
function getDetailedRailwayPath(startLat, startLng, endLat, endLng) {
  const b1 = getBranchOfCoord(startLat, startLng);
  const b2 = getBranchOfCoord(endLat, endLng);

  if (b1.type === b2.type) {
    return getSubPathAlongSinglePolyline(
      b1.path,
      startLat,
      startLng,
      endLat,
      endLng,
    );
  }

  const leg1 = getSubPathAlongSinglePolyline(
    b1.path,
    startLat,
    startLng,
    HANOI_HUB[0],
    HANOI_HUB[1],
  );
  const leg2 = getSubPathAlongSinglePolyline(
    b2.path,
    HANOI_HUB[0],
    HANOI_HUB[1],
    endLat,
    endLng,
  );

  const combined = [...leg1];
  for (let i = 1; i < leg2.length; i++) {
    combined.push(leg2[i]);
  }
  return combined;
}

// Interpolate train position along railway polyline paths so train stays 100% on railway tracks
function interpolateAlongRailwayLine(
  startLat,
  startLng,
  endLat,
  endLng,
  progress,
) {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const detailedPath = getDetailedRailwayPath(
    startLat,
    startLng,
    endLat,
    endLng,
  );

  if (!detailedPath || detailedPath.length < 2) {
    return {
      lat: startLat + (endLat - startLat) * clampedProgress,
      lng: startLng + (endLng - startLng) * clampedProgress,
    };
  }

  const segmentDistances = [];
  let totalDist = 0;
  for (let i = 0; i < detailedPath.length - 1; i++) {
    const dist = getDistanceDeg(
      detailedPath[i][0],
      detailedPath[i][1],
      detailedPath[i + 1][0],
      detailedPath[i + 1][1],
    );
    segmentDistances.push(dist);
    totalDist += dist;
  }

  if (totalDist <= 0) {
    return { lat: startLat, lng: startLng };
  }

  const targetDist = clampedProgress * totalDist;
  let accumulated = 0;

  for (let i = 0; i < segmentDistances.length; i++) {
    const segDist = segmentDistances[i];
    if (
      accumulated + segDist >= targetDist ||
      i === segmentDistances.length - 1
    ) {
      const segProgress =
        segDist > 0 ? (targetDist - accumulated) / segDist : 0;
      const clampedSegProgress = Math.max(0, Math.min(1, segProgress));
      const p1 = detailedPath[i];
      const p2 = detailedPath[i + 1];

      return {
        lat: p1[0] + (p2[0] - p1[0]) * clampedSegProgress,
        lng: p1[1] + (p2[1] - p1[1]) * clampedSegProgress,
      };
    }
    accumulated += segDist;
  }

  return { lat: endLat, lng: endLng };
}

// Interpolate GPS coordinates and status of the train based on time
function getInterpolatedTracking(item, currentTime = new Date()) {
  const { schedule, tracking } = item;

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

  const startLat = schedule.route.startStation.latitude || 21.0245;
  const startLng = schedule.route.startStation.longitude || 105.8412;
  const startName = schedule.route.startStation.stationName;

  const endLat = schedule.route.endStation.latitude || 10.7769;
  const endLng = schedule.route.endStation.longitude || 106.6952;
  const endName = schedule.route.endStation.stationName;

  if (currentTime < depTime) {
    return {
      ...tracking,
      latitude: startLat,
      longitude: startLng,
      currentStation: startName,
      speed: 0.0,
      status: "CHƯA KHỞI HÀNH",
    };
  }

  if (currentTime > arrTime) {
    return {
      ...tracking,
      latitude: endLat,
      longitude: endLng,
      currentStation: endName,
      speed: 0.0,
      status: "COMPLETED",
    };
  }

  // Train running - Compile route nodes
  const nodes = [];
  nodes.push({
    lat: startLat,
    lng: startLng,
    name: startName,
    time: depTime,
    type: "START",
  });

  if (schedule.scheduleStops && schedule.scheduleStops.length > 0) {
    const sortedStops = [...schedule.scheduleStops].sort(
      (a, b) => a.stopOrder - b.stopOrder,
    );
    for (const stop of sortedStops) {
      const stopArr = new Date(stop.arrivalTime);
      const stopDep = stop.departureTime
        ? new Date(stop.departureTime)
        : stopArr;
      nodes.push({
        lat: stop.station.latitude || 16.0,
        lng: stop.station.longitude || 108.0,
        name: stop.station.stationName,
        time: stopArr,
        depTime: stopDep,
        type: "STOP",
      });
    }
  }

  nodes.push({
    lat: endLat,
    lng: endLng,
    name: endName,
    time: arrTime,
    type: "END",
  });

  // Interpolate segment along railway polyline
  for (let i = 0; i < nodes.length - 1; i++) {
    const current = nodes[i];
    const next = nodes[i + 1];
    const currentDep = current.type === "STOP" ? current.depTime : current.time;
    const nextArr = next.time;

    if (
      current.type === "STOP" &&
      currentTime >= current.time &&
      currentTime < current.depTime
    ) {
      return {
        ...tracking,
        latitude: current.lat,
        longitude: current.lng,
        currentStation: current.name,
        speed: 0.0,
        status: "ĐANG DỪNG GA",
      };
    }

    if (currentTime >= currentDep && currentTime < nextArr) {
      const segmentDuration = nextArr.getTime() - currentDep.getTime();
      const elapsed = currentTime.getTime() - currentDep.getTime();
      const progress = segmentDuration > 0 ? elapsed / segmentDuration : 0;

      const point = interpolateAlongRailwayLine(
        current.lat,
        current.lng,
        next.lat,
        next.lng,
        progress,
      );

      return {
        ...tracking,
        latitude: point.lat,
        longitude: point.lng,
        currentStation: `Giữa ${current.name.replace("Ga ", "")} & ${next.name.replace("Ga ", "")}`,
        speed: 55.0,
        status: "ĐANG CHẠY",
      };
    }
  }

  return tracking;
}

// Calculate timeline progress
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
  const [tileKey, setTileKey] = useState("google_streets"); // google_streets | google_hybrid | google_terrain

  // Clock reference
  const [timeRef, setTimeRef] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRef(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch tracking data
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
    const interval = setInterval(() => {
      loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Socket updates
  useEffect(() => {
    const socket = createSeatSocket();
    socket.on("connect", () => {
      console.log("[Socket.io] Connected for Live Tracking updates");
    });
    socket.on("live-tracking:update", (updatedTracking) => {
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

  // Process trackings
  const processedTrackings = useMemo(() => {
    return activeTrackings.map((item) => {
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

  // KPIs
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

  // Selected Item
  const selectedItem = useMemo(() => {
    return processedTrackings.find(
      (item) => item.schedule.id === selectedTrainId,
    );
  }, [processedTrackings, selectedTrainId]);

  // Selected route path coordinates for polyline highlight
  const selectedRoutePath = useMemo(() => {
    if (!selectedItem) return null;
    const { schedule } = selectedItem;
    const rawStops = [];

    if (
      schedule.route.startStation.latitude &&
      schedule.route.startStation.longitude
    ) {
      rawStops.push([
        schedule.route.startStation.latitude,
        schedule.route.startStation.longitude,
      ]);
    }
    (schedule.scheduleStops || []).forEach((st) => {
      if (st.station.latitude && st.station.longitude) {
        rawStops.push([st.station.latitude, st.station.longitude]);
      }
    });
    if (
      schedule.route.endStation.latitude &&
      schedule.route.endStation.longitude
    ) {
      rawStops.push([
        schedule.route.endStation.latitude,
        schedule.route.endStation.longitude,
      ]);
    }

    if (rawStops.length < 2) return null;

    const fullPath = [];
    for (let i = 0; i < rawStops.length - 1; i++) {
      const segPath = getDetailedRailwayPath(
        rawStops[i][0],
        rawStops[i][1],
        rawStops[i + 1][0],
        rawStops[i + 1][1],
      );
      const startIdx = i === 0 ? 0 : 1;
      for (let j = startIdx; j < segPath.length; j++) {
        fullPath.push(segPath[j]);
      }
    }

    return fullPath.length >= 2 ? fullPath : null;
  }, [selectedItem]);

  // Render Horizontal Timeline
  const renderProgressTimeline = (item) => {
    if (!item) return null;
    const { schedule, tracking } = item;

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
      <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-6 text-white text-left space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h4 className="font-extrabold text-sm text-[#00a3ff]">
              HÀNH TRÌNH TUYẾN: {schedule.route.routeName}
            </h4>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Tàu đang di chuyển giữa các ga dừng
            </p>
          </div>
          <span className="px-3 py-1 bg-slate-800 text-xs font-bold rounded-lg text-slate-300 border border-slate-700">
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

          {/* Floating train indicator */}
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
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-800 text-xs">
          <div>
            <p className="text-slate-400">Vị trí hiện tại</p>
            <p className="font-bold text-slate-200 mt-1 truncate">
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
            <p className="text-slate-400">Lượng khách hàng</p>
            <p className="font-bold text-slate-200 mt-1 flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-sky-400" />
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
            Quản Lý Vận Hành Tàu (Google Maps Việt Nam)
          </h2>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Bản đồ điều phối đường sắt Việt Nam chính chuẩn (Google Maps Việt
            Nam, chủ quyền Hoàng Sa & Trường Sa).
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-[#00629d]">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">
              Tổng số tàu chạy
            </p>
            <p className="text-xl font-black text-slate-800 dark:text-white">
              {kpis.total}
            </p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Tàu đúng giờ</p>
            <p className="text-xl font-black text-emerald-600">{kpis.onTime}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-amber-50 dark:bg-amber-950/40 rounded-xl text-amber-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">Tàu bị trễ</p>
            <p className="text-xl font-black text-amber-600">{kpis.delayed}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex items-center gap-3">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 rounded-xl text-indigo-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold">
              Đúng giờ toàn tuyến
            </p>
            <p className="text-xl font-black text-indigo-600">
              {kpis.performance}%
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Interactive Map & Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Interactive Leaflet Map Container */}
        <div className="lg:col-span-2 relative bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800 min-h-[550px] flex flex-col">
          {/* Map Tile Switcher & Sovereignty Badge */}
          <div className="absolute top-4 left-4 right-4 z-[400] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
            <div className="bg-slate-900/90 border border-slate-700/80 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-xl flex items-center gap-2 pointer-events-auto">
              <Layers className="h-4 w-4 text-[#00a3ff]" />
              <select
                value={tileKey}
                onChange={(e) => setTileKey(e.target.value)}
                className="bg-transparent text-white text-xs font-bold border-none outline-none cursor-pointer pr-1"
              >
                {Object.entries(MAP_TILES).map(([key, item]) => (
                  <option
                    key={key}
                    value={key}
                    className="bg-slate-900 text-white"
                  >
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-[#da251d]/90 border border-[#ffde00]/60 backdrop-blur-md px-3.5 py-1.5 rounded-2xl shadow-xl flex items-center gap-1.5 pointer-events-auto text-xs text-white font-black">
              <ShieldCheck className="h-4 w-4 text-[#ffde00]" />
              Bản Đồ Chủ Quyền Việt Nam (Hoàng Sa & Trường Sa)
            </div>
          </div>

          {/* Leaflet Map Component */}
          <MapContainer
            center={[16.047079, 108.20623]}
            zoom={6}
            scrollWheelZoom={true}
            style={{
              width: "100%",
              height: isFullscreen ? "calc(100vh - 200px)" : "560px",
              background: "#f8fafc",
            }}
            className="z-0 rounded-3xl"
          >
            <TileLayer
              url={MAP_TILES[tileKey].url}
              attribution={MAP_TILES[tileKey].attribution}
            />

            <MapFlyTo selectedItem={selectedItem} />

            {/* Railway Network Backbone Polylines */}
            <Polyline
              positions={NORTH_SOUTH_RAILWAY_PATH}
              pathOptions={{ color: "#0284c7", weight: 5, opacity: 0.85 }}
            />
            <Polyline
              positions={LAO_CAI_BRANCH_PATH}
              pathOptions={{
                color: "#0284c7",
                weight: 3.5,
                opacity: 0.75,
                dashArray: "6, 5",
              }}
            />
            <Polyline
              positions={HAI_PHONG_BRANCH_PATH}
              pathOptions={{
                color: "#0284c7",
                weight: 3.5,
                opacity: 0.75,
                dashArray: "6, 5",
              }}
            />

            {/* Highlighted Selected Train Route Polyline */}
            {selectedRoutePath && (
              <Polyline
                positions={selectedRoutePath}
                pathOptions={{ color: "#e11d48", weight: 6, opacity: 0.95 }}
              />
            )}

            {/* Vietnam Station Markers */}
            {VIETNAM_STATIONS_GPS.map((st) => (
              <Marker
                key={st.code}
                position={[st.lat, st.lng]}
                icon={createStationMarkerIcon(st.isMajor)}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={0.95}>
                  <div className="font-bold text-xs text-slate-900">
                    {st.name}
                  </div>
                </Tooltip>
              </Marker>
            ))}

            {/* Vietnam Archipelago Markers (Hoàng Sa & Trường Sa) */}
            {VIETNAM_ARCHIPELAGOS.map((arc) => (
              <Marker
                key={arc.code}
                position={[arc.lat, arc.lng]}
                icon={createIslandMarkerIcon()}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -10]}
                  opacity={0.95}
                  permanent
                >
                  <div className="font-black text-[11px] text-[#da251d] bg-amber-50 px-2 py-0.5 rounded border border-[#da251d]/40 shadow">
                    {arc.name}
                  </div>
                </Tooltip>
              </Marker>
            ))}

            {/* Active Trains Markers */}
            {processedTrackings.map((item) => {
              const { schedule, tracking } = item;
              const isDelayed =
                schedule?.status === "DELAYED" ||
                Boolean(schedule?.delayMinutes && schedule.delayMinutes > 0) ||
                tracking?.status === "DELAYED";
              const isSelected = selectedTrainId === schedule.id;

              const lat =
                tracking.latitude ||
                schedule.route.startStation.latitude ||
                21.0245;
              const lng =
                tracking.longitude ||
                schedule.route.startStation.longitude ||
                105.8412;

              return (
                <Marker
                  key={schedule.id}
                  position={[lat, lng]}
                  icon={createTrainMarkerIcon(
                    schedule.train.trainCode,
                    isDelayed,
                    isSelected,
                  )}
                  eventHandlers={{
                    click: () => setSelectedTrainId(schedule.id),
                  }}
                >
                  <Popup className="custom-leaflet-popup">
                    <div className="p-1 space-y-2 text-left min-w-[200px]">
                      <div className="flex items-center justify-between border-b pb-1.5">
                        <span className="font-black text-sm text-[#00629d]">
                          {schedule.train.trainCode}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isDelayed
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {isDelayed
                            ? `Trễ ${schedule.delayMinutes}m`
                            : "Đúng giờ"}
                        </span>
                      </div>
                      <p className="text-xs font-semibold text-slate-700">
                        {schedule.route.routeName}
                      </p>
                      <p className="text-xs text-slate-500">
                        <strong>Vị trí:</strong>{" "}
                        {tracking.currentStation || "Đang di chuyển"}
                      </p>
                      <p className="text-xs text-slate-500">
                        <strong>Tốc độ:</strong>{" "}
                        {tracking.speed
                          ? `${Math.round(tracking.speed)} km/h`
                          : "0 km/h"}
                      </p>
                      <p className="text-xs text-slate-500">
                        <strong>Khách hàng:</strong>{" "}
                        {tracking.passengerCount || 0} người
                      </p>
                      <button
                        onClick={() => setSelectedTrainId(schedule.id)}
                        className="w-full mt-1 bg-[#00629d] hover:bg-[#004e7d] text-white text-xs font-bold py-1.5 px-3 rounded-lg border-none cursor-pointer transition-all"
                      >
                        Xem Lộ Trình Chi Tiết
                      </button>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
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
              <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[280px] overflow-y-auto pr-1">
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
                          ? "bg-slate-100 dark:bg-slate-800/80 ring-2 ring-[#00629d]/40"
                          : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-800 dark:text-white">
                            {schedule.train.trainCode}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold truncate">
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
              độ, số lượng hành khách và lộ trình các ga.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
