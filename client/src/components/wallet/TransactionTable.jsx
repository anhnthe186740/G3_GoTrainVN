import {
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Banknote,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from "lucide-react";

const fmt = (n) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n ?? 0,
  );

const TYPE_META = {
  DEPOSIT: {
    label: "Nạp tiền",
    Icon: ArrowDownLeft,
    badge: "bg-green-100 text-green-700",
    iconBg: "bg-green-100 text-green-600",
    amountColor: "text-green-600",
    prefix: "+",
  },
  PAYMENT: {
    label: "Thanh toán",
    Icon: ArrowUpRight,
    badge: "bg-blue-100 text-blue-700",
    iconBg: "bg-blue-100 text-blue-600",
    amountColor: "text-red-600",
    prefix: "−",
  },
  REFUND: {
    label: "Hoàn tiền",
    Icon: RotateCcw,
    badge: "bg-purple-100 text-purple-700",
    iconBg: "bg-purple-100 text-purple-600",
    amountColor: "text-green-600",
    prefix: "+",
  },
  WITHDRAWAL: {
    label: "Rút tiền",
    Icon: Banknote,
    badge: "bg-orange-100 text-orange-700",
    iconBg: "bg-orange-100 text-orange-600",
    amountColor: "text-red-600",
    prefix: "−",
  },
};

const STATUS_META = {
  COMPLETED: { label: "Hoàn thành", cls: "bg-green-100 text-green-700" },
  PENDING: { label: "Chờ duyệt", cls: "bg-amber-100 text-amber-700" },
  FAILED: { label: "Thất bại", cls: "bg-red-100 text-red-700" },
};

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
  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-outline-variant/50">
        <table className="w-full">
          <thead className="bg-surface-container">
            <tr>
              {["Loại", "Mô tả", "Số tiền", "Trạng thái", "Ngày"].map((h) => (
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
          Chưa có giao dịch nào
        </p>
        <p className="text-sm text-on-surface-variant/70">
          Nạp tiền để bắt đầu sử dụng ví
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-outline-variant/50">
        <table className="w-full">
          <thead className="bg-surface-container">
            <tr>
              {[
                "Loại giao dịch",
                "Mô tả",
                "Số tiền",
                "Trạng thái",
                "Thời gian",
              ].map((h) => (
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
                  <td className="px-4 py-4">
                    <p className="text-sm text-on-surface line-clamp-2 max-w-[200px]">
                      {txn.description || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`font-bold text-sm tabular-nums ${meta.amountColor}`}
                    >
                      {meta.prefix}
                      {fmt(txn.amount)}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${statusMeta.cls}`}
                    >
                      {statusMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-on-surface-variant whitespace-nowrap">
                    {new Date(txn.createdAt).toLocaleString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
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
            {(page - 1) * limit + 1}–{Math.min(page * limit, total)} / {total}{" "}
            giao dịch
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-40 transition-colors"
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
                    className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors ${
                      p === page
                        ? "bg-primary text-white"
                        : "hover:bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {p}
                  </button>
                </span>
              ))}
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-surface-container disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
