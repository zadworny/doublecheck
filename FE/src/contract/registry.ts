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
   * An on-chain index vector is full; read events instead.
   */
  30: {message:"IndexFull"},
  31: {message:"NoPendingAdmin"}
}


/**
 * A vetted organisation or person.
 * 
 * The badge is soulbound: `controller` is set at registration and there is no
 * transfer function. Only the admin can move a badge to a new key
 * (`rotate_controller`), and only to recover a lost key — the badge can never
 * be sold or handed to a different subject.
 */
export interface Entity {
  /**
 * The wallet that acts for this entity. Soulbound to the subject.
 */
controller: string;
  /**
 * Organisations: registered legal name. Natural persons: leave empty and
 * serve the name from the off-chain credential — see the report §5.
 */
display_name: string;
  /**
 * Primary domain, used for the DNS / email-domain challenge. Empty for
 * natural persons.
 */
domain: string;
  /**
 * Unix seconds. `0` means no expiry.
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
 * The address that performed the verification. Jobited today, an accredited
 * issuer later.
 */
issuer: string;
  /**
 * Free-text jurisdiction, e.g. "Germany". Empty if not applicable.
 */
jurisdiction: string;
  kind: EntityKind;
  /**
 * SHA-256 of the canonical off-chain credential JSON. Lets any reader
 * prove the off-chain profile they fetched is the one Jobited signed.
 */
metadata_hash: Buffer;
  /**
 * Where that credential is served from (https / ipfs).
 */
metadata_uri: string;
  status: EntityStatus;
  /**
 * Count of upheld complaints. Reputation collateral in place of a cash
 * stake — see the report §4.
 */
strikes: u32;
  verified_at: u64;
}

/**
 * Records live in persistent storage; configuration lives in instance storage
 * so it is bumped along with the contract itself.
 */
export type DataKey = {tag: "Admin", values: void} | {tag: "PendingAdmin", values: void} | {tag: "Arbiter", values: void} | {tag: "Paused", values: void} | {tag: "EntityCount", values: void} | {tag: "ClaimCount", values: void} | {tag: "Entity", values: readonly [u64]} | {tag: "HandleIdx", values: readonly [string]} | {tag: "ControllerIdx", values: readonly [string]} | {tag: "Relationship", values: readonly [u64]} | {tag: "Mandate", values: readonly [u64]} | {tag: "OrgRels", values: readonly [u64]} | {tag: "PersonRels", values: readonly [u64]} | {tag: "OrgMandates", values: readonly [u64]} | {tag: "PersonMandates", values: readonly [u64]} | {tag: "LiveMandate", values: readonly [u64, u64]};


