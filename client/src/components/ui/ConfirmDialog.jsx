/**
 * ConfirmDialog.jsx
 * Modal xác nhận hành động quan trọng (thay thế window.confirm — BR-33)
 *
 * Props:
 *  isOpen      - boolean
 *  title       - string
 *  message     - string | ReactNode
 *  severity    - 'danger' | 'warning' | 'info'
 *  confirmText - string (default: "Xác nhận")
 *  cancelText  - string (default: "Hủy bỏ")
 *  onConfirm   - () => void
 *  onCancel    - () => void
 *  loading     - boolean (disable buttons while processing)
 */

const SEVERITY_CONFIG = {
  danger: {
    iconBg: "bg-red-50",
    icon: "cancel",
    iconColor: "text-red-500",
    confirmBtnClass:
      "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500/30",
    titleColor: "text-red-700",
  },
  warning: {
    iconBg: "bg-amber-50",
    icon: "warning",
    iconColor: "text-amber-500",
    confirmBtnClass:
      "bg-amber-500 hover:bg-amber-600 text-white focus:ring-amber-500/30",
    titleColor: "text-amber-700",
  },
  info: {
    iconBg: "bg-blue-50",
    icon: "info",
    iconColor: "text-blue-500",
    confirmBtnClass:
      "bg-[#00629d] hover:bg-[#00629d]/90 text-white focus:ring-[#00629d]/30",
    titleColor: "text-[#00629d]",
  },
};

export function ConfirmDialog({
  isOpen,
  title,
  message,
  severity = "warning",
  confirmText = "Xác nhận",
  cancelText = "Hủy bỏ",
  onConfirm,
  onCancel,
  loading = false,
}) {
  if (!isOpen) return null;

  const cfg = SEVERITY_CONFIG[severity] || SEVERITY_CONFIG.warning;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-[fadeInScale_0.18s_ease-out]">
        {/* Header */}
        <div className="p-6 pb-4 flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl ${cfg.iconBg} flex items-center justify-center shrink-0`}
          >
            <span
              className={`material-symbols-outlined text-[28px] ${cfg.iconColor}`}
            >
              {cfg.icon}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h3
              id="confirm-dialog-title"
              className={`font-bold text-base leading-tight ${cfg.titleColor}`}
            >
              {title}
            </h3>
            <div className="text-sm text-[#3f4852] mt-2 leading-relaxed">
              {typeof message === "string" ? <p>{message}</p> : message}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#bec7d4]/20 mx-6" />

        {/* Footer Buttons */}
        <div className="p-4 flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-[#bec7d4]/50 text-[#3f4852] text-sm font-semibold hover:bg-[#f2f4f6] disabled:opacity-50 transition-all cursor-pointer bg-transparent"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-60 transition-all focus:outline-none focus:ring-4 cursor-pointer border-none ${cfg.confirmBtnClass}`}
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                Đang xử lý...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
