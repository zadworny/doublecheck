//! Contract events.
//!
//! Every state change emits one. The on-chain index vectors in `DataKey` are an
//! MVP convenience for a frontend with no backend; these events are the real
//! feed an indexer should build the explorer from once the registry outgrows
//! `MAX_INDEX_LEN` claims per entity.

use crate::types::{
    ClaimStatus, Confirmation, EntityKind, EntityStatus, MandateType, RelationshipType,
};
use soroban_sdk::{contractevent, Address, BytesN, String};

/// A new organisation or person passed verification.
#[contractevent]
pub struct EntityRegistered {
    #[topic]
    pub id: u64,
    #[topic]
    pub kind: EntityKind,
    #[topic]
    pub controller: Address,
    pub handle: String,
    pub issuer: Address,
    pub verified_at: u64,
    pub expires_at: u64,
}

/// The issuer completed review and offered a badge to its controller. It is
/// not verified until the controller accepts.
#[contractevent]
pub struct EntityProposed {
    #[topic]
    pub pending_id: u64,
    #[topic]
    pub kind: EntityKind,
    #[topic]
    pub controller: Address,
    pub handle: String,
    pub issuer: Address,
    pub metadata_hash: BytesN<32>,
    pub terms_hash: BytesN<32>,
    pub accept_by: u64,
    pub expires_at: u64,
}

/// The intended controller accepted the exact pending badge and terms. This
/// event links the proposal id to the permanent entity id for indexers and
/// independent consent audits.
#[contractevent]
pub struct EntityAccepted {
    #[topic]
    pub pending_id: u64,
    #[topic]
    pub entity_id: u64,
    #[topic]
    pub controller: Address,
    pub issuer: Address,
    pub metadata_hash: BytesN<32>,
    pub terms_hash: BytesN<32>,
    pub accepted_at: u64,
}

/// A pending issuance was cancelled or expired before acceptance.
#[contractevent]
pub struct EntityProposalCancelled {
    #[topic]
    pub pending_id: u64,
    pub by: Address,
}

/// An entity's verified status changed (suspend, revoke, reinstate, renew).
#[contractevent]
pub struct EntityStatusSet {
    #[topic]
    pub id: u64,
    #[topic]
    pub status: EntityStatus,
    pub expires_at: u64,
    pub by: Address,
}

/// The issuer anchored a replacement off-chain credential.
#[contractevent]
pub struct MetadataUpdated {
    #[topic]
    pub id: u64,
    pub metadata_hash: BytesN<32>,
    pub metadata_uri: String,
    pub by: Address,
}

/// The current controller began an issuer-reviewed key rotation.
#[contractevent]
pub struct ControllerRotationProposed {
    #[topic]
    pub id: u64,
    #[topic]
    pub current_controller: Address,
    #[topic]
    pub proposed_controller: Address,
}

/// The issuer approved the exact pending destination after its recovery review.
#[contractevent]
pub struct ControllerRotationApproved {
    #[topic]
    pub id: u64,
    #[topic]
    pub proposed_controller: Address,
    pub approved_by: Address,
}

/// A pending controller recovery was cancelled before the destination accepted.
#[contractevent]
pub struct ControllerRotationCancelled {
    #[topic]
    pub id: u64,
    #[topic]
    pub proposed_controller: Address,
    pub cancelled_by: Address,
}

/// An entity's badge moved to a new key after a key-loss recovery.
#[contractevent]
pub struct ControllerRotated {
    #[topic]
    pub id: u64,
    #[topic]
    pub old_controller: Address,
    #[topic]
    pub new_controller: Address,
}

/// An upheld complaint was recorded against an entity.
#[contractevent]
pub struct StrikeAdded {
    #[topic]
    pub id: u64,
    pub strikes: u32,
    pub by: Address,
}

/// An organisation attested a person's affiliation.
#[contractevent]
pub struct RelationshipAttested {
    #[topic]
    pub id: u64,
    #[topic]
    pub org: u64,
    #[topic]
    pub person: u64,
    pub rel_type: RelationshipType,
    pub public_display: bool,
    pub confirmation: Confirmation,
    pub attested_by: Address,
}

/// A relationship was closed with an explicit end date.
#[contractevent]
pub struct RelationshipEnded {
    #[topic]
    pub id: u64,
    pub end_date: u64,
    pub by: Address,
}

/// The subject changed whether the public verifier may display a relationship.
#[contractevent]
pub struct PublicDisplaySet {
    #[topic]
    pub id: u64,
    pub public_display: bool,
    pub by: Address,
}

/// An organisation authorised a representative to act on its behalf.
#[contractevent]
pub struct MandateIssued {
    #[topic]
    pub id: u64,
    #[topic]
    pub org: u64,
    #[topic]
    pub representative: u64,
    pub mandate_type: MandateType,
    pub valid_from: u64,
    pub valid_until: u64,
    pub confirmation: Confirmation,
    pub attested_by: Address,
}

/// A relationship or mandate changed state. This is the revocation feed the
/// verifier page and the browser extension watch.
#[contractevent]
pub struct ClaimStatusSet {
    #[topic]
    pub id: u64,
    #[topic]
    pub status: ClaimStatus,
    pub by: Address,
}

/// A two-step administrative handover was proposed.
#[contractevent]
pub struct AdminProposed {
    #[topic]
    pub current_admin: Address,
    #[topic]
    pub proposed_admin: Address,
}

/// A proposed administrator accepted responsibility.
#[contractevent]
pub struct AdminAccepted {
    #[topic]
    pub previous_admin: Address,
    #[topic]
    pub new_admin: Address,
}

/// The complaint arbiter role changed.
#[contractevent]
pub struct ArbiterSet {
    #[topic]
    pub arbiter: Address,
    pub by: Address,
}

/// The emergency write pause changed.
#[contractevent]
pub struct PauseSet {
    #[topic]
    pub paused: bool,
    pub by: Address,
}

/// The contract implementation was upgraded in place.
#[contractevent]
pub struct ContractUpgraded {
    pub wasm_hash: BytesN<32>,
    pub by: Address,
}
