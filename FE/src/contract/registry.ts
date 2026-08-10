/* eslint-disable */
// GENERATED FILE — do not edit by hand.
// Regenerate with `npm run bindings` (see scripts/generate-bindings.mjs).
// Source: contract CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP on testnet.
import { Buffer } from "buffer";
import {
  Client as ContractClient,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  AssembledTransaction,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
} from "@stellar/stellar-sdk/contract";
import type { u32, u64, Option } from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}


export const networks = {
  testnet: {
    networkPassphrase: "Test SDF Network ; September 2015",
    contractId: "CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP",
  }
} as const


/**
 * The answer to the only question the verifier page really asks:
 * *is this counterparty real, right now?*
 *
 * Returned by a single contract call so a wallet-free verifier can render a
 * page from one RPC round trip.
 */
export interface Check {
  /**
 * Ledger timestamp the answer was computed at.
 */
checked_at: u64;
  /**
 * `entity.status` with expiry applied. Read this, not `entity.status`.
 */
effective_status: EntityStatus;
  entity: Entity;
  /**
 * Mandates this entity is a party to. Organisations: ones they issued.
 * Persons: ones they hold.
 */
mandates: u32;
  /**
 * Relationships this entity is a party to. Organisations: ones they
 * attested. Persons: ones about them.
 */
relationships: u32;
  /**
 * True only when `effective_status == Active`.
 */
valid: boolean;
}

export const Errors = {
  1: {message:"AlreadyInitialized"},
  2: {message:"NotInitialized"},
  3: {message:"NotAuthorized"},
  4: {message:"Paused"},
  10: {message:"EntityNotFound"},
  11: {message:"HandleTaken"},
  12: {message:"ControllerTaken"},
  13: {message:"InvalidHandle"},
  14: {message:"TextTooLong"},
  /**
   * The entity is suspended, revoked or expired.
   */
  15: {message:"EntityNotActive"},
  /**
   * Expected an organisation, got a person, or the other way round.
   */
  16: {message:"WrongEntityKind"},
  20: {message:"ClaimNotFound"},
  /**
   * End date before start date, or a mandate with no end at all.
   */
  21: {message:"InvalidDateRange"},
  /**
   * The claim is not in a state this transition allows.
   */
  22: {message:"InvalidStatus"},
  /**
   * Referenced relationship does not belong to the same org and person.
   */
  23: {message:"RelationshipMismatch"},
  /**
   * Trust badges must expire and pass periodic re-verification.
   */
  24: {message:"ExpiryRequired"},
  /**
   * The requested badge lifetime exceeds [`MAX_BADGE_LIFETIME`].
   */
  25: {message:"ExpiryTooFar"},
  /**
   * Natural-person descriptive data belongs in the off-chain credential.
   */
  26: {message:"PersonalDataNotAllowed"},
  /**
   * Credential locations must be non-empty `https://` or `ipfs://` URIs.
   */
  27: {message:"InvalidUri"},
  /**
   * Public text contains a control character that can spoof verifier output.
   */
  28: {message:"InvalidText"},
  /**
   * Credential and terms hashes must be real anchors, not all-zero values.
   */
  29: {message:"InvalidHash"},
  /**
   * A confirmed pair already has [`MAX_CONFIRMED_PAIR_LEN`] live or
   * scheduled mandates. General discovery indexes remain best-effort.
   */
  30: {message:"IndexFull"},
  31: {message:"NoPendingAdmin"},
  32: {message:"NoPendingController"},
  33: {message:"PendingEntityNotFound"},
  34: {message:"PendingEntityExpired"},
  35: {message:"InvalidAcceptanceWindow"},
  36: {message:"InvalidBatchSize"},
  /**
   * The destination attempted to accept before the issuer approved the exact
   * pending controller address.
   */
  37: {message:"ControllerRotationNotApproved"},
  /**
   * A mandate cannot authorise an entity to represent itself.
   */
  38: {message:"SameEntity"}
}


/**
 * A vetted organisation or person.
 *
 * The badge is soulbound: `controller` is set at registration and there is no
 * holder-only transfer function. A controller change requires the current
 * controller, issuer approval and the destination controller, so the holder
 * and destination cannot move verified status without issuer re-approval.
 */
export interface Entity {
  /**
 * The wallet that acts for this entity. Soulbound to the subject.
 */
controller: string;
  /**
 * Organisations: registered legal name. Natural persons: leave empty and
 * serve the name from the off-chain credential — see `docs/architecture.md`.
 */
display_name: string;
  /**
 * Primary domain, used for the DNS / email-domain challenge. Empty for
 * natural persons.
 */
domain: string;
  /**
 * Unix seconds. Always non-zero; trust must be periodically renewed.
 */
expires_at: u64;
  /**
 * Unique public slug used by the verifier page.
 */
handle: string;
  /**
 * Sequential id, assigned by the contract. Stable forever.
 */
id: u64;
  /**
 * The address that performed the verification. This is the badge's fixed
 * lifecycle authority for metadata, renewal, revocation and recovery; a
 * later global admin handover does not rewrite it.
 */
issuer: string;
  /**
 * Free-text jurisdiction, e.g. "Germany". Empty if not applicable.
 */
jurisdiction: string;
  kind: EntityKind;
  /**
 * SHA-256 of the canonical off-chain credential JSON. Lets any reader
 * prove the fetched profile matches the content the issuer anchored and
 * vetted.
 */
metadata_hash: Buffer;
  /**
 * Where that credential is served from (https / ipfs).
 */
metadata_uri: string;
  status: EntityStatus;
  /**
 * Count of upheld complaints. Reputation collateral in place of a cash
 * stake — see `docs/architecture.md`.
 */
strikes: u32;
  verified_at: u64;
}

/**
 * Records live in persistent storage; configuration lives in instance storage
 * so it is bumped along with the contract itself.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "PendingAdmin", values: void} | {tag: "PendingController", values: readonly [u64]} | {tag: "Arbiter", values: void} | {tag: "Paused", values: void} | {tag: "EntityCount", values: void} | {tag: "PendingEntityCount", values: void} | {tag: "ClaimCount", values: void} | {tag: "Entity", values: readonly [u64]} | {tag: "EntitySuspendedBy", values: readonly [u64]} | {tag: "HandleIdx", values: readonly [string]} | {tag: "ControllerIdx", values: readonly [string]} | {tag: "PendingEntity", values: readonly [u64]} | {tag: "PendingHandleIdx", values: readonly [string]} | {tag: "PendingControllerIdx", values: readonly [string]} | {tag: "Relationship", values: readonly [u64]} | {tag: "Mandate", values: readonly [u64]} | {tag: "OrgRels", values: readonly [u64]} | {tag: "PersonRels", values: readonly [u64]} | {tag: "OrgMandates", values: readonly [u64]} | {tag: "PersonMandates", values: readonly [u64]} | {tag: "PairMandates", values: readonly [u64, u64]} | {tag: "LiveMandate", values: readonly [u64, u64]} | {tag: "ApprovedController", values: readonly [u64]} | {tag: "ConfirmedPairMandates", values: readonly [u64, u64]};


/**
 * An authorisation for a person or organisation/agency representative to act
 * on an organisation's behalf.
 */
export interface Mandate {
  attested_by: string;
  confirmation: Confirmation;
  confirmed_at: u64;
  detail_hash: Buffer;
  /**
 * Sequential claim id, unique across relationships *and* mandates.
 */
id: u64;
  mandate_type: MandateType;
  org: u64;
  /**
 * Relationship this mandate rests on. `0` if standalone.
 */
relationship: u64;
  /**
 * Entity id of the representative.
 */
representative: u64;
  /**
 * What they may do, e.g. "Engineering hiring for the robotics division".
 */
scope: string;
  status: ClaimStatus;
  /**
 * Optional territory. Empty if worldwide / not applicable.
 */
territory: string;
  valid_from: u64;
  /**
 * Unix seconds. Mandates are always time-bound, so this is never `0`.
 */
valid_until: u64;
}

/**
 * What kind of subject an [`Entity`] record describes.
 */
export enum EntityKind {
  Organisation = 0,
  Person = 1,
}

/**
 * Lifecycle state of a relationship or a mandate.
 *
 * As with [`EntityStatus`], `Expired` is derived from the claim's end date at
 * read time and is never written.
 */
export enum ClaimStatus {
  Active = 0,
  Ended = 1,
  Suspended = 2,
  Withdrawn = 3,
  Disputed = 4,
  Completed = 5,
  Expired = 6,
}

/**
 * What a representative is authorised to do on the organisation's behalf.
 */
export enum MandateType {
  Recruitment = 0,
  Sales = 1,
  Consulting = 2,
  Implementation = 3,
  Communications = 4,
  Legal = 5,
  Advisory = 6,
  EventRepresentation = 7,
  Partnership = 8,
}

/**
 * Who stands behind a claim — the single most important field for a reader.
 *
 * The strategy document proposes two attestation tiers: a cheap self-asserted
 * one backed only by the recruiter's own reputation, and a premium one the
 * hiring company confirms. Both are representable here.
 */
export enum Confirmation {
  SelfAsserted = 0,
  CounterpartyConfirmed = 1,
  IssuerConfirmed = 2,
}

/**
 * Lifecycle state of an entity's verified status.
 *
 * `Expired` is never written to storage: it is derived from `expires_at` at
 * read time, so badges age out without a cron job. Reads go through
 * [`crate::effective_entity_status`].
 */
export enum EntityStatus {
  Active = 0,
  Suspended = 1,
  Revoked = 2,
  Expired = 3,
}


/**
 * An organisation's attestation about a person's affiliation with it.
 */
export interface Relationship {
  /**
 * The key that signed the write.
 */
attested_by: string;
  confirmation: Confirmation;
  confirmed_at: u64;
  /**
 * Optional department. Empty if not given.
 */
department: string;
  /**
 * SHA-256 of the off-chain detail document backing this claim.
 */
detail_hash: Buffer;
  /**
 * Unix seconds. `0` means ongoing.
 */
end_date: u64;
  /**
 * Sequential claim id, unique across relationships *and* mandates.
 */
id: u64;
  /**
 * Entity id of the attesting organisation.
 */
org: u64;
  /**
 * Entity id of the subject.
 */
person: u64;
  /**
 * The subject's consent to this claim being shown publicly. When false the
 * record still exists on-chain but the verifier page must not render it.
 */
public_display: boolean;
  rel_type: RelationshipType;
  /**
 * Job title, e.g. "Senior Technical Recruiter".
 */
role: string;
  start_date: u64;
  status: ClaimStatus;
}


/**
 * A vetted badge waiting for the subject/controller to accept it.
 *
 * Verification happens off-chain first. The issuer then commits the exact
 * public record, credential hash and terms version here. Nothing becomes a
 * verified [`Entity`] until `controller` authorises `accept_entity`.
 */
export interface PendingEntity {
  accept_by: u64;
  controller: string;
  display_name: string;
  domain: string;
  expires_at: u64;
  handle: string;
  id: u64;
  issuer: string;
  jurisdiction: string;
  kind: EntityKind;
  metadata_hash: Buffer;
  metadata_uri: string;
  proposed_at: u64;
  /**
 * Hash of the code of conduct / issuance terms accepted by the subject.
 */
terms_hash: Buffer;
}


/**
 * Cursor returned by a bounded, submitted storage keepalive invocation.
 */
export interface KeepaliveResult {
  claims_touched: u32;
  done: boolean;
  entities_touched: u32;
  next_claim: u64;
  next_entity: u64;
}

/**
 * How a person is affiliated with an organisation. Mirrors the explorer UI.
 */
export enum RelationshipType {
  CurrentEmployee = 0,
  PastEmployee = 1,
  CurrentContractor = 2,
  PastContractor = 3,
  ExternalRepresentative = 4,
  AgencyRepresentative = 5,
  Advisor = 6,
}






















