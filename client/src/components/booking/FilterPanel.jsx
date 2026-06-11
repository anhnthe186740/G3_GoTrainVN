import {
  RotateCw,
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
  const trainTypes = [
    { label: "Tàu nhanh (SE)", value: "SE" },
    { label: "Tàu thường (TN)", value: "TN" },
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

      {/* Lọc Loại tàu */}
      <div className="space-y-3 pb-2">
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

      {/* Dynamic/Helpful Info section at the bottom to fill height */}
      <div className="pt-5 border-t border-slate-100 space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Mẹo đặt vé tàu
        </h4>
        <ul className="text-[11px] text-slate-500 space-y-2.5 list-disc pl-4 font-semibold leading-relaxed">
          <li>
            Đặt trước 3-5 ngày để giữ được vị trí ngồi AC hoặc giường nằm mong
            muốn.
          </li>
          <li>
            Học sinh, sinh viên và trẻ em được ưu đãi giảm tới 15% - 25% trực
            tiếp khi nhập thông tin.
          </li>
          <li>Tỉ lệ lấp đầy hiển thị theo thời gian thực.</li>
        </ul>
      </div>
    </div>
  );
}
