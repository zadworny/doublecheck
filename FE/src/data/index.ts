export * from "./types";
export { organisations, getOrganisation } from "./organisations";
export { people, getPerson } from "./people";
export {
  relationships,
  getRelationship,
  getRelationshipsForOrganisation,
  getRelationshipsForPerson,
} from "./relationships";
export {
  mandates,
  getMandate,
  getMandatesForOrganisation,
  getMandatesForPerson,
} from "./mandates";

import { organisations } from "./organisations";
import { people } from "./people";
import { mandates } from "./mandates";
import { relationships } from "./relationships";
import type { Claim, Organisation } from "./types";

export const claims: Claim[] = [...relationships, ...mandates];

export function getClaim(id: string): Claim | undefined {
  return claims.find((c) => c.id === id);
}

export function getLatestClaims(limit = 8): Claim[] {
  return [...claims]
    .sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime())
    .slice(0, limit);
}

export function getLatestOrganisations(limit = 8): Organisation[] {
  return [...organisations].sort((a, b) => b.blockNumber - a.blockNumber).slice(0, limit);
}

export interface SearchResult {
  kind: "organisation" | "person" | "claim";
  id: string;
  label: string;
  sublabel: string;
}

export function search(rawQuery: string): SearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const results: SearchResult[] = [];

  for (const org of organisations) {
    if (org.name.toLowerCase().includes(query) || org.domain.toLowerCase().includes(query) || org.id.toLowerCase() === query) {
      results.push({ kind: "organisation", id: org.id, label: org.name, sublabel: org.domain });
    }
  }

  for (const person of people) {
    if (person.name.toLowerCase().includes(query) || person.id.toLowerCase() === query) {
      results.push({ kind: "person", id: person.id, label: person.name, sublabel: person.headline });
    }
  }

  for (const claim of claims) {
    if (claim.id.toLowerCase() === query || claim.id.toLowerCase().startsWith(query)) {
      const org = organisations.find((o) => o.id === claim.organisationId);
      const personId = claim.kind === "relationship" ? claim.personId : claim.representativeId;
      const person = people.find((p) => p.id === personId);
      const label = claim.kind === "relationship" ? claim.type : claim.mandateType;
      results.push({
        kind: "claim",
        id: claim.id,
        label: `${label} — ${org?.name ?? "Unknown org"}`,
        sublabel: person?.name ?? "Unknown person",
      });
    }
  }

  return results;
}
