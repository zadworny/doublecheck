//! On-chain data model for the DoubleCheck registry.
//!
//! The model has three record types:
//!
//! * [`Entity`] — an organisation or a natural person the issuer has vetted.
//! * [`Relationship`] — an organisation's attestation that a person is (or was)
//!   employed by, contracted to, or otherwise affiliated with it.
//! * [`Mandate`] — an organisation's authorisation for one of those people to
//!   act on its behalf for a scope, a territory and a fixed time window.
//!
//! Free-text fields are deliberately short and structural. Anything that is
//! genuinely personal data (full name, contact details, CV, ID-check evidence)
//! belongs in the off-chain credential referenced by `metadata_uri` and pinned
//! by `metadata_hash`; see `docs/architecture.md` at the repo root.

use soroban_sdk::{contracterror, contracttype, Address, BytesN, String};

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/// Minimum length of a public handle; it forms the verifier's URL segment.
pub const MIN_HANDLE_LEN: u32 = 3;
/// Maximum length of a public handle.
pub const MAX_HANDLE_LEN: u32 = 64;
/// Maximum length of short structural text (role, scope, legal name, domain…).
pub const MAX_TEXT_LEN: u32 = 128;
/// Maximum length of a metadata URI.
pub const MAX_URI_LEN: u32 = 256;
/// Badges must be renewed at least this often. A small grace over one year
/// avoids making leap years and scheduling jitter part of the issuer flow.
pub const MAX_BADGE_LIFETIME: u64 = 400 * 24 * 60 * 60;
/// A mandate must be reviewed at least annually as well.
pub const MAX_MANDATE_LIFETIME: u64 = 366 * 24 * 60 * 60;
/// A controller must accept a proposed badge within this window.
pub const MAX_ACCEPT_WINDOW: u64 = 30 * 24 * 60 * 60;
/// Maximum entity and claim records one submitted keeper invocation touches.
pub const MAX_KEEPALIVE_BATCH: u32 = 50;
/// Maximum number of claim ids held in one on-chain index vector.
///
/// The index vectors exist so the explorer works with no off-chain indexer at
/// MVP scale. Past this many claims per entity the caller must read the
/// contract's events instead.
pub const MAX_INDEX_LEN: u32 = 512;
/// Maximum simultaneous live or scheduled confirmations for one exact pair.
///
/// This is deliberately lower than the discovery-index bound: resolving each
/// id reads a separate ledger entry, and Stellar caps a transaction's ledger
/// footprint. Sixty-four leaves room for linked relationship reads and normal
/// contract bookkeeping under the network limit.
pub const MAX_CONFIRMED_PAIR_LEN: u32 = 64;
/// Maximum mandate records inspected by one strict authorisation read across
/// the confirmed index and legacy fallbacks. A linked mandate can require a
/// second ledger read for its relationship, so this keeps the worst case below
/// Stellar's transaction footprint ceiling.
pub const MAX_AUTHORISATION_SCAN: u32 = 128;

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/// What kind of subject an [`Entity`] record describes.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntityKind {
    /// A company, agency or other legal person.
    Organisation = 0,
    /// A natural person — typically a recruiter or a company representative.
    Person = 1,
}

/// Lifecycle state of an entity's verified status.
///
/// `Expired` is never written to storage: it is derived from `expires_at` at
/// read time, so badges age out without a cron job. Reads go through
/// [`crate::effective_entity_status`].
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum EntityStatus {
    Active = 0,
    /// Temporarily withheld — e.g. while a complaint is under review.
    Suspended = 1,
    /// Permanently withdrawn. Terminal.
    Revoked = 2,
    /// Derived only. Never stored.
    Expired = 3,
}

/// How a person is affiliated with an organisation. Mirrors the explorer UI.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RelationshipType {
    CurrentEmployee = 0,
    PastEmployee = 1,
    CurrentContractor = 2,
    PastContractor = 3,
    ExternalRepresentative = 4,
    AgencyRepresentative = 5,
    Advisor = 6,
}

