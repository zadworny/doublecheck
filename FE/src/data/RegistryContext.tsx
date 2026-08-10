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
 * A snapshot is held in memory and refreshed periodically. Everything below
 * it is a pure function of that snapshot, so pages stay synchronous while a
 * revoked or newly-expired record cannot remain green indefinitely.
 */
export interface Registry extends RegistrySnapshot {
  getOrganisation(id: string): Organisation | undefined;
  /** Resolves the public handle used in shareable verification links. */
  getByHandle(handle: string): Organisation | Person | undefined;
  /** Resolves the Stellar address a badge is soulbound to. Used by `/me`. */
  getByController(address: string): Organisation | Person | undefined;
  getPerson(id: string): Person | undefined;
  getClaim(id: string): Claim | undefined;
  getRelationship(id: string): Relationship | undefined;
  getMandate(id: string): Mandate | undefined;
  getRelationshipsForOrganisation(id: string): Relationship[];
  getRelationshipsForPerson(id: string): Relationship[];
  getMandatesForOrganisation(id: string): Mandate[];
  /** Mandates held by either a person or an organisation acting as an agency. */
  getMandatesHeldBy(id: string): Mandate[];
  getMandatesBetween(organisationId: string, representativeId: string): Mandate[];
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

/** Chrome can remain usable on registry-independent routes during an RPC outage. */
export function useOptionalRegistry(): Registry | null {
  return useContext(RegistryContext);
}

function buildRegistry(snapshot: RegistrySnapshot, refresh: () => void): Registry {
  // Defence in depth: loaders should already omit unpublished relationships,
  // but the public context enforces the boundary too so a future API/indexer
  // cannot accidentally make them reachable through a getter or feed.
  const publicSnapshot: RegistrySnapshot = {
    ...snapshot,
    relationships: snapshot.relationships.filter((relationship) => relationship.publicDisplay),
    claims: snapshot.claims.filter(
      (claim) => claim.kind !== "relationship" || claim.publicDisplay,
    ),
  };

  const orgById = new Map(publicSnapshot.organisations.map((o) => [o.id, o]));
  const personById = new Map(publicSnapshot.people.map((p) => [p.id, p]));
  const byHandle = new Map<string, Organisation | Person>([
    ...publicSnapshot.organisations.map((o) => [o.handle, o] as const),
    ...publicSnapshot.people.map((p) => [p.handle, p] as const),
  ]);
  // The snapshot is a complete walk of every entity, so a controller can be
  // resolved locally — no extra contract round trip for `/me`.
  const byController = new Map<string, Organisation | Person>([
    ...publicSnapshot.organisations.map((o) => [o.controller, o] as const),
    ...publicSnapshot.people.map((p) => [p.controller, p] as const),
  ]);
  const relById = new Map(publicSnapshot.relationships.map((r) => [r.id, r]));
  const mandateById = new Map(publicSnapshot.mandates.map((m) => [m.id, m]));

  const byConfirmedAtDesc = <T extends { confirmedAt: string; id: string }>(a: T, b: T) => {
    const byTime = new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime();
    if (byTime !== 0) return byTime;
    // Several transactions may share one ledger timestamp. Claim ids are
    // monotonic, so use them to preserve the contract's "newest mandate" rule.
    const aId = BigInt(a.id);
    const bId = BigInt(b.id);
    return aId === bId ? 0 : aId < bId ? 1 : -1;
  };

  return {
    ...publicSnapshot,
    refresh,
    getOrganisation: (id) => orgById.get(id),
    getByHandle: (handle) => byHandle.get(handle.toLowerCase()),
    getByController: (address) => byController.get(address.trim().toUpperCase()),
    getPerson: (id) => personById.get(id),
    getRelationship: (id) => relById.get(id),
    getMandate: (id) => mandateById.get(id),
    getClaim: (id) => relById.get(id) ?? mandateById.get(id),

    getRelationshipsForOrganisation: (id) =>
      publicSnapshot.relationships.filter((r) => r.organisationId === id).sort(byConfirmedAtDesc),
    getRelationshipsForPerson: (id) =>
      publicSnapshot.relationships.filter((r) => r.personId === id).sort(byConfirmedAtDesc),
    getMandatesForOrganisation: (id) =>
      publicSnapshot.mandates.filter((m) => m.organisationId === id).sort(byConfirmedAtDesc),
    getMandatesHeldBy: (id) =>
      publicSnapshot.mandates.filter((m) => m.representativeId === id).sort(byConfirmedAtDesc),
    getMandatesBetween: (organisationId, representativeId) =>
      publicSnapshot.mandates
        .filter(
          (mandate) =>
            mandate.organisationId === organisationId &&
            mandate.representativeId === representativeId,
        )
        .sort(byConfirmedAtDesc),

    getLatestClaims: (limit = 8) => [...publicSnapshot.claims].sort(byConfirmedAtDesc).slice(0, limit),
    getLatestOrganisations: (limit = 8) =>
      [...publicSnapshot.organisations].sort((a, b) => Number(b.id) - Number(a.id)).slice(0, limit),

    search(rawQuery: string): SearchResult[] {
      const query = rawQuery.trim().toLowerCase();
      if (!query) return [];
      const results: SearchResult[] = [];

      for (const org of publicSnapshot.organisations) {
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

      for (const person of publicSnapshot.people) {
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

      for (const claim of publicSnapshot.claims) {
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

  useEffect(() => {
    // A public trust verdict must not stay frozen for the lifetime of a tab.
    // This is intentionally conservative for the small direct-RPC MVP; the
    // production indexer can replace it with cheap targeted/event-driven reads.
    const timer = window.setInterval(refresh, 60_000);
    const onVisibility = () => {
      if (
        document.visibilityState === "visible" &&
        snapshot &&
        Date.now() - snapshot.loadedAt > 30_000
      ) {
        refresh();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh, snapshot]);

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
