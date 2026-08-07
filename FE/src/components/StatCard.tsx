import type { CSSProperties, ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function StatCard({ label, value, icon, className = "", style }: StatCardProps) {
  return (
    <div
      style={style}
      className={`flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 dark:border-slate-800 dark:bg-slate-900/60 ${className}`}
    >
      {icon && (
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="text-xl font-semibold tabular-nums">{value}</div>
        <div className="truncate text-xs text-slate-500 dark:text-slate-400">{label}</div>
      </div>
    </div>
  );
}