/// What a representative is authorised to do on the organisation's behalf.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum MandateType {
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

/// Lifecycle state of a relationship or a mandate.
///
/// As with [`EntityStatus`], `Expired` is derived from the claim's end date at
/// read time and is never written.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ClaimStatus {
    Active = 0,
    /// Ran its course — employment ended, engagement finished.
    Ended = 1,
    /// Frozen pending review of a complaint.
    Suspended = 2,
    /// Pulled by the attesting organisation or by the subject.
    Withdrawn = 3,
    /// A complaint has been raised and not yet resolved.
    Disputed = 4,
    /// Mandate delivered successfully.
    Completed = 5,
    /// Derived only. Never stored.
    Expired = 6,
}

/// Who stands behind a claim — the single most important field for a reader.
///
/// The strategy document proposes two attestation tiers: a cheap self-asserted
/// one backed only by the recruiter's own reputation, and a premium one the
/// hiring company confirms. Both are representable here.
#[contracttype]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Confirmation {
    /// The representative asserted this themselves. Backed by their badge, not
    /// by the organisation. Cheap, fast, weaker.
    SelfAsserted = 0,
    /// The organisation's own controller key signed the write. This is the
    /// "company-confirmed" tier.
    CounterpartyConfirmed = 1,
    /// The issuer recorded it after an out-of-band check (DNS record,
    /// email-domain challenge, light KYB) on behalf of an organisation that
    /// holds no key of its own.
    IssuerConfirmed = 2,
}

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

/// A vetted organisation or person.
///
/// The badge is soulbound: `controller` is set at registration and there is no
/// holder-only transfer function. A controller change requires the current
/// controller, issuer approval and the destination controller, so the holder
/// and destination cannot move verified status without issuer re-approval.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Entity {
    /// Sequential id, assigned by the contract. Stable forever.
    pub id: u64,
    pub kind: EntityKind,
    /// The wallet that acts for this entity. Soulbound to the subject.
    pub controller: Address,
    /// Unique public slug used by the verifier page.
    pub handle: String,
    /// Organisations: registered legal name. Natural persons: leave empty and
    /// serve the name from the off-chain credential — see `docs/architecture.md`.
    pub display_name: String,
    /// Primary domain, used for the DNS / email-domain challenge. Empty for
    /// natural persons.
    pub domain: String,
    /// Free-text jurisdiction, e.g. "Germany". Empty if not applicable.
    pub jurisdiction: String,
    /// SHA-256 of the canonical off-chain credential JSON. Lets any reader
    /// prove the fetched profile matches the content the issuer anchored and
    /// vetted.
    pub metadata_hash: BytesN<32>,
    /// Where that credential is served from (https / ipfs).
    pub metadata_uri: String,
    /// The address that performed the verification. This is the badge's fixed
    /// lifecycle authority for metadata, renewal, revocation and recovery; a
    /// later global admin handover does not rewrite it.
    pub issuer: Address,
    pub status: EntityStatus,
    pub verified_at: u64,
    /// Unix seconds. Always non-zero; trust must be periodically renewed.
    pub expires_at: u64,
    /// Count of upheld complaints. Reputation collateral in place of a cash
    /// stake — see `docs/architecture.md`.
    pub strikes: u32,
}

/// A vetted badge waiting for the subject/controller to accept it.
///
/// Verification happens off-chain first. The issuer then commits the exact
/// public record, credential hash and terms version here. Nothing becomes a
/// verified [`Entity`] until `controller` authorises `accept_entity`.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct PendingEntity {
    pub id: u64,
    pub kind: EntityKind,
    pub controller: Address,
    pub handle: String,
    pub display_name: String,
    pub domain: String,
    pub jurisdiction: String,
    pub metadata_hash: BytesN<32>,
    pub metadata_uri: String,
    pub issuer: Address,
    /// Hash of the code of conduct / issuance terms accepted by the subject.
    pub terms_hash: BytesN<32>,
    pub proposed_at: u64,
    pub accept_by: u64,
    pub expires_at: u64,
}

