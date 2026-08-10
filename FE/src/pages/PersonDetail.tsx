import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useRegistry } from "../data";
import { Identicon } from "../components/Identicon";
import { HashId } from "../components/HashId";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Panel } from "../components/Panel";
import { SharePanel } from "../components/SharePanel";
import { Tabs } from "../components/Tabs";
import { ClaimRow } from "../components/ClaimRow";
import { EntityStatusBanner } from "../components/EntityStatusBanner";
import { ReportButton } from "../components/ReportButton";
import { CredentialPanel } from "../components/CredentialPanel";
import { formatDate } from "../lib/format";
import { NotFound } from "./NotFound";

export function PersonDetail({ personId }: { personId?: string } = {}) {
  const params = useParams();
  const id = personId ?? params.id ?? "";
  const { getPerson, getRelationshipsForPerson, getMandatesHeldBy } = useRegistry();
  const person = getPerson(id);
  const [tab, setTab] = useState("all");

  if (!person) return <NotFound />;

  const relationships = getRelationshipsForPerson(person.id);
  const mandates = getMandatesHeldBy(person.id);
  const allClaims = [...relationships, ...mandates].sort(
    (a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime(),
  );
  const currentCount = relationships.filter((r) => r.status === "Active").length;
  const historicalCount = relationships.length - currentCount;

  const visibleClaims = tab === "relationships" ? relationships : tab === "mandates" ? mandates : allClaims;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Identicon seed={person.id} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{person.name}</h1>
            {person.verified && <VerifiedBadge issuer={person.issuer} label="Verified recruiter" />}
          </div>
          <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">@{person.handle}</div>
        </div>
        <ReportButton
          variant="full"
          target={{ type: "entity", id: person.id, label: `${person.name} (@${person.handle})` }}
        />
      </div>

      <EntityStatusBanner status={person.status} strikes={person.strikes} />

      <Panel>
        <dl className="grid grid-cols-1 divide-y divide-slate-100 text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800/70">
          <div className="space-y-3 px-4 py-4">
            <Row label="Entity id" value={`#${person.id}`} />
            <Row label="Current badge status" value={person.status} />
            <Row label="Controller" value={<HashId value={person.controller} />} />
            <Row label="Verified by" value={<HashId value={person.issuer} />} />
            <Row label="Identity verified since" value={formatDate(person.verifiedAt)} />
            <Row label="Badge expires" value={person.expiresAt ? formatDate(person.expiresAt) : "Never"} />
          </div>
          <div className="space-y-3 px-4 py-4">
            <Row label="Current & active relationships" value={String(currentCount)} />
            <Row label="Historical relationships" value={String(historicalCount)} />
            <Row label="Mandates held" value={String(mandates.length)} />
            <Row label="Upheld complaint outcomes" value={String(person.strikes)} />
          </div>
        </dl>
      </Panel>

      <CredentialPanel
        key={`${person.id}:${person.metadataUri}:${person.metadataHash}`}
        subject={person}
      />

      <SharePanel subject={person} />

      <Panel>
        <div className="px-2 pt-1 sm:px-3">
          <Tabs
            tabs={[
              { key: "all", label: "All claims", count: allClaims.length },
              { key: "relationships", label: "Relationships", count: relationships.length },
              { key: "mandates", label: "Mandates", count: mandates.length },
            ]}
            active={tab}
            onChange={setTab}
          />
        </div>
        {visibleClaims.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">No claims in this category.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {visibleClaims.map((claim) => (
              <ClaimRow key={claim.id} claim={claim} />
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium text-slate-800 dark:text-slate-100">{value}</dd>
    </div>
  );
}
