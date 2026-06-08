import { Search, SlidersHorizontal } from "lucide-react";

const TYPE_OPTIONS = [
  { value: "", label: "Tất cả loại" },
  { value: "DEPOSIT", label: "Nạp tiền" },
  { value: "PAYMENT", label: "Thanh toán" },
  { value: "REFUND", label: "Hoàn tiền" },
  { value: "WITHDRAWAL", label: "Rút tiền" },
];

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "FAILED", label: "Thất bại" },
];

export function TransactionFilters({ filters, onChange }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <SlidersHorizontal className="w-4 h-4" />
        <span className="text-sm font-semibold">Lọc:</span>
      </div>

      <select
        value={filters.type || ""}
        onChange={(e) =>
          onChange({ ...filters, type: e.target.value, page: 1 })
        }
        className="px-3 py-2 rounded-xl border border-outline-variant bg-white text-sm text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
      >
        {TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <select
        value={filters.status || ""}
        onChange={(e) =>
          onChange({ ...filters, status: e.target.value, page: 1 })
        }
        className="px-3 py-2 rounded-xl border border-outline-variant bg-white text-sm text-on-surface focus:outline-none focus:border-primary transition-colors cursor-pointer"
      >
        {STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {(filters.type || filters.status) && (
        <button
          onClick={() => onChange({ type: "", status: "", page: 1 })}
          className="text-xs text-primary font-semibold hover:underline"
        >
          Xoá lọc
        </button>
      )}
    </div>
  );
}
