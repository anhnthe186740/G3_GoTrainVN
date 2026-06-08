import {
  RotateCw,
  Clock,
  Train as TrainIcon,
  SlidersHorizontal,
  ArrowUpDown,
} from "lucide-react";

export function FilterPanel({
  filters,
  setFilters,
  sortBy,
  setSortBy,
  onReset,
}) {
  const timeSlots = [
    { id: "early", label: "Sáng sớm (00:00 - 06:00)", value: "00-06" },
    { id: "morning", label: "Buổi sáng (06:00 - 12:00)", value: "06-12" },
    { id: "afternoon", label: "Buổi chiều (12:00 - 18:00)", value: "12-18" },
    { id: "night", label: "Buổi tối (18:00 - 24:00)", value: "18-24" },
  ];

  const trainTypes = [
    { label: "Tàu nhanh (SE)", value: "SE" },
    { label: "Tàu thường (TN)", value: "TN" },
  ];

  const carriageTypes = [
    { label: "Ghế ngồi (SEAT)", value: "SEAT" },
    { label: "Ghế AC (AC_SEAT)", value: "AC_SEAT" },
    { label: "Giường nằm (SLEEPER)", value: "SLEEPER" },
  ];

  const sortOptions = [
    { label: "Giá: Thấp đến Cao", value: "price-asc" },
    { label: "Giá: Cao đến Thấp", value: "price-desc" },
    { label: "Giờ đi: Sớm nhất", value: "time-asc" },
    { label: "Giờ đi: Muộn nhất", value: "time-desc" },
    { label: "Thời gian di chuyển ngắn nhất", value: "duration-asc" },
  ];

  const toggleFilter = (type, value) => {
    setFilters((prev) => {
      const current = prev[type] || [];
      const updated = current.includes(value)
        ? current.filter((x) => x !== value)
        : [...current, value];
      return { ...prev, [type]: updated };
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm sticky top-24 space-y-6 text-left">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 font-bold text-slate-800 text-base">
          <SlidersHorizontal className="h-4 w-4 text-primary" />
          <span>Bộ lọc & Sắp xếp</span>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-semibold text-primary hover:text-primary-container flex items-center gap-1 cursor-pointer transition-colors"
        >
          <RotateCw className="h-3 w-3" />
          <span>Đặt lại</span>
        </button>
      </div>

      {/* Sắp xếp */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
          Sắp xếp theo
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 bg-white focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
        >
          {sortOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Lọc Khung giờ đi */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-slate-400" />
          Giờ xuất phát
        </label>
        <div className="space-y-2">
          {timeSlots.map((slot) => {
            const isChecked = (filters.timeSlots || []).includes(slot.value);
            return (
              <label
                key={slot.id}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-sm cursor-pointer select-none transition-all ${
                  isChecked
                    ? "border-primary bg-primary/5 text-primary font-semibold"
                    : "border-slate-100 bg-slate-50/50 hover:bg-slate-50 text-slate-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleFilter("timeSlots", slot.value)}
                  className="hidden"
                />
                <span className="text-xs">{slot.label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Lọc Loại tàu */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <TrainIcon className="h-3.5 w-3.5 text-slate-400" />
          Loại tàu
        </label>
        <div className="flex flex-wrap gap-2">
          {trainTypes.map((type) => {
            const isChecked = (filters.trainTypes || []).includes(type.value);
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => toggleFilter("trainTypes", type.value)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                  isChecked
                    ? "border-primary bg-primary text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                }`}
              >
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Lọc Loại chỗ (Ghế/Giường) */}
      <div className="space-y-3">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-slate-400" />
          Loại chỗ
        </label>
        <div className="space-y-2">
          {carriageTypes.map((type) => {
            const isChecked = (filters.carriageTypes || []).includes(
              type.value,
            );
            return (
              <label
                key={type.value}
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-800 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleFilter("carriageTypes", type.value)}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/20"
                />
                <span>{type.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
