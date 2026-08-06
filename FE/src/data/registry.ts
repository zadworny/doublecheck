/**
 * Loads the whole registry from the contract and maps it into the shapes the UI
 * renders.
 *
 * Soroban has no query language: you can read a key, but you cannot ask "give
 * me every entity". The contract exposes `entity_count` and `claim_count` and
 * assigns sequential ids, so a full snapshot is a walk from 1 to N. That is
 * fine at MVP scale and deliberately does not scale — past a few hundred
 * records this should be replaced by an indexer following the contract's
 * events, which exist for exactly that purpose.
 */

import {
  ClaimStatus as ChainClaimStatus,
  Confirmation as ChainConfirmation,
  EntityKind as ChainEntityKind,
  EntityStatus as ChainEntityStatus,
  MandateType as ChainMandateType,
  RelationshipType as ChainRelationshipType,
  type Entity as ChainEntity,
  type Mandate as ChainMandate,
  type Relationship as ChainRelationship,
} from "../contract/registry";
import { optionalTsToIso, read, registry, tsToIso } from "../lib/chain";
import type {
  Claim,
  ClaimStatus,
  Confirmation,
  EntityStatus,
  Mandate,
  MandateType,
  Organisation,
  Person,
  Relationship,
  RelationshipType,
  StatusEvent,
} from "./types";

/** How many contract reads to keep in flight. Enough to be quick, not enough
 * to get rate-limited by a public RPC endpoint. */
const CONCURRENCY = 8;

async function mapWithLimit<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

// ---------------------------------------------------------------------------
// Enum mapping
// ---------------------------------------------------------------------------

const ENTITY_STATUS: Record<number, EntityStatus> = {
  [ChainEntityStatus.Active]: "Active",
  [ChainEntityStatus.Suspended]: "Suspended",
  [ChainEntityStatus.Revoked]: "Revoked",
  [ChainEntityStatus.Expired]: "Expired",
};

const CLAIM_STATUS: Record<number, ClaimStatus> = {
  [ChainClaimStatus.Active]: "Active",
  [ChainClaimStatus.Ended]: "Ended",
  [ChainClaimStatus.Suspended]: "Suspended",
  [ChainClaimStatus.Withdrawn]: "Withdrawn",
  [ChainClaimStatus.Disputed]: "Disputed",
  [ChainClaimStatus.Completed]: "Completed",
  [ChainClaimStatus.Expired]: "Expired",
};

const CONFIRMATION: Record<number, Confirmation> = {
  [ChainConfirmation.SelfAsserted]: "SelfAsserted",
  [ChainConfirmation.CounterpartyConfirmed]: "CounterpartyConfirmed",
  [ChainConfirmation.IssuerConfirmed]: "IssuerConfirmed",
};

const RELATIONSHIP_TYPE: Record<number, RelationshipType> = {
  [ChainRelationshipType.CurrentEmployee]: "CurrentEmployee",
  [ChainRelationshipType.PastEmployee]: "PastEmployee",
  [ChainRelationshipType.CurrentContractor]: "CurrentContractor",
  [ChainRelationshipType.PastContractor]: "PastContractor",
  [ChainRelationshipType.ExternalRepresentative]: "ExternalRepresentative",
  [ChainRelationshipType.AgencyRepresentative]: "AgencyRepresentative",
  [ChainRelationshipType.Advisor]: "Advisor",
};

const MANDATE_TYPE: Record<number, MandateType> = {
  [ChainMandateType.Recruitment]: "Recruitment",
  [ChainMandateType.Sales]: "Sales",
  [ChainMandateType.Consulting]: "Consulting",
  [ChainMandateType.Implementation]: "Implementation",
  [ChainMandateType.Communications]: "Communications",
  [ChainMandateType.Legal]: "Legal",
  [ChainMandateType.Advisory]: "Advisory",
  [ChainMandateType.EventRepresentation]: "EventRepresentation",
  [ChainMandateType.Partnership]: "Partnership",
};

// ---------------------------------------------------------------------------
// Derived status
// ---------------------------------------------------------------------------

/**
 * Applies expiry, exactly as `effective_entity_status` does on-chain.
 *
 * Recomputing it here rather than calling the contract's derived-status reads
 * saves one round trip per record for a rule that is three lines long. The
 * contract remains the authority: this must stay in step with `lib.rs`.
 */
function effectiveEntityStatus(entity: ChainEntity, nowSeconds: number): EntityStatus {
  const stored = ENTITY_STATUS[entity.status] ?? "Suspended";
  const expiresAt = Number(entity.expires_at);
  if (stored === "Active" && expiresAt !== 0 && nowSeconds > expiresAt) return "Expired";
  return stored;
}

/** The claim equivalent. `end` of 0 means open-ended. */
function effectiveClaimStatus(status: number, end: bigint, nowSeconds: number): ClaimStatus {
  const stored = CLAIM_STATUS[status] ?? "Suspended";
  const endSeconds = Number(end);
  if (stored === "Active" && endSeconds !== 0 && nowSeconds > endSeconds) return "Expired";
  return stored;
}

/**
 * The contract does not store a status history — every change is an event.
 * Until an indexer is reading those, show the two points we can prove from the
 * record itself rather than inventing a timeline.
 */
