import { Link, useParams } from "react-router-dom";
import { StatusPill } from "../components/StatusPill";
import { useRegistry } from "../data";
import type { Mandate, Organisation, Person } from "../data/types";
import { chainConfig } from "../lib/chain";

const IS_TESTNET = chainConfig.networkPassphrase.includes("Test SDF");

/** A small, always-live surface intended for an iframe embed. */
export function LiveBadge() {
  const { handle = "" } = useParams();
  const { getByHandle, getMandatesHeldBy } = useRegistry();
  const subject = getByHandle(handle);

  if (!subject) {
    return (
      <CompactViewport>
        <BadgeShell tone="negative">
          <BadgeMark />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">No DoubleCheck record</p>
            <p className="text-xs opacity-70">This handle could not be verified.</p>
            <DeploymentDisclosure />
          </div>
          <StatusPill status="Unavailable" />
        </BadgeShell>
      </CompactViewport>
    );
  }

  const heldMandates = getMandatesHeldBy(subject.id);
  const summary = badgeSummary(subject, heldMandates);

  return (
    <CompactViewport>
      <Link
        to={`/${subject.handle}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Open the live DoubleCheck record for ${subject.name}`}
        className="block rounded-xl outline-none ring-sky-500 focus-visible:ring-2"
      >
        <BadgeShell tone={summary.tone}>
          <BadgeMark />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-sm font-semibold">{subject.name}</p>
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide opacity-55">
                Live
              </span>
            </div>
            <p className="truncate text-xs opacity-75">{summary.message}</p>
            <DeploymentDisclosure />
          </div>
          <StatusPill status={summary.status} />
        </BadgeShell>
      </Link>
    </CompactViewport>
  );
}

function DeploymentDisclosure() {
  if (!IS_TESTNET) return null;
  return (
    <p className="truncate text-[9px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
      vNext testnet demo — not production verification
    </p>
  );
}

function CompactViewport({ children }: { children: React.ReactNode }) {
  // This deliberately covers Layout when the route is nested there. It keeps
  // the iframe compact even before the router is split into a chrome-free
  // branch, while still rendering normally if it is already outside Layout.
  return (
    <main className="fixed inset-0 z-50 overflow-hidden bg-white p-2 dark:bg-slate-950">
      {children}
    </main>
  );
}

function badgeSummary(
  subject: Organisation | Person,
  mandates: Mandate[],
): { tone: "positive" | "caution" | "negative"; status: string; message: string } {
  if (subject.status !== "Active") {
    return {
      tone: "negative",
      status: subject.status,
      message: `${subject.kind === "organisation" ? "Organisation" : "Identity"} badge is ${subject.status.toLowerCase()}.`,
    };
  }

  if (subject.kind === "organisation") {
    return {
      tone: "positive",
      status: "Active",
      message: `Verified organisation · @${subject.handle}`,
    };
  }

  // The contract scans past newer scheduled, withdrawn, or self-asserted
  // records, so any still-live confirmed mandate remains relevant.
  const live = mandates.filter((mandate) => mandate.evaluation.live);
  const companyConfirmed = live.find(
    (mandate) => mandate.confirmation === "CounterpartyConfirmed",
  );
  if (companyConfirmed) {
    return {
      tone: "positive",
      status: "Active",
      message: "Company-confirmed mandate appears active now",
    };
  }
  const issuerConfirmed = live.find((mandate) => mandate.confirmation === "IssuerConfirmed");
  if (issuerConfirmed) {
    return {
      tone: "positive",
      status: "Active",
      message: "Issuer-confirmed mandate appears active now",
    };
  }
  if (live.length > 0) {
    return {
      tone: "caution",
      status: "Unavailable",
      message: "Identity active · mandate is self-asserted only",
    };
  }
  if (mandates.some((mandate) => mandate.status === "Scheduled")) {
    return {
      tone: "caution",
      status: "Scheduled",
      message: "Identity active · newest mandate has not started",
    };
  }
  return {
    tone: "caution",
    status: "Unavailable",
    message: "Identity active · no live confirmed mandate",
  };
}

function BadgeShell({
  tone,
  children,
}: {
  tone: "positive" | "caution" | "negative";
  children: React.ReactNode;
}) {
  const style = {
    positive:
      "border-emerald-500/30 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100",
    caution:
      "border-amber-500/30 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100",
    negative:
      "border-red-500/30 bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100",
  }[tone];
  return (
    <div className={`flex min-h-20 items-center gap-3 rounded-xl border px-3.5 py-3 shadow-sm ${style}`}>
      {children}
    </div>
  );
}

function BadgeMark() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2 4 5.5v6c0 5.25 3.4 9.6 8 10.5 4.6-.9 8-5.25 8-10.5v-6L12 2Zm-1.2 14-3.8-3.8 1.4-1.4 2.4 2.4 5.4-5.4 1.4 1.4-6.8 6.8Z" />
      </svg>
    </span>
  );
}
