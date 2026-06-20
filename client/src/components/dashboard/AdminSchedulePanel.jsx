import { useState, useEffect, useCallback } from "react";
import { api } from "../../services/api";
import { toast } from "sonner";
import {
  getRoutes,
  getSchedules,
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

const getScheduleStatus = (s) => {
  if (s.status === "CANCELLED" || s.status === "Hủy bỏ") return "Hủy bỏ";
  if (s.status === "DELAYED") return "Chưa chạy";
  if (s.status === "Hoàn thành") return "Hoàn thành";
  if (s.status === "Đang chạy") return "Đang chạy";
  if (s.status === "Chưa chạy") return "Chưa chạy";

  const now = new Date();
  const dep = new Date(s.departureTime);
  const arr = s.arrivalTime
    ? new Date(s.arrivalTime)
    : new Date(dep.getTime() + 6 * 3600 * 1000); // Mặc định 6 tiếng nếu không có thời gian đến

  if (now >= dep && now <= arr) return "Đang chạy";
  if (now > arr) return "Hoàn thành";
  return "Chưa chạy";
};

const STATUS_BADGE_CLASS = {
  "Đang chạy": "bg-green-50 text-green-600 border-green-100",
  "Chưa chạy": "bg-amber-50 text-amber-600 border-amber-100",
  "Hoàn thành":
    "bg-surface-container-highest text-on-surface-variant border-outline-variant",
  "Hủy bỏ": "bg-error/10 text-error border-error/20",
};

const TripPreview = ({ selectedRoute, departureTimes, bufferMinutes }) => {
  if (!selectedRoute || !departureTimes) return null;

  const durationMins = selectedRoute.estimatedDuration || 0;
  if (durationMins <= 0) return null;

  const bufferMins = parseInt(bufferMinutes) || 0;
  const numStops = selectedRoute.stations ? selectedRoute.stations.length : 0;
  const totalDurationMins = durationMins + numStops * bufferMins;

  const times = departureTimes
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(t));

  if (times.length === 0) return null;

  const durHours = Math.floor(totalDurationMins / 60);
  const durMins = totalDurationMins % 60;

  return (
    <div className="mt-3 p-3.5 bg-violet-50/50 border border-violet-100 rounded-xl space-y-2">
      <p className="text-xs font-bold text-violet-700 flex items-center gap-1.5">
        <span className="material-symbols-outlined text-[16px]">info</span>
        Thời gian hành trình dự kiến ({durHours > 0 ? `${durHours}h` : ""}{" "}
        {durMins > 0 ? `${durMins}m` : ""}):
      </p>
      <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
        {times.map((t) => {
          const [h, m] = t.split(":").map(Number);
          const totalMins = h * 60 + m + totalDurationMins;
          const availableMins = totalMins + bufferMins;

          const arrDay = Math.floor(totalMins / (24 * 60)) + 1;
          const arrHour = Math.floor((totalMins % (24 * 60)) / 60);
          const arrMin = totalMins % 60;

          const avDay = Math.floor(availableMins / (24 * 60)) + 1;
          const avHour = Math.floor((availableMins % (24 * 60)) / 60);
          const avMin = availableMins % 60;

          const arrTimeStr = `${String(arrHour).padStart(2, "0")}:${String(arrMin).padStart(2, "0")}`;
          const avTimeStr = `${String(avHour).padStart(2, "0")}:${String(avMin).padStart(2, "0")}`;

          const dayLabel = arrDay > 1 ? `Ngày thứ ${arrDay}` : "Cùng ngày";
          const avDayLabel = avDay > 1 ? `Ngày thứ ${avDay}` : "Cùng ngày";

          return (
            <div
              key={t}
              className="text-xs flex flex-col gap-1 border-b border-violet-100/30 pb-2 last:border-none last:pb-0"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-[#191c1e] bg-white px-1.5 py-0.5 rounded border border-[#bec7d4]/30">
                    {t}
                  </span>
                  <span className="material-symbols-outlined text-[14px] text-[#6f7883] opacity-50">
                    arrow_forward
                  </span>
                  <span className="font-bold text-violet-700 bg-white px-1.5 py-0.5 rounded border border-[#bec7d4]/30">
                    {arrTimeStr}
                  </span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${arrDay > 1 ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-800"}`}
                >
                  Đến: {dayLabel}
                </span>
              </div>
              {bufferMins > 0 && (
                <div className="flex items-center justify-between text-[10px] text-violet-700 bg-violet-100/40 px-2 py-0.5 rounded border border-violet-100/70">
                  <span className="flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[11px]">
                      schedule
                    </span>
                    Khả dụng từ (sau nghỉ ga cuối): <strong>{avTimeStr}</strong>
                  </span>
                  <span>
                    {avDayLabel} (+{bufferMins}p)
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Mock RouteTemplate Data ───────────────────────────────────
const MOCK_ROUTE_TEMPLATES = [
  {
    id: "tpl-mock-1",
    routeId: "r1",
    trainId: "t1",
    route: {
      routeName: "Hà Nội – Huế",
      startStation: { stationCode: "HAN", stationName: "Ga Hà Nội" },
      endStation: { stationCode: "HUE", stationName: "Ga Huế" },
    },
    train: { trainCode: "SE1", trainName: "SE1" },
    departureTimes: ["08:00"],
    bufferMinutes: 60,
    isActive: true,
  },
  {
    id: "tpl-mock-2",
    routeId: "r2",
    trainId: "t2",
    route: {
      routeName: "Hà Nội – Sài Gòn",
      startStation: { stationCode: "HAN", stationName: "Ga Hà Nội" },
      endStation: { stationCode: "SGN", stationName: "Ga Sài Gòn" },
    },
    train: { trainCode: "SE2", trainName: "SE2" },
    departureTimes: ["06:00", "22:00"],
    bufferMinutes: 60,
    isActive: true,
  },
  {
    id: "tpl-mock-3",
    routeId: "r3",
    trainId: "t3",
    route: {
      routeName: "Hà Nội – Đà Nẵng",
      startStation: { stationCode: "HAN", stationName: "Ga Hà Nội" },
      endStation: { stationCode: "DAN", stationName: "Ga Đà Nẵng" },
    },
    train: { trainCode: "SE3", trainName: "SE3" },
    departureTimes: ["08:00", "14:00"],
    bufferMinutes: 60,
    isActive: true,
  },
  {
    id: "tpl-mock-4",
    routeId: "r4",
    trainId: "t4",
    route: {
      routeName: "Hà Nội – Nha Trang",
      startStation: { stationCode: "HAN", stationName: "Ga Hà Nội" },
      endStation: { stationCode: "NTR", stationName: "Ga Nha Trang" },
    },
    train: { trainCode: "TN1", trainName: "TN1" },
    departureTimes: ["20:00"],
    bufferMinutes: 90,
    isActive: false,
  },
  {
    id: "tpl-mock-5",
    routeId: "r5",
    trainId: "t5",
    route: {
      routeName: "Hà Nội – Quy Nhơn",
      startStation: { stationCode: "HAN", stationName: "Ga Hà Nội" },
      endStation: { stationCode: "QNH", stationName: "Ga Quy Nhơn" },
    },
    train: { trainCode: "SE4", trainName: "SE4" },
    departureTimes: ["10:00"],
    bufferMinutes: 60,
    isActive: true,
  },
  {
    id: "tpl-mock-6",
    routeId: "r6",
    trainId: "t6",
    route: {
      routeName: "Hà Nội – Lào Cai",
      startStation: { stationCode: "HAN", stationName: "Ga Hà Nội" },
      endStation: { stationCode: "LCA", stationName: "Ga Lào Cai" },
    },
    train: { trainCode: "SP1", trainName: "SP1" },
    departureTimes: ["21:30"],
    bufferMinutes: 45,
    isActive: true,
  },
];

export function AdminSchedulePanel() {
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tất cả");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add modal state
  const [showAddModal, setShowAddModal] = useState(false);
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

  // Detail Modal
  const [activeDetails, setActiveDetails] = useState(null);

  // Timeline Modal
  const [timelineSchedule, setTimelineSchedule] = useState(null); // { schedule, timeline }
  const [timelineLoading, setTimelineLoading] = useState(false);

  const handleViewTimeline = async (scheduleId) => {
    setTimelineLoading(true);
    setTimelineSchedule(null);
    try {
      const res = await api.get(`/schedules/${scheduleId}/timeline`);
      setTimelineSchedule(res.data);
    } catch {
      toast.error("Không thể tải lịch trình chi tiết.");
    } finally {
      setTimelineLoading(false);
    }
  };

  const [triggeringAuto, setTriggeringAuto] = useState(false);

  // ── RouteTemplate Management State ─────────────────────────────
  const [templates, setTemplates] = useState([]);
  const [showTemplateSection, setShowTemplateSection] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    routeId: "",
    trainId: "",
    departureTimes: "08:00",
    bufferMinutes: "60",
    isActive: true,
  });
  const [templateSubmitting, setTemplateSubmitting] = useState(false);

  const handleTriggerAutoGenerate = async () => {
    setTriggeringAuto(true);
    try {
      const res = await api.post("/schedules/trigger-auto-generate");
      toast.success(
        res.data.message || "Kích hoạt tạo lịch trình tự động thành công!",
      );
      loadAll({ force: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Lỗi khi kích hoạt tự động tạo lịch trình.",
      );
    } finally {
      setTriggeringAuto(false);
    }
  };

  // ── Load All Data ──────────────────────────────────────────────
  const loadAll = useCallback(async ({ force = false } = {}) => {
    try {
      setLoading(true);
      const [rtRes, trRes, scRes, tplRes] = await Promise.all([
        getRoutes({ force }),
        getTrains({ force }),
        getSchedules({ force }),
        api.get("/route-templates").catch(() => ({ data: { templates: [] } })),
      ]);

      setRoutes(rtRes.routes || []);
      setTrains(trRes.trains || []);
      setSchedules(scRes.schedules || []);
      setTemplates(tplRes.data?.templates || []);
    } catch (err) {
      toast.error("Không thể tải dữ liệu từ server.");
      setRoutes([]);
      setTrains([]);
      setSchedules([]);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── RouteTemplate Handlers ──────────────────────────────────────
  const openAddTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      routeId: "",
      trainId: "",
      departureTimes: "08:00",
      bufferMinutes: "60",
      isActive: true,
    });
    setShowTemplateModal(true);
  };

  const openEditTemplate = (tpl) => {
    setEditingTemplate(tpl);
    setTemplateForm({
      routeId: tpl.routeId || "",
      trainId: tpl.trainId || "",
      departureTimes: tpl.departureTimes.join(", "),
      bufferMinutes: String(tpl.bufferMinutes),
      isActive: tpl.isActive,
    });
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = async (id) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa mẫu lịch chạy này?")) return;
    try {
      await api.delete(`/route-templates/${id}`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Đã xóa mẫu lịch chạy thành công.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi xóa mẫu lịch chạy.");
    }
  };

  const handleToggleTemplateActive = async (id) => {
    const tpl = templates.find((t) => t.id === id);
    if (!tpl) return;
    const newActive = !tpl.isActive;
    try {
      const res = await api.put(`/route-templates/${id}`, {
        isActive: newActive,
      });
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? res.data.template : t)),
      );
      toast.success(
        newActive ? "Đã kích hoạt mẫu lịch chạy." : "Đã tắt mẫu lịch chạy.",
      );
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể thay đổi trạng thái mẫu.",
      );
    }
  };

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setTemplateSubmitting(true);
    const times = templateForm.departureTimes
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      if (editingTemplate) {
        const res = await api.put(`/route-templates/${editingTemplate.id}`, {
          departureTimes: times,
          bufferMinutes: parseInt(templateForm.bufferMinutes) || 60,
          isActive: templateForm.isActive,
        });
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === editingTemplate.id ? res.data.template : t,
          ),
        );
        toast.success(res.data.message || "Đã cập nhật mẫu lịch chạy.");
      } else {
        const res = await api.post("/route-templates", {
          routeId: templateForm.routeId,
          trainId: templateForm.trainId,
          departureTimes: times,
          bufferMinutes: parseInt(templateForm.bufferMinutes) || 60,
          isActive: templateForm.isActive,
        });
        setTemplates((prev) => [res.data.template, ...prev]);
        toast.success(res.data.message || "Đã thêm mẫu lịch chạy mới.");
      }
      setShowTemplateModal(false);
      setEditingTemplate(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi lưu mẫu lịch chạy.");
    } finally {
      setTemplateSubmitting(false);
    }
  };

  // ── Auto-generate Schedule Submit ──────────────────────────────
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
      toast.success(message || "Đã tạo lịch trình thành công!");
      if (c.length > 0) {
        setConflicts(c);
      } else {
        setShowAddModal(false);
        setSchedForm({
          routeId: "",
          trainId: "",
          startDate: "",
          endDate: "",
          departureTimes: "08:00",
          bufferMinutes: "60",
        });
        loadAll({ force: true });
      }
    } catch (err) {
      const { message, conflicts: c = [] } = err.response?.data || {};
      toast.error(message || "Lỗi khi tạo lịch trình.");
      if (c.length > 0) setConflicts(c);
    } finally {
      setSchedSubmitting(false);
    }
  };

  // ── Delete Schedule ─────────────────────────────────────────────
  const handleDeleteSchedule = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa lịch trình của ${name}?`))
      return;
    try {
      // Check if it is a mock schedule or server schedule
      if (id.startsWith("mock-")) {
        setSchedules((prev) => prev.filter((s) => s.id !== id));
        toast.success("Đã xóa lịch trình (Dữ liệu mô phỏng).");
      } else {
        await api.delete(`/schedules/${id}`);
        toast.success("Đã xóa lịch trình thành công.");
        loadAll({ force: true });
      }
    } catch (err) {
      toast.error("Không thể xóa lịch trình này.");
    }
  };

  // ── Filter Logic ────────────────────────────────────────────────
  const filteredSchedules = schedules.filter((s) => {
    const status = getScheduleStatus(s);

    // Search term check
    const matchSearch =
      (s.train?.trainCode || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (s.route?.routeName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (s.route?.startStation?.stationName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (s.route?.endStation?.stationName || "")
        .toLowerCase()
        .includes(searchTerm.toLowerCase());

    // Date check
    let matchDate = true;
    if (filterDate) {
      const sDateStr = new Date(s.departureTime).toISOString().split("T")[0];
      matchDate = sDateStr === filterDate;
    }

    // Status check
    const matchStatus = filterStatus === "Tất cả" || status === filterStatus;

    return matchSearch && matchDate && matchStatus;
  });

  // ── Stats calculation ───────────────────────────────────────────
  const totalSchedules = filteredSchedules.length;
  const activeSchedules = filteredSchedules.filter(
    (s) => getScheduleStatus(s) === "Đang chạy",
  ).length;

  // Pagination calculation
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredSchedules.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );
  const totalPages = Math.max(
    1,
    Math.ceil(filteredSchedules.length / itemsPerPage),
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterDate, filterStatus]);

  return (
    <div className="space-y-8">
      {/* Local App Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] tracking-tight">
            Quản Lý Lịch Trình
          </h2>
          <p className="text-sm text-[#3f4852] mt-1">
            Theo dõi hành trình, kiểm soát trạng thái chạy tàu và thiết lập lịch
            tự động.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-3 bg-[#00629d] hover:bg-[#00629d]/90 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#00629d]/20 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Tạo lịch trình mới
        </button>
      </div>

      {/* Stats Summary (Asymmetric Layout matching HTML) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-8 bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex items-center justify-between">
          <div>
            <p className="font-label-sm text-[#3f4852] mb-1 text-xs font-semibold">
              Tổng chuyến trong danh sách bộ lọc
            </p>
            <h3 className="font-display-lg text-4xl font-extrabold text-[#00629d]">
              {totalSchedules}{" "}
              <span className="text-base font-normal text-[#3f4852]">
                Chuyến tàu
              </span>
            </h3>
            <div className="flex gap-4 mt-3">
              <span className="flex items-center gap-1 text-green-700 text-xs bg-green-100/60 px-2.5 py-0.5 rounded-full font-bold">
                <span className="material-symbols-outlined text-[14px]">
                  trending_up
                </span>{" "}
                Đang chạy: {activeSchedules}
              </span>
              <span className="text-xs text-[#3f4852]/60 flex items-center">
                Cập nhật thời gian thực
              </span>
            </div>
          </div>
          <div className="hidden sm:block h-24 w-48 opacity-30">
            <div className="h-full flex items-end gap-1.5">
              <div
                className="flex-1 bg-[#00629d] rounded-t-sm"
                style={{ height: "40%" }}
              ></div>
              <div
                className="flex-1 bg-[#00629d] rounded-t-sm"
                style={{ height: "60%" }}
              ></div>
              <div
                className="flex-1 bg-[#00629d] rounded-t-sm"
                style={{ height: "45%" }}
              ></div>
              <div
                className="flex-1 bg-[#00629d] rounded-t-sm"
                style={{ height: "80%" }}
              ></div>
              <div
                className="flex-1 bg-[#00629d] rounded-t-sm"
                style={{ height: "55%" }}
              ></div>
              <div
                className="flex-1 bg-[#00629d] rounded-t-sm"
                style={{ height: "90%" }}
              ></div>
              <div
                className="flex-1 bg-[#00629d] rounded-t-sm"
                style={{ height: "70%" }}
              ></div>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 bg-[#d3e2ed] text-[#56656e] p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.04)] border border-[#bec7d4]/10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="material-symbols-outlined text-[32px] text-[#00629d] opacity-80">
              confirmation_number
            </span>
            <span className="text-xs font-bold bg-[#00629d]/10 text-[#00629d] px-2.5 py-0.5 rounded-full">
              LIVE
            </span>
          </div>
          <div className="mt-4">
            <p className="font-label-md text-xs font-bold text-[#3f4852] opacity-80 uppercase tracking-wide">
              Ước tính vé khả dụng
            </p>
            <h3 className="text-3xl font-extrabold text-[#00629d] tracking-tight mt-1">
              {(totalSchedules * 350).toLocaleString("vi-VN")}
            </h3>
          </div>
        </div>
      </div>

      {/* Trình tự động tạo lịch trình (Hàng ngày) */}
      <div className="bg-white p-6 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-[#191c1e] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[#00629d] text-[18px]">
              sync
            </span>
            Trình tự động tạo lịch trình (Hàng ngày)
          </h4>
          <p className="text-xs text-[#3f4852]">
            Hệ thống tự động đồng bộ định kỳ lúc 00:00 hàng ngày (sinh lịch cho
            ngày thứ 30 tới). Nhấp <strong>&quot;Chạy Ngay&quot;</strong> để
            quét và tạo/bù lịch chạy cho toàn bộ{" "}
            <strong>30 ngày tiếp theo</strong> dựa trên các mẫu đang hoạt động.
          </p>
        </div>
        <button
          onClick={handleTriggerAutoGenerate}
          disabled={triggeringAuto}
          className="px-4 py-2.5 bg-[#d6e5ef] hover:bg-[#c3d7e6] text-[#00629d] disabled:opacity-60 rounded-xl font-semibold text-xs transition-all active:scale-95 flex items-center justify-center gap-1.5 self-start sm:self-center shrink-0 border-none cursor-pointer"
        >
          {triggeringAuto ? (
            <>
              <span className="material-symbols-outlined text-[16px] animate-spin">
                progress_activity
              </span>
              Đang đồng bộ...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[16px]">
                bolt
              </span>
              Chạy Ngay (Đồng bộ 30 Ngày)
            </>
          )}
        </button>
      </div>

      {/* ── RouteTemplate Management Section ── */}
      <div className="bg-white rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-[#bec7d4]/10">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-violet-600 text-[20px]">
                calendar_clock
              </span>
            </div>
            <div>
              <h3 className="font-bold text-[#191c1e] text-sm">
                Mẫu Lịch Chạy (RouteTemplate)
              </h3>
              <p className="text-xs text-[#3f4852]/60">
                Định nghĩa nền tảng cho tự động gen lịch trình hàng ngày
              </p>
            </div>
            <div className="flex gap-2 ml-1">
              <span className="text-xs font-bold bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full">
                {templates.filter((t) => t.isActive).length} đang hoạt động
              </span>
              <span className="text-xs font-bold bg-[#f2f4f6] text-[#3f4852] px-2.5 py-0.5 rounded-full">
                {templates.filter((t) => !t.isActive).length} đã tắt
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openAddTemplate}
              className="px-3.5 py-2 bg-[#00629d] hover:bg-[#00629d]/90 text-white rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-all active:scale-95 border-none cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Thêm mẫu
            </button>
            <button
              onClick={() => setShowTemplateSection((s) => !s)}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-[#3f4852] hover:bg-[#f2f4f6] transition-all border-none bg-transparent cursor-pointer"
              title={showTemplateSection ? "Thu gọn" : "Mở rộng"}
            >
              <span className="material-symbols-outlined text-[20px]">
                {showTemplateSection ? "expand_less" : "expand_more"}
              </span>
            </button>
          </div>
        </div>

        {showTemplateSection && (
          <>
            {/* Info Banner */}
            <div className="px-6 py-3 bg-violet-50/60 border-b border-violet-100/60 flex items-start gap-2">
              <span className="material-symbols-outlined text-violet-500 text-[16px] mt-0.5 shrink-0">
                info
              </span>
              <p className="text-xs text-violet-700 leading-relaxed">
                Mỗi mẫu lịch chạy xác định{" "}
                <strong>tuyến đường + tàu + giờ khởi hành</strong>. Khi kích
                hoạt &quot;Chạy Ngay&quot; hoặc lịch tự động 00:00 hàng ngày, hệ
                thống chỉ sinh lịch từ <strong>các mẫu đang hoạt động</strong>.
                Mẫu không hoạt động sẽ bị bỏ qua hoàn toàn.
              </p>
            </div>

            {/* Table */}
            {templates.length === 0 ? (
              <div className="py-14 text-center">
                <span className="material-symbols-outlined text-5xl text-[#bec7d4] block mb-3">
                  calendar_clock
                </span>
                <p className="font-bold text-[#191c1e] text-sm">
                  Chưa có mẫu lịch chạy nào
                </p>
                <p className="text-xs text-[#3f4852]/60 mt-1">
                  Thêm mẫu để hệ thống có thể tự động gen lịch trình
                </p>
                <button
                  onClick={openAddTemplate}
                  className="mt-4 px-4 py-2 bg-[#00629d] text-white rounded-xl font-semibold text-xs cursor-pointer border-none hover:bg-[#00629d]/90 transition-all"
                >
                  Thêm mẫu đầu tiên
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#f7f9fb]/80 border-b border-[#bec7d4]/20">
                      <th className="px-6 py-3.5 font-semibold text-[#3f4852] text-xs uppercase tracking-wide">
                        Tuyến đường
                      </th>
                      <th className="px-6 py-3.5 font-semibold text-[#3f4852] text-xs uppercase tracking-wide">
                        Tàu
                      </th>
                      <th className="px-6 py-3.5 font-semibold text-[#3f4852] text-xs uppercase tracking-wide">
                        Giờ khởi hành
                      </th>
                      <th className="px-6 py-3.5 font-semibold text-[#3f4852] text-xs uppercase tracking-wide text-center">
                        Buffer
                      </th>
                      <th className="px-6 py-3.5 font-semibold text-[#3f4852] text-xs uppercase tracking-wide text-center">
                        Hoạt động
                      </th>
                      <th className="px-6 py-3.5 font-semibold text-[#3f4852] text-xs uppercase tracking-wide text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#bec7d4]/10">
                    {templates.map((tpl) => (
                      <tr
                        key={tpl.id}
                        className="hover:bg-[#f7f9fb] transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[#191c1e]">
                              {tpl.route?.startStation?.stationCode}
                            </span>
                            <span className="material-symbols-outlined text-[14px] text-[#6f7883] opacity-50">
                              arrow_forward
                            </span>
                            <span className="font-bold text-sm text-[#00629d]">
                              {tpl.route?.endStation?.stationCode}
                            </span>
                          </div>
                          <p className="text-xs text-[#3f4852]/50 mt-0.5 truncate max-w-[220px]">
                            {tpl.route?.startStation?.stationName} →{" "}
                            {tpl.route?.endStation?.stationName}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#cfe5ff]/40 rounded-lg">
                            <span className="material-symbols-outlined text-[14px] text-[#00629d]">
                              train
                            </span>
                            <span className="font-bold text-sm text-[#00629d]">
                              {tpl.train?.trainCode}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {tpl.departureTimes.map((t) => (
                              <span
                                key={t}
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#e8f4fd] text-[#005a90] text-xs font-bold rounded-lg border border-[#bde0f7]"
                              >
                                <span className="material-symbols-outlined text-[11px]">
                                  schedule
                                </span>
                                {t}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-xs font-semibold text-[#3f4852] bg-[#f2f4f6] px-2.5 py-1 rounded-lg">
                            {tpl.bufferMinutes} phút
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleToggleTemplateActive(tpl.id)}
                              className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors cursor-pointer border-none focus:outline-none ${
                                tpl.isActive ? "bg-[#00629d]" : "bg-[#bec7d4]"
                              }`}
                              title={tpl.isActive ? "Tắt mẫu" : "Kích hoạt mẫu"}
                            >
                              <span
                                className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                                  tpl.isActive
                                    ? "translate-x-5"
                                    : "translate-x-0.5"
                                }`}
                              />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => openEditTemplate(tpl)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#00629d] hover:bg-white hover:shadow-sm transition-all cursor-pointer border-none bg-transparent"
                              title="Chỉnh sửa"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                edit
                              </span>
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(tpl.id)}
                              className="w-8 h-8 rounded-lg flex items-center justify-center text-[#ba1a1a] hover:bg-white hover:shadow-sm transition-all cursor-pointer border-none bg-transparent"
                              title="Xóa mẫu"
                            >
                              <span className="material-symbols-outlined text-[18px]">
                                delete
                              </span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-5 rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block font-label-sm text-xs font-bold text-[#3f4852] mb-2">
            Tìm kiếm mã tàu/tuyến
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7883]">
              search
            </span>
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#f2f4f6] rounded-xl border-none focus:ring-2 focus:ring-[#00a3ff] outline-none text-sm"
              placeholder="VD: SE1, Hà Nội..."
              type="text"
            />
          </div>
        </div>

        <div className="w-full md:w-auto min-w-[180px]">
          <label className="block font-label-sm text-xs font-bold text-[#3f4852] mb-2">
            Ngày khởi hành
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#6f7883]">
              calendar_month
            </span>
            <input
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-[#f2f4f6] rounded-xl border-none focus:ring-2 focus:ring-[#00a3ff] outline-none text-sm cursor-pointer"
              type="date"
            />
          </div>
        </div>

        <div className="w-full md:w-auto min-w-[160px]">
          <label className="block font-label-sm text-xs font-bold text-[#3f4852] mb-2">
            Trạng thái chạy tàu
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#f2f4f6] rounded-xl border-none focus:ring-2 focus:ring-[#00a3ff] outline-none text-sm cursor-pointer"
          >
            <option value="Tất cả">Tất cả</option>
            <option value="Đang chạy">Đang chạy</option>
            <option value="Chưa chạy">Chưa chạy</option>
            <option value="Hoàn thành">Hoàn thành</option>
            <option value="Hủy bỏ">Hủy bỏ</option>
          </select>
        </div>

        {(searchTerm || filterDate || filterStatus !== "Tất cả") && (
          <button
            onClick={() => {
              setSearchTerm("");
              setFilterDate("");
              setFilterStatus("Tất cả");
            }}
            className="bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer"
            title="Xóa bộ lọc"
          >
            <span className="material-symbols-outlined text-[18px]">
              filter_alt_off
            </span>
            Xóa lọc
          </button>
        )}

        <button
          onClick={() => loadAll({ force: true })}
          className="bg-[#f2f4f6] text-[#00629d] hover:bg-[#cfe5ff]/50 p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer border-none"
          title="Tải lại dữ liệu"
        >
          <span className="material-symbols-outlined">refresh</span>
        </button>
      </div>

      {/* Schedule Table (Modern List Pattern) */}
      <div className="bg-white rounded-2xl shadow-[0px_10px_30px_rgba(0,163,255,0.06)] border border-[#bec7d4]/10 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#3f4852]">
            <span className="material-symbols-outlined animate-spin text-4xl text-[#00629d] mb-2">
              progress_activity
            </span>
            <p className="text-sm font-medium">
              Đang tải danh sách lịch trình...
            </p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-20 text-[#3f4852]/60">
            <span className="material-symbols-outlined text-6xl block text-[#6f7883] mb-3">
              calendar_today
            </span>
            <p className="font-bold text-base text-[#191c1e]">
              Không tìm thấy lịch trình nào
            </p>
            <p className="text-sm mt-1 text-[#3f4852]">
              Hãy thay đổi bộ lọc hoặc thêm mới lịch trình tự động.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f2f4f6]/50 border-b border-[#bec7d4]/20">
                  <th className="px-6 py-4 font-semibold text-[#3f4852] text-xs uppercase tracking-wide">
                    Mã Tàu
                  </th>
                  <th className="px-6 py-4 font-semibold text-[#3f4852] text-xs uppercase tracking-wide">
                    Lộ Trình & Tuyến
                  </th>
                  <th className="px-6 py-4 font-semibold text-[#3f4852] text-xs uppercase tracking-wide">
                    Thời Gian Khởi Hành
                  </th>
                  <th className="px-6 py-4 font-semibold text-[#3f4852] text-xs uppercase tracking-wide text-center">
                    Trạng Thái
                  </th>
                  <th className="px-6 py-4 font-semibold text-[#3f4852] text-xs uppercase tracking-wide text-right">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bec7d4]/10">
                {currentItems.map((s) => {
                  const status = getScheduleStatus(s);
                  const stopsCount = s.route?.stations?.length || 0;
                  const stopsString = s.route?.stations
                    ? s.route.stations
                        .map((st) => st.station?.stationName || st.stationName)
                        .join(" - ")
                    : "";

                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-[#f7f9fb] transition-colors group cursor-default"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#00629d]/5 flex items-center justify-center text-[#00629d] font-bold text-sm">
                            {s.train?.trainCode || "TÀU"}
                          </div>
                          <span className="font-semibold text-sm text-[#191c1e]">
                            {s.train?.trainName || "Tàu hành khách"}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-[#191c1e]">
                            {s.route?.startStation?.stationName || "Ga đi"}
                          </span>
                          <span className="material-symbols-outlined text-[16px] text-[#6f7883] opacity-40">
                            arrow_forward
                          </span>
                          <span className="font-semibold text-sm text-[#00629d]">
                            {s.route?.endStation?.stationName || "Ga đến"}
                          </span>
                        </div>
                        <p className="text-xs text-[#3f4852]/60 mt-1 truncate max-w-xs">
                          {stopsCount > 0
                            ? `Qua ${stopsCount} ga dừng: ${stopsString}`
                            : `Tuyến thẳng từ ${s.route?.startStation?.stationName || "Ga đi"} đến ${s.route?.endStation?.stationName || "Ga đến"}`}
                        </p>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex flex-col">
                          <span className="font-semibold text-sm text-[#191c1e]">
                            {new Date(s.departureTime).toLocaleTimeString(
                              "vi-VN",
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </span>
                          <span className="text-xs text-[#3f4852]/60 mt-0.5">
                            {new Date(s.departureTime).toLocaleDateString(
                              "vi-VN",
                              {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-center">
                          <span
                            className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                              STATUS_BADGE_CLASS[status] ||
                              "bg-[#f2f4f6] text-[#3f4852] border-[#bec7d4]"
                            }`}
                          >
                            {status}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setActiveDetails(s)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#3f4852] hover:bg-white hover:shadow-sm hover:text-[#00a3ff] transition-all cursor-pointer border-none bg-transparent"
                            title="Xem chi tiết"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              visibility
                            </span>
                          </button>
                          <button
                            onClick={() => handleViewTimeline(s.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#7c4dff] hover:bg-white hover:shadow-sm hover:text-[#5e35b1] transition-all cursor-pointer border-none bg-transparent"
                            title="Xem lịch trình tuyến tính"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              route
                            </span>
                          </button>
                          <button
                            onClick={() => {
                              toast.info(
                                "Tính năng chỉnh sửa lịch trình đơn lẻ đang được phát triển.",
                              );
                            }}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#00629d] hover:bg-white hover:shadow-sm hover:text-[#005a90] transition-all cursor-pointer border-none bg-transparent"
                            title="Chỉnh sửa"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              edit
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteSchedule(
                                s.id,
                                `${s.train?.trainCode} (${s.route?.routeName})`,
                              )
                            }
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#ba1a1a] hover:bg-white hover:shadow-sm hover:text-red-700 transition-all cursor-pointer border-none bg-transparent"
                            title="Xóa"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              delete
                            </span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination bar */}
        {!loading && filteredSchedules.length > 0 && (
          <div className="px-6 py-4 bg-[#f2f4f6]/30 border-t border-[#bec7d4]/20 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#3f4852]/60">
              Hiển thị{" "}
              <span className="font-semibold text-[#191c1e]">
                {indexOfFirstItem + 1}
              </span>{" "}
              -{" "}
              <span className="font-semibold text-[#191c1e]">
                {Math.min(indexOfLastItem, filteredSchedules.length)}
              </span>{" "}
              trong tổng số{" "}
              <span className="font-semibold text-[#191c1e]">
                {filteredSchedules.length}
              </span>{" "}
              lịch trình
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#3f4852] hover:bg-white border border-[#bec7d4]/50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_left
                </span>
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (p) =>
                    p === 1 ||
                    p === totalPages ||
                    Math.abs(p - currentPage) <= 1,
                )
                .map((p, idx, arr) => (
                  <span key={p} className="flex items-center">
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1.5 text-[#3f4852]/40 text-xs">
                        …
                      </span>
                    )}
                    <button
                      onClick={() => setCurrentPage(p)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold text-xs transition-all cursor-pointer border ${
                        p === currentPage
                          ? "bg-[#00629d] text-white border-[#00629d]"
                          : "border-[#bec7d4]/50 hover:bg-white text-[#3f4852]"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}

              <button
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#3f4852] hover:bg-white border border-[#bec7d4]/50 disabled:opacity-30 disabled:hover:bg-transparent transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">
                  chevron_right
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Add Schedule Modal (Drawer style / Centered Modal) ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-lg p-6 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-[#bec7d4]/10 pb-4 mb-5">
              <h3 className="font-bold text-lg text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#00629d]">
                  calendar_today
                </span>
                Gen lịch trình theo khoảng thời gian
              </h3>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setConflicts([]);
                }}
                className="text-[#6f7883] hover:text-[#191c1e] p-1 rounded-lg hover:bg-[#f2f4f6] transition-all cursor-pointer border-none bg-transparent"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSchedules} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Tuyến đường hoạt động *
                </label>
                <select
                  required
                  value={schedForm.routeId}
                  onChange={(e) =>
                    setSchedForm({ ...schedForm, routeId: e.target.value })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white cursor-pointer"
                >
                  <option value="">-- Chọn tuyến đường --</option>
                  {routes
                    .filter((r) => r.isActive !== false)
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
                  Tàu hỏa chạy *
                </label>
                <select
                  required
                  value={schedForm.trainId}
                  onChange={(e) =>
                    setSchedForm({ ...schedForm, trainId: e.target.value })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white cursor-pointer"
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
                    Ngày khởi chạy *
                  </label>
                  <input
                    required
                    type="date"
                    value={schedForm.startDate}
                    onChange={(e) =>
                      setSchedForm({ ...schedForm, startDate: e.target.value })
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none cursor-pointer"
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
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Giờ khởi hành hàng ngày *
                  <span className="text-[#3f4852]/60 font-normal ml-1">
                    (phân tách nhiều giờ bằng dấu phẩy)
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
                <TripPreview
                  selectedRoute={routes.find((r) => r.id === schedForm.routeId)}
                  departureTimes={schedForm.departureTimes}
                  bufferMinutes={schedForm.bufferMinutes}
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

              <div className="flex gap-3 pt-3 border-t border-[#bec7d4]/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setConflicts([]);
                  }}
                  className="flex-1 py-3 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors cursor-pointer"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={
                    schedSubmitting ||
                    routes.length === 0 ||
                    trains.length === 0
                  }
                  className="flex-1 py-3 rounded-xl bg-[#00629d] hover:bg-[#00629d]/90 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  {schedSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      Đang sinh lịch trình...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">
                        auto_schedule
                      </span>
                      Bắt đầu Gen lịch trình
                    </>
                  )}
                </button>
              </div>
            </form>

            {conflicts.length > 0 && (
              <div className="mt-5 p-4 bg-[#ffdad6]/40 border border-[#ba1a1a]/20 rounded-xl">
                <p className="text-sm font-bold text-[#ba1a1a] flex items-center gap-1 mb-2">
                  <span className="material-symbols-outlined text-[18px]">
                    warning
                  </span>
                  Xung đột phát hiện ({conflicts.length} lịch trùng):
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {conflicts.map((c, i) => (
                    <div
                      key={i}
                      className="text-xs bg-white rounded-lg p-2.5 border border-[#ba1a1a]/10"
                    >
                      <p className="font-semibold text-[#191c1e]">
                        Đề xuất: {formatDateTime(c.proposedDeparture)} →{" "}
                        {formatDateTime(c.proposedArrival)}
                      </p>
                      <p className="text-[#ba1a1a] mt-1">
                        Trùng lịch hiện tại:{" "}
                        {formatDateTime(c.conflictingDeparture)} →{" "}
                        {formatDateTime(c.conflictingArrival)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail Modal ── */}
      {activeDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-md p-6 relative">
            <button
              onClick={() => setActiveDetails(null)}
              className="absolute top-4 right-4 text-[#6f7883] hover:text-[#191c1e] p-1 rounded-lg hover:bg-[#f2f4f6] transition-all cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <div className="flex items-center gap-3 border-b border-[#bec7d4]/10 pb-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#00629d]/10 flex items-center justify-center text-[#00629d] font-bold text-lg shrink-0">
                {activeDetails.train?.trainCode || "TÀU"}
              </div>
              <div>
                <h3 className="font-bold text-[#191c1e] text-base">
                  {activeDetails.train?.trainName || "Tàu hành khách"}
                </h3>
                <p className="text-xs text-[#3f4852]/60">
                  Mã lịch trình: {activeDetails.id}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-[11px] text-[#3f4852]/60 font-bold uppercase tracking-wide">
                  Tuyến đường
                </p>
                <p className="text-sm font-semibold text-[#191c1e] mt-0.5">
                  {activeDetails.route?.routeName || "Chưa xác định"}
                </p>
              </div>

              <div className="flex justify-between border-t border-[#bec7d4]/10 pt-3">
                <div>
                  <p className="text-[11px] text-[#3f4852]/60 font-bold uppercase tracking-wide">
                    Ga xuất phát
                  </p>
                  <p className="text-sm font-semibold text-[#191c1e] mt-0.5">
                    {activeDetails.route?.startStation?.stationName ||
                      "Ga khởi hành"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-[#3f4852]/60 font-bold uppercase tracking-wide">
                    Ga kết thúc
                  </p>
                  <p className="text-sm font-semibold text-[#00629d] mt-0.5">
                    {activeDetails.route?.endStation?.stationName ||
                      "Ga kết thúc"}
                  </p>
                </div>
              </div>

              {activeDetails.route?.stations &&
                activeDetails.route.stations.length > 0 && (
                  <div>
                    <p className="text-[11px] text-[#3f4852]/60 font-bold uppercase tracking-wide mb-1.5">
                      Lộ trình ga trung gian
                    </p>
                    <div className="relative border-l-2 border-[#00629d]/20 ml-2 pl-4 space-y-2">
                      {activeDetails.route.stations.map((st, i) => (
                        <div key={i} className="relative">
                          <div className="absolute -left-[21px] top-1.5 w-2 h-2 rounded-full bg-[#00629d]" />
                          <span className="text-xs font-semibold text-[#191c1e]">
                            {st.station?.stationName || st.stationName}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="border-t border-[#bec7d4]/10 pt-3">
                <p className="text-[11px] text-[#3f4852]/60 font-bold uppercase tracking-wide">
                  Thời gian đi
                </p>
                <p className="text-sm font-semibold text-[#191c1e] mt-0.5">
                  Khởi hành: {formatDateTime(activeDetails.departureTime)}
                </p>
                {activeDetails.arrivalTime && (
                  <p className="text-sm font-semibold text-[#191c1e] mt-0.5">
                    Đến nơi (dự kiến):{" "}
                    {formatDateTime(activeDetails.arrivalTime)}
                  </p>
                )}
              </div>

              <div className="border-t border-[#bec7d4]/10 pt-3 flex justify-between items-center">
                <p className="text-xs font-semibold text-[#3f4852]">
                  Trạng thái chạy
                </p>
                <span
                  className={`px-3 py-1 rounded-full text-[11px] font-bold border uppercase tracking-wider ${
                    STATUS_BADGE_CLASS[getScheduleStatus(activeDetails)] ||
                    "bg-[#f2f4f6] text-[#3f4852] border-[#bec7d4]"
                  }`}
                >
                  {getScheduleStatus(activeDetails)}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveDetails(null)}
              className="mt-6 w-full py-2.5 rounded-xl bg-[#f2f4f6] hover:bg-[#eceef0] text-[#3f4852] font-semibold text-sm transition-all cursor-pointer border-none"
            >
              Đóng chi tiết
            </button>
          </div>
        </div>
      )}

      {/* ── RouteTemplate Add/Edit Modal ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.18)] border border-[#bec7d4]/20 w-full max-w-md p-6 my-8">
            <div className="flex items-center justify-between border-b border-[#bec7d4]/10 pb-4 mb-5">
              <h3 className="font-bold text-lg text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-600">
                  calendar_clock
                </span>
                {editingTemplate
                  ? "Chỉnh sửa mẫu lịch chạy"
                  : "Thêm mẫu lịch chạy"}
              </h3>
              <button
                onClick={() => {
                  setShowTemplateModal(false);
                  setEditingTemplate(null);
                }}
                className="text-[#6f7883] hover:text-[#191c1e] p-1 rounded-lg hover:bg-[#f2f4f6] transition-all cursor-pointer border-none bg-transparent"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Tuyến đường *
                </label>
                <select
                  required
                  value={templateForm.routeId}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      routeId: e.target.value,
                    })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white cursor-pointer"
                >
                  <option value="">-- Chọn tuyến đường --</option>
                  {routes
                    .filter((r) => r.isActive !== false)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.routeName} ({r.startStation?.stationName} →{" "}
                        {r.endStation?.stationName})
                      </option>
                    ))}
                </select>
                {routes.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    ⚠ Không có tuyến nào — dữ liệu sẽ được giữ nguyên khi lưu.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Tàu hỏa *
                </label>
                <select
                  required
                  value={templateForm.trainId}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      trainId: e.target.value,
                    })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none bg-white cursor-pointer"
                >
                  <option value="">-- Chọn tàu hỏa --</option>
                  {trains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.trainName} ({t.trainCode})
                    </option>
                  ))}
                </select>
                {trains.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    ⚠ Không có tàu nào — dữ liệu sẽ được giữ nguyên khi lưu.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Giờ khởi hành hàng ngày *
                  <span className="font-normal text-[#3f4852]/60 ml-1">
                    (phân tách bằng dấu phẩy)
                  </span>
                </label>
                <input
                  required
                  value={templateForm.departureTimes}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      departureTimes: e.target.value,
                    })
                  }
                  placeholder="06:00, 14:00, 22:00"
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                />
                <p className="text-[11px] text-[#3f4852]/60 mt-1">
                  VD: <code>06:00, 14:30, 22:00</code> — mỗi giờ sẽ tạo 1 lịch
                  mỗi ngày.
                </p>
                <TripPreview
                  selectedRoute={routes.find(
                    (r) => r.id === templateForm.routeId,
                  )}
                  departureTimes={templateForm.departureTimes}
                  bufferMinutes={templateForm.bufferMinutes}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Thời gian nghỉ tại mỗi ga (phút)
                </label>
                <input
                  type="number"
                  min="0"
                  max="480"
                  value={templateForm.bufferMinutes}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
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

              <div className="flex items-center justify-between py-3 px-4 bg-[#f7f9fb] rounded-xl border border-[#bec7d4]/20">
                <div>
                  <p className="text-xs font-semibold text-[#191c1e]">
                    Kích hoạt mẫu
                  </p>
                  <p className="text-[11px] text-[#3f4852]/60 mt-0.5">
                    Mẫu sẽ được dùng trong lần gen lịch tiếp theo
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setTemplateForm((f) => ({ ...f, isActive: !f.isActive }))
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer border-none focus:outline-none ${
                    templateForm.isActive ? "bg-[#00629d]" : "bg-[#bec7d4]"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
                      templateForm.isActive ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              <div className="flex gap-3 pt-3 border-t border-[#bec7d4]/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={templateSubmitting}
                  className="flex-1 py-3 rounded-xl bg-[#00629d] hover:bg-[#00629d]/90 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  {templateSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">
                        {editingTemplate ? "save" : "add"}
                      </span>
                      {editingTemplate ? "Cập nhật" : "Thêm mẫu"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sticky Footer matching HTML */}
      <footer className="py-4 border-t border-[#bec7d4]/10 flex flex-col sm:flex-row items-center justify-between text-xs text-[#3f4852]/40 gap-2">
        <div>© 2026 GoTrain VN System Admin</div>
        <div className="flex gap-4">
          <span>Trạng thái máy chủ: Ổn định</span>
          <span>Version 2.4.1-stable</span>
        </div>
      </footer>

      {/* ── Timeline Loading Overlay ── */}
      {timelineLoading && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-3 shadow-2xl">
            <span className="material-symbols-outlined animate-spin text-4xl text-[#00629d]">
              progress_activity
            </span>
            <p className="text-sm font-semibold text-[#191c1e]">
              Đang tải lịch trình liên tục...
            </p>
          </div>
        </div>
      )}

      {/* ── Train Timeline Modal ── */}
      {timelineSchedule && !timelineLoading && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-7 py-5 border-b border-[#bec7d4]/20 flex items-start justify-between bg-gradient-to-r from-[#00629d]/5 to-[#7c4dff]/5">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-[#00629d] text-[20px]">
                    train
                  </span>
                  <span className="font-extrabold text-lg text-[#191c1e]">
                    {timelineSchedule.schedule.train?.trainName}
                  </span>
                  <span className="text-xs bg-[#00629d]/10 text-[#00629d] px-2 py-0.5 rounded-full font-bold">
                    {timelineSchedule.schedule.train?.trainCode}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold border uppercase ${
                      STATUS_BADGE_CLASS[
                        getScheduleStatus(timelineSchedule.schedule)
                      ] || "bg-[#f2f4f6] text-[#3f4852] border-[#bec7d4]"
                    }`}
                  >
                    {getScheduleStatus(timelineSchedule.schedule)}
                  </span>
                </div>
                <p className="text-sm text-[#3f4852] font-medium">
                  {timelineSchedule.schedule.routeName} &nbsp;·&nbsp;
                  <span className="text-[#00629d] font-semibold">
                    {timelineSchedule.schedule.distance} km
                  </span>
                  &nbsp;·&nbsp;
                  {Math.floor(
                    (timelineSchedule.schedule.duration || 0) / 60,
                  )}h {(timelineSchedule.schedule.duration || 0) % 60}m hành
                  trình
                </p>
              </div>
              <button
                onClick={() => setTimelineSchedule(null)}
                className="p-2 hover:bg-[#f2f4f6] rounded-xl transition-all text-[#3f4852] hover:text-[#191c1e] cursor-pointer border-none bg-transparent flex-shrink-0"
              >
                <span className="material-symbols-outlined text-[22px]">
                  close
                </span>
              </button>
            </div>

            {/* Timeline body */}
            <div className="overflow-y-auto flex-1 px-7 py-6">
              <h4 className="text-xs font-bold text-[#3f4852] uppercase tracking-widest mb-5 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#7c4dff] text-[16px]">
                  route
                </span>
                Lịch Trình Nối Tiếp Liên Tục
              </h4>

              <div className="relative">
                {timelineSchedule.timeline.map((point, idx) => {
                  const isStart = point.type === "START";
                  const isEnd = point.type === "END";
                  const isLast = idx === timelineSchedule.timeline.length - 1;

                  const dotColor = isStart
                    ? "bg-[#00629d] ring-[#00629d]/20"
                    : isEnd
                      ? "bg-[#7c4dff] ring-[#7c4dff]/20"
                      : "bg-white ring-[#00629d]/30 border-2 border-[#00629d]";

                  const labelColor = isStart
                    ? "text-[#00629d]"
                    : isEnd
                      ? "text-[#7c4dff]"
                      : "text-[#191c1e]";

                  const timeDisplay = isStart
                    ? formatDateTime(point.departureTime)
                    : isEnd
                      ? formatDateTime(point.arrivalTime)
                      : `${formatDateTime(point.arrivalTime)} → ${formatDateTime(point.departureTime)}`;

                  return (
                    <div key={idx} className="flex gap-4">
                      {/* Left: dot + connector line */}
                      <div className="flex flex-col items-center flex-shrink-0">
                        <div
                          className={`w-5 h-5 rounded-full ring-4 flex items-center justify-center mt-0.5 flex-shrink-0 ${dotColor}`}
                        >
                          {(isStart || isEnd) && (
                            <span className="material-symbols-outlined text-white text-[10px]">
                              {isStart ? "play_arrow" : "flag"}
                            </span>
                          )}
                        </div>
                        {!isLast && (
                          <div className="flex-1 w-px min-h-[40px] bg-gradient-to-b from-[#00629d]/40 to-[#7c4dff]/40 my-1" />
                        )}
                      </div>

                      {/* Right: stop info */}
                      <div
                        className={`pb-6 ${isLast ? "pb-0" : ""} flex-1 min-w-0`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className={`font-bold text-base leading-tight ${labelColor}`}
                              >
                                {point.stationName}
                              </p>
                              {isStart && (
                                <span className="text-[10px] bg-[#00629d] text-white px-1.5 py-0.5 rounded-full font-bold">
                                  GA ĐẦU
                                </span>
                              )}
                              {isEnd && (
                                <span className="text-[10px] bg-[#7c4dff] text-white px-1.5 py-0.5 rounded-full font-bold">
                                  GA CUỐI
                                </span>
                              )}
                              {!isStart && !isEnd && (
                                <span className="text-[10px] bg-[#cfe5ff] text-[#00629d] px-1.5 py-0.5 rounded-full font-bold">
                                  GA DỪNG #{point.stopOrder}
                                </span>
                              )}
                            </div>
                            {point.city && (
                              <p className="text-xs text-[#3f4852]/60 mt-0.5">
                                {point.city}
                              </p>
                            )}
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-bold text-[#191c1e] font-mono">
                              {timeDisplay}
                            </p>
                            {point.distanceFromStart != null && (
                              <p className="text-xs text-[#3f4852]/60 mt-0.5">
                                📍 {point.distanceFromStart} km từ ga đầu
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Segment info between stops */}
                        {!isLast && point.segmentMinutes != null && (
                          <div className="mt-2 flex items-center gap-2">
                            <div className="h-px flex-1 bg-[#bec7d4]/20" />
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#f7f9fb] border border-[#bec7d4]/20 rounded-full">
                              <span className="material-symbols-outlined text-[12px] text-[#6f7883]">
                                schedule
                              </span>
                              <span className="text-[11px] text-[#6f7883] font-semibold">
                                {Math.floor(point.segmentMinutes / 60) > 0
                                  ? `${Math.floor(point.segmentMinutes / 60)}h `
                                  : ""}
                                {point.segmentMinutes % 60}m di chuyển
                              </span>
                              {point.segmentDistanceKm != null && (
                                <>
                                  <span className="text-[#bec7d4]">·</span>
                                  <span className="text-[11px] text-[#6f7883] font-semibold">
                                    {point.segmentDistanceKm} km
                                  </span>
                                </>
                              )}
                            </div>
                            <div className="h-px flex-1 bg-[#bec7d4]/20" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Summary footer */}
              <div className="mt-6 p-4 bg-gradient-to-r from-[#00629d]/5 to-[#7c4dff]/5 border border-[#bec7d4]/20 rounded-2xl grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-[#3f4852]/60 font-semibold uppercase tracking-wide mb-1">
                    Tổng ga dừng
                  </p>
                  <p className="text-xl font-extrabold text-[#00629d]">
                    {timelineSchedule.timeline.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#3f4852]/60 font-semibold uppercase tracking-wide mb-1">
                    Khoảng cách
                  </p>
                  <p className="text-xl font-extrabold text-[#00629d]">
                    {timelineSchedule.schedule.distance} km
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#3f4852]/60 font-semibold uppercase tracking-wide mb-1">
                    Hành trình
                  </p>
                  <p className="text-xl font-extrabold text-[#7c4dff]">
                    {Math.floor((timelineSchedule.schedule.duration || 0) / 60)}
                    h {(timelineSchedule.schedule.duration || 0) % 60}m
                  </p>
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-7 py-4 border-t border-[#bec7d4]/10 flex items-center justify-between gap-3 bg-[#f7f9fb]">
              <p className="text-xs text-[#3f4852]/50">
                💡 Dữ liệu này là nền tảng để hệ thống bán vé chặng lẻ
              </p>
              <button
                onClick={() => setTimelineSchedule(null)}
                className="px-5 py-2 rounded-xl bg-[#00629d] hover:bg-[#00629d]/90 text-white font-semibold text-sm transition-all cursor-pointer border-none"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