/// An organisation's attestation about a person's affiliation with it.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Relationship {
    /// Sequential claim id, unique across relationships *and* mandates.
    pub id: u64,
    /// Entity id of the attesting organisation.
    pub org: u64,
    /// Entity id of the subject.
    pub person: u64,
    pub rel_type: RelationshipType,
    /// Job title, e.g. "Senior Technical Recruiter".
    pub role: String,
    /// Optional department. Empty if not given.
    pub department: String,
    pub start_date: u64,
    /// Unix seconds. `0` means ongoing.
    pub end_date: u64,
    pub status: ClaimStatus,
    pub confirmation: Confirmation,
    /// The subject's consent to this claim being shown publicly. When false the
    /// record still exists on-chain but the verifier page must not render it.
    pub public_display: bool,
    /// SHA-256 of the off-chain detail document backing this claim.
    pub detail_hash: BytesN<32>,
    pub confirmed_at: u64,
    /// The key that signed the write.
    pub attested_by: Address,
}

/// An authorisation for a person or organisation/agency representative to act
/// on an organisation's behalf.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Mandate {
    /// Sequential claim id, unique across relationships *and* mandates.
    pub id: u64,
    pub org: u64,
    /// Entity id of the representative.
    pub representative: u64,
    /// Relationship this mandate rests on. `0` if standalone.
    pub relationship: u64,
    pub mandate_type: MandateType,
    /// What they may do, e.g. "Engineering hiring for the robotics division".
    pub scope: String,
    /// Optional territory. Empty if worldwide / not applicable.
    pub territory: String,
    pub valid_from: u64,
    /// Unix seconds. Mandates are always time-bound, so this is never `0`.
    pub valid_until: u64,
    pub status: ClaimStatus,
    pub confirmation: Confirmation,
    pub detail_hash: BytesN<32>,
    pub confirmed_at: u64,
    pub attested_by: Address,
}

/// The answer to the only question the verifier page really asks:
/// *is this counterparty real, right now?*
///
/// Returned by a single contract call so a wallet-free verifier can render a
/// page from one RPC round trip.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Check {
    pub entity: Entity,
    /// `entity.status` with expiry applied. Read this, not `entity.status`.
    pub effective_status: EntityStatus,
    /// True only when `effective_status == Active`.
    pub valid: bool,
    /// Relationships this entity is a party to. Organisations: ones they
    /// attested. Persons: ones about them.
    pub relationships: u32,
    /// Mandates this entity is a party to. Organisations: ones they issued.
    /// Persons: ones they hold.
    pub mandates: u32,
    /// Ledger timestamp the answer was computed at.
    pub checked_at: u64,
}

/// Cursor returned by a bounded, submitted storage keepalive invocation.
#[contracttype]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct KeepaliveResult {
    pub next_entity: u64,
    pub next_claim: u64,
    pub entities_touched: u32,
    pub claims_touched: u32,
    pub done: bool,
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------