function historyFor(confirmedAt: string, status: ClaimStatus, endedAt: string | null): StatusEvent[] {
  const events: StatusEvent[] = [
    { status: "Confirmed", at: confirmedAt, note: "Written to the registry" },
  ];
  if (status !== "Active") {
    events.push({
      status,
      at: endedAt ?? confirmedAt,
      note: endedAt ? undefined : "Exact time available from the contract's event log",
    });
  }
  return events;
}

// ---------------------------------------------------------------------------
// Record mapping
// ---------------------------------------------------------------------------

function toOrganisation(entity: ChainEntity, now: number): Organisation {
  return {
    kind: "organisation",
    ...common(entity, now),
    domain: entity.domain,
    jurisdiction: entity.jurisdiction,
  };
}

function toPerson(entity: ChainEntity, now: number): Person {
  return { kind: "person", ...common(entity, now) };
}

function common(entity: ChainEntity, now: number) {
  const status = effectiveEntityStatus(entity, now);
  return {
    id: entity.id.toString(),
    handle: entity.handle,
    // Natural persons are registered with an empty display name on purpose —
    // the name lives in the off-chain credential, so it can be erased. Falling
    // back to the handle keeps the page readable either way.
    name: entity.display_name || entity.handle,
    issuer: entity.issuer,
    controller: entity.controller,
    status,
    verified: status === "Active",
    verifiedAt: tsToIso(entity.verified_at),
    expiresAt: optionalTsToIso(entity.expires_at),
    strikes: entity.strikes,
    metadataUri: entity.metadata_uri,
    metadataHash: entity.metadata_hash.toString("hex"),
  };
}

function toRelationship(claim: ChainRelationship, now: number): Relationship {
  const status = effectiveClaimStatus(claim.status, claim.end_date, now);
  const endDate = optionalTsToIso(claim.end_date);
  return {
    kind: "relationship",
    id: claim.id.toString(),
    organisationId: claim.org.toString(),
    personId: claim.person.toString(),
    type: RELATIONSHIP_TYPE[claim.rel_type] ?? "Advisor",
    role: claim.role,
    department: claim.department || undefined,
    startDate: tsToIso(claim.start_date),
    endDate,
    status,
    confirmation: CONFIRMATION[claim.confirmation] ?? "SelfAsserted",
    attestedBy: claim.attested_by,
    publicDisplay: claim.public_display,
    detailHash: claim.detail_hash.toString("hex"),
    confirmedAt: tsToIso(claim.confirmed_at),
    history: historyFor(tsToIso(claim.confirmed_at), status, endDate),
  };
}

function toMandate(claim: ChainMandate, now: number): Mandate {
  const status = effectiveClaimStatus(claim.status, claim.valid_until, now);
  return {
    kind: "mandate",
    id: claim.id.toString(),
    organisationId: claim.org.toString(),
    representativeId: claim.representative.toString(),
    relationshipId: Number(claim.relationship) === 0 ? null : claim.relationship.toString(),
    mandateType: MANDATE_TYPE[claim.mandate_type] ?? "Recruitment",
    scope: claim.scope,
    territory: claim.territory || undefined,
    validFrom: tsToIso(claim.valid_from),
    validTo: tsToIso(claim.valid_until),
    status,
    confirmation: CONFIRMATION[claim.confirmation] ?? "SelfAsserted",
    attestedBy: claim.attested_by,
    detailHash: claim.detail_hash.toString("hex"),
    confirmedAt: tsToIso(claim.confirmed_at),
    history: historyFor(tsToIso(claim.confirmed_at), status, tsToIso(claim.valid_until)),
  };
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

export interface RegistrySnapshot {
  organisations: Organisation[];
  people: Person[];
  relationships: Relationship[];
  mandates: Mandate[];
  claims: Claim[];
  /** When this snapshot was read, so the UI can say how fresh it is. */
  loadedAt: number;
}

export async function loadRegistry(): Promise<RegistrySnapshot> {
  const client = registry();
  const now = Math.floor(Date.now() / 1000);

  const [entityCount, claimCount] = await Promise.all([
    read(client.entity_count()),
    read(client.claim_count()),
  ]);

  const entityIds = range(Number(entityCount));
  const entities = await mapWithLimit(entityIds, (id) =>
    read(client.get_entity({ id: BigInt(id) })),
  );

  const organisations: Organisation[] = [];
  const people: Person[] = [];
  for (const entity of entities) {
    if (!entity) continue;
    if (entity.kind === ChainEntityKind.Organisation) organisations.push(toOrganisation(entity, now));
    else people.push(toPerson(entity, now));
  }

  // A claim id is either a relationship or a mandate, never both. Asking for
  // both in parallel costs one extra simulated read and halves the wall time
  // against asking serially.
  const claimIds = range(Number(claimCount));
  const claimPairs = await mapWithLimit(claimIds, async (id) =>
    Promise.all([
      read(client.get_relationship({ id: BigInt(id) })),
      read(client.get_mandate({ id: BigInt(id) })),
    ]),
  );

  const relationships: Relationship[] = [];
  const mandates: Mandate[] = [];
  for (const [rel, mandate] of claimPairs) {
    if (rel) relationships.push(toRelationship(rel, now));
    else if (mandate) mandates.push(toMandate(mandate, now));
  }

  return {
    organisations,
    people,
    relationships,
    mandates,
    claims: [...relationships, ...mandates],
    loadedAt: Date.now(),
  };
}

/** `[1, 2, … n]` — contract ids are 1-based so `0` can mean "none". */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}
