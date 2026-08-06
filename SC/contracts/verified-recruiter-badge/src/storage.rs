//! Storage access and TTL bookkeeping.
//!
//! Soroban charges rent: an entry that is not extended is archived and stops
//! being readable. Every read and write here bumps the entry it touches, so an
//! entity that is actively being checked stays live for free. Entities nobody
//! looks at for three months get archived and must be restored before the next
//! read — which is the correct behaviour for the registry, since an archived
//! badge is also an unrenewed one.

use soroban_sdk::{Address, Env, String, Vec};

use crate::types::{DataKey, Entity, Error, Mandate, Relationship, MAX_INDEX_LEN};

/// Ledgers per day at the ~5 second close time Stellar targets.
pub const DAY_IN_LEDGERS: u32 = 17_280;

/// Entries are extended to 120 days.
///
/// Mainnet's `state_archival` settings as of protocol 27 are
/// `min_persistent_ttl = 2_073_600` ledgers (120 days) and
/// `max_entry_ttl = 3_110_400` (180 days). Extending to exactly the minimum is
/// valid on every network without tracking each one's ceiling, and it is
/// cheaper rent than pushing to the maximum. Nothing is lost: every read in
/// this module extends what it touched, so a badge anyone is still checking
/// never archives.
pub const EXTEND_TO: u32 = 120 * DAY_IN_LEDGERS;
/// …whenever fewer than 45 days remain, so a quiet quarter is survivable.
pub const EXTEND_THRESHOLD: u32 = 45 * DAY_IN_LEDGERS;

pub fn extend_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(EXTEND_THRESHOLD, EXTEND_TO);
}

fn extend_record(env: &Env, key: &DataKey) {
    env.storage()
        .persistent()
        .extend_ttl(key, EXTEND_THRESHOLD, EXTEND_TO);
}

// ---------------------------------------------------------------------------
// Config (instance storage)
// ---------------------------------------------------------------------------

pub fn admin(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Admin)
        .ok_or(Error::NotInitialized)
}

pub fn set_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::Admin, admin);
}

pub fn pending_admin(env: &Env) -> Option<Address> {
    env.storage().instance().get(&DataKey::PendingAdmin)
}

pub fn set_pending_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&DataKey::PendingAdmin, admin);
}

pub fn clear_pending_admin(env: &Env) {
    env.storage().instance().remove(&DataKey::PendingAdmin);
}

pub fn arbiter(env: &Env) -> Result<Address, Error> {
    env.storage()
        .instance()
        .get(&DataKey::Arbiter)
        .ok_or(Error::NotInitialized)
}

pub fn set_arbiter(env: &Env, arbiter: &Address) {
    env.storage().instance().set(&DataKey::Arbiter, arbiter);
}

pub fn paused(env: &Env) -> bool {
    env.storage()
        .instance()
        .get(&DataKey::Paused)
        .unwrap_or(false)
}

pub fn set_paused(env: &Env, paused: bool) {
    env.storage().instance().set(&DataKey::Paused, &paused);
}

pub fn entity_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::EntityCount)
        .unwrap_or(0)
}

pub fn claim_count(env: &Env) -> u64 {
    env.storage()
        .instance()
        .get(&DataKey::ClaimCount)
        .unwrap_or(0)
}

/// Reserves and returns the next entity id. Ids start at 1, so `0` is free to
/// mean "none".
pub fn next_entity_id(env: &Env) -> u64 {
    let id = entity_count(env) + 1;
    env.storage().instance().set(&DataKey::EntityCount, &id);
    id
}

/// Reserves and returns the next claim id. Relationships and mandates share one
/// id space so a single id is enough to look a claim up.
pub fn next_claim_id(env: &Env) -> u64 {
    let id = claim_count(env) + 1;
    env.storage().instance().set(&DataKey::ClaimCount, &id);
    id
}

// ---------------------------------------------------------------------------
// Entities
// ---------------------------------------------------------------------------

