import { useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useRegistry } from "../data";
import { Identicon } from "../components/Identicon";
import { HashId } from "../components/HashId";
import { VerifiedBadge } from "../components/VerifiedBadge";
import { Panel } from "../components/Panel";
import { Tabs } from "../components/Tabs";
import { ClaimRow } from "../components/ClaimRow";
import { formatDate } from "../lib/format";
import { NotFound } from "./NotFound";

export function OrgDetail() {
  const { id = "" } = useParams();
  const { getOrganisation, getRelationshipsForOrganisation, getMandatesForOrganisation } = useRegistry();
  const org = getOrganisation(id);
  const [tab, setTab] = useState("all");

  if (!org) return <NotFound />;

  const relationships = getRelationshipsForOrganisation(org.id);
  const mandates = getMandatesForOrganisation(org.id);
  const allClaims = [...relationships, ...mandates].sort(
    (a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime(),
  );

  const visibleClaims = tab === "relationships" ? relationships : tab === "mandates" ? mandates : allClaims;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Identicon seed={org.id} size={56} rounded={false} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{org.name}</h1>
            {org.verified && <VerifiedBadge issuer={org.issuer} />}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <span>@{org.handle}</span>
            {org.domain && (
              <>
                <span>·</span>
                <span>{org.domain}</span>
              </>
            )}
            {org.jurisdiction && (
              <>
                <span>·</span>
                <span>{org.jurisdiction}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <Panel>
        <dl className="grid grid-cols-1 divide-y divide-slate-100 text-sm sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800/70">
          <div className="space-y-3 px-4 py-4">
            <Row label="Entity id" value={`#${org.id}`} />
            <Row label="Controller" value={<HashId value={org.controller} />} />
            <Row label="Verified by" value={<HashId value={org.issuer} />} />
          </div>
          <div className="space-y-3 px-4 py-4">
            <Row label="Verified since" value={formatDate(org.verifiedAt)} />
            <Row label="Badge expires" value={org.expiresAt ? formatDate(org.expiresAt) : "Never"} />
            <Row label="Relationships confirmed" value={String(relationships.length)} />
            <Row label="Mandates issued" value={String(mandates.length)} />
          </div>
        </dl>
      </Panel>

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
