export function Input({ label, className = "", ...props }) {
  return (
    <label className="block space-y-2 text-sm font-medium text-slate-700">
      {label && <span>{label}</span>}
      <input
        className={`w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200 ${className}`}
        {...props}
      />
    </label>
  );
}