/// Records live in persistent storage; configuration lives in instance storage
/// so it is bumped along with the contract itself.
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    /// Current authority for new issuance, configuration and upgrades. Existing
    /// badges keep their own immutable [`Entity::issuer`] authority.
    Admin,
    /// Proposed admin in the two-step handover.
    PendingAdmin,
    /// Controller proposed by the current controller for an entity. This key is
    /// retained unchanged so proposals written by an older contract remain
    /// readable after an upgrade.
    PendingController(u64),
    /// Address allowed to record the outcome of the off-chain complaint queue.
    Arbiter,
    /// Emergency stop on all writes except admin/arbiter recovery.
    Paused,
    /// Monotonic entity id counter.
    EntityCount,
    /// Monotonic pending-issuance id counter.
    PendingEntityCount,
    /// Monotonic claim id counter, shared by relationships and mandates.
    ClaimCount,

    /// Entity by id.
    Entity(u64),
    /// Address that imposed the current entity suspension. An arbiter may lift
    /// its own hold but cannot undo one imposed by the issuer.
    EntitySuspendedBy(u64),
    /// Entity id by handle. Enforces handle uniqueness.
    HandleIdx(String),
    /// Entity id by controller address. Enforces one badge per key.
    ControllerIdx(Address),

    /// Pending issuance by proposal id.
    PendingEntity(u64),
    /// Proposal id by reserved handle.
    PendingHandleIdx(String),
    /// Proposal id by reserved controller.
    PendingControllerIdx(Address),

    /// Relationship by claim id.
    Relationship(u64),
    /// Mandate by claim id.
    Mandate(u64),

    /// Claim ids of relationships attested by this organisation.
    OrgRels(u64),
    /// Claim ids of relationships about this person.
    PersonRels(u64),
    /// Claim ids of mandates issued by this organisation.
    OrgMandates(u64),
    /// Claim ids of mandates held by this representative.
    PersonMandates(u64),
    /// Claim ids for one organisation/representative pair. This prevents an
    /// unrelated organisation from crowding a valid pair out of the bounded
    /// representative-wide index retained for legacy records.
    PairMandates(u64, u64),

    /// `(org id, representative id)` -> the most recently written mandate id.
    /// Kept as a fast hint and for backwards compatibility; strict
    /// `is_authorised` scans the rolling confirmed-pair index, then the legacy
    /// general pair and representative indexes, so a newer scheduled or
    /// self-asserted hint cannot mask older live confirmation.
    LiveMandate(u64, u64),

    /// Destination controller the issuer approved for a pending rotation.
    /// Stored separately from [`DataKey::PendingController`] so upgrading with
    /// an old unapproved proposal fails closed until the issuer reviews it.
    ApprovedController(u64),
    /// Relevant organisation- or issuer-confirmed mandate ids for one pair.
    /// Inactive and expired entries are pruned; live and scheduled entries are
    /// never silently evicted. Self-assertions never enter this bounded index.
    ConfirmedPairMandates(u64, u64),
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[contracterror]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum Error {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    NotAuthorized = 3,
    Paused = 4,

    EntityNotFound = 10,
    HandleTaken = 11,
    ControllerTaken = 12,
    InvalidHandle = 13,
    TextTooLong = 14,
    /// The entity is suspended, revoked or expired.
    EntityNotActive = 15,
    /// Expected an organisation, got a person, or the other way round.
    WrongEntityKind = 16,

    ClaimNotFound = 20,
    /// End date before start date, or a mandate with no end at all.
    InvalidDateRange = 21,
    /// The claim is not in a state this transition allows.
    InvalidStatus = 22,
    /// Referenced relationship does not belong to the same org and person.
    RelationshipMismatch = 23,
    /// Trust badges must expire and pass periodic re-verification.
    ExpiryRequired = 24,
    /// The requested badge lifetime exceeds [`MAX_BADGE_LIFETIME`].
    ExpiryTooFar = 25,
    /// Natural-person descriptive data belongs in the off-chain credential.
    PersonalDataNotAllowed = 26,
    /// Credential locations must be non-empty `https://` or `ipfs://` URIs.
    InvalidUri = 27,
    /// Public text contains a control character that can spoof verifier output.
    InvalidText = 28,
    /// Credential and terms hashes must be real anchors, not all-zero values.
    InvalidHash = 29,

    /// A confirmed pair already has [`MAX_CONFIRMED_PAIR_LEN`] live or
    /// scheduled mandates. General discovery indexes remain best-effort.
    IndexFull = 30,
    NoPendingAdmin = 31,
    NoPendingController = 32,
    PendingEntityNotFound = 33,
    PendingEntityExpired = 34,
    InvalidAcceptanceWindow = 35,
    InvalidBatchSize = 36,
    /// The destination attempted to accept before the issuer approved the exact
    /// pending controller address.
    ControllerRotationNotApproved = 37,
    /// A mandate cannot authorise an entity to represent itself.
    SameEntity = 38,
}
