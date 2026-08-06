import { Link } from "react-router-dom";
import type { Claim } from "../data/types";
import { getOrganisation } from "../data/organisations";
import { getPerson } from "../data/people";
import { Identicon } from "./Identicon";
import { HashId } from "./HashId";
import { StatusPill } from "./StatusPill";
import { ReportButton } from "./ReportButton";
import { formatRelative } from "../lib/format";

interface ClaimRowProps {
  claim: Claim;
}

export function ClaimRow({ claim }: ClaimRowProps) {
  const org = getOrganisation(claim.organisationId);
  const personId = claim.kind === "relationship" ? claim.personId : claim.representativeId;
  const person = getPerson(personId);
  const typeLabel = claim.kind === "relationship" ? claim.type.replace(/([a-z])([A-Z])/g, "$1 $2") : claim.mandateType;

  return (
    <div className="space-y-2 border-b border-slate-100 px-3 py-3 text-sm last:border-b-0 hover:bg-slate-50/70 dark:border-slate-800/70 dark:hover:bg-slate-900/40 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
          </svg>
        </span>

        <Link to={`/tx/${claim.id}`} className="shrink-0 text-sky-600 hover:underline dark:text-sky-400">
          <HashId value={claim.id} copyable={false} />
        </Link>

        <span className="shrink-0 rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {typeLabel}
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-3">
          <StatusPill status={claim.status} />
          <span className="hidden text-xs text-slate-400 md:inline">{formatRelative(claim.confirmedAt)}</span>
          <ReportButton subjectLabel={`${typeLabel} — ${org?.name ?? ""} → ${person?.name ?? ""}`} />
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
            to={`/person/${person.id}`}
            className="flex min-w-0 shrink items-center gap-1.5 hover:text-sky-600 dark:hover:text-sky-400"
          >
            <Identicon seed={person.id} size={20} />
            <span className="truncate font-medium text-slate-700 dark:text-slate-300">{person.name}</span>
          </Link>
        )}
      </div>
    </div>
  );
}
