//! Contract events.
//!
//! Every state change emits one. The on-chain index vectors in `DataKey` are an
//! MVP convenience for a frontend with no backend; these events are the real
//! feed an indexer should build the explorer from once the registry outgrows
//! `MAX_INDEX_LEN` claims per entity.

use crate::types::{ClaimStatus, Confirmation, EntityKind, EntityStatus, MandateType, RelationshipType};
use soroban_sdk::{contractevent, Address, String};

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
    pub confirmation: Confirmation,
    pub attested_by: Address,
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
