import { Link } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";
import { StatCard } from "../components/StatCard";
import { Panel } from "../components/Panel";
import { ClaimRow } from "../components/ClaimRow";
import { Identicon } from "../components/Identicon";
import { formatDate } from "../lib/format";
import { useRegistry } from "../data";
import { chainConfig } from "../lib/chain";

export function Home() {
  const {
    organisations,
    people,
    relationships,
    mandates,
    getLatestClaims,
    getLatestOrganisations,
    getRelationshipsForOrganisation,
    getMandatesForOrganisation,
  } = useRegistry();

  const latestClaims = getLatestClaims(8);
  const latestOrgs = getLatestOrganisations(6);
  const activeMandates = mandates.filter((m) => m.status === "Active").length;

  return (
    <div className="space-y-8">
      <section className="flex flex-col items-center gap-4 py-6 text-center sm:py-10">
        <h1 className="max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
          Check the company relationship. Check the mandate.
        </h1>
        <p className="max-w-xl text-sm text-slate-500 dark:text-slate-400">
          Every claim below is confirmed by a verified organisation, signed, time-bound and publicly checkable —
          no account, wallet or blockchain knowledge required.
        </p>
        <SearchBar size="large" />
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Verified organisations"
          value={organisations.length}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 9h.01M9 13h.01M9 17h.01M15 9h.01M15 13h.01M15 17h.01" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          label="Verified people"
          value={people.length}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          label="Relationship attestations"
          value={relationships.length}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
        <StatCard
          label="Active mandates"
          value={activeMandates}
          icon={
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4M7.8 3.86A2 2 0 0 1 9.34 3h5.32a2 2 0 0 1 1.54.86l1.83 2.44A2 2 0 0 1 18.4 8H5.6a2 2 0 0 1-1.63-1.7L5.8 3.86Z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Latest verified organisations">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
            {latestOrgs.map((org) => {
              const count = getRelationshipsForOrganisation(org.id).length + getMandatesForOrganisation(org.id).length;
              return (
                <li key={org.id}>
                  <Link to={`/org/${org.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40">
                    <Identicon seed={org.id} size={32} rounded={false} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{org.name}</span>
                        <span className="hidden shrink-0 text-xs text-slate-400 sm:inline">#{org.id}</span>
                      </div>
                      <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                        Verified {formatDate(org.verifiedAt)} · {count} claims confirmed
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title="Latest claims" bodyClassName="divide-y divide-slate-100 dark:divide-slate-800/70">
          {latestClaims.map((claim) => (
            <ClaimRow key={claim.id} claim={claim} />
          ))}
        </Panel>
      </section>

      <p className="text-center text-xs text-slate-400">
        Read live from the{" "}
        <a href={chainConfig.explorerUrl} target="_blank" rel="noreferrer" className="underline hover:text-sky-500">
          registry contract
        </a>{" "}
        on Stellar. No wallet, no account — every read is a free simulation.
      </p>
    </div>
  );
}
