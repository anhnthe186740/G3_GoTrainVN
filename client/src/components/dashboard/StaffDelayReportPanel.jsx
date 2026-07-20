import { useState, useEffect, useCallback, useMemo } from "react";
import {
  AlertTriangle,
  Clock,
  Search,
  RefreshCw,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Calendar,
  Compass,
  Thermometer,
  User,
  Navigation,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "../../services/api";
import { getSchedules } from "../../services/referenceDataApi";

export function StaffDelayReportPanel() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("today_tomorrow"); // today_tomorrow, today, tomorrow, all
  const [statusFilter, setStatusFilter] = useState("ALL"); // ALL, ACTIVE, DELAYED, CANCELLED

  // Modal State
  const [selectedSchedule, setSelectedSchedule] = useState(null);
  const [modalStatus, setModalStatus] = useState("ACTIVE");
  const [modalDelayMinutes, setModalDelayMinutes] = useState(0);
  const [modalNotes, setModalNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Tracking Modal State
  const [selectedTrackingSchedule, setSelectedTrackingSchedule] =
    useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackSpeed, setTrackSpeed] = useState(55);
  const [trackTemp, setTrackTemp] = useState(25.0);
  const [trackPassengers, setTrackPassengers] = useState(45);
  const [trackLat, setTrackLat] = useState(21.0285);
  const [trackLong, setTrackLong] = useState(105.8542);
  const [trackStation, setTrackStation] = useState("");
  const [trackStatus, setTrackStatus] = useState("ON_TIME");
  const [updatingTracking, setUpdatingTracking] = useState(false);

  const handleOpenTrackingModal = async (sch) => {
    setSelectedTrackingSchedule(sch);
    setTrackingLoading(true);
    try {
      const res = await api.get(`/schedules/${sch.id}/live-tracking`);
      const tr = res.data.tracking;
      setTrackSpeed(
        tr.speed !== undefined && tr.speed !== null ? tr.speed : 55,
      );
      setTrackTemp(tr.temperature || 25.0);
      setTrackPassengers(tr.passengerCount || 45);
      setTrackLat(tr.latitude || sch.route?.startStation?.latitude || 21.0245);
      setTrackLong(
        tr.longitude || sch.route?.startStation?.longitude || 105.8412,
      );
      setTrackStation(
        tr.currentStation || sch.route?.startStation?.stationName || "",
      );
      setTrackStatus(tr.status || "ON_TIME");
    } catch {
      toast.error("Không thể tải dữ liệu điều vị hành trình.");
    } finally {
      setTrackingLoading(false);
    }
  };

  const handleCloseTrackingModal = () => {
    setSelectedTrackingSchedule(null);
  };

  const handleSubmitTracking = async (e) => {
    e.preventDefault();
    if (!selectedTrackingSchedule) return;

    setUpdatingTracking(true);
    try {
      const payload = {
        speed: parseFloat(trackSpeed) || 0.0,
        temperature: parseFloat(trackTemp) || 25.0,
        passengerCount: parseInt(trackPassengers) || 0,
        latitude: parseFloat(trackLat) || null,
        longitude: parseFloat(trackLong) || null,
        currentStation: trackStation.trim() || null,
        status: trackStatus,
      };

      await api.put(
        `/schedules/${selectedTrackingSchedule.id}/live-tracking`,
        payload,
      );
      toast.success("Cập nhật dữ liệu định vị & cảm biến thành công!");
      handleCloseTrackingModal();
      loadData({ force: true });
    } catch (err) {
      toast.error("Không thể lưu cập nhật thông số.");
    } finally {
      setUpdatingTracking(false);
    }
  };

  // Load schedules
  const loadData = useCallback(async ({ force = false } = {}) => {
    try {
      setLoading(true);
      const res = await getSchedules({ force });
      setSchedules(res.schedules || []);
    } catch (err) {
      toast.error("Không thể tải danh sách lịch trình chạy tàu.");
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Date Check Helpers
  const dateHelpers = useMemo(() => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    const isSameDate = (d1, d2) => {
      return (
        d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate()
      );
    };

    return {
      isToday: (dateStr) => isSameDate(new Date(dateStr), today),
      isTomorrow: (dateStr) => isSameDate(new Date(dateStr), tomorrow),
    };
  }, []);

  // Filtered schedules logic
  const filteredSchedules = useMemo(() => {
    return schedules.filter((sch) => {
      // 1. Search Query (Train Code, Train Name, Route Name, Station Names)
      const q = search.trim().toLowerCase();
      if (q) {
        const trainCode = (sch.train?.trainCode || "").toLowerCase();
        const trainName = (sch.train?.trainName || "").toLowerCase();
        const routeName = (sch.route?.routeName || "").toLowerCase();
        const startStation = (
          sch.route?.startStation?.stationName || ""
        ).toLowerCase();
        const endStation = (
          sch.route?.endStation?.stationName || ""
        ).toLowerCase();

        const matchesQuery =
          trainCode.includes(q) ||
          trainName.includes(q) ||
          routeName.includes(q) ||
          startStation.includes(q) ||
          endStation.includes(q);

        if (!matchesQuery) return false;
      }

      // 2. Date Filter
      const depTime = sch.departureTime;
      const isTodayVal = dateHelpers.isToday(depTime);
      const isTomorrowVal = dateHelpers.isTomorrow(depTime);

      if (dateFilter === "today" && !isTodayVal) return false;
      if (dateFilter === "tomorrow" && !isTomorrowVal) return false;
      if (dateFilter === "today_tomorrow" && !isTodayVal && !isTomorrowVal)
        return false;

      // 3. Status Filter
      if (statusFilter !== "ALL" && sch.status !== statusFilter) return false;

      return true;
    });
  }, [schedules, search, dateFilter, statusFilter, dateHelpers]);

  // Statistics
  const stats = useMemo(() => {
    let active = 0;
    let delayed = 0;
    let cancelled = 0;

    filteredSchedules.forEach((sch) => {
      if (sch.status === "ACTIVE") active++;
      else if (sch.status === "DELAYED") delayed++;
      else if (sch.status === "CANCELLED") cancelled++;
    });

    return {
      total: filteredSchedules.length,
      active,
      delayed,
      cancelled,
    };
  }, [filteredSchedules]);

  // Formatting helpers
  const formatTime = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  // Open Delay/Incident Modal
  const handleOpenReportModal = (sch) => {
    setSelectedSchedule(sch);
    setModalStatus(sch.status || "ACTIVE");
    setModalDelayMinutes(sch.delayMinutes || 0);
    setModalNotes(sch.notes || "");
  };

  // Close Modal
  const handleCloseModal = () => {
    setSelectedSchedule(null);
  };

  // Submit Delay Report
  const handleSubmitDelay = async (e) => {
    e.preventDefault();
    if (!selectedSchedule) return;

    if (
      modalStatus === "DELAYED" &&
      (Number(modalDelayMinutes) <= 0 || isNaN(Number(modalDelayMinutes)))
    ) {
      toast.error("Vui lòng nhập số phút trễ hợp lệ lớn hơn 0.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        status: modalStatus,
        delayMinutes: modalStatus === "DELAYED" ? Number(modalDelayMinutes) : 0,
        notes: modalNotes.trim(),
      };

      const res = await api.put(
        `/schedules/${selectedSchedule.id}/delay`,
        payload,
      );

      if (res.data?.success) {
        toast.success(
          res.data.message || "Cập nhật sự cố lịch chạy tàu thành công.",
        );

        // Update local state instead of hard reloading to be reactive and elegant
        setSchedules((prev) =>
          prev.map((sch) =>
            sch.id === selectedSchedule.id
              ? {
                  ...sch,
                  status: res.data.schedule.status,
                  delayMinutes: res.data.schedule.delayMinutes,
                  notes: res.data.schedule.notes,
                }
              : sch,
          ),
        );
        handleCloseModal();
      } else {
        toast.error("Cập nhật thất bại. Vui lòng kiểm tra lại thông tin.");
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message ||
          "Lỗi kết nối máy chủ, không thể cập nhật.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 text-left">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-[#191c1e] tracking-tight">
            Báo Trễ Chuyến & Sự Cố Lịch Trình
          </h2>
          <p className="text-sm font-medium text-[#6f7883] mt-1">
            Giao diện trực ca cho nhân viên quầy báo cáo trễ tàu hoặc hủy chuyến
            đột xuất do thời tiết/sự cố kỹ thuật.
          </p>
        </div>
        <button
          onClick={() => {
            loadData({ force: true });
            toast.success("Đã làm mới dữ liệu chạy tàu.");
          }}
          disabled={loading}
          className="flex items-center gap-1.5 bg-[#f2f4f6] hover:bg-[#eceef0] text-[#3f4852] px-4 py-2.5 rounded-xl font-bold text-sm transition-all border-none cursor-pointer disabled:opacity-55"
        >
          <RefreshCw
            className={`h-4.5 w-4.5 ${loading ? "animate-spin" : ""}`}
          />
          Tải lại lịch chạy
        </button>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/20 shadow-sm">
          <p className="text-xs text-[#6f7883] font-bold uppercase">
            Giám sát trong bộ lọc
          </p>
          <h3 className="text-2xl font-extrabold text-[#191c1e] mt-1">
            {stats.total} chuyến
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/20 shadow-sm">
          <p className="text-xs text-[#6f7883] font-bold uppercase">
            Đúng giờ (Active)
          </p>
          <h3 className="text-2xl font-extrabold text-emerald-600 mt-1">
            {stats.active}
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/20 shadow-sm">
          <p className="text-xs text-[#6f7883] font-bold uppercase">
            Trễ giờ (Delayed)
          </p>
          <h3 className="text-2xl font-extrabold text-amber-500 mt-1">
            {stats.delayed}
          </h3>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#bec7d4]/20 shadow-sm">
          <p className="text-xs text-[#6f7883] font-bold uppercase">
            Đã Hủy (Cancelled)
          </p>
          <h3 className="text-2xl font-extrabold text-red-600 mt-1">
            {stats.cancelled}
          </h3>
        </div>
      </div>

      {/* Advanced Filter Box */}
      <div className="bg-white rounded-2xl p-5 border border-[#bec7d4]/30 shadow-sm space-y-4">
        <h4 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[#00629d] text-[18px]">
            tune
          </span>
          Bộ lọc lịch trình giám sát
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Tìm kiếm chuyến / tàu
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-4 w-4" />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nhập mã tàu, ga đi/đến, tuyến..."
                className="w-full border border-[#bec7d4]/60 rounded-xl pl-9 pr-4 py-2.5 text-xs font-semibold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none transition"
              />
            </div>
          </div>

          {/* Date Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Thời gian khởi hành
            </label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none bg-white cursor-pointer transition"
            >
              <option value="today_tomorrow">
                Hôm nay & Ngày mai (Mặc định)
              </option>
              <option value="today">Chỉ hôm nay</option>
              <option value="tomorrow">Chỉ ngày mai</option>
              <option value="all">Tất cả thời gian</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-600 mb-1.5">
              Trạng thái vận hành
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-semibold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none bg-white cursor-pointer transition"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Hoạt động bình thường</option>
              <option value="DELAYED">Trễ chuyến</option>
              <option value="CANCELLED">Đã hủy chuyến</option>
            </select>
          </div>
        </div>
      </div>

      {/* Schedules Table */}
      <div className="bg-white rounded-2xl border border-[#bec7d4]/20 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#00629d]" />
            <p className="mt-3 text-sm font-semibold text-slate-500">
              Đang tải thông tin chạy tàu hệ thống...
            </p>
          </div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-16 text-slate-400 bg-white">
            <span className="material-symbols-outlined text-5xl block mb-2 opacity-50">
              train_clear
            </span>
            <p className="font-bold text-slate-600 text-sm">
              Không tìm thấy chuyến tàu nào
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Vui lòng điều chỉnh lại bộ lọc hoặc tải lại danh sách chạy tàu.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 border-b border-[#bec7d4]/20">
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Khởi hành
                  </th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Tàu chạy
                  </th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Tuyến đường & Ga dừng
                  </th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Trạng thái
                  </th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-600 uppercase tracking-wider">
                    Chi tiết sự cố / Ghi chú
                  </th>
                  <th className="px-6 py-4 text-xs font-extrabold text-slate-600 uppercase tracking-wider text-right">
                    Hành động
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#bec7d4]/10 text-sm text-slate-700 font-medium">
                {filteredSchedules.map((sch) => {
                  const depDateStr = formatDate(sch.departureTime);
                  const isTodayVal = dateHelpers.isToday(sch.departureTime);
                  const isTomorrowVal = dateHelpers.isTomorrow(
                    sch.departureTime,
                  );

                  const delayMs =
                    sch.status === "DELAYED"
                      ? (sch.delayMinutes || 0) * 60000
                      : 0;
                  const isPast =
                    new Date(sch.departureTime).getTime() + delayMs <
                    Date.now();

                  let dateBadge = null;
                  if (isTodayVal) {
                    dateBadge = (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded">
                        Hôm nay
                      </span>
                    );
                  } else if (isTomorrowVal) {
                    dateBadge = (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
                        Ngày mai
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={sch.id}
                      className="hover:bg-slate-50/40 transition-colors"
                    >
                      {/* Departure Time */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-slate-800 font-bold">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          {formatTime(sch.departureTime)}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center">
                          {depDateStr}
                          {dateBadge}
                        </div>
                      </td>

                      {/* Train */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded border border-slate-200">
                          {sch.train?.trainCode || "Tàu"}
                        </span>
                        <div className="text-xs text-slate-400 mt-1 font-semibold">
                          {sch.train?.trainName || "Tàu hỏa"}
                        </div>
                      </td>

                      {/* Route */}
                      <td className="px-6 py-4">
                        <div className="text-slate-800 font-bold text-xs">
                          {sch.route?.routeName || "Chưa đặt tên"}
                        </div>
                        <div className="text-[11px] text-[#6f7883] mt-0.5 font-semibold">
                          {sch.route?.startStation?.stationName || "Ga đi"} →{" "}
                          {sch.route?.endStation?.stationName || "Ga đến"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {isPast ? (
                          sch.status === "CANCELLED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-200">
                              <XCircle className="h-3 w-3" />
                              Đã hủy
                            </span>
                          ) : sch.status === "DELAYED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full border border-slate-200">
                              <AlertTriangle className="h-3 w-3 text-slate-400" />
                              Đã chạy (Trễ {sch.delayMinutes}m)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-500 text-xs font-bold rounded-full border border-slate-200">
                              <CheckCircle2 className="h-3 w-3 text-slate-400" />
                              Đã chạy
                            </span>
                          )
                        ) : (
                          <>
                            {sch.status === "ACTIVE" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                                <CheckCircle2 className="h-3 w-3" />
                                Đúng giờ
                              </span>
                            )}
                            {sch.status === "DELAYED" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                                <AlertTriangle className="h-3 w-3" />
                                Trễ {sch.delayMinutes || 0}m
                              </span>
                            )}
                            {sch.status === "CANCELLED" && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 text-red-700 text-xs font-bold rounded-full border border-red-200">
                                <XCircle className="h-3 w-3" />
                                Hủy chuyến
                              </span>
                            )}
                          </>
                        )}
                      </td>

                      {/* Notes / Incident reason */}
                      <td className="px-6 py-4 max-w-xs truncate text-xs text-slate-500 font-semibold italic">
                        {sch.notes ? (
                          sch.notes
                        ) : (
                          <span className="text-slate-300">
                            Không có sự cố ghi nhận
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                        {isPast ? (
                          <span className="inline-flex items-center gap-1 px-3 py-2 text-xs font-bold text-slate-400 italic bg-slate-50 border border-slate-200/50 rounded-xl">
                            Đã qua giờ chạy
                          </span>
                        ) : (
                          <div className="flex justify-end items-center gap-2">
                            <button
                              onClick={() => handleOpenTrackingModal(sch)}
                              className="inline-flex items-center gap-1 bg-[#e0f2fe] hover:bg-[#bae6fd] text-[#0369a1] border border-[#bae6fd] px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer"
                            >
                              <Compass className="h-3.5 w-3.5" />
                              Định vị
                            </button>

                            <button
                              onClick={() => handleOpenReportModal(sch)}
                              className="inline-flex items-center gap-1 bg-[#fff6e6] hover:bg-[#ffecc7] text-amber-800 border border-amber-200/60 px-3.5 py-2 rounded-xl font-bold transition-all cursor-pointer"
                            >
                              <AlertCircle className="h-3.5 w-3.5" />
                              Báo trễ
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal Report Incident/Delay */}
      {selectedSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,0,0,0.15)] border border-[#bec7d4]/20 w-full max-w-md overflow-hidden transform transition-all scale-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#bec7d4]/20 bg-slate-50 flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                Báo Cáo Sự Cố Chuyến Tàu
              </h3>
              <button
                onClick={handleCloseModal}
                disabled={submitting}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors border-none bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSubmitDelay} className="p-6 space-y-4">
              {/* Train & Route Details Card */}
              <div className="bg-[#f7f9fb] rounded-xl p-4 border border-[#bec7d4]/20 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-[#6f7883] font-bold uppercase">
                    Mã tàu:
                  </span>
                  <span className="font-extrabold text-[#191c1e]">
                    {selectedSchedule.train?.trainCode} (
                    {selectedSchedule.train?.trainName})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6f7883] font-bold uppercase">
                    Tuyến đường:
                  </span>
                  <span className="font-bold text-[#191c1e]">
                    {selectedSchedule.route?.routeName}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6f7883] font-bold uppercase">
                    Giờ khởi hành gốc:
                  </span>
                  <span className="font-bold text-[#191c1e]">
                    {formatTime(selectedSchedule.departureTime)} -{" "}
                    {formatDate(selectedSchedule.departureTime)}
                  </span>
                </div>
              </div>

              {/* Status Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Chọn trạng thái vận hành mới
                </label>
                <select
                  value={modalStatus}
                  onChange={(e) => setModalStatus(e.target.value)}
                  className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-3 text-xs font-bold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none bg-white cursor-pointer transition"
                >
                  <option value="ACTIVE">ACTIVE - Hoạt động đúng giờ</option>
                  <option value="DELAYED">DELAYED - Tàu chạy trễ giờ</option>
                  <option value="CANCELLED">CANCELLED - Đã hủy chuyến</option>
                </select>
              </div>

              {/* Delay Minutes (Only if status is DELAYED) */}
              {modalStatus === "DELAYED" && (
                <div className="animate-slide-down">
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Số phút trễ dự kiến (m)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      value={modalDelayMinutes}
                      onChange={(e) => setModalDelayMinutes(e.target.value)}
                      placeholder="Ví dụ: 15, 30, 120"
                      className="w-full border border-[#bec7d4]/60 rounded-xl px-4 py-3 text-xs font-bold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#6f7883]">
                      phút
                    </span>
                  </div>
                </div>
              )}

              {/* Incident Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                  Lý do sự cố / Ghi chú chạy tàu
                </label>
                <textarea
                  required={modalStatus !== "ACTIVE"}
                  value={modalNotes}
                  onChange={(e) => setModalNotes(e.target.value)}
                  placeholder={
                    modalStatus === "ACTIVE"
                      ? "Không có sự cố ghi nhận. Trở lại trạng thái chạy bình thường."
                      : "Ví dụ: Thời tiết xấu gây bão lũ ngập ray đường sắt, sự cố kỹ thuật đầu máy kéo..."
                  }
                  rows="3"
                  className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-3 text-xs font-semibold focus:border-[#00629d] focus:ring-4 focus:ring-[#cfe5ff] outline-none transition"
                ></textarea>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-3 border-t border-[#bec7d4]/10 mt-6">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border-none cursor-pointer disabled:opacity-50"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl bg-[#00629d] hover:bg-[#00527f] text-white text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-55"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5" />
                      Lưu cập nhật
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Edit Tracking / Telemetry Sensors */}
      {selectedTrackingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-[0px_20px_60px_rgba(0,0,0,0.15)] border border-[#bec7d4]/20 w-full max-w-md overflow-hidden transform transition-all scale-100">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#bec7d4]/20 bg-slate-50 flex justify-between items-center">
              <h3 className="font-extrabold text-base text-slate-800 flex items-center gap-2">
                <Compass className="h-5 w-5 text-[#00629d]" />
                Điều Hành Telemetry Chuyến Tàu
              </h3>
              <button
                onClick={handleCloseTrackingModal}
                disabled={updatingTracking}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors border-none bg-transparent cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            {trackingLoading ? (
              <div className="p-12 text-center">
                <RefreshCw className="mx-auto h-8 w-8 animate-spin text-[#00629d]" />
                <p className="mt-3 text-sm font-semibold text-slate-500">
                  Đang tải định vị...
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmitTracking} className="p-6 space-y-4">
                {/* Train Info */}
                <div className="bg-[#cfe5ff]/20 rounded-xl p-3 border border-[#cfe5ff] text-xs">
                  <p className="font-extrabold text-slate-800">
                    TÀU: {selectedTrackingSchedule.train?.trainCode} | TUYẾN:{" "}
                    {selectedTrackingSchedule.route?.routeName}
                  </p>
                </div>

                {/* GPS Coordinates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                      <Navigation className="h-3.5 w-3.5 text-slate-400 rotate-45" />
                      Vĩ độ (Latitude)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={trackLat}
                      onChange={(e) => setTrackLat(e.target.value)}
                      className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-[#00629d] outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                      <Navigation className="h-3.5 w-3.5 text-slate-400 rotate-45" />
                      Kinh độ (Longitude)
                    </label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      value={trackLong}
                      onChange={(e) => setTrackLong(e.target.value)}
                      className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-[#00629d] outline-none transition"
                    />
                  </div>
                </div>

                {/* Current Station */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                    <Compass className="h-3.5 w-3.5 text-slate-400" />
                    Ga hiện tại / Ga vừa đi qua
                  </label>
                  <input
                    type="text"
                    required
                    value={trackStation}
                    onChange={(e) => setTrackStation(e.target.value)}
                    placeholder="Ví dụ: Ga Hà Nội, Ga Vinh"
                    className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-[#00629d] outline-none transition"
                  />
                </div>

                {/* Sensors Speed & Temperature */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                      <Compass className="h-3.5 w-3.5 text-slate-400" />
                      Tốc độ (km/h)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={trackSpeed}
                      onChange={(e) => setTrackSpeed(e.target.value)}
                      className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-[#00629d] outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5 text-slate-400" />
                      Nhiệt độ toa (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={trackTemp}
                      onChange={(e) => setTrackTemp(e.target.value)}
                      className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-[#00629d] outline-none transition"
                    />
                  </div>
                </div>

                {/* Passenger Count */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5 flex items-center gap-1">
                    <User className="h-3.5 w-3.5 text-slate-400" />
                    Số lượng hành khách thực tế
                  </label>
                  <input
                    type="number"
                    required
                    value={trackPassengers}
                    onChange={(e) => setTrackPassengers(e.target.value)}
                    className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-[#00629d] outline-none transition"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1.5">
                    Trạng thái vận hành
                  </label>
                  <select
                    value={trackStatus}
                    onChange={(e) => setTrackStatus(e.target.value)}
                    className="w-full border border-[#bec7d4]/60 rounded-xl px-3 py-2.5 text-xs font-bold focus:border-[#00629d] outline-none bg-white cursor-pointer transition"
                  >
                    <option value="ON_TIME">ON_TIME - Đúng giờ</option>
                    <option value="DELAYED">DELAYED - Trễ giờ</option>
                    <option value="EARLY">EARLY - Chạy sớm</option>
                    <option value="COMPLETED">COMPLETED - Đã ga cuối</option>
                    <option value="CANCELLED">CANCELLED - Đã hủy chuyến</option>
                  </select>
                </div>

                {/* Form Actions */}
                <div className="flex gap-2 pt-3 border-t border-[#bec7d4]/10 mt-6">
                  <button
                    type="button"
                    onClick={handleCloseTrackingModal}
                    disabled={updatingTracking}
                    className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all border-none cursor-pointer disabled:opacity-50"
                  >
                    Đóng lại
                  </button>
                  <button
                    type="submit"
                    disabled={updatingTracking}
                    className="flex-1 py-3 rounded-xl bg-[#00629d] hover:bg-[#00527f] text-white text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-55"
                  >
                    {updatingTracking ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <FileText className="h-3.5 w-3.5" />
                        Lưu cập nhật
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
