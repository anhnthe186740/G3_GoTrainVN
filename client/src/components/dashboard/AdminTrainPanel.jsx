import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { api } from "../../services/api";

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

export function AdminTrainPanel() {
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
  const [selectedCarriageIdx, setSelectedCarriageIdx] = useState(0); // index 0-4

  // Fetch trains
  const fetchTrains = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/trains");
      setTrains(res.data.trains || []);
    } catch (err) {
      toast.error(
        "Không thể tải danh sách tàu: " +
          (err.response?.data?.message || err.message),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrains();
  }, [fetchTrains]);

  // Helper to determine train maintenance status
  const getTrainStatus = (train) => {
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

    if (inMaintenance) {
      return {
        label: "Bảo trì định kỳ",
        colorClass: "text-error",
        indicator: "bg-error",
        bgClass: "bg-error-container/30",
        isMaintenance: true,
      };
    }
    return {
      label: "Sẵn sàng",
      colorClass: "text-emerald-600",
      indicator: "bg-emerald-500 animate-pulse",
      bgClass: "bg-emerald-100",
      isMaintenance: false,
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
      fetchTrains();
    } catch (err) {
      toast.error(
        "Lỗi khi xóa tàu: " + (err.response?.data?.message || err.message),
      );
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
      fetchTrains();
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

  // Filters
  const filteredTrains = trains.filter((train) => {
    const matchesSearch =
      train.trainName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      train.trainCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType ? train.trainType === filterType : true;
    const status = getTrainStatus(train);
    const matchesStatus = filterStatus
      ? filterStatus === "MAINTENANCE"
        ? status.isMaintenance
        : !status.isMaintenance
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
    // Sort seats by seatNumber: if number, sort numerically. If string (K1-T1-A), sort compartment -> floor -> side.
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
      // 4 columns
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
                  {rowSeats[0] && (
                    <div
                      className="flex-1 py-2 rounded-lg text-center font-bold text-xs border border-[#bec7d4] bg-white text-on-surface hover:bg-primary-container/20 transition-all cursor-default"
                      title={`Ký hiệu: ${rowSeats[0].seatNumber} | Giá: ${rowSeats[0].basePrice.toLocaleString()}đ`}
                    >
                      {rowSeats[0].seatNumber}
                    </div>
                  )}
                  {rowSeats[1] && (
                    <div
                      className="flex-1 py-2 rounded-lg text-center font-bold text-xs border border-[#bec7d4] bg-white text-on-surface hover:bg-primary-container/20 transition-all cursor-default"
                      title={`Ký hiệu: ${rowSeats[1].seatNumber} | Giá: ${rowSeats[1].basePrice.toLocaleString()}đ`}
                    >
                      {rowSeats[1].seatNumber}
                    </div>
                  )}
                </div>

                {/* Aisle */}
                <div className="w-12 text-center text-[10px] text-outline uppercase font-semibold">
                  Hàng {rIdx + 1}
                </div>

                {/* Right side (2 seats) */}
                <div className="flex gap-2 w-[42%] justify-between">
                  {rowSeats[2] && (
                    <div
                      className="flex-1 py-2 rounded-lg text-center font-bold text-xs border border-[#bec7d4] bg-white text-on-surface hover:bg-primary-container/20 transition-all cursor-default"
                      title={`Ký hiệu: ${rowSeats[2].seatNumber} | Giá: ${rowSeats[2].basePrice.toLocaleString()}đ`}
                    >
                      {rowSeats[2].seatNumber}
                    </div>
                  )}
                  {rowSeats[3] && (
                    <div
                      className="flex-1 py-2 rounded-lg text-center font-bold text-xs border border-[#bec7d4] bg-white text-on-surface hover:bg-primary-container/20 transition-all cursor-default"
                      title={`Ký hiệu: ${rowSeats[3].seatNumber} | Giá: ${rowSeats[3].basePrice.toLocaleString()}đ`}
                    >
                      {rowSeats[3].seatNumber}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    } else {
      // Sleeper 6 or Sleeper 4
      // Group seats by Compartment
      const compartments = {};
      sortedSeats.forEach((seat) => {
        const match = seat.seatNumber.match(/^K(\d+)/);
        const compNum = match ? match[1] : "1";
        if (!compartments[compNum]) compartments[compNum] = [];
        compartments[compNum].push(seat);
      });

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
                    .map((s) => {
                      const matchFloor = s.seatNumber.match(/-T(\d+)/);
                      const floor = matchFloor ? matchFloor[1] : "1";
                      return (
                        <div
                          key={s.id}
                          className="py-1 px-2 border border-[#bec7d4] bg-white rounded-lg flex items-center justify-between text-xs cursor-default hover:bg-primary-container/20 transition-all"
                          title={`Giường: ${s.seatNumber} | Giá: ${s.basePrice.toLocaleString()}đ`}
                        >
                          <span className="font-bold">Tầng {floor}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-semibold">
                            {s.seatNumber}
                          </span>
                        </div>
                      );
                    })}
                </div>
                {/* Right side beds (B) */}
                <div className="space-y-2">
                  <p className="text-[10px] text-outline font-bold uppercase tracking-wider text-left border-b border-outline-variant/20 pb-0.5">
                    Dãy B (Phải)
                  </p>
                  {compSeats
                    .filter((s) => s.seatNumber.endsWith("-B"))
                    .map((s) => {
                      const matchFloor = s.seatNumber.match(/-T(\d+)/);
                      const floor = matchFloor ? matchFloor[1] : "1";
                      return (
                        <div
                          key={s.id}
                          className="py-1 px-2 border border-[#bec7d4] bg-white rounded-lg flex items-center justify-between text-xs cursor-default hover:bg-primary-container/20 transition-all"
                          title={`Giường: ${s.seatNumber} | Giá: ${s.basePrice.toLocaleString()}đ`}
                        >
                          <span className="font-bold">Tầng {floor}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-semibold">
                            {s.seatNumber}
                          </span>
                        </div>
                      );
                    })}
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
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md">
        <div>
          <h2 className="text-2xl font-bold text-[#191c1e] mb-xs">
            Quản Lý Đoàn Tàu
          </h2>
          <p className="text-sm text-[#3f4852] mt-1">
            Quản lý danh sách, trạng thái và cấu hình toa của toàn bộ đội tàu.
          </p>
        </div>
        <button
          onClick={() => {
            setShowCreateModal(true);
            setCreateStep(1);
          }}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-primary-container to-primary text-white px-md py-3 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg active:scale-95 transition-all"
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
            <span className="material-symbols-outlined text-[24px]">build</span>
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
            className="w-full pl-12 pr-md py-2.5 bg-surface rounded-xl border border-outline-variant focus:ring-2 focus:ring-primary-container outline-none transition-all text-sm"
            placeholder="Tìm kiếm theo số hiệu hoặc mã tàu..."
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-sm w-full md:w-auto">
          <select
            className="flex-1 md:flex-none py-2.5 px-4 bg-white border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary-container outline-none"
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
            className="flex-1 md:flex-none py-2.5 px-4 bg-white border border-outline-variant rounded-xl text-sm focus:ring-2 focus:ring-primary-container outline-none"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="">Tất cả trạng thái</option>
            <option value="READY">Sẵn sàng</option>
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
            <p className="text-sm font-semibold">Đang tải danh sách tàu...</p>
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
                    Mã Tàu
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
                      <td className="px-6 py-4 font-semibold text-sm text-on-surface">
                        {train.trainCode}
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
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${status.bgClass} ${status.colorClass}`}
                        >
                          <span
                            className={`w-2 h-2 rounded-full ${status.indicator}`}
                          ></span>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setSelectedTrain(train);
                              setSelectedCarriageIdx(0);
                              setShowDetailModal(true);
                            }}
                            className="p-2 text-outline hover:text-primary transition-colors rounded-lg hover:bg-primary-fixed/20"
                            title="Xem sơ đồ & Chi tiết Toa/Ghế"
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              edit_square
                            </span>
                          </button>
                          <button
                            onClick={() =>
                              handleDeleteTrain(train.id, train.trainName)
                            }
                            className="p-2 text-outline hover:text-error transition-colors rounded-lg hover:bg-error-container/20"
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
                className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-outline"
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
                        Mã Đoàn Tàu *
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
                        className="w-full border border-outline-variant rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-container bg-white outline-none transition-all"
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
                  className="px-md py-2 text-sm font-semibold text-[#3f4852] hover:text-[#191c1e] transition-colors"
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
                  className="px-md py-2.5 text-sm font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
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
                    className="bg-primary hover:bg-primary-container text-white px-md py-2.5 rounded-xl font-semibold text-sm shadow-sm transition-all"
                  >
                    Tiếp theo
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={handleCreateTrain}
                    className="bg-gradient-to-r from-primary-container to-primary hover:opacity-90 disabled:opacity-50 text-white px-md py-2.5 rounded-xl font-semibold text-sm shadow-md flex items-center gap-1.5"
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
                className="p-2 hover:bg-surface-container-high rounded-full transition-colors text-outline"
                onClick={() => setShowDetailModal(false)}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-md space-y-lg">
              {/* Carriage visualization (Punch card metaphor) */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-on-surface-variant">
                  Sơ đồ {selectedTrain.totalCarriages} Toa
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  {/* Locomotive (Đầu máy) */}
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
                        Trống (Available)
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
            </div>

            {/* Footer */}
            <div className="p-md bg-surface-container-low border-t border-outline-variant flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="bg-primary text-white px-md py-2 rounded-xl font-semibold text-sm shadow-sm hover:opacity-90 transition-all"
              >
                Đóng sơ đồ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
