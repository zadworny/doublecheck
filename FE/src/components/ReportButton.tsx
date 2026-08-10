import { useState } from "react";
import { ReportModal } from "./ReportModal";

interface ReportButtonProps {
  target: {
    type: "claim" | "entity";
    id: string;
    label: string;
  };
  variant?: "icon" | "full";
}

export function ReportButton({ target, variant = "icon" }: ReportButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title={`Report this ${target.type}`}
        className={
          variant === "icon"
            ? "inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 transition hover:bg-red-500/10 hover:text-red-500"
            : "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-red-300 hover:bg-red-500/10 hover:text-red-600 dark:border-slate-700 dark:text-slate-300 dark:hover:border-red-500/40 dark:hover:text-red-400"
        }
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
        {variant === "full" && "Report"}
      </button>
      <ReportModal open={open} onClose={() => setOpen(false)} target={target} />
    </>
  );
}
