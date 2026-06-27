import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../../services/api";
import { toast } from "sonner";
import {
  getRoutes,
  getSchedules,
  getTrains,
} from "../../services/referenceDataApi";
import { ConfirmDialog } from "../ui/ConfirmDialog";

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
  if (s.status === "Hoàn thành") return "Hoàn thành";
  if (s.status === "Đang chạy") return "Đang chạy";
  if (s.status === "Chưa chạy") return "Chưa chạy";

  const now = new Date();
  const delayMs = (s.delayMinutes || 0) * 60 * 1000;
  const dep = new Date(new Date(s.departureTime).getTime() + delayMs);
  const arr = s.arrivalTime
    ? new Date(new Date(s.arrivalTime).getTime() + delayMs)
    : new Date(dep.getTime() + 6 * 3600 * 1000);

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

export function AdminSchedulePanel() {
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterStatus, setFilterStatus] = useState("Tất cả");
  const [filterTrainId, setFilterTrainId] = useState("Tất cả");

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

  // Timeline Modal
  const [timelineSchedule, setTimelineSchedule] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Live Tracking Modal states
  const [showLiveModal, setShowLiveModal] = useState(false);
  const [selectedLiveSchedule, setSelectedLiveSchedule] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [updatingLive, setUpdatingLive] = useState(false);
  const [delayMinutesVal, setDelayMinutesVal] = useState("0");
  const [liveTrackingData, setLiveTrackingData] = useState({
    speed: 0,
    temperature: 25,
    passengerCount: 0,
    latitude: 21.0285,
    longitude: 105.8542,
    currentStation: "",
    status: "ON_TIME",
  });

  const [triggeringAuto, setTriggeringAuto] = useState(false);

  // RouteTemplate Management State
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

  // ── UC-27: Create Single Schedule Modal ──────────────────────
  const [showSingleScheduleModal, setShowSingleScheduleModal] = useState(false);
  const [singleSchedForm, setSingleSchedForm] = useState({
    routeId: "",
    trainId: "",
    departureTime: "",
    bufferMinutes: "60",
    notes: "",
  });
  const [singleSchedSubmitting, setSingleSchedSubmitting] = useState(false);
  const [singleSchedPreview, setSingleSchedPreview] = useState(null);

  // ── UC-27 G3b: Stop Edit Modal ────────────────────────────────
  const [stopEditModal, setStopEditModal] = useState({
    open: false,
    scheduleId: null,
    stop: null,
    prevStop: null,
    nextStop: null,
    scheduleDep: null,
    scheduleArr: null,
    trainCode: "",
    routeName: "",
  });
  const [stopEditForm, setStopEditForm] = useState({
    arrivalTime: "",
    departureTime: "",
  });
  const [stopValidation, setStopValidation] = useState({
    loading: false,
    errors: [],
    warnings: [],
    suggestion: null,
  });
  const [stopSaving, setStopSaving] = useState(false);
  const stopValidateTimerRef = useRef(null);

  // ── UC-27: Confirm Dialog (BR-33) ─────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    title: "",
    message: "",
    severity: "warning",
    confirmText: "Xác nhận",
    loading: false,
    onConfirm: null,
  });

  const openConfirm = (opts) =>
    setConfirmDialog({ ...opts, open: true, loading: false });
  const closeConfirm = () =>
    setConfirmDialog((d) => ({ ...d, open: false, loading: false }));

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

  // Open Live Tracking & Incident Controls
  const handleOpenLiveTracking = async (schedule) => {
    setSelectedLiveSchedule(schedule);
    setDelayMinutesVal(String(schedule.delayMinutes || 0));
    setShowLiveModal(true);
    setLiveLoading(true);
    try {
      const res = await api.get(`/schedules/${schedule.id}/live-tracking`);
      setLiveTrackingData(res.data.tracking);
    } catch {
      toast.error("Không thể tải thông tin định vị thời gian thực.");
    } finally {
      setLiveLoading(false);
    }
  };

  // Update Live Telemetry parameters
  const handleUpdateLiveTelemetry = async (field, value) => {
    if (!selectedLiveSchedule) return;
    try {
      const payload = {
        ...liveTrackingData,
        [field]: value,
      };
      const res = await api.put(
        `/schedules/${selectedLiveSchedule.id}/live-tracking`,
        payload,
      );
      setLiveTrackingData(res.data.tracking);
      toast.success("Đã đồng bộ thông số live!");
    } catch {
      toast.error("Lỗi khi cập nhật thông số live.");
    }
  };

  // Submit Delay Minute Recalculations
  const handleUpdateDelay = async (e) => {
    e.preventDefault();
    if (!selectedLiveSchedule) return;
    setUpdatingLive(true);
    try {
      const res = await api.put(`/schedules/${selectedLiveSchedule.id}/delay`, {
        delayMinutes: parseInt(delayMinutesVal) || 0,
      });
      toast.success(
        res.data.message || "Cập nhật delay và tính toán lại lịch thành công!",
      );
      setShowLiveModal(false);
      loadAll({ force: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật thời gian trễ.",
      );
    } finally {
      setUpdatingLive(false);
    }
  };

  // Emergency Stop Trigger (Remote Deactivation)
  const handleEmergencyStop = async () => {
    if (!selectedLiveSchedule) return;
    if (
      !window.confirm(
        "CẢNH BÁO CỰC KỲ QUAN TRỌNG: Bạn có chắc chắn muốn DỪNG TÀU KHẨN CẤP? Lịch trình này sẽ bị HỦY, hệ thống sẽ tự động hoàn tiền cho khách hàng và đưa tàu đi sửa chữa lập tức.",
      )
    )
      return;

    setUpdatingLive(true);
    try {
      // 1. Deactivate train to MAINTENANCE status
      await api.put(`/trains/${selectedLiveSchedule.trainId}/status`, {
        status: "MAINTENANCE",
      });

      // 2. Establish Emergency Maintenance Log
      const now = new Date();
      const end = new Date(now.getTime() + 24 * 3600 * 1000); // 1 day
      await api.post("/maintenance", {
        trainId: selectedLiveSchedule.trainId,
        maintenanceType: "EMERGENCY",
        description:
          "DỪNG TÀU KHẨN CẤP: Gặp sự cố động cơ đột xuất trên hành trình.",
        startDate: now.toISOString(),
        endDate: end.toISOString(),
        affectedScheduleIds: [selectedLiveSchedule.id],
        notes: "Dừng tàu khẩn cấp do can thiệp từ xa của Admin.",
      });

      toast.success(
        "Đã kích hoạt dừng tàu khẩn cấp và chuyển tàu đi bảo trì thành công!",
      );
      setShowLiveModal(false);
      loadAll({ force: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Không thể thực hiện dừng tàu khẩn cấp.",
      );
    } finally {
      setUpdatingLive(false);
    }
  };

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
    openConfirm({
      title: "Xóa mẫu lịch chạy",
      message:
        "Bạn có chắc chắn muốn xóa mẫu lịch chạy này? Thao tác không thể hoàn tác.",
      severity: "danger",
      confirmText: "Xóa mẫu",
      onConfirm: async () => {
        setConfirmDialog((d) => ({ ...d, loading: true }));
        try {
          await api.delete(`/route-templates/${id}`);
          setTemplates((prev) => prev.filter((t) => t.id !== id));
          toast.success("Đã xóa mẫu lịch chạy thành công.");
          closeConfirm();
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Lỗi khi xóa mẫu lịch chạy.",
          );
          closeConfirm();
        }
      },
    });
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
          routeId: templateForm.routeId,
          trainId: templateForm.trainId,
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

  // ── Delete Schedule (Legacy hard-delete) ────────────────────
  const handleDeleteSchedule = async (id, name) => {
    openConfirm({
      title: `Xóa lịch trình: ${name}`,
      message:
        "Thao tác này sẽ xóa vĩnh viễn lịch trình. Nếu có hành khách đặt vé, hãy dùng 'Hủy lịch' thay thế.",
      severity: "danger",
      confirmText: "Xóa vĩnh viễn",
      onConfirm: async () => {
        setConfirmDialog((d) => ({ ...d, loading: true }));
        try {
          if (id.startsWith("mock-")) {
            setSchedules((prev) => prev.filter((s) => s.id !== id));
            toast.success("Đã xóa lịch trình (Dữ liệu mô phỏng).");
          } else {
            await api.delete(`/schedules/${id}`);
            toast.success("Đã xóa lịch trình thành công.");
            loadAll({ force: true });
          }
          closeConfirm();
        } catch (err) {
          toast.error("Không thể xóa lịch trình này.");
          closeConfirm();
        }
      },
    });
  };

  // ── UC-27 G6: Hủy lịch trình (giữ record, hoàn tiền) ────────
  const handleCancelSchedule = (schedule) => {
    const name = `${schedule.train?.trainCode} - ${schedule.route?.routeName}`;
    openConfirm({
      title: `Hủy lịch trình: ${name}`,
      message: (
        <>
          <p>
            Lịch trình <strong>{name}</strong> xuất phát lúc{" "}
            <strong>
              {new Date(schedule.departureTime).toLocaleString("vi-VN")}
            </strong>{" "}
            sẽ bị hủy.
          </p>
          <p className="mt-2 text-amber-700 bg-amber-50 rounded-lg p-2.5 text-xs">
            ⚠️ Tất cả hành khách có đặt vé CONFIRMED sẽ được hoàn tiền tự động
            và nhận email thông báo (BR-14).
          </p>
        </>
      ),
      severity: "danger",
      confirmText: "Hủy & Hoàn tiền",
      onConfirm: async () => {
        setConfirmDialog((d) => ({ ...d, loading: true }));
        try {
          const res = await api.patch(`/schedules/${schedule.id}/cancel`, {
            reason: "Admin hủy lịch trình từ bảng quản lý.",
          });
          toast.success(res.data.message || "Đã hủy lịch trình thành công.");
          closeConfirm();
          loadAll({ force: true });
        } catch (err) {
          toast.error(
            err.response?.data?.message || "Không thể hủy lịch trình.",
          );
          closeConfirm();
        }
      },
    });
  };

  // ── UC-27 G4: Tạo lịch trình đơn lẻ ─────────────────────────
  const handleCreateSingleSchedule = async (e) => {
    e.preventDefault();
    setSingleSchedSubmitting(true);
    try {
      const res = await api.post("/schedules", {
        trainId: singleSchedForm.trainId,
        routeId: singleSchedForm.routeId,
        departureTime: singleSchedForm.departureTime,
        bufferMinutes: parseInt(singleSchedForm.bufferMinutes) || 60,
        notes: singleSchedForm.notes || undefined,
      });
      toast.success(res.data.message || "Đã tạo lịch trình thành công!");
      setShowSingleScheduleModal(false);
      setSingleSchedForm({
        routeId: "",
        trainId: "",
        departureTime: "",
        bufferMinutes: "60",
        notes: "",
      });
      setSingleSchedPreview(null);
      loadAll({ force: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi tạo lịch trình.");
    } finally {
      setSingleSchedSubmitting(false);
    }
  };

  // ── UC-27 G3b: Mở modal chỉnh sửa ScheduleStop ───────────────
  const handleOpenStopEdit = (schedule, stop, allStops) => {
    const sorted = [...allStops].sort((a, b) => a.stopOrder - b.stopOrder);
    const idx = sorted.findIndex((s) => s.id === stop.id);
    setStopEditModal({
      open: true,
      scheduleId: schedule.id,
      stop,
      prevStop: idx > 0 ? sorted[idx - 1] : null,
      nextStop: idx < sorted.length - 1 ? sorted[idx + 1] : null,
      scheduleDep: schedule.departureTime,
      scheduleArr: schedule.arrivalTime,
      trainCode: schedule.train?.trainCode || "",
      routeName: schedule.route?.routeName || "",
    });
    // Pre-fill form với giờ hiện tại, convert sang local datetime-local format
    const toLocal = (iso) => {
      if (!iso) return "";
      const d = new Date(iso);
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      return d.toISOString().slice(0, 16);
    };
    setStopEditForm({
      arrivalTime: toLocal(stop.arrivalTime),
      departureTime: toLocal(stop.departureTime),
    });
    setStopValidation({
      loading: false,
      errors: [],
      warnings: [],
      suggestion: null,
    });
  };

  // ── UC-27 G3b: Debounce preview khi thay đổi giờ ─────────────
  useEffect(() => {
    if (
      !stopEditModal.open ||
      !stopEditForm.arrivalTime ||
      !stopEditForm.departureTime
    )
      return;
    clearTimeout(stopValidateTimerRef.current);
    stopValidateTimerRef.current = setTimeout(async () => {
      setStopValidation((v) => ({ ...v, loading: true }));
      try {
        const res = await api.put(
          `/schedules/${stopEditModal.scheduleId}/stops/${stopEditModal.stop?.id}?preview=true`,
          {
            arrivalTime: new Date(stopEditForm.arrivalTime).toISOString(),
            departureTime: new Date(stopEditForm.departureTime).toISOString(),
          },
        );
        setStopValidation({
          loading: false,
          errors: [],
          warnings: res.data.warnings || [],
          suggestion: res.data.suggestedDepartureTime || null,
        });
      } catch (err) {
        const msg = err.response?.data?.message || "Lỗi validate";
        const errs = err.response?.data?.errors || [msg];
        setStopValidation({
          loading: false,
          errors: errs,
          warnings: [],
          suggestion: null,
        });
      }
    }, 600);
    return () => clearTimeout(stopValidateTimerRef.current);
  }, [
    stopEditForm.arrivalTime,
    stopEditForm.departureTime,
    stopEditModal.open,
  ]);

  // ── UC-27 G3b: Lưu thay đổi ScheduleStop ─────────────────────
  const handleSaveStop = async () => {
    if (stopValidation.errors.length > 0) return;
    if (stopValidation.warnings.length > 0) {
      openConfirm({
        title: "Cảnh báo đường đơn",
        message: (
          <ul className="list-disc list-inside space-y-1 text-sm text-amber-800">
            {stopValidation.warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        ),
        severity: "warning",
        confirmText: "Vẫn lưu",
        onConfirm: async () => {
          setConfirmDialog((d) => ({ ...d, loading: true }));
          await doSaveStop();
          closeConfirm();
        },
      });
      return;
    }
    await doSaveStop();
  };

  const doSaveStop = async () => {
    setStopSaving(true);
    try {
      const res = await api.put(
        `/schedules/${stopEditModal.scheduleId}/stops/${stopEditModal.stop?.id}`,
        {
          arrivalTime: new Date(stopEditForm.arrivalTime).toISOString(),
          departureTime: new Date(stopEditForm.departureTime).toISOString(),
        },
      );
      toast.success(res.data.message || "Đã cập nhật giờ dừng.");
      setStopEditModal((m) => ({ ...m, open: false }));
      // Refresh timeline nếu đang mở
      if (timelineSchedule) {
        const tRes = await api.get(
          `/schedules/${stopEditModal.scheduleId}/timeline`,
        );
        setTimelineSchedule(tRes.data);
      }
      loadAll({ force: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi lưu.");
    } finally {
      setStopSaving(false);
    }
  };

  // ── Filter Logic ────────────────────────────────────────────────
  const filteredSchedules = schedules.filter((s) => {
    const status = getScheduleStatus(s);

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

    let matchDate = true;
    if (filterDate) {
      const sDateStr = new Date(s.departureTime).toISOString().split("T")[0];
      matchDate = sDateStr === filterDate;
    }

    const matchStatus = filterStatus === "Tất cả" || status === filterStatus;
    const matchTrain =
      filterTrainId === "Tất cả" || s.trainId === filterTrainId;

    return matchSearch && matchDate && matchStatus && matchTrain;
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
  }, [searchTerm, filterDate, filterStatus, filterTrainId]);

  // BR-32 Warning filter: find delayed schedules > 10 mins
  const delayedSchedules = schedules.filter((s) => {
    const status = getScheduleStatus(s);
    return (
      s.delayMinutes > 10 && status !== "Hoàn thành" && status !== "Hủy bỏ"
    );
  });

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
        <div className="flex gap-2">
          <button
            onClick={() => setShowSingleScheduleModal(true)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-emerald-600/20 transition-all active:scale-95 border-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              add_circle
            </span>
            Tạo lịch đơn lẻ
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-5 py-3 bg-[#00629d] hover:bg-[#00629d]/90 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#00629d]/20 transition-all active:scale-95 border-none cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">
              auto_schedule
            </span>
            Tạo hàng loạt
          </button>
        </div>
      </div>

      {/* Warning Alerts for Delays > 10 mins (BR-32) */}
      {delayedSchedules.length > 0 && (
        <div className="bg-[#ffdad6] border border-[#ba1a1a]/20 rounded-2xl p-5 flex flex-col gap-3">
          <h4 className="text-sm font-bold text-[#ba1a1a] flex items-center gap-1.5">
            <span className="material-symbols-outlined">warning</span>
            Tàu Trễ &gt; 10 phút
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {delayedSchedules.map((ds) => (
              <div
                key={ds.id}
                className="bg-white rounded-xl p-3 border border-[#ffdad6] flex items-center justify-between text-xs font-semibold"
              >
                <div>
                  <p className="text-[#ba1a1a] font-bold">
                    {ds.train?.trainCode} ({ds.route?.routeName})
                  </p>
                  <p className="text-[#3f4852] mt-0.5">
                    Số hiệu delay:{" "}
                    <strong className="text-red-600">
                      {ds.delayMinutes} phút
                    </strong>
                  </p>
                </div>
                <button
                  onClick={() => handleOpenLiveTracking(ds)}
                  className="px-2.5 py-1 bg-[#ba1a1a] hover:bg-[#ba1a1a]/90 text-white rounded-lg text-[10px] font-bold cursor-pointer border-none"
                >
                  Điều hành Live
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Summary */}
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

        <div className="w-full md:w-auto min-w-[160px]">
          <label className="block font-label-sm text-xs font-bold text-[#3f4852] mb-2">
            Đoàn tàu
          </label>
          <select
            value={filterTrainId}
            onChange={(e) => setFilterTrainId(e.target.value)}
            className="w-full px-4 py-2.5 bg-[#f2f4f6] rounded-xl border-none focus:ring-2 focus:ring-[#00a3ff] outline-none text-sm cursor-pointer"
          >
            <option value="Tất cả">Tất cả tàu</option>
            {trains.map((t) => (
              <option key={t.id} value={t.id}>
                {t.trainCode} - {t.trainName}
              </option>
            ))}
          </select>
        </div>

        {(searchTerm ||
          filterDate ||
          filterStatus !== "Tất cả" ||
          filterTrainId !== "Tất cả") && (
          <button
            onClick={() => {
              setSearchTerm("");
              setFilterDate("");
              setFilterStatus("Tất cả");
              setFilterTrainId("Tất cả");
            }}
            className="bg-[#ffdad6] text-[#ba1a1a] hover:bg-[#ffb4ab] px-4 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-1 cursor-pointer border-none"
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

      {/* Schedule Table */}
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
                            {s.delayMinutes > 0 && ` (+${s.delayMinutes}p)`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-5">
                        <div className="flex justify-end gap-1 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleOpenLiveTracking(s)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-[#d97706] hover:bg-white hover:shadow-sm hover:text-[#b45309] transition-all cursor-pointer border-none bg-transparent"
                            title="Điều hành & Giám sát Live"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              sensors
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

      {/* MODAL: LIVE TRACKING & INCIDENT DELAY MANAGEMENT */}
      {showLiveModal && selectedLiveSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0b1b2b] text-white rounded-3xl shadow-2xl border border-cyan-500/20 w-full max-w-2xl p-6 relative my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setShowLiveModal(false)}
              className="absolute top-4 right-4 text-cyan-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-all cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                <span className="material-symbols-outlined text-[24px]">
                  sensors
                </span>
              </div>
              <div>
                <h3 className="font-bold text-lg text-white">
                  Live Operations: {selectedLiveSchedule.train?.trainName} (
                  {selectedLiveSchedule.train?.trainCode})
                </h3>
                <p className="text-xs text-cyan-300/70">
                  Lộ trình: {selectedLiveSchedule.route?.routeName} · Khởi hành:{" "}
                  {formatDateTime(selectedLiveSchedule.departureTime)}
                </p>
              </div>
            </div>

            {liveLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-cyan-400">
                <span className="material-symbols-outlined animate-spin text-3xl mb-2">
                  progress_activity
                </span>
                <p className="text-sm font-semibold">
                  Đang nạp dữ liệu định vị tàu...
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Telemetry Widgets Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {/* Speed Widget */}
                  <div className="bg-[#12283f] border border-cyan-500/10 p-3 rounded-2xl flex flex-col justify-between items-center text-center">
                    <span className="material-symbols-outlined text-[24px] text-cyan-400 mb-1">
                      speed
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Tốc độ hiện tại
                    </span>
                    <span className="text-xl font-extrabold text-white mt-1">
                      {liveTrackingData.speed}{" "}
                      <span className="text-xs font-normal">km/h</span>
                    </span>
                    {/* Simulated adjustment controls */}
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() =>
                          handleUpdateLiveTelemetry(
                            "speed",
                            Math.max(0, liveTrackingData.speed - 10),
                          )
                        }
                        className="w-6 h-5 rounded bg-white/10 text-xs font-bold hover:bg-white/20"
                      >
                        -
                      </button>
                      <button
                        onClick={() =>
                          handleUpdateLiveTelemetry(
                            "speed",
                            liveTrackingData.speed + 10,
                          )
                        }
                        className="w-6 h-5 rounded bg-white/10 text-xs font-bold hover:bg-white/20"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Temp Widget */}
                  <div className="bg-[#12283f] border border-cyan-500/10 p-3 rounded-2xl flex flex-col justify-between items-center text-center">
                    <span className="material-symbols-outlined text-[24px] text-orange-400 mb-1">
                      thermostat
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Nhiệt độ toa xe
                    </span>
                    <span className="text-xl font-extrabold text-white mt-1">
                      {liveTrackingData.temperature}{" "}
                      <span className="text-xs font-normal">°C</span>
                    </span>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() =>
                          handleUpdateLiveTelemetry(
                            "temperature",
                            Math.max(16, liveTrackingData.temperature - 1),
                          )
                        }
                        className="w-6 h-5 rounded bg-white/10 text-xs font-bold hover:bg-white/20"
                      >
                        -
                      </button>
                      <button
                        onClick={() =>
                          handleUpdateLiveTelemetry(
                            "temperature",
                            Math.min(32, liveTrackingData.temperature + 1),
                          )
                        }
                        className="w-6 h-5 rounded bg-white/10 text-xs font-bold hover:bg-white/20"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Occupancy Widget */}
                  <div className="bg-[#12283f] border border-cyan-500/10 p-3 rounded-2xl flex flex-col justify-between items-center text-center">
                    <span className="material-symbols-outlined text-[24px] text-emerald-400 mb-1">
                      airline_seat_recline_normal
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Hành khách
                    </span>
                    <span className="text-xl font-extrabold text-white mt-1">
                      {liveTrackingData.passengerCount}{" "}
                      <span className="text-xs font-normal">người</span>
                    </span>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() =>
                          handleUpdateLiveTelemetry(
                            "passengerCount",
                            Math.max(0, liveTrackingData.passengerCount - 5),
                          )
                        }
                        className="w-6 h-5 rounded bg-white/10 text-xs font-bold hover:bg-white/20"
                      >
                        -
                      </button>
                      <button
                        onClick={() =>
                          handleUpdateLiveTelemetry(
                            "passengerCount",
                            liveTrackingData.passengerCount + 5,
                          )
                        }
                        className="w-6 h-5 rounded bg-white/10 text-xs font-bold hover:bg-white/20"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* GPS Widget */}
                  <div className="bg-[#12283f] border border-cyan-500/10 p-3 rounded-2xl flex flex-col justify-between items-center text-center">
                    <span className="material-symbols-outlined text-[24px] text-blue-400 mb-1">
                      distance
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                      Tọa độ GPS
                    </span>
                    <span className="text-[11px] font-mono text-white mt-1.5">
                      {liveTrackingData.latitude?.toFixed(4)},{" "}
                      {liveTrackingData.longitude?.toFixed(4)}
                    </span>
                    <div className="flex gap-1.5 mt-2">
                      <button
                        onClick={() =>
                          handleUpdateLiveTelemetry(
                            "latitude",
                            (liveTrackingData.latitude || 21.0285) + 0.01,
                          )
                        }
                        className="px-1.5 py-0.5 rounded bg-white/10 text-[9px] font-bold hover:bg-white/20"
                      >
                        Di chuyển
                      </button>
                    </div>
                  </div>
                </div>

                {/* GPS Location simulator Map mockup */}
                <div className="bg-[#0e2236] border border-white/5 p-4 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px] text-cyan-400">
                      location_on
                    </span>
                    <div className="text-left">
                      <p className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                        Vị trí hiện tại (Trạm kế)
                      </p>
                      <p className="text-sm font-bold text-white mt-0.5">
                        {liveTrackingData.currentStation ||
                          "Đang trên hành trình (Giữa các Ga)"}
                      </p>
                    </div>
                  </div>
                  <input
                    type="text"
                    placeholder="VD: Ga Phủ Lý..."
                    value={liveTrackingData.currentStation || ""}
                    onChange={(e) =>
                      setLiveTrackingData((prev) => ({
                        ...prev,
                        currentStation: e.target.value,
                      }))
                    }
                    onBlur={() =>
                      handleUpdateLiveTelemetry(
                        "currentStation",
                        liveTrackingData.currentStation,
                      )
                    }
                    className="bg-[#12283f] border border-cyan-500/20 rounded-xl px-3 py-1.5 text-xs outline-none text-white focus:ring-1 focus:ring-cyan-500"
                  />
                </div>

                {/* Delay Update Form & Stop Recalculator */}
                <div className="bg-[#12283f] border border-cyan-500/10 p-5 rounded-2xl">
                  <h4 className="font-bold text-sm text-cyan-300 mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined">schedule</span>
                    Điều hành Sự cố & Ghi nhận Delay ga đến (Recalculating)
                  </h4>
                  <form onSubmit={handleUpdateDelay} className="space-y-4">
                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                      <div className="flex-1 w-full">
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Số phút trễ kỹ thuật (Delay Minutes) *
                        </label>
                        <input
                          required
                          type="number"
                          min="0"
                          value={delayMinutesVal}
                          onChange={(e) => setDelayMinutesVal(e.target.value)}
                          className="w-full bg-[#0b1b2b] border border-cyan-500/20 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={updatingLive}
                        className="w-full sm:w-auto bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all cursor-pointer border-none flex items-center justify-center gap-1"
                      >
                        {updatingLive ? (
                          <>
                            <span className="material-symbols-outlined animate-spin text-[16px]">
                              progress_activity
                            </span>
                            Đang lưu...
                          </>
                        ) : (
                          <>
                            <span className="material-symbols-outlined text-[16px]">
                              update
                            </span>
                            Cập nhật & Tính lại lịch
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-[11px] text-cyan-300/60 leading-relaxed">
                      💡 Khi ghi nhận Delay, hệ thống sẽ tự động dời thời điểm
                      đến/đi dự kiến của ga đích chính và tất cả ga trung gian
                      dừng tiếp theo (ScheduleStop) tương ứng bằng đúng số phút
                      trễ.
                    </p>
                  </form>
                </div>

                {/* Emergency Controls (Safety rules triggers) */}
                <div className="border border-red-500/25 bg-red-500/[0.04] p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div className="text-left space-y-1">
                    <h4 className="text-sm font-bold text-red-400 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[20px]">
                        report_gmailerrorred
                      </span>
                      Dừng tàu Khẩn cấp kỹ thuật (Emergency Shutdown)
                    </h4>
                    <p className="text-xs text-slate-400 max-w-md leading-relaxed">
                      Chỉ sử dụng nút này trong tình huống khẩn cấp xảy ra tai
                      nạn hoặc hư hỏng nặng tại chỗ trên đường ray. Tàu sẽ được
                      kéo về xưởng bảo trì lập tức và các đơn đặt vé đang chờ sẽ
                      bị từ chối.
                    </p>
                  </div>
                  <button
                    onClick={handleEmergencyStop}
                    disabled={updatingLive}
                    className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs px-5 py-3 rounded-xl transition-all active:scale-95 border-none cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      dangerous
                    </span>
                    Dừng tàu khẩn cấp
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Add Schedule Modal ── */}
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
                  className="flex-1 py-3 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors cursor-pointer border-none bg-transparent"
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

      {/* ── RouteTemplate Add/Edit Modal ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-md p-6 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-[#bec7d4]/10 pb-4 mb-5">
              <h3 className="font-bold text-lg text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-violet-600">
                  calendar_clock
                </span>
                {editingTemplate
                  ? "Chỉnh sửa mẫu lịch chạy"
                  : "Thêm mới mẫu lịch chạy"}
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Đoàn tàu hoạt động *
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
                  value={templateForm.departureTimes}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      departureTimes: e.target.value,
                    })
                  }
                  placeholder="06:00, 12:00, 20:00"
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Thời gian ga nghỉ buffer (phút)
                </label>
                <input
                  type="number"
                  min="0"
                  value={templateForm.bufferMinutes}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      bufferMinutes: e.target.value,
                    })
                  }
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="templateActive"
                  checked={templateForm.isActive}
                  onChange={(e) =>
                    setTemplateForm({
                      ...templateForm,
                      isActive: e.target.checked,
                    })
                  }
                  className="rounded text-primary focus:ring-0 cursor-pointer"
                />
                <label
                  htmlFor="templateActive"
                  className="text-xs font-semibold text-[#3f4852] cursor-pointer"
                >
                  Mẫu lịch đang hoạt động (Active)
                </label>
              </div>

              <div className="flex gap-3 pt-3 border-t border-[#bec7d4]/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateModal(false);
                    setEditingTemplate(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors cursor-pointer border-none bg-transparent"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  disabled={templateSubmitting}
                  className="flex-1 py-3 rounded-xl bg-[#00629d] hover:bg-[#00629d]/90 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  {templateSubmitting ? "Đang lưu..." : "Lưu mẫu lịch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Timeline Modal ── */}
      {timelineSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-xl p-6 relative">
            <button
              onClick={() => setTimelineSchedule(null)}
              className="absolute top-4 right-4 text-[#6f7883] hover:text-[#191c1e] p-1 rounded-lg hover:bg-[#f2f4f6] transition-all cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-bold text-lg text-[#191c1e] mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#7c4dff]">
                route
              </span>
              Lịch Trình Tuyến Tính:{" "}
              {timelineSchedule.schedule.train?.trainCode}
            </h3>
            <p className="text-xs text-[#3f4852] mb-5">
              Hành trình {timelineSchedule.schedule.routeName} chi tiết từng
              chặng dừng (phút, km).
            </p>

            <div className="relative border-l-2 border-[#7c4dff]/20 ml-4 pl-6 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
              {timelineSchedule.timeline?.map((point, index) => (
                <div key={index} className="relative">
                  <div
                    className={`absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                      point.type === "START"
                        ? "bg-green-500"
                        : point.type === "END"
                          ? "bg-[#7c4dff]"
                          : "bg-amber-500"
                    }`}
                  />
                  <div>
                    <h5 className="font-bold text-sm text-[#191c1e] flex items-center gap-1.5">
                      {point.stationName} ({point.city})
                      {point.type === "START" && (
                        <span className="text-[9px] bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded-full">
                          Khởi hành
                        </span>
                      )}
                      {point.type === "END" && (
                        <span className="text-[9px] bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded-full">
                          Ga cuối
                        </span>
                      )}
                      {/* UC-27 G3b: Nút chỉnh sửa giờ dừng cho ga trung gian */}
                      {point.type === "STOP" && point.stopId && (
                        <button
                          onClick={() =>
                            handleOpenStopEdit(
                              timelineSchedule.schedule,
                              {
                                id: point.stopId,
                                stationName: point.stationName,
                                arrivalTime: point.arrivalTime,
                                departureTime: point.departureTime,
                                stopOrder: point.stopOrder,
                              },
                              timelineSchedule.timeline
                                .filter((p) => p.type === "STOP" && p.stopId)
                                .map((p) => ({
                                  id: p.stopId,
                                  arrivalTime: p.arrivalTime,
                                  departureTime: p.departureTime,
                                  stopOrder: p.stopOrder,
                                })),
                            )
                          }
                          className="ml-1 w-6 h-6 rounded-md bg-violet-50 hover:bg-violet-100 flex items-center justify-center text-violet-600 transition-all cursor-pointer border-none"
                          title="Điều chỉnh giờ dừng"
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            edit
                          </span>
                        </button>
                      )}
                    </h5>
                    <p className="text-xs text-[#3f4852]/60 mt-1">
                      {point.arrivalTime &&
                        `Đến: ${new Date(point.arrivalTime).toLocaleTimeString("vi-VN")}`}
                      {point.arrivalTime && point.departureTime && " | "}
                      {point.departureTime &&
                        `Đi: ${new Date(point.departureTime).toLocaleTimeString("vi-VN")}`}
                    </p>
                    {point.segmentMinutes != null && (
                      <p className="text-[10px] text-[#7c4dff] font-bold mt-0.5">
                        Chặng: +{point.segmentMinutes} phút (+
                        {point.segmentDistanceKm} km)
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setTimelineSchedule(null)}
              className="mt-6 w-full py-2.5 rounded-xl bg-[#f2f4f6] hover:bg-[#eceef0] text-[#3f4852] font-semibold text-sm transition-all cursor-pointer border-none"
            >
              Đóng timeline
            </button>
          </div>
        </div>
      )}

      {/* ── UC-27: Single Schedule Create Modal ── */}
      {showSingleScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,98,157,0.15)] border border-[#bec7d4]/20 w-full max-w-md p-6 my-8">
            <div className="flex items-center justify-between border-b border-[#bec7d4]/10 pb-4 mb-5">
              <h3 className="font-bold text-lg text-[#191c1e] flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-600">
                  add_circle
                </span>
                Tạo lịch trình đơn lẻ
              </h3>
              <button
                onClick={() => {
                  setShowSingleScheduleModal(false);
                  setSingleSchedPreview(null);
                }}
                className="text-[#6f7883] hover:text-[#191c1e] p-1 rounded-lg hover:bg-[#f2f4f6] transition-all cursor-pointer border-none bg-transparent"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-2">
              <span className="material-symbols-outlined text-emerald-600 text-[16px] mt-0.5 shrink-0">
                info
              </span>
              <p className="text-xs text-emerald-800">
                Giờ dừng tại các ga trung gian sẽ được{" "}
                <strong>tính tự động</strong> theo khoảng cách. Bạn có thể điều
                chỉnh sau khi tạo qua Timeline.
              </p>
            </div>

            <form onSubmit={handleCreateSingleSchedule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Tuyến đường *
                </label>
                <select
                  required
                  value={singleSchedForm.routeId}
                  onChange={(e) => {
                    setSingleSchedForm({
                      ...singleSchedForm,
                      routeId: e.target.value,
                    });
                    const r = routes.find((r) => r.id === e.target.value);
                    setSingleSchedPreview(r || null);
                  }}
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
                  Đoàn tàu *
                </label>
                <select
                  required
                  value={singleSchedForm.trainId}
                  onChange={(e) =>
                    setSingleSchedForm({
                      ...singleSchedForm,
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
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Giờ xuất phát *
                  </label>
                  <input
                    required
                    type="datetime-local"
                    min={new Date().toISOString().slice(0, 16)}
                    value={singleSchedForm.departureTime}
                    onChange={(e) =>
                      setSingleSchedForm({
                        ...singleSchedForm,
                        departureTime: e.target.value,
                      })
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Buffer tại ga (phút)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    value={singleSchedForm.bufferMinutes}
                    onChange={(e) =>
                      setSingleSchedForm({
                        ...singleSchedForm,
                        bufferMinutes: e.target.value,
                      })
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                  />
                </div>
              </div>

              {/* Preview timeline */}
              {singleSchedPreview && singleSchedForm.departureTime && (
                <div className="p-3 bg-[#f2f4f6] rounded-xl space-y-1.5">
                  <p className="text-xs font-bold text-[#3f4852] flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">
                      preview
                    </span>
                    Xem trước hành trình
                  </p>
                  <TripPreview
                    selectedRoute={singleSchedPreview}
                    departureTimes={
                      singleSchedForm.departureTime
                        .split("T")[1]
                        ?.slice(0, 5) || ""
                    }
                    bufferMinutes={singleSchedForm.bufferMinutes}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                  Ghi chú
                </label>
                <input
                  type="text"
                  value={singleSchedForm.notes}
                  onChange={(e) =>
                    setSingleSchedForm({
                      ...singleSchedForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Không bắt buộc"
                  className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#00a3ff] outline-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-[#bec7d4]/10">
                <button
                  type="button"
                  onClick={() => {
                    setShowSingleScheduleModal(false);
                    setSingleSchedPreview(null);
                  }}
                  className="flex-1 py-3 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors cursor-pointer bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={singleSchedSubmitting}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  {singleSchedSubmitting ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      Đang tạo...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">
                        add_circle
                      </span>
                      Tạo lịch trình
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── UC-27 G3b: Stop Edit Modal ── */}
      {stopEditModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between border-b border-[#bec7d4]/10 pb-4 mb-5">
              <div>
                <h3 className="font-bold text-base text-[#191c1e] flex items-center gap-2">
                  <span className="material-symbols-outlined text-violet-600 text-[20px]">
                    edit_calendar
                  </span>
                  Điều chỉnh giờ dừng — {stopEditModal.stop?.stationName}
                </h3>
                <p className="text-xs text-[#3f4852]/60 mt-0.5">
                  {stopEditModal.trainCode} | {stopEditModal.routeName}
                </p>
              </div>
              <button
                onClick={() => setStopEditModal((m) => ({ ...m, open: false }))}
                className="text-[#6f7883] hover:text-[#191c1e] p-1 rounded-lg hover:bg-[#f2f4f6] transition-all cursor-pointer border-none bg-transparent"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-100 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5 shrink-0">
                warning
              </span>
              <p className="text-xs text-amber-800">
                Thay đổi giờ dừng sẽ được kiểm tra quy tắc đường đơn tự động.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Giờ đến ga *
                  </label>
                  <input
                    type="datetime-local"
                    value={stopEditForm.arrivalTime}
                    onChange={(e) =>
                      setStopEditForm((f) => ({
                        ...f,
                        arrivalTime: e.target.value,
                      }))
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#7c4dff] outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#3f4852] mb-1">
                    Giờ đi khỏi ga *
                  </label>
                  <input
                    type="datetime-local"
                    value={stopEditForm.departureTime}
                    onChange={(e) =>
                      setStopEditForm((f) => ({
                        ...f,
                        departureTime: e.target.value,
                      }))
                    }
                    className="w-full border border-[#bec7d4]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#7c4dff] outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Real-time validation panel */}
              <div
                className={`rounded-xl border p-3 text-xs space-y-1.5 ${
                  stopValidation.loading
                    ? "bg-[#f2f4f6] border-[#bec7d4]/30"
                    : stopValidation.errors.length > 0
                      ? "bg-red-50 border-red-100"
                      : stopValidation.warnings.length > 0
                        ? "bg-amber-50 border-amber-100"
                        : "bg-green-50 border-green-100"
                }`}
              >
                {stopValidation.loading ? (
                  <div className="flex items-center gap-1.5 text-[#3f4852]">
                    <span className="material-symbols-outlined text-[14px] animate-spin">
                      progress_activity
                    </span>
                    Đang kiểm tra đường đơn...
                  </div>
                ) : stopValidation.errors.length > 0 ? (
                  <>
                    <p className="font-bold text-red-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        error
                      </span>
                      Lỗi thời gian:
                    </p>
                    {stopValidation.errors.map((e, i) => (
                      <p key={i} className="text-red-700 pl-4">
                        • {e}
                      </p>
                    ))}
                  </>
                ) : stopValidation.warnings.length > 0 ? (
                  <>
                    <p className="font-bold text-amber-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        warning
                      </span>
                      Cảnh báo đường đơn:
                    </p>
                    {stopValidation.warnings.map((w, i) => (
                      <p key={i} className="text-amber-800 pl-4">
                        • {w.message}
                      </p>
                    ))}
                    {stopValidation.suggestion && (
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(stopValidation.suggestion);
                          d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
                          setStopEditForm((f) => ({
                            ...f,
                            departureTime: d.toISOString().slice(0, 16),
                          }));
                        }}
                        className="mt-1 px-3 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-lg font-semibold cursor-pointer border-none text-[11px]"
                      >
                        📅 Tự động điều chỉnh về{" "}
                        {new Date(stopValidation.suggestion).toLocaleTimeString(
                          "vi-VN",
                        )}
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <p className="font-bold text-green-700 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        check_circle
                      </span>
                      Kiểm tra đường đơn:
                    </p>
                    <p className="text-green-700 pl-4">
                      ✅ Giãn cách cùng chiều: OK
                    </p>
                    <p className="text-green-700 pl-4">
                      ✅ Không xung đột tàu ngược chiều
                    </p>
                    <p className="text-green-700 pl-4">
                      ✅ Tuần tự thời gian hợp lệ
                    </p>
                  </>
                )}
              </div>

              <div className="flex gap-3 pt-2 border-t border-[#bec7d4]/10">
                <button
                  type="button"
                  onClick={() =>
                    setStopEditModal((m) => ({ ...m, open: false }))
                  }
                  className="flex-1 py-2.5 rounded-xl border border-[#bec7d4]/60 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] transition-colors cursor-pointer bg-transparent"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleSaveStop}
                  disabled={
                    stopSaving ||
                    stopValidation.loading ||
                    stopValidation.errors.length > 0
                  }
                  className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition-all active:scale-95 disabled:opacity-60 flex items-center justify-center gap-1.5 cursor-pointer border-none"
                >
                  {stopSaving ? (
                    <>
                      <span className="material-symbols-outlined text-[16px] animate-spin">
                        progress_activity
                      </span>
                      Đang lưu...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">
                        save
                      </span>
                      Lưu & Thông báo hành khách
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UC-27 BR-33: Confirm Dialog ── */}
      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        severity={confirmDialog.severity}
        confirmText={confirmDialog.confirmText}
        loading={confirmDialog.loading}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}
