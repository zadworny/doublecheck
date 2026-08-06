import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { chainConfig } from "../lib/chain";
import { loadRegistry, type RegistrySnapshot } from "./registry";
import type { Claim, Mandate, Organisation, Person, Relationship } from "./types";

export interface SearchResult {
  kind: "organisation" | "person" | "claim";
  id: string;
  label: string;
  sublabel: string;
}

/**
 * The whole registry, plus the lookups the pages need.
 *
 * The snapshot is read once from the contract and held in memory. Everything
 * below it is a pure function of that snapshot, so the pages stay synchronous
 * and there is exactly one loading state in the app.
 */
export interface Registry extends RegistrySnapshot {
  getOrganisation(id: string): Organisation | undefined;
  getPerson(id: string): Person | undefined;
  getClaim(id: string): Claim | undefined;
  getRelationship(id: string): Relationship | undefined;
  getMandate(id: string): Mandate | undefined;
  getRelationshipsForOrganisation(id: string): Relationship[];
  getRelationshipsForPerson(id: string): Relationship[];
  getMandatesForOrganisation(id: string): Mandate[];
  getMandatesForPerson(id: string): Mandate[];
  getLatestClaims(limit?: number): Claim[];
  getLatestOrganisations(limit?: number): Organisation[];
  search(query: string): SearchResult[];
  /** Re-reads the registry from the contract. */
  refresh(): void;
}

const RegistryContext = createContext<Registry | null>(null);

export function useRegistry(): Registry {
  const registry = useContext(RegistryContext);
  if (!registry) throw new Error("useRegistry must be used inside <RegistryProvider>");
  return registry;
}

function buildRegistry(snapshot: RegistrySnapshot, refresh: () => void): Registry {
  const orgById = new Map(snapshot.organisations.map((o) => [o.id, o]));
  const personById = new Map(snapshot.people.map((p) => [p.id, p]));
  const relById = new Map(snapshot.relationships.map((r) => [r.id, r]));
  const mandateById = new Map(snapshot.mandates.map((m) => [m.id, m]));

  const byConfirmedAtDesc = <T extends { confirmedAt: string }>(a: T, b: T) =>
    new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime();

  return {
    ...snapshot,
    refresh,
    getOrganisation: (id) => orgById.get(id),
    getPerson: (id) => personById.get(id),
    getRelationship: (id) => relById.get(id),
    getMandate: (id) => mandateById.get(id),
    getClaim: (id) => relById.get(id) ?? mandateById.get(id),

    getRelationshipsForOrganisation: (id) =>
      snapshot.relationships.filter((r) => r.organisationId === id).sort(byConfirmedAtDesc),
    getRelationshipsForPerson: (id) =>
      snapshot.relationships.filter((r) => r.personId === id).sort(byConfirmedAtDesc),
    getMandatesForOrganisation: (id) =>
      snapshot.mandates.filter((m) => m.organisationId === id).sort(byConfirmedAtDesc),
    getMandatesForPerson: (id) =>
      snapshot.mandates.filter((m) => m.representativeId === id).sort(byConfirmedAtDesc),

    getLatestClaims: (limit = 8) => [...snapshot.claims].sort(byConfirmedAtDesc).slice(0, limit),
    getLatestOrganisations: (limit = 8) =>
      [...snapshot.organisations].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, limit),

    search(rawQuery: string): SearchResult[] {
      const query = rawQuery.trim().toLowerCase();
      if (!query) return [];
      const results: SearchResult[] = [];

      for (const org of snapshot.organisations) {
        const hit =
          org.name.toLowerCase().includes(query) ||
          org.handle.toLowerCase().includes(query) ||
          org.domain.toLowerCase().includes(query) ||
          org.id === query;
        if (hit) {
          results.push({
            kind: "organisation",
            id: org.id,
            label: org.name,
            sublabel: org.domain || `@${org.handle}`,
          });
        }
      }

      for (const person of snapshot.people) {
        const hit =
          person.name.toLowerCase().includes(query) ||
          person.handle.toLowerCase().includes(query) ||
          person.id === query;
        if (hit) {
          results.push({
            kind: "person",
            id: person.id,
            label: person.name,
            sublabel: `@${person.handle}`,
          });
        }
      }

      for (const claim of snapshot.claims) {
        if (claim.id !== query) continue;
        const org = orgById.get(claim.organisationId);
        const subjectId = claim.kind === "relationship" ? claim.personId : claim.representativeId;
        const subject = personById.get(subjectId) ?? orgById.get(subjectId);
        const label = claim.kind === "relationship" ? claim.type : claim.mandateType;
        results.push({
          kind: "claim",
          id: claim.id,
          label: `${label} — ${org?.name ?? "Unknown organisation"}`,
          sublabel: subject?.name ?? "Unknown subject",
        });
      }

      return results;
    },
  };
}

export function RegistryProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<RegistrySnapshot | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [attempt, setAttempt] = useState(0);

  const refresh = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    loadRegistry()
      .then((next) => {
        if (!cancelled) setSnapshot(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause : new Error(String(cause)));
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const registry = useMemo(
    () => (snapshot ? buildRegistry(snapshot, refresh) : null),
    [snapshot, refresh],
  );

  if (error) return <LoadFailed error={error} onRetry={refresh} />;
  if (!registry) return <Loading />;

  return <RegistryContext.Provider value={registry}>{children}</RegistryContext.Provider>;
}

function Loading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-sm text-slate-500 dark:text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500 dark:border-slate-700 dark:border-t-sky-400" />
      Reading the registry from Stellar…
    </div>
  );
}

function LoadFailed({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-lg font-semibold">Could not reach the registry</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        The contract could not be read from{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">
          {chainConfig.rpcUrl}
        </code>
        . The network may be down, or the contract's ledger entries may have been archived and need
        restoring.
      </p>
      <p className="max-w-full truncate text-xs text-slate-400" title={error.message}>
        {error.message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500"
      >
        Try again
      </button>
    </div>
  );
}
