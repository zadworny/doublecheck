import { Link } from "react-router-dom";
import type { Claim } from "../data/types";
import { useRegistry } from "../data";
import { Identicon } from "./Identicon";
import { StatusPill } from "./StatusPill";
import { ReportButton } from "./ReportButton";
import { formatRelative } from "../lib/format";

interface ClaimRowProps {
  claim: Claim;
}

export function ClaimRow({ claim }: ClaimRowProps) {
  const { getOrganisation, getPerson } = useRegistry();
  const org = getOrganisation(claim.organisationId);
  const subjectId = claim.kind === "relationship" ? claim.personId : claim.representativeId;
  // A mandate holder can be an agency rather than a natural person.
  const person = getPerson(subjectId) ?? getOrganisation(subjectId);
  const typeLabel = claim.kind === "relationship" ? claim.type.replace(/([a-z])([A-Z])/g, "$1 $2") : claim.mandateType;
  const displayStatus =
    claim.kind === "mandate" && claim.confirmation === "SelfAsserted" && claim.status === "Active"
      ? "Proposed"
      : claim.status;

  return (
    <div className="space-y-2 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-900/40 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
          </svg>
        </span>

        <Link to={`/tx/${claim.id}`} className="shrink-0 font-mono text-sky-600 hover:underline dark:text-sky-400">
          #{claim.id}
        </Link>

        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {typeLabel}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          {claim.confirmation === "SelfAsserted" && (
            <span
              className="hidden rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 sm:inline dark:text-amber-400"
              title="Asserted by the subject, not confirmed by the organisation"
            >
              Self-asserted
            </span>
          )}
          <StatusPill status={displayStatus} />
          <span className="hidden text-xs text-slate-400 md:inline">{formatRelative(claim.confirmedAt)}</span>
          <ReportButton
            target={{
              type: "claim",
              id: claim.id,
              label: `${typeLabel} — ${org?.name ?? ""} → ${person?.name ?? ""}`,
            }}
          />
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-2 pl-9 text-slate-500 dark:text-slate-400">
        {org && (
          <Link
            to={`/org/${org.id}`}
            className="flex min-w-0 shrink items-center gap-1.5 hover:text-sky-600 dark:hover:text-sky-400"
          >
            <Identicon seed={org.id} size={20} rounded={false} />
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">{org.name}</span>
          </Link>
        )}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0"
        >
          <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {person && (
          <Link
            to={`/${person.kind === "organisation" ? "org" : "person"}/${person.id}`}
            className="flex min-w-0 shrink items-center gap-1.5 hover:text-sky-600 dark:hover:text-sky-400"
          >
            <Identicon seed={person.id} size={20} rounded={person.kind !== "organisation"} />
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">{person.name}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
