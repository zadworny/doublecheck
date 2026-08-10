import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { useRegistry, CONFIRMATION_LABEL } from "../data";
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
  const { getClaim, getOrganisation, getPerson, getRelationship } = useRegistry();
  const claim = getClaim(id);

  if (!claim) return <NotFound />;

  const org = getOrganisation(claim.organisationId);
  const subjectId = claim.kind === "relationship" ? claim.personId : claim.representativeId;
  // A mandate can be held by an agency, so the subject is not always a person.
  const person = getPerson(subjectId) ?? getOrganisation(subjectId);
  const isRelationship = claim.kind === "relationship";
  const typeLabel = isRelationship ? claim.type.replace(/([a-z])([A-Z])/g, "$1 $2") : claim.mandateType;
  const displayStatus =
    !isRelationship && claim.confirmation === "SelfAsserted" && claim.status === "Active"
      ? "Proposed"
      : claim.status;
  const relatedRelationship =
    !isRelationship && claim.relationshipId ? getRelationship(claim.relationshipId) : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
            <span>{isRelationship ? "Relationship attestation" : "Representation mandate"}</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-base font-semibold sm:text-lg">Claim #{claim.id}</h1>
            <StatusPill status={displayStatus} size="md" />
          </div>
        </div>
        <ReportButton
          variant="full"
          target={{
            type: "claim",
            id: claim.id,
            label: `${typeLabel} — ${org?.name ?? ""} → ${person?.name ?? ""}`,
          }}
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
          <Row label="Attested by">
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  claim.confirmation === "SelfAsserted"
                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {CONFIRMATION_LABEL[claim.confirmation]}
              </span>
              <HashId value={claim.attestedBy} />
            </span>
          </Row>

          {isRelationship ? (
            <>
              <Row label="Role">{claim.role}</Row>
              {claim.department && <Row label="Department">{claim.department}</Row>}
              <Row label="Start date">{formatDate(claim.startDate)}</Row>
              <Row label="End date">{claim.endDate ? formatDate(claim.endDate) : "Ongoing"}</Row>
              <Row label="Verifier listing">
                {claim.publicDisplay ? "Permitted by subject" : "Not listed (still public on Stellar)"}
              </Row>
            </>
          ) : (
            <>
              <Row label="Ledger claim status">{claim.ledgerStatus}</Row>
              <Row label="Scope">{claim.scope}</Row>
              {claim.territory && <Row label="Territory">{claim.territory}</Row>}
              <Row label="Valid from">{formatDate(claim.validFrom)}</Row>
              <Row label="Valid to">{formatDate(claim.validTo)}</Row>
              {relatedRelationship && (
                <Row label="Depends on relationship">
                  <Link to={`/tx/${relatedRelationship.id}`} className="text-sky-600 hover:underline dark:text-sky-400">
                    #{relatedRelationship.id}
                  </Link>
                </Row>
              )}
            </>
          )}
        </dl>
      </Panel>

      <Panel title={isRelationship ? "Organisation → Person" : "Organisation → Representative"}>
        <div className="grid grid-cols-1 divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800/70">
          <EntityCell heading="From (attesting organisation)" href={org ? `/org/${org.id}` : "#"} seed={org?.id ?? ""} rounded={false} name={org?.name} sub={org ? org.domain || `@${org.handle}` : undefined} />
          <EntityCell
            heading={isRelationship ? "To (subject)" : "To (representative)"}
            href={person ? `/${person.kind === "organisation" ? "org" : "person"}/${person.id}` : "#"}
            seed={person?.id ?? ""}
            rounded={person?.kind !== "organisation"}
            name={person?.name}
            sub={person ? `@${person.handle}` : undefined}
          />
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
          <div className="text-xs text-slate-400">#{seed}</div>
        </div>
      </Link>
    </div>
  );
}
