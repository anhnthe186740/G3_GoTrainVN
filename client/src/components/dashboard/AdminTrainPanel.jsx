import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../../services/api";
import { getTrains } from "../../services/referenceDataApi";

const TRAIN_TYPES = {
  SE: {
    name: "Tàu Thống Nhất (SE)",
    badge: "bg-primary-fixed text-on-primary-fixed",
  },
  TN: {
    name: "Tàu Thường (TN)",
    badge: "bg-surface-container-highest text-on-surface-variant",
  },
  HD: {
    name: "Hải Dương - HN (HD)",
    badge: "bg-secondary-container text-on-secondary-container",
  },
  SP: {
    name: "Tàu Du Lịch Sapa (SP)",
    badge: "bg-tertiary-fixed text-on-tertiary-fixed",
  },
  QN: { name: "Tàu Quy Nhơn (QN)", badge: "bg-amber-100 text-amber-800" },
};

const CARRIAGE_TYPES = {
  NORMAL_SEAT: {
    name: "Ghế ngồi cứng (Thường)",
    capacity: 40,
    priceFactor: 1.0,
  },
  AC_SEAT: { name: "Ghế ngồi mềm điều hòa", capacity: 28, priceFactor: 1.2 },
  SLEEPER_6: { name: "Giường nằm khoang 6", capacity: 24, priceFactor: 1.5 },
  SLEEPER_4: { name: "Giường nằm khoang 4", capacity: 16, priceFactor: 1.8 },
};

const MAINTENANCE_TYPES = {
  ROUTINE: "Bảo trì định kỳ",
  EMERGENCY: "Sửa chữa khẩn cấp",
  INSPECTION: "Kiểm tra kỹ thuật",
};