export interface Client {
  /**
   * Construct and simulate a admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  admin: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a check transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The whole verifier page in one call: the record, its status with expiry
   * already applied, and how many claims hang off it.
   */
  check: ({handle}: {handle: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Check>>>

  /**
   * Construct and simulate a paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a arbiter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  arbiter: (options?: MethodOptions) => Promise<AssembledTransaction<Result<string>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Replaces the contract code. Keeps the same address, so every badge link
   * and QR code already in circulation survives an upgrade.
   */
  upgrade: ({new_wasm_hash}: {new_wasm_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a keepalive transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Requests TTL extensions for a bounded slice of registry storage.
   *
   * Unlike the explorer's simulation-only reads, this call must be signed
   * and submitted to persist its extensions. It requires no registry role:
   * a dedicated, funded keeper account can pay the small network fee. Call
   * repeatedly with the returned cursors until `done` is true.
   */
  keepalive: ({entity_cursor, claim_cursor, limit}: {entity_cursor: u64, claim_cursor: u64, limit: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Result<KeepaliveResult>>>

  /**
   * Construct and simulate a add_strike transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Records an upheld complaint.
   *
   * Strikes are the reputation collateral that replaces a cash stake in the
   * MVP: they are public, they accumulate, and enough of them justify a
   * revocation. Deciding *how many* is enough is an off-chain policy call.
   */
  add_strike: ({caller, id}: {caller: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u32>>>

  /**
   * Construct and simulate a get_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entity: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Entity>>>

  /**
   * Construct and simulate a set_paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Emergency stop. Blocks new registrations and new claims; reads, status
   * changes and revocations keep working, because pausing must never prevent
   * taking a bad badge down.
   */
  set_paused: ({paused}: {paused: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a check_by_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * [`Self::check`] by id, for callers that already resolved the handle.
   */
  check_by_id: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Check>>>

  /**
   * Construct and simulate a claim_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  claim_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a get_mandate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_mandate: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Mandate>>>

  /**
   * Construct and simulate a set_arbiter transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_arbiter: ({arbiter}: {arbiter: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a accept_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Step two of the admin handover, called by the proposed admin.
   */
  accept_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a entity_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  entity_count: (options?: MethodOptions) => Promise<AssembledTransaction<u64>>

  /**
   * Construct and simulate a renew_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Extends a badge after re-verification by its fixed issuer. Also clears a
   * suspension, since re-verification is exactly the thing that resolves one.
   */
  renew_entity: ({id, expires_at}: {id: u64, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a accept_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Accepts a pending badge and atomically makes it a verified entity.
   */
  accept_entity: ({pending_id}: {pending_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a is_authorised transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * "May this person act for that company, right now?"
   *
   * The question a candidate being cold-DMed actually has. This deliberately
   * means *company- or issuer-confirmed*: a representative's self-asserted
   * vouch is useful evidence, but it is not an authorisation from the named
   * company. The primary scan is a bounded, relevant-confirmation index
   * which a representative's self-assertions cannot fill. It prunes
   * inactive and expired mandates but never evicts a live or scheduled one.
   * A shared scan budget keeps the confirmed index and legacy fallbacks
   * below Stellar's ledger-footprint limit.
   */
  is_authorised: ({org, representative}: {org: u64, representative: u64}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a issue_mandate transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Authorises a representative to act for an organisation, for a scope and
   * a fixed window.
   *
   * This is the claim a candidate actually needs to check: not "is this
   * person real" but "is this person allowed to be recruiting for that
   * company today". Mandates are always time-bound; `valid_until` cannot be
   * zero.
   *
   * `relationship` optionally ties the mandate to the affiliation it rests
   * on. When given, it must be a relationship between the same two parties.
   */
  issue_mandate: ({caller, org, representative, relationship, mandate_type, scope, territory, valid_from, valid_until, detail_hash}: {caller: string, org: u64, representative: u64, relationship: u64, mandate_type: MandateType, scope: string, territory: string, valid_from: u64, valid_until: u64, detail_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a propose_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Step one of the admin handover. The new admin is not live until it calls
   * `accept_admin`, so a typo cannot lock the registry.
   */
  propose_admin: ({new_admin}: {new_admin: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a mandate_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A mandate's status with expiry applied.
   */
  mandate_status: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ClaimStatus>>>

  /**
   * Construct and simulate a propose_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Offers a vetted badge to a controller without activating it.
   *
   * This is the preferred onboarding path: the issuer completes its manual
   * checks, commits the exact credential and terms hashes, and reserves the
   * handle. The controller becomes verified only after independently
   * calling `accept_entity` before `accept_by`.
   */
  propose_entity: ({kind, controller, handle, display_name, domain, jurisdiction, metadata_hash, metadata_uri, terms_hash, accept_by, expires_at}: {kind: EntityKind, controller: string, handle: string, display_name: string, domain: string, jurisdiction: string, metadata_hash: Buffer, metadata_uri: string, terms_hash: Buffer, accept_by: u64, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a register_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Records that an organisation or a person passed manual verification.
   *
   * Admin-only: in phase 1 every badge is issued by hand, and this call is
   * the last step of that checklist. Badges must be time-bound and renewed;
   * permanent trust is deliberately not representable.
   */
  register_entity: ({kind, controller, handle, display_name, domain, jurisdiction, metadata_hash, metadata_uri, expires_at}: {kind: EntityKind, controller: string, handle: string, display_name: string, domain: string, jurisdiction: string, metadata_hash: Buffer, metadata_uri: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a update_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Repoints an entity at a new off-chain credential.
   *
   * Issuer-only. `metadata_hash` anchors the credential the issuer vetted;
   * allowing the subject to replace it would let them substitute a new
   * identity while the page continued to display the original issuer.
   * Subject-owned profile data belongs in a separate, explicitly unverified
   * document at the application layer.
   */
  update_metadata: ({caller, id, metadata_hash, metadata_uri}: {caller: string, id: u64, metadata_hash: Buffer, metadata_uri: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a end_relationship transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Closes a relationship with an end date, without deleting it.
   *
   * History is the point: "left in March" is a different and more useful
   * answer than "no record found".
   */
  end_relationship: ({caller, id, end_date}: {caller: string, id: u64, end_date: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_relationship transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_relationship: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Relationship>>>

  /**
   * Construct and simulate a mandates_held_by transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mandates_held_by: ({representative}: {representative: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a accept_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Completes a recovery after the issuer approved this exact destination
   * and that destination explicitly accepts it. Uniqueness is checked again
   * at acceptance time so a stale proposal cannot overwrite a key in use.
   */
  accept_controller: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a rotate_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Backwards-compatible atomic rotation for recovery tooling.
   *
   * The badge's fixed issuer, current controller and destination controller
   * must all consent.
   * The issuer can therefore help coordinate recovery but cannot move a
   * soulbound badge on its own. New integrations should prefer the
   * propose/approve/accept flow above.
   */
  rotate_controller: ({id, new_controller}: {id: u64, new_controller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_entity_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Suspends, revokes or reinstates a badge. The stored issuer owns permanent
   * lifecycle decisions; the global arbiter may place and lift its own hold.
   *
   * `Revoked` is terminal — a revoked badge cannot come back, because a
   * reader who saw "revoked" must never be contradicted later. Re-admitting
   * someone means issuing a new entity under a new handle.
   */
  set_entity_status: ({caller, id, status}: {caller: string, id: u64, status: EntityStatus}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pending_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_entity: ({pending_id}: {pending_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PendingEntity>>>

  /**
   * Construct and simulate a mandates_issued_by transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mandates_issued_by: ({org}: {org: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a propose_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Starts an issuer-reviewed controller recovery. Only the current
   * controller may nominate a destination. Any previous issuer approval is
   * cleared, so approval is always bound to this exact proposal.
   */
  propose_controller: ({caller, id, new_controller}: {caller: string, id: u64, new_controller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_mandate_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Changes a mandate's state — the revocation path that makes the badge
   * worth anything. A withdrawn mandate stops verifying the moment the
   * transaction lands, everywhere the badge is embedded.
   */
  set_mandate_status: ({caller, id, status}: {caller: string, id: u64, status: ClaimStatus}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_public_display transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Flips whether the official verifier may render this relationship.
   * Soroban storage remains publicly readable either way; this is display
   * consent, not an erasure or an on-chain privacy mechanism.
   */
  set_public_display: ({caller, id, public_display}: {caller: string, id: u64, public_display: boolean}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a attest_relationship transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Attests that a person is, or was, affiliated with an organisation.
   *
   * `caller` decides how much the claim is worth, and the contract stamps it
   * accordingly:
   *
   * * the organisation's controller -> [`Confirmation::CounterpartyConfirmed`]
   * * the person's own controller   -> [`Confirmation::SelfAsserted`]
   * * the admin                     -> [`Confirmation::IssuerConfirmed`]
   *
   * A recruiter can therefore list where they work without waiting for the
   * company, and a reader can still see nobody but the recruiter said so.
   */
  attest_relationship: ({caller, org, person, rel_type, role, department, start_date, end_date, public_display, detail_hash}: {caller: string, org: u64, person: u64, rel_type: RelationshipType, role: string, department: string, start_date: u64, end_date: u64, public_display: boolean, detail_hash: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a relationship_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * A relationship's status with expiry applied — `end_date` counts as the
   * expiry, so a finished engagement never reads as `Active`.
   */
  relationship_status: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ClaimStatus>>>

  /**
   * Construct and simulate a relationships_about transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  relationships_about: ({person}: {person: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a get_entity_by_handle transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entity_by_handle: ({handle}: {handle: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Entity>>>

  /**
   * Construct and simulate a cancel_entity_proposal transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancels a pending badge. The issuer or intended controller may cancel
   * at any time; after the acceptance deadline or badge expiry any
   * authenticated caller may release the abandoned reservations.
   */
  cancel_entity_proposal: ({caller, pending_id}: {caller: string, pending_id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pending_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Public recovery state for wallets and operators coordinating the three
   * asynchronous signatures.
   */
  get_pending_controller: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_approved_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the exact pending destination the issuer approved, if any.
   */
  get_approved_controller: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a set_relationship_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Changes a relationship's state.
   *
   * The subject can always set `Withdrawn` on a claim about themselves. That
   * is the on-chain form of the right to object: an organisation cannot pin
   * a public statement about a person against their will.
   */
  set_relationship_status: ({caller, id, status}: {caller: string, id: u64, status: ClaimStatus}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_entity_by_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_entity_by_controller: ({controller}: {controller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Entity>>>

  /**
   * Construct and simulate a relationships_attested_by transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  relationships_attested_by: ({org}: {org: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a cancel_controller_rotation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Cancels an unaccepted recovery. The current controller or issuer may
   * cancel; the current controller remains in control throughout the flow.
   */
  cancel_controller_rotation: ({caller, id}: {caller: string, id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a approve_controller_rotation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The issuer approves the exact pending destination after completing its
   * recovery/re-verification policy. A proposal written before this contract
   * upgrade has no approval entry and therefore fails closed until reviewed.
   */
  approve_controller_rotation: ({id}: {id: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a get_pending_entity_by_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_pending_entity_by_controller: ({controller}: {controller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<PendingEntity>>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, arbiter}: {admin: string, arbiter: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, arbiter}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAAAAAAAFYWRtaW4AAAAAAAAAAAAAAQAAA+kAAAATAAAAAw==",
        "AAAAAAAAAHlUaGUgd2hvbGUgdmVyaWZpZXIgcGFnZSBpbiBvbmUgY2FsbDogdGhlIHJlY29yZCwgaXRzIHN0YXR1cyB3aXRoIGV4cGlyeQphbHJlYWR5IGFwcGxpZWQsIGFuZCBob3cgbWFueSBjbGFpbXMgaGFuZyBvZmYgaXQuAAAAAAAABWNoZWNrAAAAAAAAAQAAAAAAAAAGaGFuZGxlAAAAAAAQAAAAAQAAA+gAAAfQAAAABUNoZWNrAAAA",
        "AAAAAAAAAAAAAAAGcGF1c2VkAAAAAAAAAAAAAQAAAAE=",
        "AAAAAAAAAAAAAAAHYXJiaXRlcgAAAAAAAAAAAQAAA+kAAAATAAAAAw==",
        "AAAAAAAAAH9SZXBsYWNlcyB0aGUgY29udHJhY3QgY29kZS4gS2VlcHMgdGhlIHNhbWUgYWRkcmVzcywgc28gZXZlcnkgYmFkZ2UgbGluawphbmQgUVIgY29kZSBhbHJlYWR5IGluIGNpcmN1bGF0aW9uIHN1cnZpdmVzIGFuIHVwZ3JhZGUuAAAAAAd1cGdyYWRlAAAAAAEAAAAAAAAADW5ld193YXNtX2hhc2gAAAAAAAPuAAAAIAAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAVBSZXF1ZXN0cyBUVEwgZXh0ZW5zaW9ucyBmb3IgYSBib3VuZGVkIHNsaWNlIG9mIHJlZ2lzdHJ5IHN0b3JhZ2UuCgpVbmxpa2UgdGhlIGV4cGxvcmVyJ3Mgc2ltdWxhdGlvbi1vbmx5IHJlYWRzLCB0aGlzIGNhbGwgbXVzdCBiZSBzaWduZWQKYW5kIHN1Ym1pdHRlZCB0byBwZXJzaXN0IGl0cyBleHRlbnNpb25zLiBJdCByZXF1aXJlcyBubyByZWdpc3RyeSByb2xlOgphIGRlZGljYXRlZCwgZnVuZGVkIGtlZXBlciBhY2NvdW50IGNhbiBwYXkgdGhlIHNtYWxsIG5ldHdvcmsgZmVlLiBDYWxsCnJlcGVhdGVkbHkgd2l0aCB0aGUgcmV0dXJuZWQgY3Vyc29ycyB1bnRpbCBgZG9uZWAgaXMgdHJ1ZS4AAAAJa2VlcGFsaXZlAAAAAAAAAwAAAAAAAAANZW50aXR5X2N1cnNvcgAAAAAAAAYAAAAAAAAADGNsYWltX2N1cnNvcgAAAAYAAAAAAAAABWxpbWl0AAAAAAAABAAAAAEAAAPpAAAH0AAAAA9LZWVwYWxpdmVSZXN1bHQAAAAAAw==",
        "AAAAAAAAAPBSZWNvcmRzIGFuIHVwaGVsZCBjb21wbGFpbnQuCgpTdHJpa2VzIGFyZSB0aGUgcmVwdXRhdGlvbiBjb2xsYXRlcmFsIHRoYXQgcmVwbGFjZXMgYSBjYXNoIHN0YWtlIGluIHRoZQpNVlA6IHRoZXkgYXJlIHB1YmxpYywgdGhleSBhY2N1bXVsYXRlLCBhbmQgZW5vdWdoIG9mIHRoZW0ganVzdGlmeSBhCnJldm9jYXRpb24uIERlY2lkaW5nICpob3cgbWFueSogaXMgZW5vdWdoIGlzIGFuIG9mZi1jaGFpbiBwb2xpY3kgY2FsbC4AAAAKYWRkX3N0cmlrZQAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPpAAAABAAAAAM=",
        "AAAAAAAAAAAAAAAKZ2V0X2VudGl0eQAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6AAAB9AAAAAGRW50aXR5AAA=",
        "AAAAAAAAAKhFbWVyZ2VuY3kgc3RvcC4gQmxvY2tzIG5ldyByZWdpc3RyYXRpb25zIGFuZCBuZXcgY2xhaW1zOyByZWFkcywgc3RhdHVzCmNoYW5nZXMgYW5kIHJldm9jYXRpb25zIGtlZXAgd29ya2luZywgYmVjYXVzZSBwYXVzaW5nIG11c3QgbmV2ZXIgcHJldmVudAp0YWtpbmcgYSBiYWQgYmFkZ2UgZG93bi4AAAAKc2V0X3BhdXNlZAAAAAAAAQAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAERbYFNlbGY6OmNoZWNrYF0gYnkgaWQsIGZvciBjYWxsZXJzIHRoYXQgYWxyZWFkeSByZXNvbHZlZCB0aGUgaGFuZGxlLgAAAAtjaGVja19ieV9pZAAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPoAAAH0AAAAAVDaGVjawAAAA==",
        "AAAAAAAAAAAAAAALY2xhaW1fY291bnQAAAAAAAAAAAEAAAAG",
        "AAAAAAAAAAAAAAALZ2V0X21hbmRhdGUAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6AAAB9AAAAAHTWFuZGF0ZQA=",
        "AAAAAAAAAAAAAAALc2V0X2FyYml0ZXIAAAAAAQAAAAAAAAAHYXJiaXRlcgAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAD1TdGVwIHR3byBvZiB0aGUgYWRtaW4gaGFuZG92ZXIsIGNhbGxlZCBieSB0aGUgcHJvcG9zZWQgYWRtaW4uAAAAAAAADGFjY2VwdF9hZG1pbgAAAAAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAMZW50aXR5X2NvdW50AAAAAAAAAAEAAAAG",
        "AAAAAAAAAJJFeHRlbmRzIGEgYmFkZ2UgYWZ0ZXIgcmUtdmVyaWZpY2F0aW9uIGJ5IGl0cyBmaXhlZCBpc3N1ZXIuIEFsc28gY2xlYXJzIGEKc3VzcGVuc2lvbiwgc2luY2UgcmUtdmVyaWZpY2F0aW9uIGlzIGV4YWN0bHkgdGhlIHRoaW5nIHRoYXQgcmVzb2x2ZXMgb25lLgAAAAAADHJlbmV3X2VudGl0eQAAAAIAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAALZTZXRzIHRoZSBpc3N1aW5nIGF1dGhvcml0eSBhbmQgdGhlIGNvbXBsYWludCBhcmJpdGVyIGF0IGRlcGxveSB0aW1lLgoKUGFzc2luZyB0aGUgc2FtZSBhZGRyZXNzIGZvciBib3RoIGlzIGZpbmUgZm9yIHRoZSBmb3VuZGluZyBjb2hvcnQ7CnNwbGl0dGluZyB0aGVtIGxhdGVyIGlzIGEgYHNldF9hcmJpdGVyYCBjYWxsLgAAAAAADV9fY29uc3RydWN0b3IAAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAB2FyYml0ZXIAAAAAEwAAAAA=",
        "AAAAAAAAAEJBY2NlcHRzIGEgcGVuZGluZyBiYWRnZSBhbmQgYXRvbWljYWxseSBtYWtlcyBpdCBhIHZlcmlmaWVkIGVudGl0eS4AAAAAAA1hY2NlcHRfZW50aXR5AAAAAAAAAQAAAAAAAAAKcGVuZGluZ19pZAAAAAAABgAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAkMiTWF5IHRoaXMgcGVyc29uIGFjdCBmb3IgdGhhdCBjb21wYW55LCByaWdodCBub3c/IgoKVGhlIHF1ZXN0aW9uIGEgY2FuZGlkYXRlIGJlaW5nIGNvbGQtRE1lZCBhY3R1YWxseSBoYXMuIFRoaXMgZGVsaWJlcmF0ZWx5Cm1lYW5zICpjb21wYW55LSBvciBpc3N1ZXItY29uZmlybWVkKjogYSByZXByZXNlbnRhdGl2ZSdzIHNlbGYtYXNzZXJ0ZWQKdm91Y2ggaXMgdXNlZnVsIGV2aWRlbmNlLCBidXQgaXQgaXMgbm90IGFuIGF1dGhvcmlzYXRpb24gZnJvbSB0aGUgbmFtZWQKY29tcGFueS4gVGhlIHByaW1hcnkgc2NhbiBpcyBhIGJvdW5kZWQsIHJlbGV2YW50LWNvbmZpcm1hdGlvbiBpbmRleAp3aGljaCBhIHJlcHJlc2VudGF0aXZlJ3Mgc2VsZi1hc3NlcnRpb25zIGNhbm5vdCBmaWxsLiBJdCBwcnVuZXMKaW5hY3RpdmUgYW5kIGV4cGlyZWQgbWFuZGF0ZXMgYnV0IG5ldmVyIGV2aWN0cyBhIGxpdmUgb3Igc2NoZWR1bGVkIG9uZS4KQSBzaGFyZWQgc2NhbiBidWRnZXQga2VlcHMgdGhlIGNvbmZpcm1lZCBpbmRleCBhbmQgbGVnYWN5IGZhbGxiYWNrcwpiZWxvdyBTdGVsbGFyJ3MgbGVkZ2VyLWZvb3RwcmludCBsaW1pdC4AAAAADWlzX2F1dGhvcmlzZWQAAAAAAAACAAAAAAAAAANvcmcAAAAABgAAAAAAAAAOcmVwcmVzZW50YXRpdmUAAAAAAAYAAAABAAAAAQ==",
        "AAAAAAAAAb1BdXRob3Jpc2VzIGEgcmVwcmVzZW50YXRpdmUgdG8gYWN0IGZvciBhbiBvcmdhbmlzYXRpb24sIGZvciBhIHNjb3BlIGFuZAphIGZpeGVkIHdpbmRvdy4KClRoaXMgaXMgdGhlIGNsYWltIGEgY2FuZGlkYXRlIGFjdHVhbGx5IG5lZWRzIHRvIGNoZWNrOiBub3QgImlzIHRoaXMKcGVyc29uIHJlYWwiIGJ1dCAiaXMgdGhpcyBwZXJzb24gYWxsb3dlZCB0byBiZSByZWNydWl0aW5nIGZvciB0aGF0CmNvbXBhbnkgdG9kYXkiLiBNYW5kYXRlcyBhcmUgYWx3YXlzIHRpbWUtYm91bmQ7IGB2YWxpZF91bnRpbGAgY2Fubm90IGJlCnplcm8uCgpgcmVsYXRpb25zaGlwYCBvcHRpb25hbGx5IHRpZXMgdGhlIG1hbmRhdGUgdG8gdGhlIGFmZmlsaWF0aW9uIGl0IHJlc3RzCm9uLiBXaGVuIGdpdmVuLCBpdCBtdXN0IGJlIGEgcmVsYXRpb25zaGlwIGJldHdlZW4gdGhlIHNhbWUgdHdvIHBhcnRpZXMuAAAAAAAADWlzc3VlX21hbmRhdGUAAAAAAAAKAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAA29yZwAAAAAGAAAAAAAAAA5yZXByZXNlbnRhdGl2ZQAAAAAABgAAAAAAAAAMcmVsYXRpb25zaGlwAAAABgAAAAAAAAAMbWFuZGF0ZV90eXBlAAAH0AAAAAtNYW5kYXRlVHlwZQAAAAAAAAAABXNjb3BlAAAAAAAAEAAAAAAAAAAJdGVycml0b3J5AAAAAAAAEAAAAAAAAAAKdmFsaWRfZnJvbQAAAAAABgAAAAAAAAALdmFsaWRfdW50aWwAAAAABgAAAAAAAAALZGV0YWlsX2hhc2gAAAAD7gAAACAAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAHxTdGVwIG9uZSBvZiB0aGUgYWRtaW4gaGFuZG92ZXIuIFRoZSBuZXcgYWRtaW4gaXMgbm90IGxpdmUgdW50aWwgaXQgY2FsbHMKYGFjY2VwdF9hZG1pbmAsIHNvIGEgdHlwbyBjYW5ub3QgbG9jayB0aGUgcmVnaXN0cnkuAAAADXByb3Bvc2VfYWRtaW4AAAAAAAABAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAACdBIG1hbmRhdGUncyBzdGF0dXMgd2l0aCBleHBpcnkgYXBwbGllZC4AAAAADm1hbmRhdGVfc3RhdHVzAAAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPoAAAH0AAAAAtDbGFpbVN0YXR1cwA=",
        "AAAAAAAAATlPZmZlcnMgYSB2ZXR0ZWQgYmFkZ2UgdG8gYSBjb250cm9sbGVyIHdpdGhvdXQgYWN0aXZhdGluZyBpdC4KClRoaXMgaXMgdGhlIHByZWZlcnJlZCBvbmJvYXJkaW5nIHBhdGg6IHRoZSBpc3N1ZXIgY29tcGxldGVzIGl0cyBtYW51YWwKY2hlY2tzLCBjb21taXRzIHRoZSBleGFjdCBjcmVkZW50aWFsIGFuZCB0ZXJtcyBoYXNoZXMsIGFuZCByZXNlcnZlcyB0aGUKaGFuZGxlLiBUaGUgY29udHJvbGxlciBiZWNvbWVzIHZlcmlmaWVkIG9ubHkgYWZ0ZXIgaW5kZXBlbmRlbnRseQpjYWxsaW5nIGBhY2NlcHRfZW50aXR5YCBiZWZvcmUgYGFjY2VwdF9ieWAuAAAAAAAADnByb3Bvc2VfZW50aXR5AAAAAAALAAAAAAAAAARraW5kAAAH0AAAAApFbnRpdHlLaW5kAAAAAAAAAAAACmNvbnRyb2xsZXIAAAAAABMAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAAAAAAMZGlzcGxheV9uYW1lAAAAEAAAAAAAAAAGZG9tYWluAAAAAAAQAAAAAAAAAAxqdXJpc2RpY3Rpb24AAAAQAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAAAAAAADG1ldGFkYXRhX3VyaQAAABAAAAAAAAAACnRlcm1zX2hhc2gAAAAAA+4AAAAgAAAAAAAAAAlhY2NlcHRfYnkAAAAAAAAGAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAQdSZWNvcmRzIHRoYXQgYW4gb3JnYW5pc2F0aW9uIG9yIGEgcGVyc29uIHBhc3NlZCBtYW51YWwgdmVyaWZpY2F0aW9uLgoKQWRtaW4tb25seTogaW4gcGhhc2UgMSBldmVyeSBiYWRnZSBpcyBpc3N1ZWQgYnkgaGFuZCwgYW5kIHRoaXMgY2FsbCBpcwp0aGUgbGFzdCBzdGVwIG9mIHRoYXQgY2hlY2tsaXN0LiBCYWRnZXMgbXVzdCBiZSB0aW1lLWJvdW5kIGFuZCByZW5ld2VkOwpwZXJtYW5lbnQgdHJ1c3QgaXMgZGVsaWJlcmF0ZWx5IG5vdCByZXByZXNlbnRhYmxlLgAAAAAPcmVnaXN0ZXJfZW50aXR5AAAAAAkAAAAAAAAABGtpbmQAAAfQAAAACkVudGl0eUtpbmQAAAAAAAAAAAAKY29udHJvbGxlcgAAAAAAEwAAAAAAAAAGaGFuZGxlAAAAAAAQAAAAAAAAAAxkaXNwbGF5X25hbWUAAAAQAAAAAAAAAAZkb21haW4AAAAAABAAAAAAAAAADGp1cmlzZGljdGlvbgAAABAAAAAAAAAADW1ldGFkYXRhX2hhc2gAAAAAAAPuAAAAIAAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAEAAAPpAAAABgAAAAM=",
        "AAAAAAAAAWlSZXBvaW50cyBhbiBlbnRpdHkgYXQgYSBuZXcgb2ZmLWNoYWluIGNyZWRlbnRpYWwuCgpJc3N1ZXItb25seS4gYG1ldGFkYXRhX2hhc2hgIGFuY2hvcnMgdGhlIGNyZWRlbnRpYWwgdGhlIGlzc3VlciB2ZXR0ZWQ7CmFsbG93aW5nIHRoZSBzdWJqZWN0IHRvIHJlcGxhY2UgaXQgd291bGQgbGV0IHRoZW0gc3Vic3RpdHV0ZSBhIG5ldwppZGVudGl0eSB3aGlsZSB0aGUgcGFnZSBjb250aW51ZWQgdG8gZGlzcGxheSB0aGUgb3JpZ2luYWwgaXNzdWVyLgpTdWJqZWN0LW93bmVkIHByb2ZpbGUgZGF0YSBiZWxvbmdzIGluIGEgc2VwYXJhdGUsIGV4cGxpY2l0bHkgdW52ZXJpZmllZApkb2N1bWVudCBhdCB0aGUgYXBwbGljYXRpb24gbGF5ZXIuAAAAAAAAD3VwZGF0ZV9tZXRhZGF0YQAAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAAAAAAADG1ldGFkYXRhX3VyaQAAABAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAKFDbG9zZXMgYSByZWxhdGlvbnNoaXAgd2l0aCBhbiBlbmQgZGF0ZSwgd2l0aG91dCBkZWxldGluZyBpdC4KCkhpc3RvcnkgaXMgdGhlIHBvaW50OiAibGVmdCBpbiBNYXJjaCIgaXMgYSBkaWZmZXJlbnQgYW5kIG1vcmUgdXNlZnVsCmFuc3dlciB0aGFuICJubyByZWNvcmQgZm91bmQiLgAAAAAAABBlbmRfcmVsYXRpb25zaGlwAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAIZW5kX2RhdGUAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAQZ2V0X3JlbGF0aW9uc2hpcAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+gAAAfQAAAADFJlbGF0aW9uc2hpcA==",
        "AAAAAAAAAAAAAAAQbWFuZGF0ZXNfaGVsZF9ieQAAAAEAAAAAAAAADnJlcHJlc2VudGF0aXZlAAAAAAAGAAAAAQAAA+oAAAAG",
        "AAAAAAAAANNDb21wbGV0ZXMgYSByZWNvdmVyeSBhZnRlciB0aGUgaXNzdWVyIGFwcHJvdmVkIHRoaXMgZXhhY3QgZGVzdGluYXRpb24KYW5kIHRoYXQgZGVzdGluYXRpb24gZXhwbGljaXRseSBhY2NlcHRzIGl0LiBVbmlxdWVuZXNzIGlzIGNoZWNrZWQgYWdhaW4KYXQgYWNjZXB0YW5jZSB0aW1lIHNvIGEgc3RhbGUgcHJvcG9zYWwgY2Fubm90IG92ZXJ3cml0ZSBhIGtleSBpbiB1c2UuAAAAABFhY2NlcHRfY29udHJvbGxlcgAAAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAATtCYWNrd2FyZHMtY29tcGF0aWJsZSBhdG9taWMgcm90YXRpb24gZm9yIHJlY292ZXJ5IHRvb2xpbmcuCgpUaGUgYmFkZ2UncyBmaXhlZCBpc3N1ZXIsIGN1cnJlbnQgY29udHJvbGxlciBhbmQgZGVzdGluYXRpb24gY29udHJvbGxlcgptdXN0IGFsbCBjb25zZW50LgpUaGUgaXNzdWVyIGNhbiB0aGVyZWZvcmUgaGVscCBjb29yZGluYXRlIHJlY292ZXJ5IGJ1dCBjYW5ub3QgbW92ZSBhCnNvdWxib3VuZCBiYWRnZSBvbiBpdHMgb3duLiBOZXcgaW50ZWdyYXRpb25zIHNob3VsZCBwcmVmZXIgdGhlCnByb3Bvc2UvYXBwcm92ZS9hY2NlcHQgZmxvdyBhYm92ZS4AAAAAEXJvdGF0ZV9jb250cm9sbGVyAAAAAAAAAgAAAAAAAAACaWQAAAAAAAYAAAAAAAAADm5ld19jb250cm9sbGVyAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAVhTdXNwZW5kcywgcmV2b2tlcyBvciByZWluc3RhdGVzIGEgYmFkZ2UuIFRoZSBzdG9yZWQgaXNzdWVyIG93bnMgcGVybWFuZW50CmxpZmVjeWNsZSBkZWNpc2lvbnM7IHRoZSBnbG9iYWwgYXJiaXRlciBtYXkgcGxhY2UgYW5kIGxpZnQgaXRzIG93biBob2xkLgoKYFJldm9rZWRgIGlzIHRlcm1pbmFsIOKAlCBhIHJldm9rZWQgYmFkZ2UgY2Fubm90IGNvbWUgYmFjaywgYmVjYXVzZSBhCnJlYWRlciB3aG8gc2F3ICJyZXZva2VkIiBtdXN0IG5ldmVyIGJlIGNvbnRyYWRpY3RlZCBsYXRlci4gUmUtYWRtaXR0aW5nCnNvbWVvbmUgbWVhbnMgaXNzdWluZyBhIG5ldyBlbnRpdHkgdW5kZXIgYSBuZXcgaGFuZGxlLgAAABFzZXRfZW50aXR5X3N0YXR1cwAAAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAACaWQAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxFbnRpdHlTdGF0dXMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAASZ2V0X3BlbmRpbmdfZW50aXR5AAAAAAABAAAAAAAAAApwZW5kaW5nX2lkAAAAAAAGAAAAAQAAA+gAAAfQAAAADVBlbmRpbmdFbnRpdHkAAAA=",
        "AAAAAAAAAAAAAAASbWFuZGF0ZXNfaXNzdWVkX2J5AAAAAAABAAAAAAAAAANvcmcAAAAABgAAAAEAAAPqAAAABg==",
        "AAAAAAAAAMNTdGFydHMgYW4gaXNzdWVyLXJldmlld2VkIGNvbnRyb2xsZXIgcmVjb3ZlcnkuIE9ubHkgdGhlIGN1cnJlbnQKY29udHJvbGxlciBtYXkgbm9taW5hdGUgYSBkZXN0aW5hdGlvbi4gQW55IHByZXZpb3VzIGlzc3VlciBhcHByb3ZhbCBpcwpjbGVhcmVkLCBzbyBhcHByb3ZhbCBpcyBhbHdheXMgYm91bmQgdG8gdGhpcyBleGFjdCBwcm9wb3NhbC4AAAAAEnByb3Bvc2VfY29udHJvbGxlcgAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAObmV3X2NvbnRyb2xsZXIAAAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAL5DaGFuZ2VzIGEgbWFuZGF0ZSdzIHN0YXRlIOKAlCB0aGUgcmV2b2NhdGlvbiBwYXRoIHRoYXQgbWFrZXMgdGhlIGJhZGdlCndvcnRoIGFueXRoaW5nLiBBIHdpdGhkcmF3biBtYW5kYXRlIHN0b3BzIHZlcmlmeWluZyB0aGUgbW9tZW50IHRoZQp0cmFuc2FjdGlvbiBsYW5kcywgZXZlcnl3aGVyZSB0aGUgYmFkZ2UgaXMgZW1iZWRkZWQuAAAAAAASc2V0X21hbmRhdGVfc3RhdHVzAAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAALQ2xhaW1TdGF0dXMAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAMFGbGlwcyB3aGV0aGVyIHRoZSBvZmZpY2lhbCB2ZXJpZmllciBtYXkgcmVuZGVyIHRoaXMgcmVsYXRpb25zaGlwLgpTb3JvYmFuIHN0b3JhZ2UgcmVtYWlucyBwdWJsaWNseSByZWFkYWJsZSBlaXRoZXIgd2F5OyB0aGlzIGlzIGRpc3BsYXkKY29uc2VudCwgbm90IGFuIGVyYXN1cmUgb3IgYW4gb24tY2hhaW4gcHJpdmFjeSBtZWNoYW5pc20uAAAAAAAAEnNldF9wdWJsaWNfZGlzcGxheQAAAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAOcHVibGljX2Rpc3BsYXkAAAAAAAEAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAfpBdHRlc3RzIHRoYXQgYSBwZXJzb24gaXMsIG9yIHdhcywgYWZmaWxpYXRlZCB3aXRoIGFuIG9yZ2FuaXNhdGlvbi4KCmBjYWxsZXJgIGRlY2lkZXMgaG93IG11Y2ggdGhlIGNsYWltIGlzIHdvcnRoLCBhbmQgdGhlIGNvbnRyYWN0IHN0YW1wcyBpdAphY2NvcmRpbmdseToKCiogdGhlIG9yZ2FuaXNhdGlvbidzIGNvbnRyb2xsZXIgLT4gW2BDb25maXJtYXRpb246OkNvdW50ZXJwYXJ0eUNvbmZpcm1lZGBdCiogdGhlIHBlcnNvbidzIG93biBjb250cm9sbGVyICAgLT4gW2BDb25maXJtYXRpb246OlNlbGZBc3NlcnRlZGBdCiogdGhlIGFkbWluICAgICAgICAgICAgICAgICAgICAgLT4gW2BDb25maXJtYXRpb246Oklzc3VlckNvbmZpcm1lZGBdCgpBIHJlY3J1aXRlciBjYW4gdGhlcmVmb3JlIGxpc3Qgd2hlcmUgdGhleSB3b3JrIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhlCmNvbXBhbnksIGFuZCBhIHJlYWRlciBjYW4gc3RpbGwgc2VlIG5vYm9keSBidXQgdGhlIHJlY3J1aXRlciBzYWlkIHNvLgAAAAAAE2F0dGVzdF9yZWxhdGlvbnNoaXAAAAAACgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAANvcmcAAAAABgAAAAAAAAAGcGVyc29uAAAAAAAGAAAAAAAAAAhyZWxfdHlwZQAAB9AAAAAQUmVsYXRpb25zaGlwVHlwZQAAAAAAAAAEcm9sZQAAABAAAAAAAAAACmRlcGFydG1lbnQAAAAAABAAAAAAAAAACnN0YXJ0X2RhdGUAAAAAAAYAAAAAAAAACGVuZF9kYXRlAAAABgAAAAAAAAAOcHVibGljX2Rpc3BsYXkAAAAAAAEAAAAAAAAAC2RldGFpbF9oYXNoAAAAA+4AAAAgAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAIJBIHJlbGF0aW9uc2hpcCdzIHN0YXR1cyB3aXRoIGV4cGlyeSBhcHBsaWVkIOKAlCBgZW5kX2RhdGVgIGNvdW50cyBhcyB0aGUKZXhwaXJ5LCBzbyBhIGZpbmlzaGVkIGVuZ2FnZW1lbnQgbmV2ZXIgcmVhZHMgYXMgYEFjdGl2ZWAuAAAAAAATcmVsYXRpb25zaGlwX3N0YXR1cwAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPoAAAH0AAAAAtDbGFpbVN0YXR1cwA=",
        "AAAAAAAAAAAAAAATcmVsYXRpb25zaGlwc19hYm91dAAAAAABAAAAAAAAAAZwZXJzb24AAAAAAAYAAAABAAAD6gAAAAY=",
        "AAAAAAAAAAAAAAAUZ2V0X2VudGl0eV9ieV9oYW5kbGUAAAABAAAAAAAAAAZoYW5kbGUAAAAAABAAAAABAAAD6AAAB9AAAAAGRW50aXR5AAA=",
        "AAAAAAAAAMFDYW5jZWxzIGEgcGVuZGluZyBiYWRnZS4gVGhlIGlzc3VlciBvciBpbnRlbmRlZCBjb250cm9sbGVyIG1heSBjYW5jZWwKYXQgYW55IHRpbWU7IGFmdGVyIHRoZSBhY2NlcHRhbmNlIGRlYWRsaW5lIG9yIGJhZGdlIGV4cGlyeSBhbnkKYXV0aGVudGljYXRlZCBjYWxsZXIgbWF5IHJlbGVhc2UgdGhlIGFiYW5kb25lZCByZXNlcnZhdGlvbnMuAAAAAAAAFmNhbmNlbF9lbnRpdHlfcHJvcG9zYWwAAAAAAAIAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAAKcGVuZGluZ19pZAAAAAAABgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAF9QdWJsaWMgcmVjb3Zlcnkgc3RhdGUgZm9yIHdhbGxldHMgYW5kIG9wZXJhdG9ycyBjb29yZGluYXRpbmcgdGhlIHRocmVlCmFzeW5jaHJvbm91cyBzaWduYXR1cmVzLgAAAAAWZ2V0X3BlbmRpbmdfY29udHJvbGxlcgAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6AAAABM=",
        "AAAAAAAAAEJSZXR1cm5zIHRoZSBleGFjdCBwZW5kaW5nIGRlc3RpbmF0aW9uIHRoZSBpc3N1ZXIgYXBwcm92ZWQsIGlmIGFueS4AAAAAABdnZXRfYXBwcm92ZWRfY29udHJvbGxlcgAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAOdDaGFuZ2VzIGEgcmVsYXRpb25zaGlwJ3Mgc3RhdGUuCgpUaGUgc3ViamVjdCBjYW4gYWx3YXlzIHNldCBgV2l0aGRyYXduYCBvbiBhIGNsYWltIGFib3V0IHRoZW1zZWx2ZXMuIFRoYXQKaXMgdGhlIG9uLWNoYWluIGZvcm0gb2YgdGhlIHJpZ2h0IHRvIG9iamVjdDogYW4gb3JnYW5pc2F0aW9uIGNhbm5vdCBwaW4KYSBwdWJsaWMgc3RhdGVtZW50IGFib3V0IGEgcGVyc29uIGFnYWluc3QgdGhlaXIgd2lsbC4AAAAAF3NldF9yZWxhdGlvbnNoaXBfc3RhdHVzAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAACaWQAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtDbGFpbVN0YXR1cwAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAYZ2V0X2VudGl0eV9ieV9jb250cm9sbGVyAAAAAQAAAAAAAAAKY29udHJvbGxlcgAAAAAAEwAAAAEAAAPoAAAH0AAAAAZFbnRpdHkAAA==",
        "AAAAAAAAAAAAAAAZcmVsYXRpb25zaGlwc19hdHRlc3RlZF9ieQAAAAAAAAEAAAAAAAAAA29yZwAAAAAGAAAAAQAAA+oAAAAG",
        "AAAAAAAAAItDYW5jZWxzIGFuIHVuYWNjZXB0ZWQgcmVjb3ZlcnkuIFRoZSBjdXJyZW50IGNvbnRyb2xsZXIgb3IgaXNzdWVyIG1heQpjYW5jZWw7IHRoZSBjdXJyZW50IGNvbnRyb2xsZXIgcmVtYWlucyBpbiBjb250cm9sIHRocm91Z2hvdXQgdGhlIGZsb3cuAAAAABpjYW5jZWxfY29udHJvbGxlcl9yb3RhdGlvbgAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAANhUaGUgaXNzdWVyIGFwcHJvdmVzIHRoZSBleGFjdCBwZW5kaW5nIGRlc3RpbmF0aW9uIGFmdGVyIGNvbXBsZXRpbmcgaXRzCnJlY292ZXJ5L3JlLXZlcmlmaWNhdGlvbiBwb2xpY3kuIEEgcHJvcG9zYWwgd3JpdHRlbiBiZWZvcmUgdGhpcyBjb250cmFjdAp1cGdyYWRlIGhhcyBubyBhcHByb3ZhbCBlbnRyeSBhbmQgdGhlcmVmb3JlIGZhaWxzIGNsb3NlZCB1bnRpbCByZXZpZXdlZC4AAAAbYXBwcm92ZV9jb250cm9sbGVyX3JvdGF0aW9uAAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAgZ2V0X3BlbmRpbmdfZW50aXR5X2J5X2NvbnRyb2xsZXIAAAABAAAAAAAAAApjb250cm9sbGVyAAAAAAATAAAAAQAAA+gAAAfQAAAADVBlbmRpbmdFbnRpdHkAAAA=",
        "AAAAAQAAAM9UaGUgYW5zd2VyIHRvIHRoZSBvbmx5IHF1ZXN0aW9uIHRoZSB2ZXJpZmllciBwYWdlIHJlYWxseSBhc2tzOgoqaXMgdGhpcyBjb3VudGVycGFydHkgcmVhbCwgcmlnaHQgbm93PyoKClJldHVybmVkIGJ5IGEgc2luZ2xlIGNvbnRyYWN0IGNhbGwgc28gYSB3YWxsZXQtZnJlZSB2ZXJpZmllciBjYW4gcmVuZGVyIGEKcGFnZSBmcm9tIG9uZSBSUEMgcm91bmQgdHJpcC4AAAAAAAAAAAVDaGVjawAAAAAAAAYAAAAsTGVkZ2VyIHRpbWVzdGFtcCB0aGUgYW5zd2VyIHdhcyBjb21wdXRlZCBhdC4AAAAKY2hlY2tlZF9hdAAAAAAABgAAAERgZW50aXR5LnN0YXR1c2Agd2l0aCBleHBpcnkgYXBwbGllZC4gUmVhZCB0aGlzLCBub3QgYGVudGl0eS5zdGF0dXNgLgAAABBlZmZlY3RpdmVfc3RhdHVzAAAH0AAAAAxFbnRpdHlTdGF0dXMAAAAAAAAABmVudGl0eQAAAAAH0AAAAAZFbnRpdHkAAAAAAF1NYW5kYXRlcyB0aGlzIGVudGl0eSBpcyBhIHBhcnR5IHRvLiBPcmdhbmlzYXRpb25zOiBvbmVzIHRoZXkgaXNzdWVkLgpQZXJzb25zOiBvbmVzIHRoZXkgaG9sZC4AAAAAAAAIbWFuZGF0ZXMAAAAEAAAAZVJlbGF0aW9uc2hpcHMgdGhpcyBlbnRpdHkgaXMgYSBwYXJ0eSB0by4gT3JnYW5pc2F0aW9uczogb25lcyB0aGV5CmF0dGVzdGVkLiBQZXJzb25zOiBvbmVzIGFib3V0IHRoZW0uAAAAAAAADXJlbGF0aW9uc2hpcHMAAAAAAAAEAAAALFRydWUgb25seSB3aGVuIGBlZmZlY3RpdmVfc3RhdHVzID09IEFjdGl2ZWAuAAAABXZhbGlkAAAAAAAAAQ==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAHgAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAMAAAAAAAAABlBhdXNlZAAAAAAABAAAAAAAAAAORW50aXR5Tm90Rm91bmQAAAAAAAoAAAAAAAAAC0hhbmRsZVRha2VuAAAAAAsAAAAAAAAAD0NvbnRyb2xsZXJUYWtlbgAAAAAMAAAAAAAAAA1JbnZhbGlkSGFuZGxlAAAAAAAADQAAAAAAAAALVGV4dFRvb0xvbmcAAAAADgAAACxUaGUgZW50aXR5IGlzIHN1c3BlbmRlZCwgcmV2b2tlZCBvciBleHBpcmVkLgAAAA9FbnRpdHlOb3RBY3RpdmUAAAAADwAAAD9FeHBlY3RlZCBhbiBvcmdhbmlzYXRpb24sIGdvdCBhIHBlcnNvbiwgb3IgdGhlIG90aGVyIHdheSByb3VuZC4AAAAAD1dyb25nRW50aXR5S2luZAAAAAAQAAAAAAAAAA1DbGFpbU5vdEZvdW5kAAAAAAAAFAAAADxFbmQgZGF0ZSBiZWZvcmUgc3RhcnQgZGF0ZSwgb3IgYSBtYW5kYXRlIHdpdGggbm8gZW5kIGF0IGFsbC4AAAAQSW52YWxpZERhdGVSYW5nZQAAABUAAAAzVGhlIGNsYWltIGlzIG5vdCBpbiBhIHN0YXRlIHRoaXMgdHJhbnNpdGlvbiBhbGxvd3MuAAAAAA1JbnZhbGlkU3RhdHVzAAAAAAAAFgAAAENSZWZlcmVuY2VkIHJlbGF0aW9uc2hpcCBkb2VzIG5vdCBiZWxvbmcgdG8gdGhlIHNhbWUgb3JnIGFuZCBwZXJzb24uAAAAABRSZWxhdGlvbnNoaXBNaXNtYXRjaAAAABcAAAA7VHJ1c3QgYmFkZ2VzIG11c3QgZXhwaXJlIGFuZCBwYXNzIHBlcmlvZGljIHJlLXZlcmlmaWNhdGlvbi4AAAAADkV4cGlyeVJlcXVpcmVkAAAAAAAYAAAAPFRoZSByZXF1ZXN0ZWQgYmFkZ2UgbGlmZXRpbWUgZXhjZWVkcyBbYE1BWF9CQURHRV9MSUZFVElNRWBdLgAAAAxFeHBpcnlUb29GYXIAAAAZAAAARE5hdHVyYWwtcGVyc29uIGRlc2NyaXB0aXZlIGRhdGEgYmVsb25ncyBpbiB0aGUgb2ZmLWNoYWluIGNyZWRlbnRpYWwuAAAAFlBlcnNvbmFsRGF0YU5vdEFsbG93ZWQAAAAAABoAAABEQ3JlZGVudGlhbCBsb2NhdGlvbnMgbXVzdCBiZSBub24tZW1wdHkgYGh0dHBzOi8vYCBvciBgaXBmczovL2AgVVJJcy4AAAAKSW52YWxpZFVyaQAAAAAAGwAAAEhQdWJsaWMgdGV4dCBjb250YWlucyBhIGNvbnRyb2wgY2hhcmFjdGVyIHRoYXQgY2FuIHNwb29mIHZlcmlmaWVyIG91dHB1dC4AAAALSW52YWxpZFRleHQAAAAAHAAAAEZDcmVkZW50aWFsIGFuZCB0ZXJtcyBoYXNoZXMgbXVzdCBiZSByZWFsIGFuY2hvcnMsIG5vdCBhbGwtemVybyB2YWx1ZXMuAAAAAAALSW52YWxpZEhhc2gAAAAAHQAAAIFBIGNvbmZpcm1lZCBwYWlyIGFscmVhZHkgaGFzIFtgTUFYX0NPTkZJUk1FRF9QQUlSX0xFTmBdIGxpdmUgb3IKc2NoZWR1bGVkIG1hbmRhdGVzLiBHZW5lcmFsIGRpc2NvdmVyeSBpbmRleGVzIHJlbWFpbiBiZXN0LWVmZm9ydC4AAAAAAAAJSW5kZXhGdWxsAAAAAAAAHgAAAAAAAAAOTm9QZW5kaW5nQWRtaW4AAAAAAB8AAAAAAAAAE05vUGVuZGluZ0NvbnRyb2xsZXIAAAAAIAAAAAAAAAAVUGVuZGluZ0VudGl0eU5vdEZvdW5kAAAAAAAAIQAAAAAAAAAUUGVuZGluZ0VudGl0eUV4cGlyZWQAAAAiAAAAAAAAABdJbnZhbGlkQWNjZXB0YW5jZVdpbmRvdwAAAAAjAAAAAAAAABBJbnZhbGlkQmF0Y2hTaXplAAAAJAAAAGRUaGUgZGVzdGluYXRpb24gYXR0ZW1wdGVkIHRvIGFjY2VwdCBiZWZvcmUgdGhlIGlzc3VlciBhcHByb3ZlZCB0aGUgZXhhY3QKcGVuZGluZyBjb250cm9sbGVyIGFkZHJlc3MuAAAAHUNvbnRyb2xsZXJSb3RhdGlvbk5vdEFwcHJvdmVkAAAAAAAAJQAAADlBIG1hbmRhdGUgY2Fubm90IGF1dGhvcmlzZSBhbiBlbnRpdHkgdG8gcmVwcmVzZW50IGl0c2VsZi4AAAAAAAAKU2FtZUVudGl0eQAAAAAAJg==",
        "AAAAAQAAAUdBIHZldHRlZCBvcmdhbmlzYXRpb24gb3IgcGVyc29uLgoKVGhlIGJhZGdlIGlzIHNvdWxib3VuZDogYGNvbnRyb2xsZXJgIGlzIHNldCBhdCByZWdpc3RyYXRpb24gYW5kIHRoZXJlIGlzIG5vCmhvbGRlci1vbmx5IHRyYW5zZmVyIGZ1bmN0aW9uLiBBIGNvbnRyb2xsZXIgY2hhbmdlIHJlcXVpcmVzIHRoZSBjdXJyZW50CmNvbnRyb2xsZXIsIGlzc3VlciBhcHByb3ZhbCBhbmQgdGhlIGRlc3RpbmF0aW9uIGNvbnRyb2xsZXIsIHNvIHRoZSBob2xkZXIKYW5kIGRlc3RpbmF0aW9uIGNhbm5vdCBtb3ZlIHZlcmlmaWVkIHN0YXR1cyB3aXRob3V0IGlzc3VlciByZS1hcHByb3ZhbC4AAAAAAAAAAAZFbnRpdHkAAAAAAA4AAAA/VGhlIHdhbGxldCB0aGF0IGFjdHMgZm9yIHRoaXMgZW50aXR5LiBTb3VsYm91bmQgdG8gdGhlIHN1YmplY3QuAAAAAApjb250cm9sbGVyAAAAAAATAAAAk09yZ2FuaXNhdGlvbnM6IHJlZ2lzdGVyZWQgbGVnYWwgbmFtZS4gTmF0dXJhbCBwZXJzb25zOiBsZWF2ZSBlbXB0eSBhbmQKc2VydmUgdGhlIG5hbWUgZnJvbSB0aGUgb2ZmLWNoYWluIGNyZWRlbnRpYWwg4oCUIHNlZSBgZG9jcy9hcmNoaXRlY3R1cmUubWRgLgAAAAAMZGlzcGxheV9uYW1lAAAAEAAAAFVQcmltYXJ5IGRvbWFpbiwgdXNlZCBmb3IgdGhlIEROUyAvIGVtYWlsLWRvbWFpbiBjaGFsbGVuZ2UuIEVtcHR5IGZvcgpuYXR1cmFsIHBlcnNvbnMuAAAAAAAABmRvbWFpbgAAAAAAEAAAAEJVbml4IHNlY29uZHMuIEFsd2F5cyBub24temVybzsgdHJ1c3QgbXVzdCBiZSBwZXJpb2RpY2FsbHkgcmVuZXdlZC4AAAAAAApleHBpcmVzX2F0AAAAAAAGAAAALVVuaXF1ZSBwdWJsaWMgc2x1ZyB1c2VkIGJ5IHRoZSB2ZXJpZmllciBwYWdlLgAAAAAAAAZoYW5kbGUAAAAAABAAAAA4U2VxdWVudGlhbCBpZCwgYXNzaWduZWQgYnkgdGhlIGNvbnRyYWN0LiBTdGFibGUgZm9yZXZlci4AAAACaWQAAAAAAAYAAAC9VGhlIGFkZHJlc3MgdGhhdCBwZXJmb3JtZWQgdGhlIHZlcmlmaWNhdGlvbi4gVGhpcyBpcyB0aGUgYmFkZ2UncyBmaXhlZApsaWZlY3ljbGUgYXV0aG9yaXR5IGZvciBtZXRhZGF0YSwgcmVuZXdhbCwgcmV2b2NhdGlvbiBhbmQgcmVjb3Zlcnk7IGEKbGF0ZXIgZ2xvYmFsIGFkbWluIGhhbmRvdmVyIGRvZXMgbm90IHJld3JpdGUgaXQuAAAAAAAABmlzc3VlcgAAAAAAEwAAAEBGcmVlLXRleHQganVyaXNkaWN0aW9uLCBlLmcuICJHZXJtYW55Ii4gRW1wdHkgaWYgbm90IGFwcGxpY2FibGUuAAAADGp1cmlzZGljdGlvbgAAABAAAAAAAAAABGtpbmQAAAfQAAAACkVudGl0eUtpbmQAAAAAAJFTSEEtMjU2IG9mIHRoZSBjYW5vbmljYWwgb2ZmLWNoYWluIGNyZWRlbnRpYWwgSlNPTi4gTGV0cyBhbnkgcmVhZGVyCnByb3ZlIHRoZSBmZXRjaGVkIHByb2ZpbGUgbWF0Y2hlcyB0aGUgY29udGVudCB0aGUgaXNzdWVyIGFuY2hvcmVkIGFuZAp2ZXR0ZWQuAAAAAAAADW1ldGFkYXRhX2hhc2gAAAAAAAPuAAAAIAAAADRXaGVyZSB0aGF0IGNyZWRlbnRpYWwgaXMgc2VydmVkIGZyb20gKGh0dHBzIC8gaXBmcykuAAAADG1ldGFkYXRhX3VyaQAAABAAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAxFbnRpdHlTdGF0dXMAAABqQ291bnQgb2YgdXBoZWxkIGNvbXBsYWludHMuIFJlcHV0YXRpb24gY29sbGF0ZXJhbCBpbiBwbGFjZSBvZiBhIGNhc2gKc3Rha2Ug4oCUIHNlZSBgZG9jcy9hcmNoaXRlY3R1cmUubWRgLgAAAAAAB3N0cmlrZXMAAAAABAAAAAAAAAALdmVyaWZpZWRfYXQAAAAABg==",
        "AAAAAgAAAHtSZWNvcmRzIGxpdmUgaW4gcGVyc2lzdGVudCBzdG9yYWdlOyBjb25maWd1cmF0aW9uIGxpdmVzIGluIGluc3RhbmNlIHN0b3JhZ2UKc28gaXQgaXMgYnVtcGVkIGFsb25nIHdpdGggdGhlIGNvbnRyYWN0IGl0c2VsZi4AAAAAAAAAAAdEYXRhS2V5AAAAABkAAAAAAAAAhkN1cnJlbnQgYXV0aG9yaXR5IGZvciBuZXcgaXNzdWFuY2UsIGNvbmZpZ3VyYXRpb24gYW5kIHVwZ3JhZGVzLiBFeGlzdGluZwpiYWRnZXMga2VlcCB0aGVpciBvd24gaW1tdXRhYmxlIFtgRW50aXR5Ojppc3N1ZXJgXSBhdXRob3JpdHkuAAAAAAAFQWRtaW4AAAAAAAAAAAAAKFByb3Bvc2VkIGFkbWluIGluIHRoZSB0d28tc3RlcCBoYW5kb3Zlci4AAAAMUGVuZGluZ0FkbWluAAAAAQAAAKdDb250cm9sbGVyIHByb3Bvc2VkIGJ5IHRoZSBjdXJyZW50IGNvbnRyb2xsZXIgZm9yIGFuIGVudGl0eS4gVGhpcyBrZXkgaXMKcmV0YWluZWQgdW5jaGFuZ2VkIHNvIHByb3Bvc2FscyB3cml0dGVuIGJ5IGFuIG9sZGVyIGNvbnRyYWN0IHJlbWFpbgpyZWFkYWJsZSBhZnRlciBhbiB1cGdyYWRlLgAAAAARUGVuZGluZ0NvbnRyb2xsZXIAAAAAAAABAAAABgAAAAAAAABHQWRkcmVzcyBhbGxvd2VkIHRvIHJlY29yZCB0aGUgb3V0Y29tZSBvZiB0aGUgb2ZmLWNoYWluIGNvbXBsYWludCBxdWV1ZS4AAAAAB0FyYml0ZXIAAAAAAAAAADtFbWVyZ2VuY3kgc3RvcCBvbiBhbGwgd3JpdGVzIGV4Y2VwdCBhZG1pbi9hcmJpdGVyIHJlY292ZXJ5LgAAAAAGUGF1c2VkAAAAAAAAAAAAHE1vbm90b25pYyBlbnRpdHkgaWQgY291bnRlci4AAAALRW50aXR5Q291bnQAAAAAAAAAACZNb25vdG9uaWMgcGVuZGluZy1pc3N1YW5jZSBpZCBjb3VudGVyLgAAAAAAElBlbmRpbmdFbnRpdHlDb3VudAAAAAAAAAAAAEFNb25vdG9uaWMgY2xhaW0gaWQgY291bnRlciwgc2hhcmVkIGJ5IHJlbGF0aW9uc2hpcHMgYW5kIG1hbmRhdGVzLgAAAAAAAApDbGFpbUNvdW50AAAAAAABAAAADUVudGl0eSBieSBpZC4AAAAAAAAGRW50aXR5AAAAAAABAAAABgAAAAEAAAB/QWRkcmVzcyB0aGF0IGltcG9zZWQgdGhlIGN1cnJlbnQgZW50aXR5IHN1c3BlbnNpb24uIEFuIGFyYml0ZXIgbWF5IGxpZnQKaXRzIG93biBob2xkIGJ1dCBjYW5ub3QgdW5kbyBvbmUgaW1wb3NlZCBieSB0aGUgaXNzdWVyLgAAAAARRW50aXR5U3VzcGVuZGVkQnkAAAAAAAABAAAABgAAAAEAAAAwRW50aXR5IGlkIGJ5IGhhbmRsZS4gRW5mb3JjZXMgaGFuZGxlIHVuaXF1ZW5lc3MuAAAACUhhbmRsZUlkeAAAAAAAAAEAAAAQAAAAAQAAADxFbnRpdHkgaWQgYnkgY29udHJvbGxlciBhZGRyZXNzLiBFbmZvcmNlcyBvbmUgYmFkZ2UgcGVyIGtleS4AAAANQ29udHJvbGxlcklkeAAAAAAAAAEAAAATAAAAAQAAACBQZW5kaW5nIGlzc3VhbmNlIGJ5IHByb3Bvc2FsIGlkLgAAAA1QZW5kaW5nRW50aXR5AAAAAAAAAQAAAAYAAAABAAAAH1Byb3Bvc2FsIGlkIGJ5IHJlc2VydmVkIGhhbmRsZS4AAAAAEFBlbmRpbmdIYW5kbGVJZHgAAAABAAAAEAAAAAEAAAAjUHJvcG9zYWwgaWQgYnkgcmVzZXJ2ZWQgY29udHJvbGxlci4AAAAAFFBlbmRpbmdDb250cm9sbGVySWR4AAAAAQAAABMAAAABAAAAGVJlbGF0aW9uc2hpcCBieSBjbGFpbSBpZC4AAAAAAAAMUmVsYXRpb25zaGlwAAAAAQAAAAYAAAABAAAAFE1hbmRhdGUgYnkgY2xhaW0gaWQuAAAAB01hbmRhdGUAAAAAAQAAAAYAAAABAAAAOUNsYWltIGlkcyBvZiByZWxhdGlvbnNoaXBzIGF0dGVzdGVkIGJ5IHRoaXMgb3JnYW5pc2F0aW9uLgAAAAAAAAdPcmdSZWxzAAAAAAEAAAAGAAAAAQAAAC1DbGFpbSBpZHMgb2YgcmVsYXRpb25zaGlwcyBhYm91dCB0aGlzIHBlcnNvbi4AAAAAAAAKUGVyc29uUmVscwAAAAAAAQAAAAYAAAABAAAAMkNsYWltIGlkcyBvZiBtYW5kYXRlcyBpc3N1ZWQgYnkgdGhpcyBvcmdhbmlzYXRpb24uAAAAAAALT3JnTWFuZGF0ZXMAAAAAAQAAAAYAAAABAAAAMkNsYWltIGlkcyBvZiBtYW5kYXRlcyBoZWxkIGJ5IHRoaXMgcmVwcmVzZW50YXRpdmUuAAAAAAAOUGVyc29uTWFuZGF0ZXMAAAAAAAEAAAAGAAAAAQAAAMBDbGFpbSBpZHMgZm9yIG9uZSBvcmdhbmlzYXRpb24vcmVwcmVzZW50YXRpdmUgcGFpci4gVGhpcyBwcmV2ZW50cyBhbgp1bnJlbGF0ZWQgb3JnYW5pc2F0aW9uIGZyb20gY3Jvd2RpbmcgYSB2YWxpZCBwYWlyIG91dCBvZiB0aGUgYm91bmRlZApyZXByZXNlbnRhdGl2ZS13aWRlIGluZGV4IHJldGFpbmVkIGZvciBsZWdhY3kgcmVjb3Jkcy4AAAAMUGFpck1hbmRhdGVzAAAAAgAAAAYAAAAGAAAAAQAAAUNgKG9yZyBpZCwgcmVwcmVzZW50YXRpdmUgaWQpYCAtPiB0aGUgbW9zdCByZWNlbnRseSB3cml0dGVuIG1hbmRhdGUgaWQuCktlcHQgYXMgYSBmYXN0IGhpbnQgYW5kIGZvciBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eTsgc3RyaWN0CmBpc19hdXRob3Jpc2VkYCBzY2FucyB0aGUgcm9sbGluZyBjb25maXJtZWQtcGFpciBpbmRleCwgdGhlbiB0aGUgbGVnYWN5CmdlbmVyYWwgcGFpciBhbmQgcmVwcmVzZW50YXRpdmUgaW5kZXhlcywgc28gYSBuZXdlciBzY2hlZHVsZWQgb3IKc2VsZi1hc3NlcnRlZCBoaW50IGNhbm5vdCBtYXNrIG9sZGVyIGxpdmUgY29uZmlybWF0aW9uLgAAAAALTGl2ZU1hbmRhdGUAAAAAAgAAAAYAAAAGAAAAAQAAAM9EZXN0aW5hdGlvbiBjb250cm9sbGVyIHRoZSBpc3N1ZXIgYXBwcm92ZWQgZm9yIGEgcGVuZGluZyByb3RhdGlvbi4KU3RvcmVkIHNlcGFyYXRlbHkgZnJvbSBbYERhdGFLZXk6OlBlbmRpbmdDb250cm9sbGVyYF0gc28gdXBncmFkaW5nIHdpdGgKYW4gb2xkIHVuYXBwcm92ZWQgcHJvcG9zYWwgZmFpbHMgY2xvc2VkIHVudGlsIHRoZSBpc3N1ZXIgcmV2aWV3cyBpdC4AAAAAEkFwcHJvdmVkQ29udHJvbGxlcgAAAAAAAQAAAAYAAAABAAAA1FJlbGV2YW50IG9yZ2FuaXNhdGlvbi0gb3IgaXNzdWVyLWNvbmZpcm1lZCBtYW5kYXRlIGlkcyBmb3Igb25lIHBhaXIuCkluYWN0aXZlIGFuZCBleHBpcmVkIGVudHJpZXMgYXJlIHBydW5lZDsgbGl2ZSBhbmQgc2NoZWR1bGVkIGVudHJpZXMgYXJlCm5ldmVyIHNpbGVudGx5IGV2aWN0ZWQuIFNlbGYtYXNzZXJ0aW9ucyBuZXZlciBlbnRlciB0aGlzIGJvdW5kZWQgaW5kZXguAAAAFUNvbmZpcm1lZFBhaXJNYW5kYXRlcwAAAAAAAAIAAAAGAAAABg==",
        "AAAAAQAAAGdBbiBhdXRob3Jpc2F0aW9uIGZvciBhIHBlcnNvbiBvciBvcmdhbmlzYXRpb24vYWdlbmN5IHJlcHJlc2VudGF0aXZlIHRvIGFjdApvbiBhbiBvcmdhbmlzYXRpb24ncyBiZWhhbGYuAAAAAAAAAAAHTWFuZGF0ZQAAAAAOAAAAAAAAAAthdHRlc3RlZF9ieQAAAAATAAAAAAAAAAxjb25maXJtYXRpb24AAAfQAAAADENvbmZpcm1hdGlvbgAAAAAAAAAMY29uZmlybWVkX2F0AAAABgAAAAAAAAALZGV0YWlsX2hhc2gAAAAD7gAAACAAAABAU2VxdWVudGlhbCBjbGFpbSBpZCwgdW5pcXVlIGFjcm9zcyByZWxhdGlvbnNoaXBzICphbmQqIG1hbmRhdGVzLgAAAAJpZAAAAAAABgAAAAAAAAAMbWFuZGF0ZV90eXBlAAAH0AAAAAtNYW5kYXRlVHlwZQAAAAAAAAAAA29yZwAAAAAGAAAANlJlbGF0aW9uc2hpcCB0aGlzIG1hbmRhdGUgcmVzdHMgb24uIGAwYCBpZiBzdGFuZGFsb25lLgAAAAAADHJlbGF0aW9uc2hpcAAAAAYAAAAgRW50aXR5IGlkIG9mIHRoZSByZXByZXNlbnRhdGl2ZS4AAAAOcmVwcmVzZW50YXRpdmUAAAAAAAYAAABGV2hhdCB0aGV5IG1heSBkbywgZS5nLiAiRW5naW5lZXJpbmcgaGlyaW5nIGZvciB0aGUgcm9ib3RpY3MgZGl2aXNpb24iLgAAAAAABXNjb3BlAAAAAAAAEAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAC0NsYWltU3RhdHVzAAAAADhPcHRpb25hbCB0ZXJyaXRvcnkuIEVtcHR5IGlmIHdvcmxkd2lkZSAvIG5vdCBhcHBsaWNhYmxlLgAAAAl0ZXJyaXRvcnkAAAAAAAAQAAAAAAAAAAp2YWxpZF9mcm9tAAAAAAAGAAAAQ1VuaXggc2Vjb25kcy4gTWFuZGF0ZXMgYXJlIGFsd2F5cyB0aW1lLWJvdW5kLCBzbyB0aGlzIGlzIG5ldmVyIGAwYC4AAAAAC3ZhbGlkX3VudGlsAAAAAAY=",
        "AAAAAwAAADRXaGF0IGtpbmQgb2Ygc3ViamVjdCBhbiBbYEVudGl0eWBdIHJlY29yZCBkZXNjcmliZXMuAAAAAAAAAApFbnRpdHlLaW5kAAAAAAACAAAAKEEgY29tcGFueSwgYWdlbmN5IG9yIG90aGVyIGxlZ2FsIHBlcnNvbi4AAAAMT3JnYW5pc2F0aW9uAAAAAAAAAEdBIG5hdHVyYWwgcGVyc29uIOKAlCB0eXBpY2FsbHkgYSByZWNydWl0ZXIgb3IgYSBjb21wYW55IHJlcHJlc2VudGF0aXZlLgAAAAAGUGVyc29uAAAAAAAB",
        "AAAAAwAAAJxMaWZlY3ljbGUgc3RhdGUgb2YgYSByZWxhdGlvbnNoaXAgb3IgYSBtYW5kYXRlLgoKQXMgd2l0aCBbYEVudGl0eVN0YXR1c2BdLCBgRXhwaXJlZGAgaXMgZGVyaXZlZCBmcm9tIHRoZSBjbGFpbSdzIGVuZCBkYXRlIGF0CnJlYWQgdGltZSBhbmQgaXMgbmV2ZXIgd3JpdHRlbi4AAAAAAAAAC0NsYWltU3RhdHVzAAAAAAcAAAAAAAAABkFjdGl2ZQAAAAAAAAAAADlSYW4gaXRzIGNvdXJzZSDigJQgZW1wbG95bWVudCBlbmRlZCwgZW5nYWdlbWVudCBmaW5pc2hlZC4AAAAAAAAFRW5kZWQAAAAAAAABAAAAJUZyb3plbiBwZW5kaW5nIHJldmlldyBvZiBhIGNvbXBsYWludC4AAAAAAAAJU3VzcGVuZGVkAAAAAAAAAgAAADdQdWxsZWQgYnkgdGhlIGF0dGVzdGluZyBvcmdhbmlzYXRpb24gb3IgYnkgdGhlIHN1YmplY3QuAAAAAAlXaXRoZHJhd24AAAAAAAADAAAAMUEgY29tcGxhaW50IGhhcyBiZWVuIHJhaXNlZCBhbmQgbm90IHlldCByZXNvbHZlZC4AAAAAAAAIRGlzcHV0ZWQAAAAEAAAAH01hbmRhdGUgZGVsaXZlcmVkIHN1Y2Nlc3NmdWxseS4AAAAACUNvbXBsZXRlZAAAAAAAAAUAAAAbRGVyaXZlZCBvbmx5LiBOZXZlciBzdG9yZWQuAAAAAAdFeHBpcmVkAAAAAAY=",
        "AAAAAwAAAEdXaGF0IGEgcmVwcmVzZW50YXRpdmUgaXMgYXV0aG9yaXNlZCB0byBkbyBvbiB0aGUgb3JnYW5pc2F0aW9uJ3MgYmVoYWxmLgAAAAAAAAAAC01hbmRhdGVUeXBlAAAAAAkAAAAAAAAAC1JlY3J1aXRtZW50AAAAAAAAAAAAAAAABVNhbGVzAAAAAAAAAQAAAAAAAAAKQ29uc3VsdGluZwAAAAAAAgAAAAAAAAAOSW1wbGVtZW50YXRpb24AAAAAAAMAAAAAAAAADkNvbW11bmljYXRpb25zAAAAAAAEAAAAAAAAAAVMZWdhbAAAAAAAAAUAAAAAAAAACEFkdmlzb3J5AAAABgAAAAAAAAATRXZlbnRSZXByZXNlbnRhdGlvbgAAAAAHAAAAAAAAAAtQYXJ0bmVyc2hpcAAAAAAI",
        "AAAAAwAAARdXaG8gc3RhbmRzIGJlaGluZCBhIGNsYWltIOKAlCB0aGUgc2luZ2xlIG1vc3QgaW1wb3J0YW50IGZpZWxkIGZvciBhIHJlYWRlci4KClRoZSBzdHJhdGVneSBkb2N1bWVudCBwcm9wb3NlcyB0d28gYXR0ZXN0YXRpb24gdGllcnM6IGEgY2hlYXAgc2VsZi1hc3NlcnRlZApvbmUgYmFja2VkIG9ubHkgYnkgdGhlIHJlY3J1aXRlcidzIG93biByZXB1dGF0aW9uLCBhbmQgYSBwcmVtaXVtIG9uZSB0aGUKaGlyaW5nIGNvbXBhbnkgY29uZmlybXMuIEJvdGggYXJlIHJlcHJlc2VudGFibGUgaGVyZS4AAAAAAAAAAAxDb25maXJtYXRpb24AAAADAAAAcVRoZSByZXByZXNlbnRhdGl2ZSBhc3NlcnRlZCB0aGlzIHRoZW1zZWx2ZXMuIEJhY2tlZCBieSB0aGVpciBiYWRnZSwgbm90CmJ5IHRoZSBvcmdhbmlzYXRpb24uIENoZWFwLCBmYXN0LCB3ZWFrZXIuAAAAAAAADFNlbGZBc3NlcnRlZAAAAAAAAABdVGhlIG9yZ2FuaXNhdGlvbidzIG93biBjb250cm9sbGVyIGtleSBzaWduZWQgdGhlIHdyaXRlLiBUaGlzIGlzIHRoZQoiY29tcGFueS1jb25maXJtZWQiIHRpZXIuAAAAAAAAFUNvdW50ZXJwYXJ0eUNvbmZpcm1lZAAAAAAAAAEAAACcVGhlIGlzc3VlciByZWNvcmRlZCBpdCBhZnRlciBhbiBvdXQtb2YtYmFuZCBjaGVjayAoRE5TIHJlY29yZCwKZW1haWwtZG9tYWluIGNoYWxsZW5nZSwgbGlnaHQgS1lCKSBvbiBiZWhhbGYgb2YgYW4gb3JnYW5pc2F0aW9uIHRoYXQKaG9sZHMgbm8ga2V5IG9mIGl0cyBvd24uAAAAD0lzc3VlckNvbmZpcm1lZAAAAAAC",
        "AAAAAwAAAOBMaWZlY3ljbGUgc3RhdGUgb2YgYW4gZW50aXR5J3MgdmVyaWZpZWQgc3RhdHVzLgoKYEV4cGlyZWRgIGlzIG5ldmVyIHdyaXR0ZW4gdG8gc3RvcmFnZTogaXQgaXMgZGVyaXZlZCBmcm9tIGBleHBpcmVzX2F0YCBhdApyZWFkIHRpbWUsIHNvIGJhZGdlcyBhZ2Ugb3V0IHdpdGhvdXQgYSBjcm9uIGpvYi4gUmVhZHMgZ28gdGhyb3VnaApbYGNyYXRlOjplZmZlY3RpdmVfZW50aXR5X3N0YXR1c2BdLgAAAAAAAAAMRW50aXR5U3RhdHVzAAAABAAAAAAAAAAGQWN0aXZlAAAAAAAAAAAAQFRlbXBvcmFyaWx5IHdpdGhoZWxkIOKAlCBlLmcuIHdoaWxlIGEgY29tcGxhaW50IGlzIHVuZGVyIHJldmlldy4AAAAJU3VzcGVuZGVkAAAAAAAAAQAAACBQZXJtYW5lbnRseSB3aXRoZHJhd24uIFRlcm1pbmFsLgAAAAdSZXZva2VkAAAAAAIAAAAbRGVyaXZlZCBvbmx5LiBOZXZlciBzdG9yZWQuAAAAAAdFeHBpcmVkAAAAAAM=",
        "AAAAAQAAAENBbiBvcmdhbmlzYXRpb24ncyBhdHRlc3RhdGlvbiBhYm91dCBhIHBlcnNvbidzIGFmZmlsaWF0aW9uIHdpdGggaXQuAAAAAAAAAAAMUmVsYXRpb25zaGlwAAAADgAAAB5UaGUga2V5IHRoYXQgc2lnbmVkIHRoZSB3cml0ZS4AAAAAAAthdHRlc3RlZF9ieQAAAAATAAAAAAAAAAxjb25maXJtYXRpb24AAAfQAAAADENvbmZpcm1hdGlvbgAAAAAAAAAMY29uZmlybWVkX2F0AAAABgAAAChPcHRpb25hbCBkZXBhcnRtZW50LiBFbXB0eSBpZiBub3QgZ2l2ZW4uAAAACmRlcGFydG1lbnQAAAAAABAAAAA8U0hBLTI1NiBvZiB0aGUgb2ZmLWNoYWluIGRldGFpbCBkb2N1bWVudCBiYWNraW5nIHRoaXMgY2xhaW0uAAAAC2RldGFpbF9oYXNoAAAAA+4AAAAgAAAAIFVuaXggc2Vjb25kcy4gYDBgIG1lYW5zIG9uZ29pbmcuAAAACGVuZF9kYXRlAAAABgAAAEBTZXF1ZW50aWFsIGNsYWltIGlkLCB1bmlxdWUgYWNyb3NzIHJlbGF0aW9uc2hpcHMgKmFuZCogbWFuZGF0ZXMuAAAAAmlkAAAAAAAGAAAAKEVudGl0eSBpZCBvZiB0aGUgYXR0ZXN0aW5nIG9yZ2FuaXNhdGlvbi4AAAADb3JnAAAAAAYAAAAZRW50aXR5IGlkIG9mIHRoZSBzdWJqZWN0LgAAAAAAAAZwZXJzb24AAAAAAAYAAACPVGhlIHN1YmplY3QncyBjb25zZW50IHRvIHRoaXMgY2xhaW0gYmVpbmcgc2hvd24gcHVibGljbHkuIFdoZW4gZmFsc2UgdGhlCnJlY29yZCBzdGlsbCBleGlzdHMgb24tY2hhaW4gYnV0IHRoZSB2ZXJpZmllciBwYWdlIG11c3Qgbm90IHJlbmRlciBpdC4AAAAADnB1YmxpY19kaXNwbGF5AAAAAAABAAAAAAAAAAhyZWxfdHlwZQAAB9AAAAAQUmVsYXRpb25zaGlwVHlwZQAAAC1Kb2IgdGl0bGUsIGUuZy4gIlNlbmlvciBUZWNobmljYWwgUmVjcnVpdGVyIi4AAAAAAAAEcm9sZQAAABAAAAAAAAAACnN0YXJ0X2RhdGUAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtDbGFpbVN0YXR1cwA=",
        "AAAAAQAAARRBIHZldHRlZCBiYWRnZSB3YWl0aW5nIGZvciB0aGUgc3ViamVjdC9jb250cm9sbGVyIHRvIGFjY2VwdCBpdC4KClZlcmlmaWNhdGlvbiBoYXBwZW5zIG9mZi1jaGFpbiBmaXJzdC4gVGhlIGlzc3VlciB0aGVuIGNvbW1pdHMgdGhlIGV4YWN0CnB1YmxpYyByZWNvcmQsIGNyZWRlbnRpYWwgaGFzaCBhbmQgdGVybXMgdmVyc2lvbiBoZXJlLiBOb3RoaW5nIGJlY29tZXMgYQp2ZXJpZmllZCBbYEVudGl0eWBdIHVudGlsIGBjb250cm9sbGVyYCBhdXRob3Jpc2VzIGBhY2NlcHRfZW50aXR5YC4AAAAAAAAADVBlbmRpbmdFbnRpdHkAAAAAAAAOAAAAAAAAAAlhY2NlcHRfYnkAAAAAAAAGAAAAAAAAAApjb250cm9sbGVyAAAAAAATAAAAAAAAAAxkaXNwbGF5X25hbWUAAAAQAAAAAAAAAAZkb21haW4AAAAAABAAAAAAAAAACmV4cGlyZXNfYXQAAAAAAAYAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAAAAAACaWQAAAAAAAYAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAManVyaXNkaWN0aW9uAAAAEAAAAAAAAAAEa2luZAAAB9AAAAAKRW50aXR5S2luZAAAAAAAAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAAAAAAADG1ldGFkYXRhX3VyaQAAABAAAAAAAAAAC3Byb3Bvc2VkX2F0AAAAAAYAAABFSGFzaCBvZiB0aGUgY29kZSBvZiBjb25kdWN0IC8gaXNzdWFuY2UgdGVybXMgYWNjZXB0ZWQgYnkgdGhlIHN1YmplY3QuAAAAAAAACnRlcm1zX2hhc2gAAAAAA+4AAAAg",
        "AAAAAQAAAEVDdXJzb3IgcmV0dXJuZWQgYnkgYSBib3VuZGVkLCBzdWJtaXR0ZWQgc3RvcmFnZSBrZWVwYWxpdmUgaW52b2NhdGlvbi4AAAAAAAAAAAAAD0tlZXBhbGl2ZVJlc3VsdAAAAAAFAAAAAAAAAA5jbGFpbXNfdG91Y2hlZAAAAAAABAAAAAAAAAAEZG9uZQAAAAEAAAAAAAAAEGVudGl0aWVzX3RvdWNoZWQAAAAEAAAAAAAAAApuZXh0X2NsYWltAAAAAAAGAAAAAAAAAAtuZXh0X2VudGl0eQAAAAAG",
        "AAAAAwAAAElIb3cgYSBwZXJzb24gaXMgYWZmaWxpYXRlZCB3aXRoIGFuIG9yZ2FuaXNhdGlvbi4gTWlycm9ycyB0aGUgZXhwbG9yZXIgVUkuAAAAAAAAAAAAABBSZWxhdGlvbnNoaXBUeXBlAAAABwAAAAAAAAAPQ3VycmVudEVtcGxveWVlAAAAAAAAAAAAAAAADFBhc3RFbXBsb3llZQAAAAEAAAAAAAAAEUN1cnJlbnRDb250cmFjdG9yAAAAAAAAAgAAAAAAAAAOUGFzdENvbnRyYWN0b3IAAAAAAAMAAAAAAAAAFkV4dGVybmFsUmVwcmVzZW50YXRpdmUAAAAAAAQAAAAAAAAAFEFnZW5jeVJlcHJlc2VudGF0aXZlAAAABQAAAAAAAAAHQWR2aXNvcgAAAAAG",
        "AAAABQAAACJUaGUgZW1lcmdlbmN5IHdyaXRlIHBhdXNlIGNoYW5nZWQuAAAAAAAAAAAACFBhdXNlU2V0AAAAAQAAAAlwYXVzZV9zZXQAAAAAAAACAAAAAAAAAAZwYXVzZWQAAAAAAAEAAAABAAAAAAAAAAJieQAAAAAAEwAAAAAAAAAC",
        "AAAABQAAACNUaGUgY29tcGxhaW50IGFyYml0ZXIgcm9sZSBjaGFuZ2VkLgAAAAAAAAAACkFyYml0ZXJTZXQAAAAAAAEAAAALYXJiaXRlcl9zZXQAAAAAAgAAAAAAAAAHYXJiaXRlcgAAAAATAAAAAQAAAAAAAAACYnkAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAADNBbiB1cGhlbGQgY29tcGxhaW50IHdhcyByZWNvcmRlZCBhZ2FpbnN0IGFuIGVudGl0eS4AAAAAAAAAAAtTdHJpa2VBZGRlZAAAAAABAAAADHN0cmlrZV9hZGRlZAAAAAMAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAHc3RyaWtlcwAAAAAEAAAAAAAAAAAAAAACYnkAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAADFBIHByb3Bvc2VkIGFkbWluaXN0cmF0b3IgYWNjZXB0ZWQgcmVzcG9uc2liaWxpdHkuAAAAAAAAAAAAAA1BZG1pbkFjY2VwdGVkAAAAAAAAAQAAAA5hZG1pbl9hY2NlcHRlZAAAAAAAAgAAAAAAAAAOcHJldmlvdXNfYWRtaW4AAAAAABMAAAABAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAQAAAAI=",
        "AAAABQAAADBBIHR3by1zdGVwIGFkbWluaXN0cmF0aXZlIGhhbmRvdmVyIHdhcyBwcm9wb3NlZC4AAAAAAAAADUFkbWluUHJvcG9zZWQAAAAAAAABAAAADmFkbWluX3Byb3Bvc2VkAAAAAAACAAAAAAAAAA1jdXJyZW50X2FkbWluAAAAAAAAEwAAAAEAAAAAAAAADnByb3Bvc2VkX2FkbWluAAAAAAATAAAAAQAAAAI=",
        "AAAABQAAAEFBbiBvcmdhbmlzYXRpb24gYXV0aG9yaXNlZCBhIHJlcHJlc2VudGF0aXZlIHRvIGFjdCBvbiBpdHMgYmVoYWxmLgAAAAAAAAAAAAANTWFuZGF0ZUlzc3VlZAAAAAAAAAEAAAAObWFuZGF0ZV9pc3N1ZWQAAAAAAAgAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAADb3JnAAAAAAYAAAABAAAAAAAAAA5yZXByZXNlbnRhdGl2ZQAAAAAABgAAAAEAAAAAAAAADG1hbmRhdGVfdHlwZQAAB9AAAAALTWFuZGF0ZVR5cGUAAAAAAAAAAAAAAAAKdmFsaWRfZnJvbQAAAAAABgAAAAAAAAAAAAAAC3ZhbGlkX3VudGlsAAAAAAYAAAAAAAAAAAAAAAxjb25maXJtYXRpb24AAAfQAAAADENvbmZpcm1hdGlvbgAAAAAAAAAAAAAAC2F0dGVzdGVkX2J5AAAAABMAAAAAAAAAAg==",
        "AAAABQAAAHdBIHJlbGF0aW9uc2hpcCBvciBtYW5kYXRlIGNoYW5nZWQgc3RhdGUuIFRoaXMgaXMgdGhlIHJldm9jYXRpb24gZmVlZCB0aGUKdmVyaWZpZXIgcGFnZSBhbmQgdGhlIGJyb3dzZXIgZXh0ZW5zaW9uIHdhdGNoLgAAAAAAAAAADkNsYWltU3RhdHVzU2V0AAAAAAABAAAAEGNsYWltX3N0YXR1c19zZXQAAAADAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtDbGFpbVN0YXR1cwAAAAABAAAAAAAAAAJieQAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAKxUaGUgaW50ZW5kZWQgY29udHJvbGxlciBhY2NlcHRlZCB0aGUgZXhhY3QgcGVuZGluZyBiYWRnZSBhbmQgdGVybXMuIFRoaXMKZXZlbnQgbGlua3MgdGhlIHByb3Bvc2FsIGlkIHRvIHRoZSBwZXJtYW5lbnQgZW50aXR5IGlkIGZvciBpbmRleGVycyBhbmQKaW5kZXBlbmRlbnQgY29uc2VudCBhdWRpdHMuAAAAAAAAAA5FbnRpdHlBY2NlcHRlZAAAAAAAAQAAAA9lbnRpdHlfYWNjZXB0ZWQAAAAABwAAAAAAAAAKcGVuZGluZ19pZAAAAAAABgAAAAEAAAAAAAAACWVudGl0eV9pZAAAAAAAAAYAAAABAAAAAAAAAApjb250cm9sbGVyAAAAAAATAAAAAQAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAAAAAAKdGVybXNfaGFzaAAAAAAD7gAAACAAAAAAAAAAAAAAAAthY2NlcHRlZF9hdAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAHNUaGUgaXNzdWVyIGNvbXBsZXRlZCByZXZpZXcgYW5kIG9mZmVyZWQgYSBiYWRnZSB0byBpdHMgY29udHJvbGxlci4gSXQgaXMKbm90IHZlcmlmaWVkIHVudGlsIHRoZSBjb250cm9sbGVyIGFjY2VwdHMuAAAAAAAAAAAORW50aXR5UHJvcG9zZWQAAAAAAAEAAAAPZW50aXR5X3Byb3Bvc2VkAAAAAAkAAAAAAAAACnBlbmRpbmdfaWQAAAAAAAYAAAABAAAAAAAAAARraW5kAAAH0AAAAApFbnRpdHlLaW5kAAAAAAABAAAAAAAAAApjb250cm9sbGVyAAAAAAATAAAAAQAAAAAAAAAGaGFuZGxlAAAAAAAQAAAAAAAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAAAAAAKdGVybXNfaGFzaAAAAAAD7gAAACAAAAAAAAAAAAAAAAlhY2NlcHRfYnkAAAAAAAAGAAAAAAAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAAC",
        "AAAABQAAAEhBbiBlbnRpdHkncyB2ZXJpZmllZCBzdGF0dXMgY2hhbmdlZCAoc3VzcGVuZCwgcmV2b2tlLCByZWluc3RhdGUsIHJlbmV3KS4AAAAAAAAAD0VudGl0eVN0YXR1c1NldAAAAAABAAAAEWVudGl0eV9zdGF0dXNfc2V0AAAAAAAABAAAAAAAAAACaWQAAAAAAAYAAAABAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRW50aXR5U3RhdHVzAAAAAQAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAI=",
        "AAAABQAAADdUaGUgaXNzdWVyIGFuY2hvcmVkIGEgcmVwbGFjZW1lbnQgb2ZmLWNoYWluIGNyZWRlbnRpYWwuAAAAAAAAAAAPTWV0YWRhdGFVcGRhdGVkAAAAAAEAAAAQbWV0YWRhdGFfdXBkYXRlZAAAAAQAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAAAAAAMbWV0YWRhdGFfdXJpAAAAEAAAAAAAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAI=",
        "AAAABQAAADJUaGUgY29udHJhY3QgaW1wbGVtZW50YXRpb24gd2FzIHVwZ3JhZGVkIGluIHBsYWNlLgAAAAAAAAAAABBDb250cmFjdFVwZ3JhZGVkAAAAAQAAABFjb250cmFjdF91cGdyYWRlZAAAAAAAAAIAAAAAAAAACXdhc21faGFzaAAAAAAAA+4AAAAgAAAAAAAAAAAAAAACYnkAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAADFBIG5ldyBvcmdhbmlzYXRpb24gb3IgcGVyc29uIHBhc3NlZCB2ZXJpZmljYXRpb24uAAAAAAAAAAAAABBFbnRpdHlSZWdpc3RlcmVkAAAAAQAAABFlbnRpdHlfcmVnaXN0ZXJlZAAAAAAAAAcAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAEa2luZAAAB9AAAAAKRW50aXR5S2luZAAAAAAAAQAAAAAAAAAKY29udHJvbGxlcgAAAAAAEwAAAAEAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAAAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAAAAAAC3ZlcmlmaWVkX2F0AAAAAAYAAAAAAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAEtUaGUgc3ViamVjdCBjaGFuZ2VkIHdoZXRoZXIgdGhlIHB1YmxpYyB2ZXJpZmllciBtYXkgZGlzcGxheSBhIHJlbGF0aW9uc2hpcC4AAAAAAAAAABBQdWJsaWNEaXNwbGF5U2V0AAAAAQAAABJwdWJsaWNfZGlzcGxheV9zZXQAAAAAAAMAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAOcHVibGljX2Rpc3BsYXkAAAAAAAEAAAAAAAAAAAAAAAJieQAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAD9BbiBlbnRpdHkncyBiYWRnZSBtb3ZlZCB0byBhIG5ldyBrZXkgYWZ0ZXIgYSBrZXktbG9zcyByZWNvdmVyeS4AAAAAAAAAABFDb250cm9sbGVyUm90YXRlZAAAAAAAAAEAAAASY29udHJvbGxlcl9yb3RhdGVkAAAAAAADAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAADm9sZF9jb250cm9sbGVyAAAAAAATAAAAAQAAAAAAAAAObmV3X2NvbnRyb2xsZXIAAAAAABMAAAABAAAAAg==",
        "AAAABQAAADRBIHJlbGF0aW9uc2hpcCB3YXMgY2xvc2VkIHdpdGggYW4gZXhwbGljaXQgZW5kIGRhdGUuAAAAAAAAABFSZWxhdGlvbnNoaXBFbmRlZAAAAAAAAAEAAAAScmVsYXRpb25zaGlwX2VuZGVkAAAAAAADAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAACGVuZF9kYXRlAAAABgAAAAAAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAI=",
        "AAAABQAAADBBbiBvcmdhbmlzYXRpb24gYXR0ZXN0ZWQgYSBwZXJzb24ncyBhZmZpbGlhdGlvbi4AAAAAAAAAFFJlbGF0aW9uc2hpcEF0dGVzdGVkAAAAAQAAABVyZWxhdGlvbnNoaXBfYXR0ZXN0ZWQAAAAAAAAHAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAAA29yZwAAAAAGAAAAAQAAAAAAAAAGcGVyc29uAAAAAAAGAAAAAQAAAAAAAAAIcmVsX3R5cGUAAAfQAAAAEFJlbGF0aW9uc2hpcFR5cGUAAAAAAAAAAAAAAA5wdWJsaWNfZGlzcGxheQAAAAAAAQAAAAAAAAAAAAAADGNvbmZpcm1hdGlvbgAAB9AAAAAMQ29uZmlybWF0aW9uAAAAAAAAAAAAAAALYXR0ZXN0ZWRfYnkAAAAAEwAAAAAAAAAC",
        "AAAABQAAAD5BIHBlbmRpbmcgaXNzdWFuY2Ugd2FzIGNhbmNlbGxlZCBvciBleHBpcmVkIGJlZm9yZSBhY2NlcHRhbmNlLgAAAAAAAAAAABdFbnRpdHlQcm9wb3NhbENhbmNlbGxlZAAAAAABAAAAGWVudGl0eV9wcm9wb3NhbF9jYW5jZWxsZWQAAAAAAAACAAAAAAAAAApwZW5kaW5nX2lkAAAAAAAGAAAAAQAAAAAAAAACYnkAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAExUaGUgaXNzdWVyIGFwcHJvdmVkIHRoZSBleGFjdCBwZW5kaW5nIGRlc3RpbmF0aW9uIGFmdGVyIGl0cyByZWNvdmVyeSByZXZpZXcuAAAAAAAAABpDb250cm9sbGVyUm90YXRpb25BcHByb3ZlZAAAAAAAAQAAABxjb250cm9sbGVyX3JvdGF0aW9uX2FwcHJvdmVkAAAAAwAAAAAAAAACaWQAAAAAAAYAAAABAAAAAAAAABNwcm9wb3NlZF9jb250cm9sbGVyAAAAABMAAAABAAAAAAAAAAthcHByb3ZlZF9ieQAAAAATAAAAAAAAAAI=",
        "AAAABQAAAD1UaGUgY3VycmVudCBjb250cm9sbGVyIGJlZ2FuIGFuIGlzc3Vlci1yZXZpZXdlZCBrZXkgcm90YXRpb24uAAAAAAAAAAAAABpDb250cm9sbGVyUm90YXRpb25Qcm9wb3NlZAAAAAAAAQAAABxjb250cm9sbGVyX3JvdGF0aW9uX3Byb3Bvc2VkAAAAAwAAAAAAAAACaWQAAAAAAAYAAAABAAAAAAAAABJjdXJyZW50X2NvbnRyb2xsZXIAAAAAABMAAAABAAAAAAAAABNwcm9wb3NlZF9jb250cm9sbGVyAAAAABMAAAABAAAAAg==",
        "AAAABQAAAExBIHBlbmRpbmcgY29udHJvbGxlciByZWNvdmVyeSB3YXMgY2FuY2VsbGVkIGJlZm9yZSB0aGUgZGVzdGluYXRpb24gYWNjZXB0ZWQuAAAAAAAAABtDb250cm9sbGVyUm90YXRpb25DYW5jZWxsZWQAAAAAAQAAAB1jb250cm9sbGVyX3JvdGF0aW9uX2NhbmNlbGxlZAAAAAAAAAMAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAATcHJvcG9zZWRfY29udHJvbGxlcgAAAAATAAAAAQAAAAAAAAAMY2FuY2VsbGVkX2J5AAAAEwAAAAAAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<Result<string>>,
        check: this.txFromJSON<Option<Check>>,
        paused: this.txFromJSON<boolean>,
        arbiter: this.txFromJSON<Result<string>>,
        upgrade: this.txFromJSON<Result<void>>,
        keepalive: this.txFromJSON<Result<KeepaliveResult>>,
        add_strike: this.txFromJSON<Result<u32>>,
        get_entity: this.txFromJSON<Option<Entity>>,
        set_paused: this.txFromJSON<Result<void>>,
        check_by_id: this.txFromJSON<Option<Check>>,
        claim_count: this.txFromJSON<u64>,
        get_mandate: this.txFromJSON<Option<Mandate>>,
        set_arbiter: this.txFromJSON<Result<void>>,
        accept_admin: this.txFromJSON<Result<void>>,
        entity_count: this.txFromJSON<u64>,
        renew_entity: this.txFromJSON<Result<void>>,
        accept_entity: this.txFromJSON<Result<u64>>,
        is_authorised: this.txFromJSON<boolean>,
        issue_mandate: this.txFromJSON<Result<u64>>,
        propose_admin: this.txFromJSON<Result<void>>,
        mandate_status: this.txFromJSON<Option<ClaimStatus>>,
        propose_entity: this.txFromJSON<Result<u64>>,
        register_entity: this.txFromJSON<Result<u64>>,
        update_metadata: this.txFromJSON<Result<void>>,
        end_relationship: this.txFromJSON<Result<void>>,
        get_relationship: this.txFromJSON<Option<Relationship>>,
        mandates_held_by: this.txFromJSON<Array<u64>>,
        accept_controller: this.txFromJSON<Result<void>>,
        rotate_controller: this.txFromJSON<Result<void>>,
        set_entity_status: this.txFromJSON<Result<void>>,
        get_pending_entity: this.txFromJSON<Option<PendingEntity>>,
        mandates_issued_by: this.txFromJSON<Array<u64>>,
        propose_controller: this.txFromJSON<Result<void>>,
        set_mandate_status: this.txFromJSON<Result<void>>,
        set_public_display: this.txFromJSON<Result<void>>,
        attest_relationship: this.txFromJSON<Result<u64>>,
        relationship_status: this.txFromJSON<Option<ClaimStatus>>,
        relationships_about: this.txFromJSON<Array<u64>>,
        get_entity_by_handle: this.txFromJSON<Option<Entity>>,
        cancel_entity_proposal: this.txFromJSON<Result<void>>,
        get_pending_controller: this.txFromJSON<Option<string>>,
        get_approved_controller: this.txFromJSON<Option<string>>,
        set_relationship_status: this.txFromJSON<Result<void>>,
        get_entity_by_controller: this.txFromJSON<Option<Entity>>,
        relationships_attested_by: this.txFromJSON<Array<u64>>,
        cancel_controller_rotation: this.txFromJSON<Result<void>>,
        approve_controller_rotation: this.txFromJSON<Result<void>>,
        get_pending_entity_by_controller: this.txFromJSON<Option<PendingEntity>>
  }
}