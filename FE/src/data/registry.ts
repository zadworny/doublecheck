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
  LedgerClaimStatus,
  Mandate,
  MandateEvaluation,
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
function effectiveClaimStatus(
  status: number,
  end: bigint,
  nowSeconds: number,
): LedgerClaimStatus {
  const stored = CLAIM_STATUS[status] ?? "Suspended";
  const endSeconds = Number(end);
  if (stored === "Active" && endSeconds !== 0 && nowSeconds > endSeconds) return "Expired";
  return stored as LedgerClaimStatus;
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
      at: endedAt,
      note: endedAt
        ? undefined
        : "Current stored status; the exact transition time requires the contract event log.",
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
    // Natural persons are registered with an empty display name on purpose.
    // Keeping the name in issuer-controlled off-chain storage can support a
    // deletion request, although ledger anchors and third-party copies remain.
    // Falling back to the handle keeps the page readable either way.
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

function toMandate(
  claim: ChainMandate,
  now: number,
  entities: Map<string, Organisation | Person>,
  relationships: Map<string, Relationship>,
): Mandate {
  const ledgerStatus = effectiveClaimStatus(claim.status, claim.valid_until, now);
  const organisation = entities.get(claim.org.toString());
  const representative = entities.get(claim.representative.toString());
  const relationshipId = Number(claim.relationship) === 0 ? null : claim.relationship.toString();
  const relationship = relationshipId ? relationships.get(relationshipId) : undefined;
  const evaluation = evaluateMandate(
    claim,
    ledgerStatus,
    organisation,
    representative,
    relationshipId,
    relationship,
    now,
  );

  return {
    kind: "mandate",
    id: claim.id.toString(),
    organisationId: claim.org.toString(),
    representativeId: claim.representative.toString(),
    // Do not leak even the id of a relationship the subject withheld from the
    // public UI. `evaluation.relationshipStatus` still distinguishes that
    // safety failure from a valid standalone mandate.
    relationshipId: relationship ? relationshipId : null,
    mandateType: MANDATE_TYPE[claim.mandate_type] ?? "Recruitment",
    scope: claim.scope,
    territory: claim.territory || undefined,
    validFrom: tsToIso(claim.valid_from),
    validTo: tsToIso(claim.valid_until),
    status: evaluation.live
      ? claim.confirmation === ChainConfirmation.SelfAsserted
        ? "Proposed"
        : "Active"
      : evaluation.code === "scheduled"
        ? "Scheduled"
        : evaluation.code === "expired"
          ? "Expired"
          : evaluation.code === "claim-inactive"
            ? ledgerStatus
            : "Unavailable",
    ledgerStatus,
    evaluation,
    confirmation: CONFIRMATION[claim.confirmation] ?? "SelfAsserted",
    attestedBy: claim.attested_by,
    detailHash: claim.detail_hash.toString("hex"),
    confirmedAt: tsToIso(claim.confirmed_at),
    history: historyFor(
      tsToIso(claim.confirmed_at),
      ledgerStatus,
      ledgerStatus === "Expired" ? tsToIso(claim.valid_until) : null,
    ),
  };
}

function evaluateMandate(
  claim: ChainMandate,
  ledgerStatus: LedgerClaimStatus,
  organisation: Organisation | Person | undefined,
  representative: Organisation | Person | undefined,
  relationshipId: string | null,
  relationship: Relationship | undefined,
  now: number,
): MandateEvaluation {
  const common = {
    organisationStatus: organisation?.status ?? "Missing",
    representativeStatus: representative?.status ?? "Missing",
    relationshipStatus: relationshipId
      ? (relationship?.status ?? "Missing")
      : "NotRequired",
    evaluatedAt: new Date(now * 1000).toISOString(),
  } as const;

  if (ledgerStatus === "Expired") {
    return {
      ...common,
      code: "expired",
      live: false,
      reasons: ["The mandate's validity window has ended."],
    };
  }
  if (ledgerStatus !== "Active") {
    return {
      ...common,
      code: "claim-inactive",
      live: false,
      reasons: [`The mandate's on-chain status is ${ledgerStatus}.`],
    };
  }
  if (!organisation || organisation.status !== "Active") {
    return {
      ...common,
      code: "organisation-inactive",
      live: false,
      reasons: [
        organisation
          ? `The organisation badge is ${organisation.status}.`
          : "The organisation badge could not be resolved.",
      ],
    };
  }
  if (!representative || representative.status !== "Active") {
    return {
      ...common,
      code: "representative-inactive",
      live: false,
      reasons: [
        representative
          ? `The representative badge is ${representative.status}.`
          : "The representative badge could not be resolved.",
      ],
    };
  }
  if (relationshipId && !relationship) {
    return {
      ...common,
      code: "relationship-missing",
      live: false,
      reasons: [
        "The supporting relationship is missing or is not approved for public display.",
      ],
    };
  }
  if (relationship && relationship.status !== "Active") {
    return {
      ...common,
      code: "relationship-inactive",
      live: false,
      reasons: [`The supporting relationship is ${relationship.status}.`],
    };
  }
  if (now < Number(claim.valid_from)) {
    return {
      ...common,
      code: "scheduled",
      live: false,
      reasons: ["The mandate's validity window has not started yet."],
    };
  }

  return {
    ...common,
    code: "live",
    live: true,
    reasons: ["The mandate, both badges, and its public supporting relationship are active."],
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

  const [entityCount, claimCount] = await Promise.all([
    read(client.entity_count()),
    read(client.claim_count()),
  ]);

  const entityIds = range(Number(entityCount));
  const entities = await mapWithLimit(entityIds, (id) =>
    read(client.get_entity({ id: BigInt(id) })),
  );

  // Expiry is a ledger-time rule. Use the contract's own `checked_at` clock
  // rather than trusting a visitor's potentially skewed device clock. An empty
  // registry has no status to evaluate, so wall time is harmless as fallback.
  const clockEntity = entities.find((entity) => entity !== undefined);
  const clockCheck = clockEntity
    ? await read(client.check_by_id({ id: clockEntity.id }))
    : undefined;
  const now = clockCheck
    ? Number(clockCheck.checked_at)
    : Math.floor(Date.now() / 1000);

  const organisations: Organisation[] = [];
  const people: Person[] = [];
  for (const entity of entities) {
    if (!entity) continue;
    if (entity.kind === ChainEntityKind.Organisation) organisations.push(toOrganisation(entity, now));
    else people.push(toPerson(entity, now));
  }
  const entityById = new Map<string, Organisation | Person>([
    ...organisations.map((entity) => [entity.id, entity] as const),
    ...people.map((entity) => [entity.id, entity] as const),
  ]);

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
  for (const [rel] of claimPairs) {
    // `public_display` is the subject's verifier-publication choice. Unpublished
    // relationships remain readable on Stellar but never enter this public UI
    // snapshot, which keeps them out of getters, search, feeds, and claim routes.
    if (rel?.public_display) relationships.push(toRelationship(rel, now));
  }
  const relationshipById = new Map(relationships.map((claim) => [claim.id, claim]));

  const mandates: Mandate[] = [];
  for (const [, mandate] of claimPairs) {
    if (mandate) {
      mandates.push(toMandate(mandate, now, entityById, relationshipById));
    }
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

/**
 * Executes the contract's direct pair check as a read-only simulation.
 *
 * This is supporting evidence, not a replacement for confirmation provenance:
 * the boolean deliberately collapses company- and issuer-confirmed paths and
 * does not explain which mandate or dependency produced the answer.
 */
export async function readPairAuthorisation(orgId: string, representativeId: string) {
  const client = registry();
  return await read(
    client.is_authorised({
      org: BigInt(orgId),
      representative: BigInt(representativeId),
    }),
  );
}

/** `[1, 2, … n]` — contract ids are 1-based so `0` can mean "none". */
function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}
