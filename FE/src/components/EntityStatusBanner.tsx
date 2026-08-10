import type { EntityStatus } from "../data/types";

const COPY: Record<
  EntityStatus,
  { title: string; detail: string; classes: string; icon: string }
> = {
  Active: {
    title: "Verification is active",
    detail: "The identity badge is current. Check a separate live mandate before trusting a claimed company role.",
    classes: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
    icon: "✓",
  },
  Suspended: {
    title: "Verification is suspended",
    detail: "Do not rely on this badge or its mandates while a private review is in progress.",
    classes: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    icon: "!",
  },
  Revoked: {
    title: "Verification has been revoked",
    detail: "This is a terminal on-chain status. Do not treat this entity as verified.",
    classes: "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300",
    icon: "×",
  },
  Expired: {
    title: "Verification has expired",
    detail: "Periodic re-verification was not completed before expiry. Current mandates are not authoritative.",
    classes: "border-slate-400/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
    icon: "–",
  },
};

export function EntityStatusBanner({ status, strikes }: { status: EntityStatus; strikes: number }) {
  const copy = COPY[status];
  return (
    <div className={`rounded-xl border px-4 py-3 ${copy.classes}`} role="status">
      <div className="flex items-start gap-3">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-sm font-bold"
          aria-hidden="true"
        >
          {copy.icon}
        </span>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{copy.title}</div>
          <p className="mt-0.5 text-xs leading-5 opacity-90">{copy.detail}</p>
          {strikes > 0 && (
            <p className="mt-1 text-xs font-semibold">
              {strikes} upheld complaint {strikes === 1 ? "outcome" : "outcomes"} recorded on-chain.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
