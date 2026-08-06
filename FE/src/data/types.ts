/**
 * The shapes this UI renders.
 *
 * These mirror the contract's records (see `src/contract/registry.ts`, which is
 * generated from the deployed contract) but flattened for display: `bigint`
 * timestamps become ISO strings, numeric enums become string literals, and
 * entity/claim ids become strings so they can go straight into a route.
 *
 * The mapping lives in `registry.ts`.
 */

export type RelationshipType =
  | "CurrentEmployee"
  | "PastEmployee"
  | "CurrentContractor"
  | "PastContractor"
  | "ExternalRepresentative"
  | "AgencyRepresentative"
  | "Advisor";

export type MandateType =
  | "Recruitment"
  | "Sales"
  | "Consulting"
  | "Implementation"
  | "Communications"
  | "Legal"
  | "Advisory"
  | "EventRepresentation"
  | "Partnership";

/**
 * One status union for both claim kinds. The contract stores a single
 * `ClaimStatus`; `Expired` is derived from the end date at read time and is
 * never written.
 */
export type ClaimStatus =
  | "Active"
  | "Ended"
  | "Suspended"
  | "Withdrawn"
  | "Disputed"
  | "Completed"
  | "Expired";

/** Kept as separate names because the two record kinds read differently. */
export type RelationshipStatus = ClaimStatus;
export type MandateStatus = ClaimStatus;

/** An entity's badge state. `Expired` is derived, like `ClaimStatus.Expired`. */
export type EntityStatus = "Active" | "Suspended" | "Revoked" | "Expired";

/**
 * Who stands behind a claim — the field that decides how much it is worth.
 *
 * The contract records which key signed the write, so this cannot be
 * misrepresented by whoever is serving the page.
 */
export type Confirmation = "SelfAsserted" | "CounterpartyConfirmed" | "IssuerConfirmed";

export const CONFIRMATION_LABEL: Record<Confirmation, string> = {
  CounterpartyConfirmed: "Confirmed by the organisation",
  IssuerConfirmed: "Confirmed by the issuer",
  SelfAsserted: "Self-asserted",
};

export interface StatusEvent {
  status: string;
  at: string;
  note?: string;
}

interface EntityBase {
  /** Decimal entity id, used in routes. */
  id: string;
  /** Public slug — `/{handle}` on the verifier. Unique across the registry. */
  handle: string;
  /** `display_name` if the issuer set one, otherwise the handle. */
  name: string;
  /** Stellar address of the issuer that verified this entity. */
  issuer: string;
  /** Stellar address this badge is soulbound to. */
  controller: string;
  /** True only when the effective status is `Active`. */
  verified: boolean;
  status: EntityStatus;
  verifiedAt: string;
  /** `null` when the badge never expires. */
  expiresAt: string | null;
  /** Upheld complaints recorded against this entity. */
  strikes: number;
  /** Where the off-chain credential lives, and the hash pinning its contents. */
  metadataUri: string;
  metadataHash: string;
}

export interface Organisation extends EntityBase {
  kind: "organisation";
  /** Target of the DNS / email-domain challenge. May be empty. */
  domain: string;
  jurisdiction: string;
}

export interface Person extends EntityBase {
  kind: "person";
}

interface ClaimBase {
  /** Decimal claim id. Relationships and mandates share one id space. */
  id: string;
  organisationId: string;
  status: ClaimStatus;
  confirmation: Confirmation;
  /** Stellar address of the key that signed this claim into the registry. */
  attestedBy: string;
  confirmedAt: string;
  detailHash: string;
  history: StatusEvent[];
}

export interface Relationship extends ClaimBase {
  kind: "relationship";
  personId: string;
  type: RelationshipType;
  role: string;
  department?: string;
  startDate: string;
  /** `null` means ongoing. */
  endDate?: string | null;
  /** When false the subject asked for this not to be shown publicly. */
  publicDisplay: boolean;
}

export interface Mandate extends ClaimBase {
  kind: "mandate";
  representativeId: string;
  /** Claim id of the relationship this rests on, or `null` if standalone. */
  relationshipId: string | null;
  mandateType: MandateType;
  scope: string;
  territory?: string;
  validFrom: string;
  validTo: string;
}

export type Claim = Relationship | Mandate;