export function AdminTrainPanel() {
  const [activeTab, setActiveTab] = useState("trains"); // "trains" | "maintenance"
  const [trains, setTrains] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  // Create Train modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [newTrainForm, setNewTrainForm] = useState({
    trainName: "",
    trainCode: "",
    trainType: "SE",
    operatingCompany: "Đường Sắt Việt Nam",
    carriages: [
      "NORMAL_SEAT",
      "NORMAL_SEAT",
      "AC_SEAT",
      "SLEEPER_6",
      "SLEEPER_4",
    ],
  });

  // Seat/Carriage view modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTrain, setSelectedTrain] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedCarriageIdx, setSelectedCarriageIdx] = useState(0); // index 0-4

  // Seat Blocking modal states
  const [showSeatBlockModal, setShowSeatBlockModal] = useState(false);
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [seatBlockForm, setSeatBlockForm] = useState({
    status: "AVAILABLE",
    blockReason: "MAINTENANCE",
    blockUntil: "",
  });

  // Direct train status change confirmation states
  const [showStatusConfirmModal, setShowStatusConfirmModal] = useState(false);
  const [selectedTrainForStatusChange, setSelectedTrainForStatusChange] =
    useState(null);
  const [nextTrainStatus, setNextTrainStatus] = useState("");

  // Maintenance list states
  const [maintenanceList, setMaintenanceList] = useState([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [activeSchedulesForTrain, setActiveSchedulesForTrain] = useState([]);
  const [maintenanceForm, setMaintenanceForm] = useState({
    trainId: "",
    maintenanceType: "ROUTINE",
    description: "",
    startDate: "",
    endDate: "",
    affectedScheduleIds: [],
    notes: "",
  });

  // Fetch trains
  const fetchTrains = useCallback(async ({ force = false } = {}) => {
    try {
      setLoading(true);
      const data = await getTrains({ force });
      setTrains(data.trains || []);
    } catch (err) {
      toast.error(
        "Không thể tải danh sách tàu: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch maintenance list
  const fetchMaintenanceList = useCallback(async () => {
    try {
      setMaintenanceLoading(true);
      const res = await api.get("/maintenance");
      setMaintenanceList(res.data.maintenanceList || []);
    } catch (err) {
      toast.error("Không thể tải danh sách kế hoạch bảo trì.");
    } finally {
      setMaintenanceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrains();
    fetchMaintenanceList();
  }, [fetchTrains, fetchMaintenanceList]);

  // Helper to determine train maintenance status
  const getTrainStatus = (train) => {
    if (train.status === "INACTIVE") {
      return {
        label: "Ngừng hoạt động",
        colorClass: "text-amber-600",
        indicator: "bg-amber-500",
        bgClass: "bg-amber-100",
        isMaintenance: false,
        isInactive: true,
      };
    }

    const now = new Date();
    const inMaintenance = train.maintenance?.some((m) => {
      if (m.status === "IN_PROGRESS") return true;
      if (m.status === "SCHEDULED") {
        const start = new Date(m.startDate);
        const end = new Date(m.endDate);
        return now >= start && now <= end;
      }
      return false;
    });

    if (inMaintenance || train.status === "MAINTENANCE") {
      return {
        label: "Đang bảo trì",
        colorClass: "text-error",
        indicator: "bg-error",
        bgClass: "bg-error-container/30",
        isMaintenance: true,
        isInactive: false,
      };
    }
    return {
      label: "Sẵn sàng",
      colorClass: "text-emerald-600",
      indicator: "bg-emerald-500 animate-pulse",
      bgClass: "bg-emerald-100",
      isMaintenance: false,
      isInactive: false,
    };
  };

  // Delete Train
  const handleDeleteTrain = async (trainId, trainName) => {
    if (
      !window.confirm(
        `Bạn có chắc chắn muốn xóa con tàu "${trainName}"? Toàn bộ toa và ghế liên quan sẽ bị xóa vĩnh viễn khỏi cơ sở dữ liệu.`,
      )
    ) {
      return;
    }
    try {
      await api.delete(`/trains/${trainId}`);
      toast.success(`Đã xóa tàu ${trainName} thành công.`);
      fetchTrains({ force: true });
    } catch (err) {
      toast.error(
        "Lỗi khi xóa tàu: " + (err.response?.data?.message || err.message),
      );
    }
  };

  const handleOpenTrainDetail = async (train) => {
    setSelectedTrain(train);
    setSelectedCarriageIdx(0);
    setShowDetailModal(true);
    setDetailLoading(true);

    try {
      const response = await api.get(`/trains/${train.id}`);
      setSelectedTrain(response.data.train);
    } catch (err) {
      toast.error(
        "Không thể tải chi tiết tàu: " +
          (err.response?.data?.message || err.message),
      );
      setShowDetailModal(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit Create Train
  const handleCreateTrain = async (e) => {
    e.preventDefault();
    if (!newTrainForm.trainName || !newTrainForm.trainCode) {
      toast.error("Vui lòng nhập đầy đủ tên và mã tàu.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...newTrainForm,
        trainName: newTrainForm.trainName.trim().toUpperCase(),
        trainCode: newTrainForm.trainCode.trim().toUpperCase(),
      };
      await api.post("/trains", payload);
      toast.success("Tạo tàu mới và sinh 148 ghế ngồi thành công!");
      setShowCreateModal(false);
      setCreateStep(1);
      setNewTrainForm({
        trainName: "",
        trainCode: "",
        trainType: "SE",
        operatingCompany: "Đường Sắt Việt Nam",
        carriages: [
          "NORMAL_SEAT",
          "NORMAL_SEAT",
          "AC_SEAT",
          "SLEEPER_6",
          "SLEEPER_4",
        ],
      });
      fetchTrains({ force: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi tạo tàu.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Form Carriage Change
  const handleCarriageChange = (idx, value) => {
    const updated = [...newTrainForm.carriages];
    updated[idx] = value;
    setNewTrainForm({ ...newTrainForm, carriages: updated });
  };

  // Get total seats for the train config in the form
  const getFormTotalSeats = () => {
    return newTrainForm.carriages.reduce(
      (sum, type) => sum + (CARRIAGE_TYPES[type]?.capacity || 0),
      0,
    );
  };

  // Trigger train status toggle (with BR-33 confirmation modal)
  const handleStatusToggle = (train) => {
    const nextStatus = train.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setSelectedTrainForStatusChange(train);
    setNextTrainStatus(nextStatus);
    setShowStatusConfirmModal(true);
  };

  const confirmStatusChange = async () => {
    if (!selectedTrainForStatusChange || !nextTrainStatus) return;
    try {
      const res = await api.put(
        `/trains/${selectedTrainForStatusChange.id}/status`,
        {
          status: nextTrainStatus,
        },
      );
      toast.success(res.data.message || "Cập nhật trạng thái tàu thành công!");
      setShowStatusConfirmModal(false);
      fetchTrains({ force: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Lỗi khi cập nhật trạng thái vận hành.",
      );
    }
  };

  // Handle Seat Click for Block Modal
  const handleSeatClick = (seat) => {
    setSelectedSeat(seat);
    setSeatBlockForm({
      status: seat.status === "BLOCKED" ? "BLOCKED" : "AVAILABLE",
      blockReason: seat.blockReason || "MAINTENANCE",
      blockUntil: seat.blockUntil
        ? new Date(seat.blockUntil).toISOString().split("T")[0]
        : "",
    });
    setShowSeatBlockModal(true);
  };

  // Submit Seat Block Update
  const handleSaveSeatBlock = async (e) => {
    e.preventDefault();
    if (!selectedSeat) return;
    try {
      const payload = {
        status: seatBlockForm.status,
        blockReason:
          seatBlockForm.status === "BLOCKED" ? seatBlockForm.blockReason : null,
        blockUntil:
          seatBlockForm.status === "BLOCKED" && seatBlockForm.blockUntil
            ? seatBlockForm.blockUntil
            : null,
      };

      const res = await api.put(
        `/maintenance/seats/${selectedSeat.id}/block`,
        payload,
      );
      toast.success(res.data.message || "Cập nhật trạng thái ghế thành công!");
      setShowSeatBlockModal(false);
      // Reload detail map
      if (selectedTrain) {
        handleOpenTrainDetail(selectedTrain);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi khóa/mở khóa ghế.");
    }
  };

  // Handle Maintenance Form Train Change
  const handleMaintenanceTrainChange = async (trainId) => {
    setMaintenanceForm((prev) => ({
      ...prev,
      trainId,
      affectedScheduleIds: [],
    }));
    if (!trainId) {
      setActiveSchedulesForTrain([]);
      return;
    }
    try {
      const res = await api.get(`/trains/${trainId}`);
      const now = new Date();
      const futureSchedules = (res.data.train?.schedules || []).filter((s) => {
        return new Date(s.departureTime) >= now && s.status !== "CANCELLED";
      });
      setActiveSchedulesForTrain(futureSchedules);
    } catch (err) {
      toast.error("Không thể tải lịch trình hoạt động của tàu.");
    }
  };

  // Submit Maintenance Plan
  const handleCreateMaintenance = async (e) => {
    e.preventDefault();
    const { trainId, startDate, endDate, description } = maintenanceForm;
    if (!trainId || !startDate || !endDate || !description) {
      toast.error("Vui lòng điền đầy đủ các thông tin bắt buộc.");
      return;
    }

    try {
      const res = await api.post("/maintenance", maintenanceForm);
      toast.success(res.data.message || "Lập kế hoạch bảo trì thành công!");
      setShowMaintenanceModal(false);
      setMaintenanceForm({
        trainId: "",
        maintenanceType: "ROUTINE",
        description: "",
        startDate: "",
        endDate: "",
        affectedScheduleIds: [],
        notes: "",
      });
      fetchMaintenanceList();
      fetchTrains({ force: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Lỗi khi lập kế hoạch bảo trì.",
      );
    }
  };

  // Update Maintenance status
  const handleUpdateMaintenanceStatus = async (vmId, status) => {
    try {
      const res = await api.put(`/maintenance/${vmId}`, { status });
      toast.success(
        res.data.message || "Cập nhật trạng thái đợt bảo trì thành công!",
      );
      fetchMaintenanceList();
      fetchTrains({ force: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Lỗi cập nhật trạng thái bảo trì.",
      );
    }
  };

  // Delete Maintenance record
  const handleDeleteMaintenance = async (vmId) => {
    if (!window.confirm("Bạn có chắc muốn xóa bản ghi lịch bảo trì này không?"))
      return;
    try {
      const res = await api.delete(`/maintenance/${vmId}`);
      toast.success(res.data.message || "Xóa lịch trình bảo trì thành công!");
      fetchMaintenanceList();
      fetchTrains({ force: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Lỗi khi xóa lịch bảo trì.");
    }
  };

  // Filters
  const filteredTrains = trains.filter((train) => {
    const uniqueRoutes = [
      ...new Set(
        train.schedules?.map((s) => s.route?.routeName).filter(Boolean),
      ),
    ].join(", ");
    const matchesSearch =
      train.trainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      train.trainCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      uniqueRoutes.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType ? train.trainType === filterType : true;
    const status = getTrainStatus(train);
    const matchesStatus = filterStatus
      ? filterStatus === "MAINTENANCE"
        ? status.isMaintenance
        : filterStatus === "INACTIVE"
          ? status.isInactive
          : !status.isMaintenance && !status.isInactive
      : true;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalCapacityAll = trains.reduce((sum, t) => sum + t.totalCapacity, 0);
  const maintenanceCount = trains.filter(
    (t) => getTrainStatus(t).isMaintenance,
  ).length;

  // Render Seat Layout for details view
  const renderSeatsMatrix = (carriage) => {
    const seats = carriage.seats || [];
    const sortedSeats = [...seats].sort((a, b) => {
      const aIsNum = !isNaN(a.seatNumber);
      const bIsNum = !isNaN(b.seatNumber);
      if (aIsNum && bIsNum) {
        return parseInt(a.seatNumber) - parseInt(b.seatNumber);
      }
      return a.seatNumber.localeCompare(b.seatNumber);
    });

    if (
      carriage.carriageType === "NORMAL_SEAT" ||
      carriage.carriageType === "AC_SEAT"
    ) {
      const rows = [];
      const numCols = 4;
      const totalSeats = carriage.totalSeats;
      const numRows = totalSeats / numCols;

      for (let r = 0; r < numRows; r++) {
        const rowSeats = [];
        for (let c = 0; c < numCols; c++) {
          const seatIdx = r * numCols + c;
          if (seatIdx < sortedSeats.length) {
            rowSeats.push(sortedSeats[seatIdx]);
          }
        }
        rows.push(rowSeats);
      }

      const renderSeatBox = (s) => {
        if (!s) return null;
        const isBlocked = s.status === "BLOCKED";
        const seatTitle = isBlocked
          ? `Ghế ${s.seatNumber} (ĐANG KHÓA - ${s.blockReason || "Bảo trì"}${s.blockUntil ? ` đến ${new Date(s.blockUntil).toLocaleDateString("vi-VN")}` : ""})`
          : `Ký hiệu: ${s.seatNumber} | Giá: ${s.basePrice.toLocaleString()}đ`;

        return (
          <div
            onClick={() => handleSeatClick(s)}
            className={`flex-1 py-2 rounded-lg text-center font-bold text-xs border transition-all cursor-pointer ${
              isBlocked
                ? "bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300"
                : "bg-white text-on-surface border-[#bec7d4] hover:bg-primary-container/20"
            }`}
            title={seatTitle}
          >
            {s.seatNumber}
          </div>
        );
      };

      return (
        <div className="space-y-3">
          <div className="flex justify-between items-center text-xs font-semibold text-on-surface-variant px-md">
            <span>Dãy A (Cửa sổ)</span>
            <span>Dãy B (Lối đi)</span>
            <span className="w-12 text-center text-outline">Lối Đi</span>
            <span>Dãy C (Lối đi)</span>
            <span>Dãy D (Cửa sổ)</span>
          </div>
          <div className="bg-surface-container-low border border-outline-variant rounded-xl p-md space-y-2">
            {rows.map((rowSeats, rIdx) => (
              <div key={rIdx} className="flex items-center justify-between">
                {/* Left side (2 seats) */}
                <div className="flex gap-2 w-[42%] justify-between">
                  {renderSeatBox(rowSeats[0])}
                  {renderSeatBox(rowSeats[1])}
                </div>

                {/* Aisle */}
                <div className="w-12 text-center text-[10px] text-outline uppercase font-semibold">
                  Hàng {rIdx + 1}
                </div>

                {/* Right side (2 seats) */}
                <div className="flex gap-2 w-[42%] justify-between">
                  {renderSeatBox(rowSeats[2])}
                  {renderSeatBox(rowSeats[3])}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      const compartments = {};
      sortedSeats.forEach((seat) => {
        const match = seat.seatNumber.match(/^K(\d+)/);
        const compNum = match ? match[1] : "1";
        if (!compartments[compNum]) compartments[compNum] = [];
        compartments[compNum].push(seat);
      });

      const renderBedBox = (s) => {
        if (!s) return null;
        const matchFloor = s.seatNumber.match(/-T(\d+)/);
        const floor = matchFloor ? matchFloor[1] : "1";
        const isBlocked = s.status === "BLOCKED";
        const seatTitle = isBlocked
          ? `Giường ${s.seatNumber} (ĐANG KHÓA - ${s.blockReason || "Bảo trì"}${s.blockUntil ? ` đến ${new Date(s.blockUntil).toLocaleDateString("vi-VN")}` : ""})`
          : `Giường: ${s.seatNumber} | Giá: ${s.basePrice.toLocaleString()}đ`;

        return (
          <div
            onClick={() => handleSeatClick(s)}
            className={`py-1 px-2 border rounded-lg flex items-center justify-between text-xs cursor-pointer transition-all ${
              isBlocked
                ? "bg-slate-200 text-slate-500 border-slate-300 hover:bg-slate-300"
                : "bg-white text-on-surface border-[#bec7d4] hover:bg-primary-container/20"
            }`}
            title={seatTitle}
          >
            <span className="font-bold">Tầng {floor}</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                isBlocked
                  ? "bg-slate-300 text-slate-600"
                  : "bg-surface-container-highest text-on-surface-variant"
              }`}
            >
              {s.seatNumber}
            </span>
          </div>
        );
      };

      return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(compartments).map(([compNum, compSeats]) => (
            <div
              key={compNum}
              className="border border-outline-variant rounded-xl p-md bg-surface-container-low shadow-sm"
            >
              <div className="font-bold text-sm text-[#00629d] border-b border-outline-variant/60 pb-2 mb-3 flex items-center justify-between">
                <span>Khoang {compNum}</span>
                <span className="text-xs font-normal text-on-surface-variant">
                  {compSeats.length} Giường nằm
                </span>
              </div>
              <div className="grid grid-cols-2 gap-md">
                {/* Left side beds (A) */}
                <div className="space-y-2">
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider text-left border-b border-outline-variant/20 pb-0.5">
                    Dãy A (Trái)
                  </p>
                  {compSeats
                    .filter((s) => s.seatNumber.endsWith("-A"))
                    .map((s) => renderBedBox(s))}
                </div>
                {/* Right side beds (B) */}
                <div className="space-y-2">
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider text-left border-b border-outline-variant/20 pb-0.5">
                    Dãy B (Phải)
                  </p>
                  {compSeats
                    .filter((s) => s.seatNumber.endsWith("-B"))
                    .map((s) => renderBedBox(s))}
                </div>
              </div>
            </div>
          ))}
        </div>
      );
    }
  };

  return (
    <div className="space-y-8">
      {/* Sub-tab Selection */}
      <div className="flex border-b border-outline-variant/60 mb-6">
        <button
          onClick={() => setActiveTab("trains")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "trains"
              ? "border-primary text-primary"
              : "border-transparent text-outline hover:text-on-surface"
          }`}
        >
          Danh Sách Đoàn Tàu
        </button>
        <button
          onClick={() => setActiveTab("maintenance")}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === "maintenance"
              ? "border-primary text-primary"
              : "border-transparent text-outline hover:text-on-surface"
          }`}
        >
          Lịch Trình Bảo Trì
        </button>
      </div>

      {activeTab === "trains" ? (
        <>
          {/* Page Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h2 className="text-2xl font-bold text-[#191c1e] mb-xs">
                Quản Lý Đoàn Tàu
              </h2>
              <p className="text-sm text-[#3f4852] mt-1">
                Quản lý danh sách, trạng thái hoạt động trực tiếp và sơ đồ toa
                ghế đội tàu.
              </p>
            </div>
            <button
              onClick={() => {
                setShowCreateModal(true);
                setCreateStep(1);
              }}
              className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary-container to-primary text-white px-md py-3 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">
                add_circle
              </span>
              Thêm Đoàn Tàu Mới
            </button>
          </div>

          {/* Bento Stats Grid */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-md">
            <div className="bg-white p-5 rounded-2xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] flex items-center gap-md">
              <div className="w-12 h-12 bg-primary-fixed/30 rounded-full flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[24px]">
                  directions_railway
                </span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  Tổng số tàu
                </p>
                <p className="text-xl font-bold text-on-surface">
                  {trains.length} Đoàn tàu
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] flex items-center gap-md">
              <div className="w-12 h-12 bg-tertiary-fixed/30 rounded-full flex items-center justify-center text-tertiary">
                <span className="material-symbols-outlined text-[24px]">
                  airline_seat_recline_extra
                </span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  Tổng ghế khả dụng
                </p>
                <p className="text-xl font-bold text-on-surface">
                  {totalCapacityAll.toLocaleString()} Ghế
                </p>
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] flex items-center gap-md border-l-4 border-error">
              <div className="w-12 h-12 bg-error-container/30 rounded-full flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[24px]">
                  build
                </span>
              </div>
              <div>
                <p className="text-xs text-on-surface-variant uppercase tracking-wider font-semibold">
                  Đang bảo trì
                </p>
                <p className="text-xl font-bold text-on-surface">
                  {maintenanceCount} Đoàn tàu
                </p>
              </div>
            </div>
          </section>

          {/* Search & Filters */}
          <div className="flex flex-col md:flex-row gap-md items-center bg-white p-4 rounded-xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.04)]">
            <div className="relative flex-1 w-full">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                search
              </span>
              <input
                className="w-full pl-12 pr-md py-2.5 bg-[#f2f4f6] rounded-xl focus:ring-2 focus:ring-primary-container outline-none transition-all text-sm"
                placeholder="Tìm kiếm theo số hiệu hoặc mã tàu..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-sm w-full md:w-auto">
              <select
                className="flex-1 md:flex-none py-2.5 px-4 bg-white border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary-container outline-none cursor-pointer"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">Tất cả loại tàu</option>
                {Object.entries(TRAIN_TYPES).map(([code, type]) => (
                  <option key={code} value={code}>
                    {type.name}
                  </option>
                ))}
              </select>
              <select
                className="flex-1 md:flex-none py-2.5 px-4 bg-white border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary-container outline-none cursor-pointer"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">Tất cả trạng thái</option>
                <option value="READY">Sẵn sàng hoạt động</option>
                <option value="INACTIVE">Đang ngừng chạy</option>
                <option value="MAINTENANCE">Đang bảo trì</option>
              </select>
            </div>
          </div>

          {/* Trains Table */}
          <div className="bg-white rounded-2xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] overflow-hidden">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#3f4852]">
                <span className="material-symbols-outlined animate-spin text-3xl mb-2">
                  progress_activity
                </span>
                <p className="text-sm font-semibold">
                  Đang tải danh sách tàu...
                </p>
              </div>
            ) : filteredTrains.length === 0 ? (
              <div className="text-center py-20 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline mb-2">
                  train
                </span>
                <p className="text-sm font-semibold">
                  Không tìm thấy đoàn tàu nào phù hợp.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f2f4f6]/50">
                    <tr className="border-b border-outline-variant">
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Số hiệu
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Lộ Trình
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Loại Tàu
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Số Toa
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Tổng Ghế
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Trạng Thái
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider text-right">
                        Thao Tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {filteredTrains.map((train) => {
                      const status = getTrainStatus(train);
                      const trainTypeInfo = TRAIN_TYPES[train.trainType] || {
                        name: train.trainType,
                        badge: "bg-surface-container-highest",
                      };
                      return (
                        <tr
                          key={train.id}
                          className="hover:bg-surface/40 transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <span className="font-bold text-primary text-base">
                              {train.trainName}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-medium text-on-surface-variant">
                            {[
                              ...new Set(
                                train.schedules
                                  ?.map((s) => s.route?.routeName)
                                  .filter(Boolean),
                              ),
                            ].join(", ") || "Chưa xếp lịch"}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${trainTypeInfo.badge}`}
                            >
                              {trainTypeInfo.name}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold">
                            {train.totalCarriages} Toa
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold">
                            {train.totalCapacity} Ghế
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.bgClass} ${status.colorClass}`}
                              >
                                <span
                                  className={`w-2 h-2 rounded-full ${status.indicator}`}
                                ></span>
                                {status.label}
                              </span>
                              <label className="relative inline-flex items-center cursor-pointer text-[11px] font-semibold text-outline select-none mt-1">
                                <input
                                  type="checkbox"
                                  checked={train.status === "ACTIVE"}
                                  onChange={() => handleStatusToggle(train)}
                                  disabled={train.status === "MAINTENANCE"}
                                  className="sr-only peer"
                                />
                                <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-focus:ring-0 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-500"></div>
                                <span className="ml-2">
                                  {train.status === "ACTIVE"
                                    ? "Mở chạy"
                                    : "Ngừng chạy"}
                                </span>
                              </label>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  handleOpenTrainDetail(train);
                                }}
                                className="p-2 text-outline hover:text-primary transition-colors rounded-lg hover:bg-primary-fixed/20 cursor-pointer border-none bg-transparent"
                                title="Xem sơ đồ & Thiết lập khóa ghế"
                              >
                                <span className="material-symbols-outlined text-[20px]">
                                  edit_square
                                </span>
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteTrain(train.id, train.trainName)
                                }
                                className="p-2 text-outline hover:text-error transition-colors rounded-lg hover:bg-error-container/20 cursor-pointer border-none bg-transparent"
                                title="Xóa đoàn tàu"
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
          </div>
        </>
      ) : (
        // Tab Lịch Trình Bảo Trì (Vehicle Maintenance Manager)
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
            <div>
              <h2 className="text-2xl font-bold text-[#191c1e] mb-xs">
                Kế Hoạch Bảo Trì Đoàn Tàu
              </h2>
              <p className="text-sm text-[#3f4852] mt-1">
                Lập kế hoạch dọn rửa, kiểm tra hoặc sửa chữa khẩn cấp quy mô lớn
                và điều phối các chuyến đi bị ảnh hưởng.
              </p>
            </div>
            <button
              onClick={() => {
                setShowMaintenanceModal(true);
              }}
              className="flex items-center justify-center gap-2 bg-[#00629d] text-white px-md py-3 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all cursor-pointer border-none"
            >
              <span className="material-symbols-outlined text-[18px]">
                build
              </span>
              Thiết lập bảo trì mới
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-outline-variant/10 shadow-[0px_4px_16px_rgba(0,163,255,0.06)] overflow-hidden">
            {maintenanceLoading ? (
              <div className="flex flex-col items-center justify-center py-20 text-[#3f4852]">
                <span className="material-symbols-outlined animate-spin text-3xl mb-2">
                  progress_activity
                </span>
                <p className="text-sm font-semibold">
                  Đang tải lịch trình bảo trì...
                </p>
              </div>
            ) : maintenanceList.length === 0 ? (
              <div className="text-center py-20 text-on-surface-variant">
                <span className="material-symbols-outlined text-5xl text-outline mb-2">
                  build
                </span>
                <p className="text-sm font-semibold">
                  Chưa có lịch bảo trì nào được thiết lập.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-[#f2f4f6]/50">
                    <tr className="border-b border-outline-variant">
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Đoàn tàu
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Tính chất bảo trì
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Ngày bắt đầu
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Ngày kết thúc dự kiến
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Hủy lịch chạy
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider">
                        Trạng thái
                      </th>
                      <th className="px-6 py-4 font-semibold text-xs text-on-surface-variant uppercase tracking-wider text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {maintenanceList.map((vm) => {
                      return (
                        <tr
                          key={vm.id}
                          className="hover:bg-surface/40 transition-colors"
                        >
                          <td className="px-6 py-4 font-bold text-[#00629d]">
                            {vm.train?.trainCode} - {vm.train?.trainName}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold">
                            <span
                              className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                vm.maintenanceType === "ROUTINE"
                                  ? "bg-cyan-100 text-cyan-800"
                                  : vm.maintenanceType === "EMERGENCY"
                                    ? "bg-red-100 text-red-800"
                                    : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {MAINTENANCE_TYPES[vm.maintenanceType]}
                            </span>
                            <p className="text-xs text-on-surface-variant font-normal mt-1 italic">
                              &quot;{vm.description}&quot;
                            </p>
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold">
                            {new Date(vm.startDate).toLocaleString("vi-VN")}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold">
                            {new Date(vm.endDate).toLocaleString("vi-VN")}
                          </td>
                          <td className="px-6 py-4 text-xs font-medium text-error">
                            {vm.affectedScheduleIds?.length > 0 ? (
                              <span className="font-bold flex items-center gap-1">
                                <span className="material-symbols-outlined text-[14px]">
                                  warning
                                </span>
                                Hủy {vm.affectedScheduleIds.length} chuyến
                              </span>
                            ) : (
                              <span className="text-[#3f4852]/60">
                                Không ảnh hưởng
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-sm font-bold">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs ${
                                vm.status === "SCHEDULED"
                                  ? "bg-blue-100 text-blue-700"
                                  : vm.status === "IN_PROGRESS"
                                    ? "bg-amber-100 text-amber-700 animate-pulse"
                                    : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {vm.status === "SCHEDULED"
                                ? "Đã lập lịch"
                                : vm.status === "IN_PROGRESS"
                                  ? "Đang tiến hành"
                                  : "Đã hoàn thành"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {vm.status === "SCHEDULED" && (
                                <button
                                  onClick={() =>
                                    handleUpdateMaintenanceStatus(
                                      vm.id,
                                      "IN_PROGRESS",
                                    )
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white cursor-pointer border-none"
                                >
                                  Bắt đầu
                                </button>
                              )}
                              {vm.status === "IN_PROGRESS" && (
                                <button
                                  onClick={() =>
                                    handleUpdateMaintenanceStatus(
                                      vm.id,
                                      "COMPLETED",
                                    )
                                  }
                                  className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white cursor-pointer border-none"
                                >
                                  Hoàn thành
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteMaintenance(vm.id)}
                                className="p-1 text-error hover:bg-error-container/30 rounded cursor-pointer border-none bg-transparent"
                                title="Xóa"
                              >
                                <span className="material-symbols-outlined text-[18px]">
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
          </div>
        </div>
      )}

      {/* MODAL: CREATE TRAIN */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-md">
          <div
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => !submitting && setShowCreateModal(false)}
          ></div>
          <div className="relative bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-outline-variant/30 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-md border-b border-outline-variant flex items-center justify-between bg-surface-container-lowest">
              <div>
                <h3 className="font-bold text-lg text-on-surface">
                  Thêm Đoàn Tàu Mới
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Tạo tàu và tự động sinh ghế theo định mức thiết kế
                </p>
              </div>
              <button
                className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-outline cursor-pointer border-none bg-transparent"
                disabled={submitting}
                onClick={() => setShowCreateModal(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Stepper */}
            <div className="px-md py-3 bg-surface border-b border-outline-variant/60 flex items-center justify-around text-xs font-semibold text-on-surface-variant">
              <span
                className={`flex items-center gap-1.5 ${createStep === 1 ? "text-primary font-bold" : ""}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${createStep === 1 ? "bg-primary text-white" : "bg-surface-container-highest"}`}
                >
                  1
                </span>
                Thông tin chung
              </span>
              <span className="text-outline">---</span>
              <span
                className={`flex items-center gap-1.5 ${createStep === 2 ? "text-primary font-bold" : ""}`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${createStep === 2 ? "bg-primary text-white" : "bg-surface-container-highest"}`}
                >
                  2
                </span>
                Cấu hình 5 toa & Sinh ghế
              </span>
            </div>

            {/* Form */}
            <form
              onSubmit={handleCreateTrain}
              className="flex-1 overflow-y-auto p-md space-y-md"
            >
              {createStep === 1 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-md">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                        Số Hiệu Tàu *
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="VD: SE1, HD3, TN6..."
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container outline-none transition-all uppercase"
                        value={newTrainForm.trainName}
                        onChange={(e) =>
                          setNewTrainForm({
                            ...newTrainForm,
                            trainName: e.target.value,
                            trainCode: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                        Mã Tàu *
                      </label>
                      <input
                        required
                        type="text"
                        placeholder="VD: SE1, HD3, TN6..."
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container outline-none transition-all uppercase bg-surface text-on-surface-variant"
                        readOnly
                        value={newTrainForm.trainCode}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-md">
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                        Phân Loại Tuyến Tàu *
                      </label>
                      <select
                        required
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container bg-white outline-none transition-all cursor-pointer"
                        value={newTrainForm.trainType}
                        onChange={(e) =>
                          setNewTrainForm({
                            ...newTrainForm,
                            trainType: e.target.value,
                          })
                        }
                      >
                        {Object.entries(TRAIN_TYPES).map(([code, type]) => (
                          <option key={code} value={code}>
                            {type.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                        Đơn Vị Vận Hành
                      </label>
                      <input
                        type="text"
                        placeholder="Đường Sắt Việt Nam"
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container outline-none transition-all"
                        value={newTrainForm.operatingCompany}
                        onChange={(e) =>
                          setNewTrainForm({
                            ...newTrainForm,
                            operatingCompany: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-primary/5 rounded-xl text-xs text-on-surface-variant space-y-2 border border-primary/10">
                    <p className="font-bold text-primary flex items-center gap-1">
                      <span className="material-symbols-outlined text-[16px]">
                        info
                      </span>{" "}
                      Định mức mặc định của đoàn tàu
                    </p>
                    <p className="leading-relaxed">
                      Mỗi đoàn tàu khi tạo mới sẽ bao gồm{" "}
                      <b>cố định 5 toa hành khách</b> theo tiêu chuẩn. Bạn sẽ
                      cấu hình chi tiết loại toa và hệ thống tự động sinh 148
                      ghế/giường nằm tương ứng ở bước tiếp theo.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-on-surface-variant font-semibold">
                    Cấu hình 5 Toa tàu (Toa số 1 đến 5):
                  </p>
                  <div className="space-y-3">
                    {newTrainForm.carriages.map((type, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-4 bg-surface rounded-xl p-3 border border-outline-variant/60"
                      >
                        <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold text-sm">
                          {idx + 1}
                        </span>
                        <div className="flex-1">
                          <label className="block text-[10px] font-bold text-outline uppercase">
                            Toa số {idx + 1}
                          </label>
                          <select
                            className="w-full bg-transparent font-semibold border-none p-0 text-sm focus:ring-0 cursor-pointer text-[#00629d]"
                            value={type}
                            onChange={(e) =>
                              handleCarriageChange(idx, e.target.value)
                            }
                          >
                            {Object.entries(CARRIAGE_TYPES).map(
                              ([code, tInfo]) => (
                                <option key={code} value={code}>
                                  {tInfo.name} ({tInfo.capacity} chỗ - Hệ số{" "}
                                  {tInfo.priceFactor}x)
                                </option>
                              ),
                            )}
                          </select>
                        </div>
                        <div className="text-right text-xs font-semibold text-on-surface-variant">
                          {CARRIAGE_TYPES[type]?.capacity} chỗ
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary info banner */}
                  <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-on-surface">
                        Tổng số toa: 5 Toa
                      </p>
                      <p className="text-on-surface-variant mt-0.5">
                        Số toa sẽ tự động hiển thị đẹp mắt trên client
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary text-sm">
                        Tổng cộng: {getFormTotalSeats()} chỗ
                      </p>
                      <p className="text-[10px] text-outline">
                        Sẽ tự động sinh bản ghi Seats
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </form>

            {/* Footer */}
            <div className="p-md border-t border-outline-variant bg-surface flex justify-between gap-md">
              {createStep === 2 ? (
                <button
                  type="button"
                  onClick={() => setCreateStep(1)}
                  disabled={submitting}
                  className="px-md py-2 text-sm font-semibold text-[#3f4852] hover:text-[#191c1e] transition-colors cursor-pointer border-none bg-transparent"
                >
                  Quay lại
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setShowCreateModal(false)}
                  className="px-md py-2.5 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors cursor-pointer border-none bg-transparent"
                >
                  Hủy bỏ
                </button>

                {createStep === 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!newTrainForm.trainName) {
                        toast.error("Vui lòng nhập số hiệu tàu.");
                        return;
                      }
                      setCreateStep(2);
                    }}
                    className="bg-primary hover:bg-primary-container text-white px-md py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all cursor-pointer border-none"
                  >
                    Tiếp theo
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCreateTrain}
                    className="bg-gradient-to-r from-primary-container to-primary hover:opacity-90 disabled:opacity-50 text-white px-md py-2.5 rounded-xl font-semibold text-sm shadow-md flex items-center gap-1.5 cursor-pointer border-none"
                  >
                    {submitting ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">
                          progress_activity
                        </span>
                        Đang tạo & sinh ghế...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[18px]">
                          bolt
                        </span>
                        Lưu & Sinh ghế
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: TRAIN DETAIL / CARRIAGES & SEATS */}
      {showDetailModal && selectedTrain && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-md">
          <div
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm"
            onClick={() => setShowDetailModal(false)}
          ></div>
          <div className="relative bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden border border-outline-variant/30 flex flex-col max-h-[90vh] glass-panel">
            {/* Header */}
            <div className="p-md border-b border-outline-variant flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg text-on-surface">
                  Đoàn Tàu {selectedTrain.trainName} - Sơ Đồ Toa & Ghế
                </h3>
                <p className="text-xs text-on-surface-variant mt-0.5">
                  Phân loại tàu: {selectedTrain.trainType} · Tổng{" "}
                  {selectedTrain.totalCapacity} chỗ
                </p>
              </div>
              <button
                className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-outline cursor-pointer border-none bg-transparent"
                onClick={() => setShowDetailModal(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-md space-y-lg">
              {detailLoading ? (
                <div className="min-h-64 flex flex-col items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-3xl animate-spin">
                    progress_activity
                  </span>
                  <p className="mt-2 text-sm font-semibold">
                    Đang tải sơ đồ toa và ghế...
                  </p>
                </div>
              ) : (
                <>
                  {/* Carriage visualization */}
                  <div className="space-y-3">
                    <p className="text-xs font-bold text-on-surface-variant">
                      Sơ đồ {selectedTrain.totalCarriages} Toa (Click vào ghế
                      bên dưới để khóa/mở khóa bảo trì)
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Locomotive */}
                      <div className="w-16 h-20 bg-primary-container text-white rounded-lg flex flex-col items-center justify-center relative punch-hole overflow-hidden select-none">
                        <span className="material-symbols-outlined text-[20px]">
                          train
                        </span>
                        <span className="text-[10px] opacity-80 uppercase mt-0.5 font-bold">
                          Đầu Máy
                        </span>
                      </div>

                      {/* Carriages */}
                      {selectedTrain.carriages?.map((carriage, idx) => {
                        const isSelected = selectedCarriageIdx === idx;
                        let shortName = "Ghế";
                        if (carriage.carriageType.includes("SLEEPER"))
                          shortName = "Giường";

                        return (
                          <div
                            key={carriage.id}
                            onClick={() => setSelectedCarriageIdx(idx)}
                            className={`w-16 h-20 rounded-lg flex flex-col items-center justify-center relative punch-hole overflow-hidden cursor-pointer select-none transition-all ${
                              isSelected
                                ? "bg-primary text-white ring-2 ring-primary-container shadow-md"
                                : "bg-surface-container-highest border border-outline-variant text-on-surface hover:bg-surface-container-high"
                            }`}
                          >
                            <span className="font-extrabold text-sm">
                              Toa {carriage.carriageNumber}
                            </span>
                            <span
                              className={`text-[9px] uppercase mt-0.5 font-bold ${isSelected ? "text-white/80" : "text-on-surface-variant"}`}
                            >
                              {shortName}
                            </span>
                            <span
                              className={`text-[9px] mt-0.5 font-semibold ${isSelected ? "text-white/70" : "text-outline"}`}
                            >
                              {carriage.totalSeats} chỗ
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Carriage Info & Seat Map */}
                  {selectedTrain.carriages?.[selectedCarriageIdx] && (
                    <div className="space-y-4 border-t border-outline-variant/60 pt-md">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-bold text-base text-on-surface">
                            Toa Số{" "}
                            {
                              selectedTrain.carriages[selectedCarriageIdx]
                                .carriageNumber
                            }
                            :{" "}
                            {CARRIAGE_TYPES[
                              selectedTrain.carriages[selectedCarriageIdx]
                                .carriageType
                            ]?.name ||
                              selectedTrain.carriages[selectedCarriageIdx]
                                .carriageType}
                          </h4>
                          <p className="text-xs text-on-surface-variant mt-0.5">
                            Tổng số chỗ ngồi:{" "}
                            {
                              selectedTrain.carriages[selectedCarriageIdx]
                                .totalSeats
                            }{" "}
                            chỗ
                          </p>
                        </div>
                        <div className="flex gap-md text-xs font-semibold">
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 border border-[#bec7d4] bg-white rounded"></span>{" "}
                            Khả dụng (Available)
                          </span>
                          <span className="flex items-center gap-1.5">
                            <span className="w-3.5 h-3.5 bg-slate-200 border border-slate-300 rounded"></span>{" "}
                            Đang bị khóa (Blocked)
                          </span>
                        </div>
                      </div>

                      {/* Seat Map */}
                      <div className="p-4 bg-surface rounded-2xl border border-outline-variant/60">
                        {renderSeatsMatrix(
                          selectedTrain.carriages[selectedCarriageIdx],
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-md bg-surface-container-low border-t border-outline-variant flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-primary text-white px-md py-2 rounded-xl font-semibold text-sm shadow-sm hover:opacity-90 transition-all cursor-pointer border-none"
              >
                Đóng sơ đồ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SEAT BLOCK CONFIG (Micro-Maintenance) */}
      {showSeatBlockModal && selectedSeat && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-md bg-black/40 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 relative border border-outline-variant/30">
            <button
              onClick={() => setShowSeatBlockModal(false)}
              className="absolute top-4 right-4 text-outline hover:text-on-surface p-1 rounded-lg cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-bold text-lg text-[#191c1e] mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#00629d]">
                build
              </span>
              Cấu hình Khóa ghế: {selectedSeat.seatNumber}
            </h3>
            <p className="text-xs text-[#3f4852] mb-4">
              Khóa ghế ngăn hành khách đặt vé trên ghế này do các sự cố kỹ thuật
              vật lý hoặc an toàn.
            </p>

            <form onSubmit={handleSaveSeatBlock} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  Trạng thái khóa ghế
                </label>
                <select
                  value={seatBlockForm.status}
                  onChange={(e) =>
                    setSeatBlockForm((prev) => ({
                      ...prev,
                      status: e.target.value,
                    }))
                  }
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white cursor-pointer"
                >
                  <option value="AVAILABLE">MỞ KHÓA (Cho phép bán vé)</option>
                  <option value="BLOCKED">KHÓA (Ngừng bán vé)</option>
                </select>
              </div>

              {seatBlockForm.status === "BLOCKED" && (
                <>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                      Lý do khóa
                    </label>
                    <select
                      value={seatBlockForm.blockReason}
                      onChange={(e) =>
                        setSeatBlockForm((prev) => ({
                          ...prev,
                          blockReason: e.target.value,
                        }))
                      }
                      className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white cursor-pointer"
                    >
                      <option value="MAINTENANCE">
                        Bảo trì định kỳ (Routine Maintenance)
                      </option>
                      <option value="DEFECT">
                        Lỗi hỏng hóc vật lý (Defect - Ghế gãy, Điều hòa
                        hỏng,...)
                      </option>
                      <option value="SAFETY">
                        Vấn đề an toàn đường sắt (Safety)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                      Khóa đến ngày (Dự kiến)
                    </label>
                    <input
                      type="date"
                      value={seatBlockForm.blockUntil}
                      onChange={(e) =>
                        setSeatBlockForm((prev) => ({
                          ...prev,
                          blockUntil: e.target.value,
                        }))
                      }
                      className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                    />
                    <p className="text-[10px] text-outline mt-1">
                      Để trống nếu khóa vô thời hạn cho tới khi mở thủ công.
                    </p>
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowSeatBlockModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-[#3f4852] font-semibold text-sm cursor-pointer hover:bg-slate-100 bg-transparent"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary text-white font-semibold text-sm cursor-pointer hover:opacity-90 border-none"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TRAIN OPERATIONAL STATUS CHANGE CONFIRM (BR-33) */}
      {showStatusConfirmModal && selectedTrainForStatusChange && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-md bg-black/50 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 border border-outline-variant/30 space-y-4">
            <h3 className="font-bold text-lg text-error flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[24px]">
                warning
              </span>
              Xác nhận thay đổi trạng thái vận hành
            </h3>

            <div className="text-sm text-[#3f4852] space-y-3 leading-relaxed">
              <p>
                Bạn đang thực hiện thay đổi trạng thái hoạt động của tàu{" "}
                <strong>{selectedTrainForStatusChange.trainName}</strong> sang:
                <span
                  className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
                    nextTrainStatus === "ACTIVE"
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {nextTrainStatus === "ACTIVE"
                    ? "Hoạt động trở lại"
                    : "Ngừng hoạt động (Inactive)"}
                </span>
              </p>

              {nextTrainStatus === "INACTIVE" && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs space-y-2 text-red-800">
                  <p className="font-bold">
                    ⚠️ Cảnh báo Quy tắc nghiệp vụ (BR-29):
                  </p>
                  <p>
                    Ngay khi tàu chuyển sang trạng thái{" "}
                    <strong>Inactive</strong>, hệ thống sẽ{" "}
                    <strong>tự động từ chối (Decline)</strong> toàn bộ các yêu
                    cầu đặt vé đang ở trạng thái <strong>Pending</strong> của
                    các chuyến chạy tương lai thuộc con tàu này với lý do:{" "}
                    <em>&quot;Dịch vụ hiện không khả dụng&quot;</em>.
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowStatusConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-outline-variant text-[#3f4852] font-semibold text-sm cursor-pointer hover:bg-slate-100 bg-transparent"
              >
                Hủy thao tác
              </button>
              <button
                type="button"
                onClick={confirmStatusChange}
                className="flex-1 py-2.5 rounded-xl bg-error text-white font-semibold text-sm cursor-pointer hover:bg-red-600 border-none"
              >
                Xác nhận thay đổi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ESTABLISH VEHICLE MAINTENANCE */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-md bg-black/40 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 relative border border-outline-variant/30 my-8 max-h-[90vh] overflow-y-auto custom-scrollbar">
            <button
              onClick={() => setShowMaintenanceModal(false)}
              className="absolute top-4 right-4 text-outline hover:text-on-surface p-1 rounded-lg cursor-pointer border-none bg-transparent"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            <h3 className="font-bold text-lg text-[#191c1e] mb-2 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#00629d]">
                build
              </span>
              Lập Kế Hoạch Bảo Trì Phương Tiện
            </h3>
            <p className="text-xs text-[#3f4852] mb-4">
              Nhập các tham số khung thời gian bảo trì và chọn danh sách các
              lịch trình chạy tàu sẽ bị ảnh hưởng (hủy chuyến).
            </p>

            <form onSubmit={handleCreateMaintenance} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  Đoàn tàu đi bảo trì *
                </label>
                <select
                  required
                  value={maintenanceForm.trainId}
                  onChange={(e) => handleMaintenanceTrainChange(e.target.value)}
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white cursor-pointer"
                >
                  <option value="">-- Chọn đoàn tàu --</option>
                  {trains.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.trainName} ({t.trainCode})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                    Loại hình bảo trì *
                  </label>
                  <select
                    value={maintenanceForm.maintenanceType}
                    onChange={(e) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        maintenanceType: e.target.value,
                      }))
                    }
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none bg-white cursor-pointer"
                  >
                    <option value="ROUTINE">Bảo trì định kỳ (Routine)</option>
                    <option value="EMERGENCY">
                      Sửa chữa khẩn cấp (Emergency)
                    </option>
                    <option value="INSPECTION">
                      Kiểm tra kỹ thuật (Inspection)
                    </option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                    Lý do bảo trì *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="VD: Hỏng trục bánh xe..."
                    value={maintenanceForm.description}
                    onChange={(e) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                    Ngày bắt đầu *
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={maintenanceForm.startDate}
                    onChange={(e) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        startDate: e.target.value,
                      }))
                    }
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                    Ngày kết thúc dự kiến *
                  </label>
                  <input
                    required
                    type="datetime-local"
                    value={maintenanceForm.endDate}
                    onChange={(e) =>
                      setMaintenanceForm((prev) => ({
                        ...prev,
                        endDate: e.target.value,
                      }))
                    }
                    className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none cursor-pointer"
                  />
                </div>
              </div>

              {maintenanceForm.trainId && (
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-1 flex items-center gap-1">
                    Chuyến tàu bị ảnh hưởng (Sẽ bị hủy chuyến)
                    {activeSchedulesForTrain.length > 0 && (
                      <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full">
                        {activeSchedulesForTrain.length} lịch chạy tương lai
                      </span>
                    )}
                  </label>

                  {activeSchedulesForTrain.length === 0 ? (
                    <p className="text-[11px] text-outline italic">
                      Không tìm thấy chuyến chạy tương lai của tàu này.
                    </p>
                  ) : (
                    <div className="border border-outline-variant/60 rounded-xl max-h-40 overflow-y-auto p-2 bg-slate-50 space-y-1.5 custom-scrollbar">
                      {activeSchedulesForTrain.map((s) => {
                        const isChecked =
                          maintenanceForm.affectedScheduleIds.includes(s.id);
                        return (
                          <label
                            key={s.id}
                            className="flex items-start gap-2.5 text-xs text-[#3f4852] cursor-pointer hover:bg-slate-100 p-1.5 rounded-lg"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const selected = e.target.checked
                                  ? [
                                      ...maintenanceForm.affectedScheduleIds,
                                      s.id,
                                    ]
                                  : maintenanceForm.affectedScheduleIds.filter(
                                      (id) => id !== s.id,
                                    );
                                setMaintenanceForm((prev) => ({
                                  ...prev,
                                  affectedScheduleIds: selected,
                                }));
                              }}
                              className="mt-0.5 rounded text-primary focus:ring-0 cursor-pointer"
                            />
                            <div>
                              <p className="font-bold text-[#191c1e]">
                                {s.route?.routeName} (
                                {new Date(s.departureTime).toLocaleString(
                                  "vi-VN",
                                )}
                                )
                              </p>
                              <p className="text-[10px] text-outline">
                                ID: {s.id}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-on-surface-variant mb-1.5">
                  Ghi chú thêm
                </label>
                <textarea
                  placeholder="Ghi chú thêm cho kỹ sư..."
                  value={maintenanceForm.notes}
                  onChange={(e) =>
                    setMaintenanceForm((prev) => ({
                      ...prev,
                      notes: e.target.value,
                    }))
                  }
                  className="w-full border border-outline-variant rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none h-16 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-3 border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setShowMaintenanceModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-outline-variant text-[#3f4852] font-semibold text-sm cursor-pointer hover:bg-slate-100 bg-transparent"
                >
                  Đóng
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#00629d] text-white font-semibold text-sm cursor-pointer hover:opacity-90 border-none"
                >
                  Lưu lịch bảo trì
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
