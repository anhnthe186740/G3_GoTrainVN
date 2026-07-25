import { Search, SlidersHorizontal } from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

export function TransactionFilters({ filters, onChange }) {
  const { language } = useLanguage();

  const TYPE_OPTIONS = [
    { value: "", label: language === "vi" ? "Tất cả loại" : "All Types" },
    { value: "DEPOSIT", label: language === "vi" ? "Nạp tiền" : "Deposit" },
    { value: "PAYMENT", label: language === "vi" ? "Thanh toán" : "Payment" },
    { value: "REFUND", label: language === "vi" ? "Hoàn tiền" : "Refund" },
    {
      value: "WITHDRAWAL",
      label: language === "vi" ? "Rút tiền" : "Withdrawal",
    },
  ];

  const STATUS_OPTIONS = [
    {
      value: "",
      label: language === "vi" ? "Tất cả trạng thái" : "All Statuses",
    },
    {
      value: "COMPLETED",
      label: language === "vi" ? "Hoàn thành" : "Completed",
    },
    { value: "PENDING", label: language === "vi" ? "Chờ xử lý" : "Pending" },
    { value: "FAILED", label: language === "vi" ? "Thất bại" : "Failed" },
  ];

  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <SlidersHorizontal className="w-4 h-4" />
        <span className="text-sm font-semibold">
          {language === "vi" ? "Lọc:" : "Filter:"}
        </span>
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
          className="text-xs text-primary font-semibold hover:underline border-none bg-transparent cursor-pointer"
        >
          {language === "vi" ? "Xoá lọc" : "Clear filters"}
        </button>
      )}
    </div>
  );
}
