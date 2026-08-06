import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { getClaim, getOrganisation, getPerson, getRelationship } from "../data";
import { Identicon } from "../components/Identicon";
import { HashId } from "../components/HashId";
import { StatusPill } from "../components/StatusPill";
import { Panel } from "../components/Panel";
import { Timeline } from "../components/Timeline";
import { ReportButton } from "../components/ReportButton";
import { formatDate } from "../lib/format";
import { NotFound } from "./NotFound";

export function ClaimDetail() {
  const { id = "" } = useParams();
  const claim = getClaim(id);

  if (!claim) return <NotFound />;

  const org = getOrganisation(claim.organisationId);
  const personId = claim.kind === "relationship" ? claim.personId : claim.representativeId;
  const person = getPerson(personId);
  const isRelationship = claim.kind === "relationship";
  const typeLabel = isRelationship ? claim.type.replace(/([a-z])([A-Z])/g, "$1 $2") : claim.mandateType;
  const relatedRelationship = !isRelationship ? getRelationship(claim.relationshipId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>{isRelationship ? "Relationship attestation" : "Representation mandate"}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-base font-semibold sm:text-lg">
              <HashId value={claim.id} headLen={14} tailLen={10} />
            </h1>
            <StatusPill status={claim.status} size="md" />
          </div>
        </div>
        <ReportButton
          variant="full"
          subjectLabel={`${typeLabel} — ${org?.name ?? ""} → ${person?.name ?? ""}`}
        />
      </div>

      <Panel title="Overview">
        <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800/70">
          <Row label="Type">
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {typeLabel}
            </span>
          </Row>
          <Row label="Confirmed">{formatDate(claim.confirmedAt)}</Row>

          {isRelationship ? (
            <>
              <Row label="Role">{claim.role}</Row>
              {claim.department && <Row label="Department">{claim.department}</Row>}
              <Row label="Start date">{formatDate(claim.startDate)}</Row>
              <Row label="End date">{claim.endDate ? formatDate(claim.endDate) : "Ongoing"}</Row>
              <Row label="Public display">{claim.publicDisplay ? "Permitted by subject" : "Private"}</Row>
            </>
          ) : (
            <>
              <Row label="Scope">{claim.scope}</Row>
              {claim.territory && <Row label="Territory">{claim.territory}</Row>}
              <Row label="Valid from">{formatDate(claim.validFrom)}</Row>
              <Row label="Valid to">{formatDate(claim.validTo)}</Row>
              {relatedRelationship && (
                <Row label="Depends on relationship">
                  <Link to={`/tx/${relatedRelationship.id}`} className="text-sky-600 hover:underline dark:text-sky-400">
                    <HashId value={relatedRelationship.id} />
                  </Link>
                </Row>
              )}
            </>
          )}
        </dl>
      </Panel>

      <Panel title={isRelationship ? "Organisation → Person" : "Organisation → Representative"}>
        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800/70">
          <EntityCell heading="From (attesting organisation)" href={org ? `/org/${org.id}` : "#"} seed={org?.id ?? ""} rounded={false} name={org?.name} sub={org?.domain} />
          <EntityCell heading={isRelationship ? "To (subject)" : "To (representative)"} href={person ? `/person/${person.id}` : "#"} seed={person?.id ?? ""} rounded name={person?.name} sub={person?.headline} />
        </div>
      </Panel>

      <Panel title="Status history">
        <div className="px-4 py-5">
          <Timeline events={claim.history} />
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function EntityCell({
  heading,
  href,
  seed,
  rounded,
  name,
  sub,
}: {
  heading: string;
  href: string;
  seed: string;
  rounded: boolean;
  name?: string;
  sub?: string;
}) {
  return (
    <div className="px-4 py-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">{heading}</div>
      <Link to={href} className="flex items-center gap-3 hover:opacity-80">
        <Identicon seed={seed} size={40} rounded={rounded} />
        <div className="min-w-0">
          <div className="truncate font-medium text-slate-800 dark:text-slate-100">{name ?? "Unknown"}</div>
          {sub && <div className="truncate text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
          <HashId value={seed} className="text-slate-400" />
        </div>
      </Link>
    </div>
  );
}