/**
 * An authorisation for a person to act on an organisation's behalf.
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
   * Extends a badge after re-verification. Also clears a suspension, since
   * re-verification is exactly the thing that resolves one.
   */
  renew_entity: ({id, expires_at}: {id: u64, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a is_authorised transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * "May this person act for that company, right now?"
   * 
   * The question a candidate being cold-DMed actually has. One storage read:
   * it checks the most recent mandate between the pair, and requires both
   * parties' badges to still be valid — a mandate from a revoked company is
   * not an authorisation.
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
   * Construct and simulate a register_entity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Records that an organisation or a person passed manual verification.
   * 
   * Admin-only: in phase 1 every badge is issued by hand, and this call is
   * the last step of that checklist. `expires_at` of `0` means no expiry,
   * but the recommended default is twelve months so trust has to be renewed.
   */
  register_entity: ({kind, controller, handle, display_name, domain, jurisdiction, metadata_hash, metadata_uri, expires_at}: {kind: EntityKind, controller: string, handle: string, display_name: string, domain: string, jurisdiction: string, metadata_hash: Buffer, metadata_uri: string, expires_at: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Result<u64>>>

  /**
   * Construct and simulate a update_metadata transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Repoints an entity at a new off-chain credential.
   * 
   * Callable by the entity itself (it changed its address, logo, headline)
   * or by the admin (it re-verified). The hash is what makes this safe: the
   * subject can update the document, but the chain records exactly which
   * version is current.
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
   * Construct and simulate a rotate_controller transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Moves a badge to a new key after key loss.
   * 
   * The only way a badge ever changes hands, and it is admin-gated precisely
   * so it cannot be used to sell verified status. The subject is unchanged;
   * only the key that speaks for them is.
   */
  rotate_controller: ({id, new_controller}: {id: u64, new_controller: string}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_entity_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Suspends, revokes or reinstates a badge.
   * 
   * `Revoked` is terminal — a revoked badge cannot come back, because a
   * reader who saw "revoked" must never be contradicted later. Re-admitting
   * someone means issuing a new entity under a new handle.
   */
  set_entity_status: ({caller, id, status}: {caller: string, id: u64, status: EntityStatus}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a mandates_issued_by transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  mandates_issued_by: ({org}: {org: u64}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u64>>>

  /**
   * Construct and simulate a set_mandate_status transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Changes a mandate's state — the revocation path that makes the badge
   * worth anything. A withdrawn mandate stops verifying the moment the
   * transaction lands, everywhere the badge is embedded.
   */
  set_mandate_status: ({caller, id, status}: {caller: string, id: u64, status: ClaimStatus}, options?: MethodOptions) => Promise<AssembledTransaction<Result<void>>>

  /**
   * Construct and simulate a set_public_display transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Flips whether the verifier page may render this relationship. The record
   * stays on-chain either way; only its publication changes.
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
        "AAAAAAAAAPBSZWNvcmRzIGFuIHVwaGVsZCBjb21wbGFpbnQuCgpTdHJpa2VzIGFyZSB0aGUgcmVwdXRhdGlvbiBjb2xsYXRlcmFsIHRoYXQgcmVwbGFjZXMgYSBjYXNoIHN0YWtlIGluIHRoZQpNVlA6IHRoZXkgYXJlIHB1YmxpYywgdGhleSBhY2N1bXVsYXRlLCBhbmQgZW5vdWdoIG9mIHRoZW0ganVzdGlmeSBhCnJldm9jYXRpb24uIERlY2lkaW5nICpob3cgbWFueSogaXMgZW5vdWdoIGlzIGFuIG9mZi1jaGFpbiBwb2xpY3kgY2FsbC4AAAAKYWRkX3N0cmlrZQAAAAAAAgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPpAAAABAAAAAM=",
        "AAAAAAAAAAAAAAAKZ2V0X2VudGl0eQAAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6AAAB9AAAAAGRW50aXR5AAA=",
        "AAAAAAAAAKhFbWVyZ2VuY3kgc3RvcC4gQmxvY2tzIG5ldyByZWdpc3RyYXRpb25zIGFuZCBuZXcgY2xhaW1zOyByZWFkcywgc3RhdHVzCmNoYW5nZXMgYW5kIHJldm9jYXRpb25zIGtlZXAgd29ya2luZywgYmVjYXVzZSBwYXVzaW5nIG11c3QgbmV2ZXIgcHJldmVudAp0YWtpbmcgYSBiYWQgYmFkZ2UgZG93bi4AAAAKc2V0X3BhdXNlZAAAAAAAAQAAAAAAAAAGcGF1c2VkAAAAAAABAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAERbYFNlbGY6OmNoZWNrYF0gYnkgaWQsIGZvciBjYWxsZXJzIHRoYXQgYWxyZWFkeSByZXNvbHZlZCB0aGUgaGFuZGxlLgAAAAtjaGVja19ieV9pZAAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPoAAAH0AAAAAVDaGVjawAAAA==",
        "AAAAAAAAAAAAAAALY2xhaW1fY291bnQAAAAAAAAAAAEAAAAG",
        "AAAAAAAAAAAAAAALZ2V0X21hbmRhdGUAAAAAAQAAAAAAAAACaWQAAAAAAAYAAAABAAAD6AAAB9AAAAAHTWFuZGF0ZQA=",
        "AAAAAAAAAAAAAAALc2V0X2FyYml0ZXIAAAAAAQAAAAAAAAAHYXJiaXRlcgAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAD1TdGVwIHR3byBvZiB0aGUgYWRtaW4gaGFuZG92ZXIsIGNhbGxlZCBieSB0aGUgcHJvcG9zZWQgYWRtaW4uAAAAAAAADGFjY2VwdF9hZG1pbgAAAAAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAMZW50aXR5X2NvdW50AAAAAAAAAAEAAAAG",
        "AAAAAAAAAH5FeHRlbmRzIGEgYmFkZ2UgYWZ0ZXIgcmUtdmVyaWZpY2F0aW9uLiBBbHNvIGNsZWFycyBhIHN1c3BlbnNpb24sIHNpbmNlCnJlLXZlcmlmaWNhdGlvbiBpcyBleGFjdGx5IHRoZSB0aGluZyB0aGF0IHJlc29sdmVzIG9uZS4AAAAAAAxyZW5ld19lbnRpdHkAAAACAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAALZTZXRzIHRoZSBpc3N1aW5nIGF1dGhvcml0eSBhbmQgdGhlIGNvbXBsYWludCBhcmJpdGVyIGF0IGRlcGxveSB0aW1lLgoKUGFzc2luZyB0aGUgc2FtZSBhZGRyZXNzIGZvciBib3RoIGlzIGZpbmUgZm9yIHRoZSBmb3VuZGluZyBjb2hvcnQ7CnNwbGl0dGluZyB0aGVtIGxhdGVyIGlzIGEgYHNldF9hcmJpdGVyYCBjYWxsLgAAAAAADV9fY29uc3RydWN0b3IAAAAAAAACAAAAAAAAAAVhZG1pbgAAAAAAABMAAAAAAAAAB2FyYml0ZXIAAAAAEwAAAAA=",
        "AAAAAAAAASIiTWF5IHRoaXMgcGVyc29uIGFjdCBmb3IgdGhhdCBjb21wYW55LCByaWdodCBub3c/IgoKVGhlIHF1ZXN0aW9uIGEgY2FuZGlkYXRlIGJlaW5nIGNvbGQtRE1lZCBhY3R1YWxseSBoYXMuIE9uZSBzdG9yYWdlIHJlYWQ6Cml0IGNoZWNrcyB0aGUgbW9zdCByZWNlbnQgbWFuZGF0ZSBiZXR3ZWVuIHRoZSBwYWlyLCBhbmQgcmVxdWlyZXMgYm90aApwYXJ0aWVzJyBiYWRnZXMgdG8gc3RpbGwgYmUgdmFsaWQg4oCUIGEgbWFuZGF0ZSBmcm9tIGEgcmV2b2tlZCBjb21wYW55IGlzCm5vdCBhbiBhdXRob3Jpc2F0aW9uLgAAAAAADWlzX2F1dGhvcmlzZWQAAAAAAAACAAAAAAAAAANvcmcAAAAABgAAAAAAAAAOcmVwcmVzZW50YXRpdmUAAAAAAAYAAAABAAAAAQ==",
        "AAAAAAAAAb1BdXRob3Jpc2VzIGEgcmVwcmVzZW50YXRpdmUgdG8gYWN0IGZvciBhbiBvcmdhbmlzYXRpb24sIGZvciBhIHNjb3BlIGFuZAphIGZpeGVkIHdpbmRvdy4KClRoaXMgaXMgdGhlIGNsYWltIGEgY2FuZGlkYXRlIGFjdHVhbGx5IG5lZWRzIHRvIGNoZWNrOiBub3QgImlzIHRoaXMKcGVyc29uIHJlYWwiIGJ1dCAiaXMgdGhpcyBwZXJzb24gYWxsb3dlZCB0byBiZSByZWNydWl0aW5nIGZvciB0aGF0CmNvbXBhbnkgdG9kYXkiLiBNYW5kYXRlcyBhcmUgYWx3YXlzIHRpbWUtYm91bmQ7IGB2YWxpZF91bnRpbGAgY2Fubm90IGJlCnplcm8uCgpgcmVsYXRpb25zaGlwYCBvcHRpb25hbGx5IHRpZXMgdGhlIG1hbmRhdGUgdG8gdGhlIGFmZmlsaWF0aW9uIGl0IHJlc3RzCm9uLiBXaGVuIGdpdmVuLCBpdCBtdXN0IGJlIGEgcmVsYXRpb25zaGlwIGJldHdlZW4gdGhlIHNhbWUgdHdvIHBhcnRpZXMuAAAAAAAADWlzc3VlX21hbmRhdGUAAAAAAAAKAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAA29yZwAAAAAGAAAAAAAAAA5yZXByZXNlbnRhdGl2ZQAAAAAABgAAAAAAAAAMcmVsYXRpb25zaGlwAAAABgAAAAAAAAAMbWFuZGF0ZV90eXBlAAAH0AAAAAtNYW5kYXRlVHlwZQAAAAAAAAAABXNjb3BlAAAAAAAAEAAAAAAAAAAJdGVycml0b3J5AAAAAAAAEAAAAAAAAAAKdmFsaWRfZnJvbQAAAAAABgAAAAAAAAALdmFsaWRfdW50aWwAAAAABgAAAAAAAAALZGV0YWlsX2hhc2gAAAAD7gAAACAAAAABAAAD6QAAAAYAAAAD",
        "AAAAAAAAAHxTdGVwIG9uZSBvZiB0aGUgYWRtaW4gaGFuZG92ZXIuIFRoZSBuZXcgYWRtaW4gaXMgbm90IGxpdmUgdW50aWwgaXQgY2FsbHMKYGFjY2VwdF9hZG1pbmAsIHNvIGEgdHlwbyBjYW5ub3QgbG9jayB0aGUgcmVnaXN0cnkuAAAADXByb3Bvc2VfYWRtaW4AAAAAAAABAAAAAAAAAAluZXdfYWRtaW4AAAAAAAATAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAACdBIG1hbmRhdGUncyBzdGF0dXMgd2l0aCBleHBpcnkgYXBwbGllZC4AAAAADm1hbmRhdGVfc3RhdHVzAAAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPoAAAH0AAAAAtDbGFpbVN0YXR1cwA=",
        "AAAAAAAAARtSZWNvcmRzIHRoYXQgYW4gb3JnYW5pc2F0aW9uIG9yIGEgcGVyc29uIHBhc3NlZCBtYW51YWwgdmVyaWZpY2F0aW9uLgoKQWRtaW4tb25seTogaW4gcGhhc2UgMSBldmVyeSBiYWRnZSBpcyBpc3N1ZWQgYnkgaGFuZCwgYW5kIHRoaXMgY2FsbCBpcwp0aGUgbGFzdCBzdGVwIG9mIHRoYXQgY2hlY2tsaXN0LiBgZXhwaXJlc19hdGAgb2YgYDBgIG1lYW5zIG5vIGV4cGlyeSwKYnV0IHRoZSByZWNvbW1lbmRlZCBkZWZhdWx0IGlzIHR3ZWx2ZSBtb250aHMgc28gdHJ1c3QgaGFzIHRvIGJlIHJlbmV3ZWQuAAAAAA9yZWdpc3Rlcl9lbnRpdHkAAAAACQAAAAAAAAAEa2luZAAAB9AAAAAKRW50aXR5S2luZAAAAAAAAAAAAApjb250cm9sbGVyAAAAAAATAAAAAAAAAAZoYW5kbGUAAAAAABAAAAAAAAAADGRpc3BsYXlfbmFtZQAAABAAAAAAAAAABmRvbWFpbgAAAAAAEAAAAAAAAAAManVyaXNkaWN0aW9uAAAAEAAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAARpSZXBvaW50cyBhbiBlbnRpdHkgYXQgYSBuZXcgb2ZmLWNoYWluIGNyZWRlbnRpYWwuCgpDYWxsYWJsZSBieSB0aGUgZW50aXR5IGl0c2VsZiAoaXQgY2hhbmdlZCBpdHMgYWRkcmVzcywgbG9nbywgaGVhZGxpbmUpCm9yIGJ5IHRoZSBhZG1pbiAoaXQgcmUtdmVyaWZpZWQpLiBUaGUgaGFzaCBpcyB3aGF0IG1ha2VzIHRoaXMgc2FmZTogdGhlCnN1YmplY3QgY2FuIHVwZGF0ZSB0aGUgZG9jdW1lbnQsIGJ1dCB0aGUgY2hhaW4gcmVjb3JkcyBleGFjdGx5IHdoaWNoCnZlcnNpb24gaXMgY3VycmVudC4AAAAAAA91cGRhdGVfbWV0YWRhdGEAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAANbWV0YWRhdGFfaGFzaAAAAAAAA+4AAAAgAAAAAAAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAKFDbG9zZXMgYSByZWxhdGlvbnNoaXAgd2l0aCBhbiBlbmQgZGF0ZSwgd2l0aG91dCBkZWxldGluZyBpdC4KCkhpc3RvcnkgaXMgdGhlIHBvaW50OiAibGVmdCBpbiBNYXJjaCIgaXMgYSBkaWZmZXJlbnQgYW5kIG1vcmUgdXNlZnVsCmFuc3dlciB0aGFuICJubyByZWNvcmQgZm91bmQiLgAAAAAAABBlbmRfcmVsYXRpb25zaGlwAAAAAwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAIZW5kX2RhdGUAAAAGAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAAQZ2V0X3JlbGF0aW9uc2hpcAAAAAEAAAAAAAAAAmlkAAAAAAAGAAAAAQAAA+gAAAfQAAAADFJlbGF0aW9uc2hpcA==",
        "AAAAAAAAAAAAAAAQbWFuZGF0ZXNfaGVsZF9ieQAAAAEAAAAAAAAADnJlcHJlc2VudGF0aXZlAAAAAAAGAAAAAQAAA+oAAAAG",
        "AAAAAAAAAOJNb3ZlcyBhIGJhZGdlIHRvIGEgbmV3IGtleSBhZnRlciBrZXkgbG9zcy4KClRoZSBvbmx5IHdheSBhIGJhZGdlIGV2ZXIgY2hhbmdlcyBoYW5kcywgYW5kIGl0IGlzIGFkbWluLWdhdGVkIHByZWNpc2VseQpzbyBpdCBjYW5ub3QgYmUgdXNlZCB0byBzZWxsIHZlcmlmaWVkIHN0YXR1cy4gVGhlIHN1YmplY3QgaXMgdW5jaGFuZ2VkOwpvbmx5IHRoZSBrZXkgdGhhdCBzcGVha3MgZm9yIHRoZW0gaXMuAAAAAAARcm90YXRlX2NvbnRyb2xsZXIAAAAAAAACAAAAAAAAAAJpZAAAAAAABgAAAAAAAAAObmV3X2NvbnRyb2xsZXIAAAAAABMAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAO5TdXNwZW5kcywgcmV2b2tlcyBvciByZWluc3RhdGVzIGEgYmFkZ2UuCgpgUmV2b2tlZGAgaXMgdGVybWluYWwg4oCUIGEgcmV2b2tlZCBiYWRnZSBjYW5ub3QgY29tZSBiYWNrLCBiZWNhdXNlIGEKcmVhZGVyIHdobyBzYXcgInJldm9rZWQiIG11c3QgbmV2ZXIgYmUgY29udHJhZGljdGVkIGxhdGVyLiBSZS1hZG1pdHRpbmcKc29tZW9uZSBtZWFucyBpc3N1aW5nIGEgbmV3IGVudGl0eSB1bmRlciBhIG5ldyBoYW5kbGUuAAAAAAARc2V0X2VudGl0eV9zdGF0dXMAAAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRW50aXR5U3RhdHVzAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAAAAAAASbWFuZGF0ZXNfaXNzdWVkX2J5AAAAAAABAAAAAAAAAANvcmcAAAAABgAAAAEAAAPqAAAABg==",
        "AAAAAAAAAL5DaGFuZ2VzIGEgbWFuZGF0ZSdzIHN0YXRlIOKAlCB0aGUgcmV2b2NhdGlvbiBwYXRoIHRoYXQgbWFrZXMgdGhlIGJhZGdlCndvcnRoIGFueXRoaW5nLiBBIHdpdGhkcmF3biBtYW5kYXRlIHN0b3BzIHZlcmlmeWluZyB0aGUgbW9tZW50IHRoZQp0cmFuc2FjdGlvbiBsYW5kcywgZXZlcnl3aGVyZSB0aGUgYmFkZ2UgaXMgZW1iZWRkZWQuAAAAAAASc2V0X21hbmRhdGVfc3RhdHVzAAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAALQ2xhaW1TdGF0dXMAAAAAAQAAA+kAAAACAAAAAw==",
        "AAAAAAAAAIFGbGlwcyB3aGV0aGVyIHRoZSB2ZXJpZmllciBwYWdlIG1heSByZW5kZXIgdGhpcyByZWxhdGlvbnNoaXAuIFRoZSByZWNvcmQKc3RheXMgb24tY2hhaW4gZWl0aGVyIHdheTsgb25seSBpdHMgcHVibGljYXRpb24gY2hhbmdlcy4AAAAAAAASc2V0X3B1YmxpY19kaXNwbGF5AAAAAAADAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAAAAAAAmlkAAAAAAAGAAAAAAAAAA5wdWJsaWNfZGlzcGxheQAAAAAAAQAAAAEAAAPpAAAAAgAAAAM=",
        "AAAAAAAAAfpBdHRlc3RzIHRoYXQgYSBwZXJzb24gaXMsIG9yIHdhcywgYWZmaWxpYXRlZCB3aXRoIGFuIG9yZ2FuaXNhdGlvbi4KCmBjYWxsZXJgIGRlY2lkZXMgaG93IG11Y2ggdGhlIGNsYWltIGlzIHdvcnRoLCBhbmQgdGhlIGNvbnRyYWN0IHN0YW1wcyBpdAphY2NvcmRpbmdseToKCiogdGhlIG9yZ2FuaXNhdGlvbidzIGNvbnRyb2xsZXIgLT4gW2BDb25maXJtYXRpb246OkNvdW50ZXJwYXJ0eUNvbmZpcm1lZGBdCiogdGhlIHBlcnNvbidzIG93biBjb250cm9sbGVyICAgLT4gW2BDb25maXJtYXRpb246OlNlbGZBc3NlcnRlZGBdCiogdGhlIGFkbWluICAgICAgICAgICAgICAgICAgICAgLT4gW2BDb25maXJtYXRpb246Oklzc3VlckNvbmZpcm1lZGBdCgpBIHJlY3J1aXRlciBjYW4gdGhlcmVmb3JlIGxpc3Qgd2hlcmUgdGhleSB3b3JrIHdpdGhvdXQgd2FpdGluZyBmb3IgdGhlCmNvbXBhbnksIGFuZCBhIHJlYWRlciBjYW4gc3RpbGwgc2VlIG5vYm9keSBidXQgdGhlIHJlY3J1aXRlciBzYWlkIHNvLgAAAAAAE2F0dGVzdF9yZWxhdGlvbnNoaXAAAAAACgAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAANvcmcAAAAABgAAAAAAAAAGcGVyc29uAAAAAAAGAAAAAAAAAAhyZWxfdHlwZQAAB9AAAAAQUmVsYXRpb25zaGlwVHlwZQAAAAAAAAAEcm9sZQAAABAAAAAAAAAACmRlcGFydG1lbnQAAAAAABAAAAAAAAAACnN0YXJ0X2RhdGUAAAAAAAYAAAAAAAAACGVuZF9kYXRlAAAABgAAAAAAAAAOcHVibGljX2Rpc3BsYXkAAAAAAAEAAAAAAAAAC2RldGFpbF9oYXNoAAAAA+4AAAAgAAAAAQAAA+kAAAAGAAAAAw==",
        "AAAAAAAAAIJBIHJlbGF0aW9uc2hpcCdzIHN0YXR1cyB3aXRoIGV4cGlyeSBhcHBsaWVkIOKAlCBgZW5kX2RhdGVgIGNvdW50cyBhcyB0aGUKZXhwaXJ5LCBzbyBhIGZpbmlzaGVkIGVuZ2FnZW1lbnQgbmV2ZXIgcmVhZHMgYXMgYEFjdGl2ZWAuAAAAAAATcmVsYXRpb25zaGlwX3N0YXR1cwAAAAABAAAAAAAAAAJpZAAAAAAABgAAAAEAAAPoAAAH0AAAAAtDbGFpbVN0YXR1cwA=",
        "AAAAAAAAAAAAAAATcmVsYXRpb25zaGlwc19hYm91dAAAAAABAAAAAAAAAAZwZXJzb24AAAAAAAYAAAABAAAD6gAAAAY=",
        "AAAAAAAAAAAAAAAUZ2V0X2VudGl0eV9ieV9oYW5kbGUAAAABAAAAAAAAAAZoYW5kbGUAAAAAABAAAAABAAAD6AAAB9AAAAAGRW50aXR5AAA=",
        "AAAAAAAAAOdDaGFuZ2VzIGEgcmVsYXRpb25zaGlwJ3Mgc3RhdGUuCgpUaGUgc3ViamVjdCBjYW4gYWx3YXlzIHNldCBgV2l0aGRyYXduYCBvbiBhIGNsYWltIGFib3V0IHRoZW1zZWx2ZXMuIFRoYXQKaXMgdGhlIG9uLWNoYWluIGZvcm0gb2YgdGhlIHJpZ2h0IHRvIG9iamVjdDogYW4gb3JnYW5pc2F0aW9uIGNhbm5vdCBwaW4KYSBwdWJsaWMgc3RhdGVtZW50IGFib3V0IGEgcGVyc29uIGFnYWluc3QgdGhlaXIgd2lsbC4AAAAAF3NldF9yZWxhdGlvbnNoaXBfc3RhdHVzAAAAAAMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAAAAAACaWQAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtDbGFpbVN0YXR1cwAAAAABAAAD6QAAAAIAAAAD",
        "AAAAAAAAAAAAAAAYZ2V0X2VudGl0eV9ieV9jb250cm9sbGVyAAAAAQAAAAAAAAAKY29udHJvbGxlcgAAAAAAEwAAAAEAAAPoAAAH0AAAAAZFbnRpdHkAAA==",
        "AAAAAAAAAAAAAAAZcmVsYXRpb25zaGlwc19hdHRlc3RlZF9ieQAAAAAAAAEAAAAAAAAAA29yZwAAAAAGAAAAAQAAA+oAAAAG",
        "AAAAAQAAAM9UaGUgYW5zd2VyIHRvIHRoZSBvbmx5IHF1ZXN0aW9uIHRoZSB2ZXJpZmllciBwYWdlIHJlYWxseSBhc2tzOgoqaXMgdGhpcyBjb3VudGVycGFydHkgcmVhbCwgcmlnaHQgbm93PyoKClJldHVybmVkIGJ5IGEgc2luZ2xlIGNvbnRyYWN0IGNhbGwgc28gYSB3YWxsZXQtZnJlZSB2ZXJpZmllciBjYW4gcmVuZGVyIGEKcGFnZSBmcm9tIG9uZSBSUEMgcm91bmQgdHJpcC4AAAAAAAAAAAVDaGVjawAAAAAAAAYAAAAsTGVkZ2VyIHRpbWVzdGFtcCB0aGUgYW5zd2VyIHdhcyBjb21wdXRlZCBhdC4AAAAKY2hlY2tlZF9hdAAAAAAABgAAAERgZW50aXR5LnN0YXR1c2Agd2l0aCBleHBpcnkgYXBwbGllZC4gUmVhZCB0aGlzLCBub3QgYGVudGl0eS5zdGF0dXNgLgAAABBlZmZlY3RpdmVfc3RhdHVzAAAH0AAAAAxFbnRpdHlTdGF0dXMAAAAAAAAABmVudGl0eQAAAAAH0AAAAAZFbnRpdHkAAAAAAF1NYW5kYXRlcyB0aGlzIGVudGl0eSBpcyBhIHBhcnR5IHRvLiBPcmdhbmlzYXRpb25zOiBvbmVzIHRoZXkgaXNzdWVkLgpQZXJzb25zOiBvbmVzIHRoZXkgaG9sZC4AAAAAAAAIbWFuZGF0ZXMAAAAEAAAAZVJlbGF0aW9uc2hpcHMgdGhpcyBlbnRpdHkgaXMgYSBwYXJ0eSB0by4gT3JnYW5pc2F0aW9uczogb25lcyB0aGV5CmF0dGVzdGVkLiBQZXJzb25zOiBvbmVzIGFib3V0IHRoZW0uAAAAAAAADXJlbGF0aW9uc2hpcHMAAAAAAAAEAAAALFRydWUgb25seSB3aGVuIGBlZmZlY3RpdmVfc3RhdHVzID09IEFjdGl2ZWAuAAAABXZhbGlkAAAAAAAAAQ==",
        "AAAABAAAAAAAAAAAAAAABUVycm9yAAAAAAAAEQAAAAAAAAASQWxyZWFkeUluaXRpYWxpemVkAAAAAAABAAAAAAAAAA5Ob3RJbml0aWFsaXplZAAAAAAAAgAAAAAAAAANTm90QXV0aG9yaXplZAAAAAAAAAMAAAAAAAAABlBhdXNlZAAAAAAABAAAAAAAAAAORW50aXR5Tm90Rm91bmQAAAAAAAoAAAAAAAAAC0hhbmRsZVRha2VuAAAAAAsAAAAAAAAAD0NvbnRyb2xsZXJUYWtlbgAAAAAMAAAAAAAAAA1JbnZhbGlkSGFuZGxlAAAAAAAADQAAAAAAAAALVGV4dFRvb0xvbmcAAAAADgAAACxUaGUgZW50aXR5IGlzIHN1c3BlbmRlZCwgcmV2b2tlZCBvciBleHBpcmVkLgAAAA9FbnRpdHlOb3RBY3RpdmUAAAAADwAAAD9FeHBlY3RlZCBhbiBvcmdhbmlzYXRpb24sIGdvdCBhIHBlcnNvbiwgb3IgdGhlIG90aGVyIHdheSByb3VuZC4AAAAAD1dyb25nRW50aXR5S2luZAAAAAAQAAAAAAAAAA1DbGFpbU5vdEZvdW5kAAAAAAAAFAAAADxFbmQgZGF0ZSBiZWZvcmUgc3RhcnQgZGF0ZSwgb3IgYSBtYW5kYXRlIHdpdGggbm8gZW5kIGF0IGFsbC4AAAAQSW52YWxpZERhdGVSYW5nZQAAABUAAAAzVGhlIGNsYWltIGlzIG5vdCBpbiBhIHN0YXRlIHRoaXMgdHJhbnNpdGlvbiBhbGxvd3MuAAAAAA1JbnZhbGlkU3RhdHVzAAAAAAAAFgAAAENSZWZlcmVuY2VkIHJlbGF0aW9uc2hpcCBkb2VzIG5vdCBiZWxvbmcgdG8gdGhlIHNhbWUgb3JnIGFuZCBwZXJzb24uAAAAABRSZWxhdGlvbnNoaXBNaXNtYXRjaAAAABcAAAA2QW4gb24tY2hhaW4gaW5kZXggdmVjdG9yIGlzIGZ1bGw7IHJlYWQgZXZlbnRzIGluc3RlYWQuAAAAAAAJSW5kZXhGdWxsAAAAAAAAHgAAAAAAAAAOTm9QZW5kaW5nQWRtaW4AAAAAAB8=",
        "AAAAAQAAASVBIHZldHRlZCBvcmdhbmlzYXRpb24gb3IgcGVyc29uLgoKVGhlIGJhZGdlIGlzIHNvdWxib3VuZDogYGNvbnRyb2xsZXJgIGlzIHNldCBhdCByZWdpc3RyYXRpb24gYW5kIHRoZXJlIGlzIG5vCnRyYW5zZmVyIGZ1bmN0aW9uLiBPbmx5IHRoZSBhZG1pbiBjYW4gbW92ZSBhIGJhZGdlIHRvIGEgbmV3IGtleQooYHJvdGF0ZV9jb250cm9sbGVyYCksIGFuZCBvbmx5IHRvIHJlY292ZXIgYSBsb3N0IGtleSDigJQgdGhlIGJhZGdlIGNhbiBuZXZlcgpiZSBzb2xkIG9yIGhhbmRlZCB0byBhIGRpZmZlcmVudCBzdWJqZWN0LgAAAAAAAAAAAAAGRW50aXR5AAAAAAAOAAAAP1RoZSB3YWxsZXQgdGhhdCBhY3RzIGZvciB0aGlzIGVudGl0eS4gU291bGJvdW5kIHRvIHRoZSBzdWJqZWN0LgAAAAAKY29udHJvbGxlcgAAAAAAEwAAAItPcmdhbmlzYXRpb25zOiByZWdpc3RlcmVkIGxlZ2FsIG5hbWUuIE5hdHVyYWwgcGVyc29uczogbGVhdmUgZW1wdHkgYW5kCnNlcnZlIHRoZSBuYW1lIGZyb20gdGhlIG9mZi1jaGFpbiBjcmVkZW50aWFsIOKAlCBzZWUgdGhlIHJlcG9ydCDCpzUuAAAAAAxkaXNwbGF5X25hbWUAAAAQAAAAVVByaW1hcnkgZG9tYWluLCB1c2VkIGZvciB0aGUgRE5TIC8gZW1haWwtZG9tYWluIGNoYWxsZW5nZS4gRW1wdHkgZm9yCm5hdHVyYWwgcGVyc29ucy4AAAAAAAAGZG9tYWluAAAAAAAQAAAAIlVuaXggc2Vjb25kcy4gYDBgIG1lYW5zIG5vIGV4cGlyeS4AAAAAAApleHBpcmVzX2F0AAAAAAAGAAAALVVuaXF1ZSBwdWJsaWMgc2x1ZyB1c2VkIGJ5IHRoZSB2ZXJpZmllciBwYWdlLgAAAAAAAAZoYW5kbGUAAAAAABAAAAA4U2VxdWVudGlhbCBpZCwgYXNzaWduZWQgYnkgdGhlIGNvbnRyYWN0LiBTdGFibGUgZm9yZXZlci4AAAACaWQAAAAAAAYAAABXVGhlIGFkZHJlc3MgdGhhdCBwZXJmb3JtZWQgdGhlIHZlcmlmaWNhdGlvbi4gSm9iaXRlZCB0b2RheSwgYW4gYWNjcmVkaXRlZAppc3N1ZXIgbGF0ZXIuAAAAAAZpc3N1ZXIAAAAAABMAAABARnJlZS10ZXh0IGp1cmlzZGljdGlvbiwgZS5nLiAiR2VybWFueSIuIEVtcHR5IGlmIG5vdCBhcHBsaWNhYmxlLgAAAAxqdXJpc2RpY3Rpb24AAAAQAAAAAAAAAARraW5kAAAH0AAAAApFbnRpdHlLaW5kAAAAAACHU0hBLTI1NiBvZiB0aGUgY2Fub25pY2FsIG9mZi1jaGFpbiBjcmVkZW50aWFsIEpTT04uIExldHMgYW55IHJlYWRlcgpwcm92ZSB0aGUgb2ZmLWNoYWluIHByb2ZpbGUgdGhleSBmZXRjaGVkIGlzIHRoZSBvbmUgSm9iaXRlZCBzaWduZWQuAAAAAA1tZXRhZGF0YV9oYXNoAAAAAAAD7gAAACAAAAA0V2hlcmUgdGhhdCBjcmVkZW50aWFsIGlzIHNlcnZlZCBmcm9tIChodHRwcyAvIGlwZnMpLgAAAAxtZXRhZGF0YV91cmkAAAAQAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRW50aXR5U3RhdHVzAAAAYkNvdW50IG9mIHVwaGVsZCBjb21wbGFpbnRzLiBSZXB1dGF0aW9uIGNvbGxhdGVyYWwgaW4gcGxhY2Ugb2YgYSBjYXNoCnN0YWtlIOKAlCBzZWUgdGhlIHJlcG9ydCDCpzQuAAAAAAAHc3RyaWtlcwAAAAAEAAAAAAAAAAt2ZXJpZmllZF9hdAAAAAAG",
        "AAAAAgAAAHtSZWNvcmRzIGxpdmUgaW4gcGVyc2lzdGVudCBzdG9yYWdlOyBjb25maWd1cmF0aW9uIGxpdmVzIGluIGluc3RhbmNlIHN0b3JhZ2UKc28gaXQgaXMgYnVtcGVkIGFsb25nIHdpdGggdGhlIGNvbnRyYWN0IGl0c2VsZi4AAAAAAAAAAAdEYXRhS2V5AAAAABAAAAAAAAAAOklzc3VpbmcgYXV0aG9yaXR5LiBSZWdpc3RlcnMsIHJlbmV3cyBhbmQgcmV2b2tlcyBlbnRpdGllcy4AAAAAAAVBZG1pbgAAAAAAAAAAAAAoUHJvcG9zZWQgYWRtaW4gaW4gdGhlIHR3by1zdGVwIGhhbmRvdmVyLgAAAAxQZW5kaW5nQWRtaW4AAAAAAAAAR0FkZHJlc3MgYWxsb3dlZCB0byByZWNvcmQgdGhlIG91dGNvbWUgb2YgdGhlIG9mZi1jaGFpbiBjb21wbGFpbnQgcXVldWUuAAAAAAdBcmJpdGVyAAAAAAAAAAA7RW1lcmdlbmN5IHN0b3Agb24gYWxsIHdyaXRlcyBleGNlcHQgYWRtaW4vYXJiaXRlciByZWNvdmVyeS4AAAAABlBhdXNlZAAAAAAAAAAAABxNb25vdG9uaWMgZW50aXR5IGlkIGNvdW50ZXIuAAAAC0VudGl0eUNvdW50AAAAAAAAAABBTW9ub3RvbmljIGNsYWltIGlkIGNvdW50ZXIsIHNoYXJlZCBieSByZWxhdGlvbnNoaXBzIGFuZCBtYW5kYXRlcy4AAAAAAAAKQ2xhaW1Db3VudAAAAAAAAQAAAA1FbnRpdHkgYnkgaWQuAAAAAAAABkVudGl0eQAAAAAAAQAAAAYAAAABAAAAMEVudGl0eSBpZCBieSBoYW5kbGUuIEVuZm9yY2VzIGhhbmRsZSB1bmlxdWVuZXNzLgAAAAlIYW5kbGVJZHgAAAAAAAABAAAAEAAAAAEAAAA8RW50aXR5IGlkIGJ5IGNvbnRyb2xsZXIgYWRkcmVzcy4gRW5mb3JjZXMgb25lIGJhZGdlIHBlciBrZXkuAAAADUNvbnRyb2xsZXJJZHgAAAAAAAABAAAAEwAAAAEAAAAZUmVsYXRpb25zaGlwIGJ5IGNsYWltIGlkLgAAAAAAAAxSZWxhdGlvbnNoaXAAAAABAAAABgAAAAEAAAAUTWFuZGF0ZSBieSBjbGFpbSBpZC4AAAAHTWFuZGF0ZQAAAAABAAAABgAAAAEAAAA5Q2xhaW0gaWRzIG9mIHJlbGF0aW9uc2hpcHMgYXR0ZXN0ZWQgYnkgdGhpcyBvcmdhbmlzYXRpb24uAAAAAAAAB09yZ1JlbHMAAAAAAQAAAAYAAAABAAAALUNsYWltIGlkcyBvZiByZWxhdGlvbnNoaXBzIGFib3V0IHRoaXMgcGVyc29uLgAAAAAAAApQZXJzb25SZWxzAAAAAAABAAAABgAAAAEAAAAyQ2xhaW0gaWRzIG9mIG1hbmRhdGVzIGlzc3VlZCBieSB0aGlzIG9yZ2FuaXNhdGlvbi4AAAAAAAtPcmdNYW5kYXRlcwAAAAABAAAABgAAAAEAAAAyQ2xhaW0gaWRzIG9mIG1hbmRhdGVzIGhlbGQgYnkgdGhpcyByZXByZXNlbnRhdGl2ZS4AAAAAAA5QZXJzb25NYW5kYXRlcwAAAAAAAQAAAAYAAAABAAAAzmAob3JnIGlkLCByZXByZXNlbnRhdGl2ZSBpZClgIC0+IHRoZSBtb3N0IHJlY2VudCBtYW5kYXRlIGlkIGJldHdlZW4gdGhhdApwYWlyLiBMZXRzIGBpc19hdXRob3Jpc2VkYCBhbnN3ZXIgIm1heSB0aGlzIHBlcnNvbiBhY3QgZm9yIHRoYXQgY29tcGFueQpyaWdodCBub3c/IiBpbiBvbmUgc3RvcmFnZSByZWFkIGluc3RlYWQgb2Ygc2Nhbm5pbmcgYW4gaW5kZXguAAAAAAALTGl2ZU1hbmRhdGUAAAAAAgAAAAYAAAAG",
        "AAAAAQAAAEFBbiBhdXRob3Jpc2F0aW9uIGZvciBhIHBlcnNvbiB0byBhY3Qgb24gYW4gb3JnYW5pc2F0aW9uJ3MgYmVoYWxmLgAAAAAAAAAAAAAHTWFuZGF0ZQAAAAAOAAAAAAAAAAthdHRlc3RlZF9ieQAAAAATAAAAAAAAAAxjb25maXJtYXRpb24AAAfQAAAADENvbmZpcm1hdGlvbgAAAAAAAAAMY29uZmlybWVkX2F0AAAABgAAAAAAAAALZGV0YWlsX2hhc2gAAAAD7gAAACAAAABAU2VxdWVudGlhbCBjbGFpbSBpZCwgdW5pcXVlIGFjcm9zcyByZWxhdGlvbnNoaXBzICphbmQqIG1hbmRhdGVzLgAAAAJpZAAAAAAABgAAAAAAAAAMbWFuZGF0ZV90eXBlAAAH0AAAAAtNYW5kYXRlVHlwZQAAAAAAAAAAA29yZwAAAAAGAAAANlJlbGF0aW9uc2hpcCB0aGlzIG1hbmRhdGUgcmVzdHMgb24uIGAwYCBpZiBzdGFuZGFsb25lLgAAAAAADHJlbGF0aW9uc2hpcAAAAAYAAAAgRW50aXR5IGlkIG9mIHRoZSByZXByZXNlbnRhdGl2ZS4AAAAOcmVwcmVzZW50YXRpdmUAAAAAAAYAAABGV2hhdCB0aGV5IG1heSBkbywgZS5nLiAiRW5naW5lZXJpbmcgaGlyaW5nIGZvciB0aGUgcm9ib3RpY3MgZGl2aXNpb24iLgAAAAAABXNjb3BlAAAAAAAAEAAAAAAAAAAGc3RhdHVzAAAAAAfQAAAAC0NsYWltU3RhdHVzAAAAADhPcHRpb25hbCB0ZXJyaXRvcnkuIEVtcHR5IGlmIHdvcmxkd2lkZSAvIG5vdCBhcHBsaWNhYmxlLgAAAAl0ZXJyaXRvcnkAAAAAAAAQAAAAAAAAAAp2YWxpZF9mcm9tAAAAAAAGAAAAQ1VuaXggc2Vjb25kcy4gTWFuZGF0ZXMgYXJlIGFsd2F5cyB0aW1lLWJvdW5kLCBzbyB0aGlzIGlzIG5ldmVyIGAwYC4AAAAAC3ZhbGlkX3VudGlsAAAAAAY=",
        "AAAAAwAAADRXaGF0IGtpbmQgb2Ygc3ViamVjdCBhbiBbYEVudGl0eWBdIHJlY29yZCBkZXNjcmliZXMuAAAAAAAAAApFbnRpdHlLaW5kAAAAAAACAAAAKEEgY29tcGFueSwgYWdlbmN5IG9yIG90aGVyIGxlZ2FsIHBlcnNvbi4AAAAMT3JnYW5pc2F0aW9uAAAAAAAAAEdBIG5hdHVyYWwgcGVyc29uIOKAlCB0eXBpY2FsbHkgYSByZWNydWl0ZXIgb3IgYSBjb21wYW55IHJlcHJlc2VudGF0aXZlLgAAAAAGUGVyc29uAAAAAAAB",
        "AAAAAwAAAJxMaWZlY3ljbGUgc3RhdGUgb2YgYSByZWxhdGlvbnNoaXAgb3IgYSBtYW5kYXRlLgoKQXMgd2l0aCBbYEVudGl0eVN0YXR1c2BdLCBgRXhwaXJlZGAgaXMgZGVyaXZlZCBmcm9tIHRoZSBjbGFpbSdzIGVuZCBkYXRlIGF0CnJlYWQgdGltZSBhbmQgaXMgbmV2ZXIgd3JpdHRlbi4AAAAAAAAAC0NsYWltU3RhdHVzAAAAAAcAAAAAAAAABkFjdGl2ZQAAAAAAAAAAADlSYW4gaXRzIGNvdXJzZSDigJQgZW1wbG95bWVudCBlbmRlZCwgZW5nYWdlbWVudCBmaW5pc2hlZC4AAAAAAAAFRW5kZWQAAAAAAAABAAAAJUZyb3plbiBwZW5kaW5nIHJldmlldyBvZiBhIGNvbXBsYWludC4AAAAAAAAJU3VzcGVuZGVkAAAAAAAAAgAAADdQdWxsZWQgYnkgdGhlIGF0dGVzdGluZyBvcmdhbmlzYXRpb24gb3IgYnkgdGhlIHN1YmplY3QuAAAAAAlXaXRoZHJhd24AAAAAAAADAAAAMUEgY29tcGxhaW50IGhhcyBiZWVuIHJhaXNlZCBhbmQgbm90IHlldCByZXNvbHZlZC4AAAAAAAAIRGlzcHV0ZWQAAAAEAAAAH01hbmRhdGUgZGVsaXZlcmVkIHN1Y2Nlc3NmdWxseS4AAAAACUNvbXBsZXRlZAAAAAAAAAUAAAAbRGVyaXZlZCBvbmx5LiBOZXZlciBzdG9yZWQuAAAAAAdFeHBpcmVkAAAAAAY=",
        "AAAAAwAAAEdXaGF0IGEgcmVwcmVzZW50YXRpdmUgaXMgYXV0aG9yaXNlZCB0byBkbyBvbiB0aGUgb3JnYW5pc2F0aW9uJ3MgYmVoYWxmLgAAAAAAAAAAC01hbmRhdGVUeXBlAAAAAAkAAAAAAAAAC1JlY3J1aXRtZW50AAAAAAAAAAAAAAAABVNhbGVzAAAAAAAAAQAAAAAAAAAKQ29uc3VsdGluZwAAAAAAAgAAAAAAAAAOSW1wbGVtZW50YXRpb24AAAAAAAMAAAAAAAAADkNvbW11bmljYXRpb25zAAAAAAAEAAAAAAAAAAVMZWdhbAAAAAAAAAUAAAAAAAAACEFkdmlzb3J5AAAABgAAAAAAAAATRXZlbnRSZXByZXNlbnRhdGlvbgAAAAAHAAAAAAAAAAtQYXJ0bmVyc2hpcAAAAAAI",
        "AAAAAwAAARdXaG8gc3RhbmRzIGJlaGluZCBhIGNsYWltIOKAlCB0aGUgc2luZ2xlIG1vc3QgaW1wb3J0YW50IGZpZWxkIGZvciBhIHJlYWRlci4KClRoZSBzdHJhdGVneSBkb2N1bWVudCBwcm9wb3NlcyB0d28gYXR0ZXN0YXRpb24gdGllcnM6IGEgY2hlYXAgc2VsZi1hc3NlcnRlZApvbmUgYmFja2VkIG9ubHkgYnkgdGhlIHJlY3J1aXRlcidzIG93biByZXB1dGF0aW9uLCBhbmQgYSBwcmVtaXVtIG9uZSB0aGUKaGlyaW5nIGNvbXBhbnkgY29uZmlybXMuIEJvdGggYXJlIHJlcHJlc2VudGFibGUgaGVyZS4AAAAAAAAAAAxDb25maXJtYXRpb24AAAADAAAAcVRoZSByZXByZXNlbnRhdGl2ZSBhc3NlcnRlZCB0aGlzIHRoZW1zZWx2ZXMuIEJhY2tlZCBieSB0aGVpciBiYWRnZSwgbm90CmJ5IHRoZSBvcmdhbmlzYXRpb24uIENoZWFwLCBmYXN0LCB3ZWFrZXIuAAAAAAAADFNlbGZBc3NlcnRlZAAAAAAAAABdVGhlIG9yZ2FuaXNhdGlvbidzIG93biBjb250cm9sbGVyIGtleSBzaWduZWQgdGhlIHdyaXRlLiBUaGlzIGlzIHRoZQoiY29tcGFueS1jb25maXJtZWQiIHRpZXIuAAAAAAAAFUNvdW50ZXJwYXJ0eUNvbmZpcm1lZAAAAAAAAAEAAACLSm9iaXRlZCByZWNvcmRlZCBpdCBhZnRlciBhbiBvdXQtb2YtYmFuZCBjaGVjayAoRE5TIHJlY29yZCwgZW1haWwtZG9tYWluCmNoYWxsZW5nZSwgbGlnaHQgS1lCKSBvbiBiZWhhbGYgb2YgYW4gb3JnYW5pc2F0aW9uIHdpdGggbm8gd2FsbGV0LgAAAAAPSXNzdWVyQ29uZmlybWVkAAAAAAI=",
        "AAAAAwAAAOBMaWZlY3ljbGUgc3RhdGUgb2YgYW4gZW50aXR5J3MgdmVyaWZpZWQgc3RhdHVzLgoKYEV4cGlyZWRgIGlzIG5ldmVyIHdyaXR0ZW4gdG8gc3RvcmFnZTogaXQgaXMgZGVyaXZlZCBmcm9tIGBleHBpcmVzX2F0YCBhdApyZWFkIHRpbWUsIHNvIGJhZGdlcyBhZ2Ugb3V0IHdpdGhvdXQgYSBjcm9uIGpvYi4gUmVhZHMgZ28gdGhyb3VnaApbYGNyYXRlOjplZmZlY3RpdmVfZW50aXR5X3N0YXR1c2BdLgAAAAAAAAAMRW50aXR5U3RhdHVzAAAABAAAAAAAAAAGQWN0aXZlAAAAAAAAAAAAQFRlbXBvcmFyaWx5IHdpdGhoZWxkIOKAlCBlLmcuIHdoaWxlIGEgY29tcGxhaW50IGlzIHVuZGVyIHJldmlldy4AAAAJU3VzcGVuZGVkAAAAAAAAAQAAACBQZXJtYW5lbnRseSB3aXRoZHJhd24uIFRlcm1pbmFsLgAAAAdSZXZva2VkAAAAAAIAAAAbRGVyaXZlZCBvbmx5LiBOZXZlciBzdG9yZWQuAAAAAAdFeHBpcmVkAAAAAAM=",
        "AAAAAQAAAENBbiBvcmdhbmlzYXRpb24ncyBhdHRlc3RhdGlvbiBhYm91dCBhIHBlcnNvbidzIGFmZmlsaWF0aW9uIHdpdGggaXQuAAAAAAAAAAAMUmVsYXRpb25zaGlwAAAADgAAAB5UaGUga2V5IHRoYXQgc2lnbmVkIHRoZSB3cml0ZS4AAAAAAAthdHRlc3RlZF9ieQAAAAATAAAAAAAAAAxjb25maXJtYXRpb24AAAfQAAAADENvbmZpcm1hdGlvbgAAAAAAAAAMY29uZmlybWVkX2F0AAAABgAAAChPcHRpb25hbCBkZXBhcnRtZW50LiBFbXB0eSBpZiBub3QgZ2l2ZW4uAAAACmRlcGFydG1lbnQAAAAAABAAAAA8U0hBLTI1NiBvZiB0aGUgb2ZmLWNoYWluIGRldGFpbCBkb2N1bWVudCBiYWNraW5nIHRoaXMgY2xhaW0uAAAAC2RldGFpbF9oYXNoAAAAA+4AAAAgAAAAIFVuaXggc2Vjb25kcy4gYDBgIG1lYW5zIG9uZ29pbmcuAAAACGVuZF9kYXRlAAAABgAAAEBTZXF1ZW50aWFsIGNsYWltIGlkLCB1bmlxdWUgYWNyb3NzIHJlbGF0aW9uc2hpcHMgKmFuZCogbWFuZGF0ZXMuAAAAAmlkAAAAAAAGAAAAKEVudGl0eSBpZCBvZiB0aGUgYXR0ZXN0aW5nIG9yZ2FuaXNhdGlvbi4AAAADb3JnAAAAAAYAAAAZRW50aXR5IGlkIG9mIHRoZSBzdWJqZWN0LgAAAAAAAAZwZXJzb24AAAAAAAYAAACPVGhlIHN1YmplY3QncyBjb25zZW50IHRvIHRoaXMgY2xhaW0gYmVpbmcgc2hvd24gcHVibGljbHkuIFdoZW4gZmFsc2UgdGhlCnJlY29yZCBzdGlsbCBleGlzdHMgb24tY2hhaW4gYnV0IHRoZSB2ZXJpZmllciBwYWdlIG11c3Qgbm90IHJlbmRlciBpdC4AAAAADnB1YmxpY19kaXNwbGF5AAAAAAABAAAAAAAAAAhyZWxfdHlwZQAAB9AAAAAQUmVsYXRpb25zaGlwVHlwZQAAAC1Kb2IgdGl0bGUsIGUuZy4gIlNlbmlvciBUZWNobmljYWwgUmVjcnVpdGVyIi4AAAAAAAAEcm9sZQAAABAAAAAAAAAACnN0YXJ0X2RhdGUAAAAAAAYAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtDbGFpbVN0YXR1cwA=",
        "AAAAAwAAAElIb3cgYSBwZXJzb24gaXMgYWZmaWxpYXRlZCB3aXRoIGFuIG9yZ2FuaXNhdGlvbi4gTWlycm9ycyB0aGUgZXhwbG9yZXIgVUkuAAAAAAAAAAAAABBSZWxhdGlvbnNoaXBUeXBlAAAABwAAAAAAAAAPQ3VycmVudEVtcGxveWVlAAAAAAAAAAAAAAAADFBhc3RFbXBsb3llZQAAAAEAAAAAAAAAEUN1cnJlbnRDb250cmFjdG9yAAAAAAAAAgAAAAAAAAAOUGFzdENvbnRyYWN0b3IAAAAAAAMAAAAAAAAAFkV4dGVybmFsUmVwcmVzZW50YXRpdmUAAAAAAAQAAAAAAAAAFEFnZW5jeVJlcHJlc2VudGF0aXZlAAAABQAAAAAAAAAHQWR2aXNvcgAAAAAG",
        "AAAABQAAADNBbiB1cGhlbGQgY29tcGxhaW50IHdhcyByZWNvcmRlZCBhZ2FpbnN0IGFuIGVudGl0eS4AAAAAAAAAAAtTdHJpa2VBZGRlZAAAAAABAAAADHN0cmlrZV9hZGRlZAAAAAMAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAHc3RyaWtlcwAAAAAEAAAAAAAAAAAAAAACYnkAAAAAABMAAAAAAAAAAg==",
        "AAAABQAAAEFBbiBvcmdhbmlzYXRpb24gYXV0aG9yaXNlZCBhIHJlcHJlc2VudGF0aXZlIHRvIGFjdCBvbiBpdHMgYmVoYWxmLgAAAAAAAAAAAAANTWFuZGF0ZUlzc3VlZAAAAAAAAAEAAAAObWFuZGF0ZV9pc3N1ZWQAAAAAAAgAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAADb3JnAAAAAAYAAAABAAAAAAAAAA5yZXByZXNlbnRhdGl2ZQAAAAAABgAAAAEAAAAAAAAADG1hbmRhdGVfdHlwZQAAB9AAAAALTWFuZGF0ZVR5cGUAAAAAAAAAAAAAAAAKdmFsaWRfZnJvbQAAAAAABgAAAAAAAAAAAAAAC3ZhbGlkX3VudGlsAAAAAAYAAAAAAAAAAAAAAAxjb25maXJtYXRpb24AAAfQAAAADENvbmZpcm1hdGlvbgAAAAAAAAAAAAAAC2F0dGVzdGVkX2J5AAAAABMAAAAAAAAAAg==",
        "AAAABQAAAHdBIHJlbGF0aW9uc2hpcCBvciBtYW5kYXRlIGNoYW5nZWQgc3RhdGUuIFRoaXMgaXMgdGhlIHJldm9jYXRpb24gZmVlZCB0aGUKdmVyaWZpZXIgcGFnZSBhbmQgdGhlIGJyb3dzZXIgZXh0ZW5zaW9uIHdhdGNoLgAAAAAAAAAADkNsYWltU3RhdHVzU2V0AAAAAAABAAAAEGNsYWltX3N0YXR1c19zZXQAAAADAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAABnN0YXR1cwAAAAAH0AAAAAtDbGFpbVN0YXR1cwAAAAABAAAAAAAAAAJieQAAAAAAEwAAAAAAAAAC",
        "AAAABQAAAEhBbiBlbnRpdHkncyB2ZXJpZmllZCBzdGF0dXMgY2hhbmdlZCAoc3VzcGVuZCwgcmV2b2tlLCByZWluc3RhdGUsIHJlbmV3KS4AAAAAAAAAD0VudGl0eVN0YXR1c1NldAAAAAABAAAAEWVudGl0eV9zdGF0dXNfc2V0AAAAAAAABAAAAAAAAAACaWQAAAAAAAYAAAABAAAAAAAAAAZzdGF0dXMAAAAAB9AAAAAMRW50aXR5U3RhdHVzAAAAAQAAAAAAAAAKZXhwaXJlc19hdAAAAAAABgAAAAAAAAAAAAAAAmJ5AAAAAAATAAAAAAAAAAI=",
        "AAAABQAAADFBIG5ldyBvcmdhbmlzYXRpb24gb3IgcGVyc29uIHBhc3NlZCB2ZXJpZmljYXRpb24uAAAAAAAAAAAAABBFbnRpdHlSZWdpc3RlcmVkAAAAAQAAABFlbnRpdHlfcmVnaXN0ZXJlZAAAAAAAAAcAAAAAAAAAAmlkAAAAAAAGAAAAAQAAAAAAAAAEa2luZAAAB9AAAAAKRW50aXR5S2luZAAAAAAAAQAAAAAAAAAKY29udHJvbGxlcgAAAAAAEwAAAAEAAAAAAAAABmhhbmRsZQAAAAAAEAAAAAAAAAAAAAAABmlzc3VlcgAAAAAAEwAAAAAAAAAAAAAAC3ZlcmlmaWVkX2F0AAAAAAYAAAAAAAAAAAAAAApleHBpcmVzX2F0AAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAD9BbiBlbnRpdHkncyBiYWRnZSBtb3ZlZCB0byBhIG5ldyBrZXkgYWZ0ZXIgYSBrZXktbG9zcyByZWNvdmVyeS4AAAAAAAAAABFDb250cm9sbGVyUm90YXRlZAAAAAAAAAEAAAASY29udHJvbGxlcl9yb3RhdGVkAAAAAAADAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAADm9sZF9jb250cm9sbGVyAAAAAAATAAAAAQAAAAAAAAAObmV3X2NvbnRyb2xsZXIAAAAAABMAAAABAAAAAg==",
        "AAAABQAAADBBbiBvcmdhbmlzYXRpb24gYXR0ZXN0ZWQgYSBwZXJzb24ncyBhZmZpbGlhdGlvbi4AAAAAAAAAFFJlbGF0aW9uc2hpcEF0dGVzdGVkAAAAAQAAABVyZWxhdGlvbnNoaXBfYXR0ZXN0ZWQAAAAAAAAGAAAAAAAAAAJpZAAAAAAABgAAAAEAAAAAAAAAA29yZwAAAAAGAAAAAQAAAAAAAAAGcGVyc29uAAAAAAAGAAAAAQAAAAAAAAAIcmVsX3R5cGUAAAfQAAAAEFJlbGF0aW9uc2hpcFR5cGUAAAAAAAAAAAAAAAxjb25maXJtYXRpb24AAAfQAAAADENvbmZpcm1hdGlvbgAAAAAAAAAAAAAAC2F0dGVzdGVkX2J5AAAAABMAAAAAAAAAAg==" ]),
      options
    )
  }
  public readonly fromJSON = {
    admin: this.txFromJSON<Result<string>>,
        check: this.txFromJSON<Option<Check>>,
        paused: this.txFromJSON<boolean>,
        arbiter: this.txFromJSON<Result<string>>,
        upgrade: this.txFromJSON<Result<void>>,
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
        is_authorised: this.txFromJSON<boolean>,
        issue_mandate: this.txFromJSON<Result<u64>>,
        propose_admin: this.txFromJSON<Result<void>>,
        mandate_status: this.txFromJSON<Option<ClaimStatus>>,
        register_entity: this.txFromJSON<Result<u64>>,
        update_metadata: this.txFromJSON<Result<void>>,
        end_relationship: this.txFromJSON<Result<void>>,
        get_relationship: this.txFromJSON<Option<Relationship>>,
        mandates_held_by: this.txFromJSON<Array<u64>>,
        rotate_controller: this.txFromJSON<Result<void>>,
        set_entity_status: this.txFromJSON<Result<void>>,
        mandates_issued_by: this.txFromJSON<Array<u64>>,
        set_mandate_status: this.txFromJSON<Result<void>>,
        set_public_display: this.txFromJSON<Result<void>>,
        attest_relationship: this.txFromJSON<Result<u64>>,
        relationship_status: this.txFromJSON<Option<ClaimStatus>>,
        relationships_about: this.txFromJSON<Array<u64>>,
        get_entity_by_handle: this.txFromJSON<Option<Entity>>,
        set_relationship_status: this.txFromJSON<Result<void>>,
        get_entity_by_controller: this.txFromJSON<Option<Entity>>,
        relationships_attested_by: this.txFromJSON<Array<u64>>
  }
}