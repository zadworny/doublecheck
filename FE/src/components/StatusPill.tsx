const STATUS_STYLES: Record<string, string> = {
  Active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-emerald-500/20",
  Ended: "bg-slate-500/10 text-slate-600 dark:text-slate-400 ring-slate-500/20",
  Completed: "bg-sky-500/10 text-sky-700 dark:text-sky-400 ring-sky-500/20",
  Expired: "bg-gray-500/10 text-gray-600 dark:text-gray-400 ring-gray-500/20",
  Suspended: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  Withdrawn: "bg-orange-500/10 text-orange-700 dark:text-orange-400 ring-orange-500/20",
  Disputed: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
  Scheduled: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 ring-indigo-500/20",
  Proposed: "bg-amber-500/10 text-amber-700 dark:text-amber-400 ring-amber-500/20",
  Unavailable: "bg-red-500/10 text-red-700 dark:text-red-400 ring-red-500/20",
};

const DOT_STYLES: Record<string, string> = {
  Active: "bg-emerald-500",
  Ended: "bg-slate-400",
  Completed: "bg-sky-500",
  Expired: "bg-gray-400",
  Suspended: "bg-amber-500",
  Withdrawn: "bg-orange-500",
  Disputed: "bg-red-500",
  Scheduled: "bg-indigo-500",
  Proposed: "bg-amber-500",
  Unavailable: "bg-red-500",
};

interface StatusPillProps {
  status: string;
  size?: "sm" | "md";
}

export function StatusPill({ status, size = "sm" }: StatusPillProps) {
  const style = STATUS_STYLES[status] ?? "bg-slate-500/10 text-slate-600 ring-slate-500/20";
  const dot = DOT_STYLES[status] ?? "bg-slate-400";
  const padding = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset ${style} ${padding}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {status}
    </span>
  );
}
