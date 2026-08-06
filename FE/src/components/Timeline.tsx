import type { StatusEvent } from "../data/types";
import { formatDate } from "../lib/format";

interface TimelineProps {
  events: StatusEvent[];
}

export function Timeline({ events }: TimelineProps) {
  return (
    <ol className="relative ml-2 space-y-6 border-l border-slate-200 pl-6 dark:border-slate-800">
      {events.map((event, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[29px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white bg-sky-500 dark:border-[#0b0e14]" />
          <div className="text-sm font-medium text-slate-800 dark:text-slate-200">{event.status}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(event.at)}</div>
          {event.note && <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{event.note}</p>}
        </li>
      ))}
    </ol>
  );
}