pub fn get_entity(env: &Env, id: u64) -> Option<Entity> {
    let key = DataKey::Entity(id);
    let entity: Option<Entity> = env.storage().persistent().get(&key);
    if entity.is_some() {
        extend_record(env, &key);
    }
    entity
}

pub fn require_entity(env: &Env, id: u64) -> Result<Entity, Error> {
    get_entity(env, id).ok_or(Error::EntityNotFound)
}

pub fn put_entity(env: &Env, entity: &Entity) {
    let key = DataKey::Entity(entity.id);
    env.storage().persistent().set(&key, entity);
    extend_record(env, &key);
}

pub fn entity_id_by_handle(env: &Env, handle: &String) -> Option<u64> {
    let key = DataKey::HandleIdx(handle.clone());
    let id: Option<u64> = env.storage().persistent().get(&key);
    if id.is_some() {
        extend_record(env, &key);
    }
    id
}

pub fn put_handle(env: &Env, handle: &String, id: u64) {
    let key = DataKey::HandleIdx(handle.clone());
    env.storage().persistent().set(&key, &id);
    extend_record(env, &key);
}

pub fn entity_id_by_controller(env: &Env, controller: &Address) -> Option<u64> {
    let key = DataKey::ControllerIdx(controller.clone());
    let id: Option<u64> = env.storage().persistent().get(&key);
    if id.is_some() {
        extend_record(env, &key);
    }
    id
}

pub fn put_controller(env: &Env, controller: &Address, id: u64) {
    let key = DataKey::ControllerIdx(controller.clone());
    env.storage().persistent().set(&key, &id);
    extend_record(env, &key);
}

pub fn remove_controller(env: &Env, controller: &Address) {
    env.storage()
        .persistent()
        .remove(&DataKey::ControllerIdx(controller.clone()));
}

// ---------------------------------------------------------------------------
// Claims
// ---------------------------------------------------------------------------

pub fn get_relationship(env: &Env, id: u64) -> Option<Relationship> {
    let key = DataKey::Relationship(id);
    let claim: Option<Relationship> = env.storage().persistent().get(&key);
    if claim.is_some() {
        extend_record(env, &key);
    }
    claim
}

pub fn require_relationship(env: &Env, id: u64) -> Result<Relationship, Error> {
    get_relationship(env, id).ok_or(Error::ClaimNotFound)
}

pub fn put_relationship(env: &Env, claim: &Relationship) {
    let key = DataKey::Relationship(claim.id);
    env.storage().persistent().set(&key, claim);
    extend_record(env, &key);
}

pub fn get_mandate(env: &Env, id: u64) -> Option<Mandate> {
    let key = DataKey::Mandate(id);
    let claim: Option<Mandate> = env.storage().persistent().get(&key);
    if claim.is_some() {
        extend_record(env, &key);
    }
    claim
}

pub fn require_mandate(env: &Env, id: u64) -> Result<Mandate, Error> {
    get_mandate(env, id).ok_or(Error::ClaimNotFound)
}

pub fn put_mandate(env: &Env, claim: &Mandate) {
    let key = DataKey::Mandate(claim.id);
    env.storage().persistent().set(&key, claim);
    extend_record(env, &key);
}

// ---------------------------------------------------------------------------
// Index vectors
// ---------------------------------------------------------------------------

pub fn index(env: &Env, key: &DataKey) -> Vec<u64> {
    let ids: Option<Vec<u64>> = env.storage().persistent().get(key);
    match ids {
        Some(ids) => {
            extend_record(env, key);
            ids
        }
        None => Vec::new(env),
    }
}

/// Appends a claim id to an index vector, refusing to grow past
/// [`MAX_INDEX_LEN`] so a single entity cannot make its own reads unaffordable.
pub fn index_push(env: &Env, key: &DataKey, id: u64) -> Result<(), Error> {
    let mut ids = index(env, key);
    if ids.len() >= MAX_INDEX_LEN {
        return Err(Error::IndexFull);
    }
    ids.push_back(id);
    env.storage().persistent().set(key, &ids);
    extend_record(env, key);
    Ok(())
}
