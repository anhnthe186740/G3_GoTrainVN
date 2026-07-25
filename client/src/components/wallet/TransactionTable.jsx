import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Banknote,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";
import { useLanguage } from "../../context/LanguageContext";

const fmt = (n, language = "vi") =>
  new Intl.NumberFormat(language === "vi" ? "vi-VN" : "en-US", {
    style: "currency",
    currency: "VND",
  }).format(n ?? 0);

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="px-4 py-4">
          <div
            className="h-4 bg-surface-container rounded-lg"
            style={{ width: `${60 + i * 8}%` }}
          />
        </td>
      ))}
    </tr>
  );
}

export function TransactionTable({
  transactions = [],
  isLoading,
  total,
  page,
  totalPages,
  limit,
  onPageChange,
  hidePagination = false,
}) {
  const { language } = useLanguage();

  const TYPE_META = {
    DEPOSIT: {
      label: language === "vi" ? "Nạp tiền" : "Deposit",
      Icon: ArrowDownLeft,
      badge: "bg-green-100 text-green-700",
      iconBg: "bg-green-100 text-green-600",
      amountColor: "text-green-600",
      prefix: "+",
    },
    PAYMENT: {
      label: language === "vi" ? "Thanh toán" : "Payment",
      Icon: ArrowUpRight,
      badge: "bg-blue-100 text-blue-700",
      iconBg: "bg-blue-100 text-blue-600",
      amountColor: "text-red-600",
      prefix: "−",
    },
    REFUND: {
      label: language === "vi" ? "Hoàn tiền" : "Refund",
      Icon: RotateCcw,
      badge: "bg-purple-100 text-purple-700",
      iconBg: "bg-purple-100 text-purple-600",
      amountColor: "text-green-600",
      prefix: "+",
    },
    WITHDRAWAL: {
      label: language === "vi" ? "Rút tiền" : "Withdrawal",
      Icon: Banknote,
      badge: "bg-orange-100 text-orange-700",
      iconBg: "bg-orange-100 text-orange-600",
      amountColor: "text-red-600",
      prefix: "−",
    },
  };

  const STATUS_META = {
    COMPLETED: {
      label: language === "vi" ? "Hoàn thành" : "Completed",
      cls: "bg-green-100 text-green-700",
    },
    PENDING: {
      label: language === "vi" ? "Chờ duyệt" : "Pending",
      cls: "bg-amber-100 text-amber-700",
    },
    FAILED: {
      label: language === "vi" ? "Thất bại" : "Failed",
      cls: "bg-red-100 text-red-700",
    },
  };

  const columns =
    language === "vi"
      ? ["Loại giao dịch", "Mô tả", "Số tiền", "Trạng thái", "Thời gian"]
      : ["Type", "Description", "Amount", "Status", "Time"];

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-outline-variant/50">
        <table className="w-full text-left">
          <thead className="bg-surface-container">
            <tr>
              {columns.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30 bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (!transactions.length) {
    return (
      <div className="rounded-2xl border border-outline-variant/50 bg-white py-16 flex flex-col items-center gap-3">
        <Inbox className="w-12 h-12 text-outline" />
        <p className="text-on-surface-variant font-medium">
          {language === "vi" ? "Chưa có giao dịch nào" : "No transactions yet"}
        </p>
        <p className="text-sm text-on-surface-variant/70">
          {language === "vi"
            ? "Nạp tiền để bắt đầu sử dụng ví"
            : "Deposit money to start using your wallet"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-outline-variant/50">
        <table className="w-full text-left">
          <thead className="bg-surface-container">
            <tr>
              {columns.map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left text-xs font-semibold text-on-surface-variant uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/30 bg-white">
            {transactions.map((txn) => {
              const meta = TYPE_META[txn.type] ?? TYPE_META.PAYMENT;
              const statusMeta = STATUS_META[txn.status] ?? STATUS_META.PENDING;
              const { Icon } = meta;

              return (
                <tr
                  key={txn.id}
                  className="hover:bg-surface-container-low transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${meta.badge}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-left">
                    <p className="text-sm text-on-surface line-clamp-2 max-w-[200px] mb-0 text-left">
                      {txn.description || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-left">
                    <span
                      className={`font-bold text-sm tabular-nums ${meta.amountColor}`}
                    >
                      {meta.prefix}
                      {fmt(txn.amount, language)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${statusMeta.cls}`}
                    >
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-on-surface-variant whitespace-nowrap text-left">
                    {new Date(txn.createdAt).toLocaleString(
                      language === "vi" ? "vi-VN" : "en-US",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!hidePagination && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-on-surface-variant">
            {language === "vi" ? (
              <>
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} /{" "}
                {total} giao dịch
              </>
            ) : (
              <>
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} /{" "}
                {total} transactions
              </>
            )}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-40 transition-colors border-none bg-transparent cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1,
              )
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1 text-on-surface-variant">…</span>
                  )}
                  <button
                    onClick={() => onPageChange(p)}
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors border-none cursor-pointer ${
                      p === page
                        ? "bg-primary text-white"
                        : "hover:bg-surface-container text-on-surface-variant bg-transparent"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-40 transition-colors border-none bg-transparent cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
