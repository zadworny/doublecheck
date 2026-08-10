#![no_std]
//! # DoubleCheck — Soroban trust registry
//!
//! A public, wallet-free registry of vetted recruiters, the organisations they
//! work for, and the mandates those organisations have given them.
//!
//! ## What is on-chain and what is not
//!
//! On-chain: who was verified, by whom, when, until when, and whether that is
//! still true. Every claim carries the key that signed it, so a reader can tell
//! a company-confirmed mandate from a self-asserted one without trusting
//! the operator's website.
//!
//! Off-chain: the verification evidence (ID scans, KYB reports, references),
//! the complaint queue behind the "report" button, billing, and the human
//! review that decides whether a badge is issued or revoked. Only the *outcome*
//! of those processes is written here.
//!
//! ## Trust model
//!
//! * **admin** — the current issuing authority for new badges, registry
//!   configuration and upgrades. Each accepted badge permanently records its
//!   own [`Entity::issuer`]; that address, not a later admin, renews, updates,
//!   recovers and revokes it. An issuer-confirmed claim is stamped
//!   [`Confirmation::IssuerConfirmed`], never
//!   [`Confirmation::CounterpartyConfirmed`].
//! * **entity controller** — the wallet a verified organisation or person acts
//!   with. An organisation's controller attests its own relationships and
//!   issues its own mandates. A person's controller can always withdraw a claim
//!   about themselves.
//! * **arbiter** — records the outcome of the off-chain complaint pipeline:
//!   marks claims disputed, suspends them, adds strikes.
//!
//! Badges are soulbound. There is no holder-only transfer function; controller
//! recovery requires the current controller to propose, the issuer to approve
//! after review, and the destination controller to accept.

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use types::*;

use soroban_sdk::{contract, contractimpl, contractmeta, Address, BytesN, Env, String, Vec};

use events::{
    AdminAccepted, AdminProposed, ArbiterSet, ClaimStatusSet, ContractUpgraded, ControllerRotated,
    ControllerRotationApproved, ControllerRotationCancelled, ControllerRotationProposed,
    EntityAccepted, EntityProposalCancelled, EntityProposed, EntityRegistered, EntityStatusSet,
    MandateIssued, MetadataUpdated, PauseSet, PublicDisplaySet, RelationshipAttested,
    RelationshipEnded, StrikeAdded,
};

contractmeta!(
    key = "Description",
    val = "DoubleCheck: verified organisations, people, relationships and mandates"
);

// ---------------------------------------------------------------------------
// Derived status
// ---------------------------------------------------------------------------

/// Applies expiry to a stored entity status.
///
/// Expiry is derived rather than stored so no keeper job is needed to age
/// badges out — an unrenewed badge stops reading as valid on its own.
pub fn effective_entity_status(entity: &Entity, now: u64) -> EntityStatus {
    if entity.status == EntityStatus::Active && entity.expires_at != 0 && now > entity.expires_at {
        EntityStatus::Expired
    } else {
        entity.status
    }
}

/// Applies expiry to a stored claim status. `valid_until == 0` means open-ended.
pub fn effective_claim_status(status: ClaimStatus, valid_until: u64, now: u64) -> ClaimStatus {
    if status == ClaimStatus::Active && valid_until != 0 && now > valid_until {
        ClaimStatus::Expired
    } else {
        status
    }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/// Handles become URLs, so they are restricted to `[a-z0-9._-]`. Rejecting
/// uppercase and non-ASCII removes the easiest homograph attack on a verifier
/// link.
fn validate_handle(handle: &String) -> Result<(), Error> {
    let len = handle.len();
    if !(MIN_HANDLE_LEN..=MAX_HANDLE_LEN).contains(&len) {
        return Err(Error::InvalidHandle);
    }
    let mut buf = [0u8; MAX_HANDLE_LEN as usize];
    let slice = &mut buf[..len as usize];
    handle.copy_into_slice(slice);
    for byte in slice.iter() {
        let ok = byte.is_ascii_lowercase()
            || byte.is_ascii_digit()
            || matches!(byte, b'-' | b'_' | b'.');
        if !ok {
            return Err(Error::InvalidHandle);
        }
    }
    if !slice.first().is_some_and(u8::is_ascii_alphanumeric)
        || !slice.last().is_some_and(u8::is_ascii_alphanumeric)
    {
        return Err(Error::InvalidHandle);
    }
    // These top-level paths belong to the verifier itself. Reserving them on
    // chain prevents a perfectly valid badge from becoming unreachable when a
    // new product route is added later.
    let reserved = [
        b"api".as_slice(),
        b"apply".as_slice(),
        b"badge".as_slice(),
        b"manage".as_slice(),
        b"me".as_slice(),
        b"org".as_slice(),
        b"person".as_slice(),
        b"search".as_slice(),
        b"standard".as_slice(),
        b"tx".as_slice(),
        b"verify".as_slice(),
    ];
    if reserved.contains(&&*slice) {
        return Err(Error::InvalidHandle);
    }
    Ok(())
}

fn validate_text(text: &String) -> Result<(), Error> {
    let len = text.len();
    if len > MAX_TEXT_LEN {
        return Err(Error::TextTooLong);
    }
    let mut buf = [0u8; MAX_TEXT_LEN as usize];
    let slice = &mut buf[..len as usize];
    text.copy_into_slice(slice);
    if slice.iter().any(|byte| *byte < 0x20 || *byte == 0x7f)
        || contains_unsafe_format_control(slice)
    {
        return Err(Error::InvalidText);
    }
    Ok(())
}

/// Detects invisible Unicode formatting code points that can reorder or hide
/// public verifier text. This intentionally targets format controls rather
/// than non-ASCII text generally, so international names remain valid.
fn contains_unsafe_format_control(bytes: &[u8]) -> bool {
    let mut i = 0usize;
    while i < bytes.len() {
        let two = i + 1 < bytes.len();
        let three = i + 2 < bytes.len();
        let four = i + 3 < bytes.len();
        if (two
            && ((bytes[i] == 0xc2 && bytes[i + 1] == 0xad) // U+00AD soft hyphen
                || (bytes[i] == 0xd8 && bytes[i + 1] == 0x9c))) // U+061C Arabic letter mark
            || (three
                && ((bytes[i] == 0xe1 && bytes[i + 1] == 0xa0 && bytes[i + 2] == 0x8e) // U+180E
                    || (bytes[i] == 0xe2
                        && bytes[i + 1] == 0x80
                        && ((0x8b..=0x8f).contains(&bytes[i + 2]) // U+200B..U+200F
                            || (0xaa..=0xae).contains(&bytes[i + 2]))) // U+202A..U+202E
                    || (bytes[i] == 0xe2
                        && bytes[i + 1] == 0x81
                        && (0xa0..=0xaf).contains(&bytes[i + 2])) // U+2060..U+206F
                    || (bytes[i] == 0xef
                        && bytes[i + 1] == 0xbb
                        && bytes[i + 2] == 0xbf) // U+FEFF
                    || (bytes[i] == 0xef
                        && bytes[i + 1] == 0xbf
                        && (0xb9..=0xbb).contains(&bytes[i + 2])))) // U+FFF9..U+FFFB
            // Unicode tag controls U+E0000..U+E007F.
            || (four
                && bytes[i] == 0xf3
                && bytes[i + 1] == 0xa0
                && matches!(bytes[i + 2], 0x80 | 0x81))
        {
            return true;
        }
        i += 1;
    }
    false
}

fn validate_required_text(text: &String) -> Result<(), Error> {
    validate_text(text)?;
    if text.is_empty() {
        return Err(Error::InvalidText);
    }
    Ok(())
}

fn validate_uri(uri: &String) -> Result<(), Error> {
    let len = uri.len();
    if len > MAX_URI_LEN {
        return Err(Error::TextTooLong);
    }
    if len == 0 {
        return Err(Error::InvalidUri);
    }
    let mut buf = [0u8; MAX_URI_LEN as usize];
    let slice = &mut buf[..len as usize];
    uri.copy_into_slice(slice);
    if slice.iter().any(|byte| *byte < 0x20 || *byte == 0x7f)
        || contains_unsafe_format_control(slice)
        || !(slice.starts_with(b"https://") || slice.starts_with(b"ipfs://"))
    {
        return Err(Error::InvalidUri);
    }
    Ok(())
}

fn validate_hash(hash: &BytesN<32>) -> Result<(), Error> {
    if hash.to_array().iter().all(|byte| *byte == 0) {
        return Err(Error::InvalidHash);
    }
    Ok(())
}

#[allow(clippy::too_many_arguments)]
fn validate_entity_input(
    kind: EntityKind,
    handle: &String,
    display_name: &String,
    domain: &String,
    jurisdiction: &String,
    metadata_hash: &BytesN<32>,
    metadata_uri: &String,
    now: u64,
    expires_at: u64,
) -> Result<(), Error> {
    validate_handle(handle)?;
    validate_hash(metadata_hash)?;
    validate_uri(metadata_uri)?;

    match kind {
        EntityKind::Person => {
            validate_text(display_name)?;
            validate_text(domain)?;
            validate_text(jurisdiction)?;
            if !display_name.is_empty() || !domain.is_empty() || !jurisdiction.is_empty() {
                return Err(Error::PersonalDataNotAllowed);
            }
        }
        EntityKind::Organisation => {
            validate_required_text(display_name)?;
            validate_required_text(domain)?;
            validate_required_text(jurisdiction)?;
        }
    }
    if expires_at == 0 {
        return Err(Error::ExpiryRequired);
    }
    if expires_at <= now {
        return Err(Error::InvalidDateRange);
    }
    if expires_at > now.saturating_add(MAX_BADGE_LIFETIME) {
        return Err(Error::ExpiryTooFar);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

#[contract]
pub struct VerifiedRegistry;

#[contractimpl]
impl VerifiedRegistry {
    /// Sets the issuing authority and the complaint arbiter at deploy time.
    ///
    /// Passing the same address for both is fine for the founding cohort;
    /// splitting them later is a `set_arbiter` call.
    pub fn __constructor(env: Env, admin: Address, arbiter: Address) {
        storage::set_admin(&env, &admin);
        storage::set_arbiter(&env, &arbiter);
        storage::set_paused(&env, false);
        storage::extend_instance(&env);
    }

    // -- administration ----------------------------------------------------

    pub fn admin(env: Env) -> Result<Address, Error> {
        storage::admin(&env)
    }

    pub fn arbiter(env: Env) -> Result<Address, Error> {
        storage::arbiter(&env)
    }

    pub fn paused(env: Env) -> bool {
        storage::paused(&env)
    }

    /// Step one of the admin handover. The new admin is not live until it calls
    /// `accept_admin`, so a typo cannot lock the registry.
    pub fn propose_admin(env: Env, new_admin: Address) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        storage::set_pending_admin(&env, &new_admin);
        storage::extend_instance(&env);
        AdminProposed {
            current_admin: admin,
            proposed_admin: new_admin,
        }
        .publish(&env);
        Ok(())
    }

    /// Step two of the admin handover, called by the proposed admin.
    pub fn accept_admin(env: Env) -> Result<(), Error> {
        let pending = storage::pending_admin(&env).ok_or(Error::NoPendingAdmin)?;
        pending.require_auth();
        let previous = storage::admin(&env)?;
        storage::set_admin(&env, &pending);
        storage::clear_pending_admin(&env);
        storage::extend_instance(&env);
        AdminAccepted {
            previous_admin: previous,
            new_admin: pending,
        }
        .publish(&env);
        Ok(())
    }

    pub fn set_arbiter(env: Env, arbiter: Address) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        storage::set_arbiter(&env, &arbiter);
        storage::extend_instance(&env);
        ArbiterSet { arbiter, by: admin }.publish(&env);
        Ok(())
    }

    /// Emergency stop. Blocks new registrations and new claims; reads, status
    /// changes and revocations keep working, because pausing must never prevent
    /// taking a bad badge down.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        storage::set_paused(&env, paused);
        storage::extend_instance(&env);
        PauseSet { paused, by: admin }.publish(&env);
        Ok(())
    }

    /// Replaces the contract code. Keeps the same address, so every badge link
    /// and QR code already in circulation survives an upgrade.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        ContractUpgraded {
            wasm_hash: new_wasm_hash.clone(),
            by: admin,
        }
        .publish(&env);
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // -- entities ----------------------------------------------------------

    /// Offers a vetted badge to a controller without activating it.
    ///
    /// This is the preferred onboarding path: the issuer completes its manual
    /// checks, commits the exact credential and terms hashes, and reserves the
    /// handle. The controller becomes verified only after independently
    /// calling `accept_entity` before `accept_by`.
    #[allow(clippy::too_many_arguments)]
    pub fn propose_entity(
        env: Env,
        kind: EntityKind,
        controller: Address,
        handle: String,
        display_name: String,
        domain: String,
        jurisdiction: String,
        metadata_hash: BytesN<32>,
        metadata_uri: String,
        terms_hash: BytesN<32>,
        accept_by: u64,
        expires_at: u64,
    ) -> Result<u64, Error> {
        let issuer = Self::require_admin(&env)?;
        Self::require_not_paused(&env)?;
        let now = env.ledger().timestamp();
        validate_entity_input(
            kind,
            &handle,
            &display_name,
            &domain,
            &jurisdiction,
            &metadata_hash,
            &metadata_uri,
            now,
            expires_at,
        )?;
        validate_hash(&terms_hash)?;
        if accept_by <= now
            || accept_by >= expires_at
            || accept_by > now.saturating_add(MAX_ACCEPT_WINDOW)
        {
            return Err(Error::InvalidAcceptanceWindow);
        }
        if storage::entity_id_by_handle(&env, &handle).is_some()
            || storage::pending_entity_id_by_handle(&env, &handle).is_some()
        {
            return Err(Error::HandleTaken);
        }
        if storage::entity_id_by_controller(&env, &controller).is_some()
            || storage::pending_entity_id_by_controller(&env, &controller).is_some()
        {
            return Err(Error::ControllerTaken);
        }

        let id = storage::next_pending_entity_id(&env);
        let pending = PendingEntity {
            id,
            kind,
            controller: controller.clone(),
            handle: handle.clone(),
            display_name,
            domain,
            jurisdiction,
            metadata_hash: metadata_hash.clone(),
            metadata_uri,
            issuer: issuer.clone(),
            terms_hash: terms_hash.clone(),
            proposed_at: now,
            accept_by,
            expires_at,
        };
        storage::put_pending_entity(&env, &pending);
        storage::put_pending_handle(&env, &handle, id);
        storage::put_pending_entity_controller(&env, &controller, id);
        storage::extend_instance(&env);

        EntityProposed {
            pending_id: id,
            kind,
            controller,
            handle,
            issuer,
            metadata_hash,
            terms_hash,
            accept_by,
            expires_at,
        }
        .publish(&env);
        Ok(id)
    }

    /// Accepts a pending badge and atomically makes it a verified entity.
    pub fn accept_entity(env: Env, pending_id: u64) -> Result<u64, Error> {
        Self::require_not_paused(&env)?;
        let pending = storage::require_pending_entity(&env, pending_id)?;
        pending.controller.require_auth();
        let now = env.ledger().timestamp();
        if now > pending.accept_by || now >= pending.expires_at {
            return Err(Error::PendingEntityExpired);
        }
        // Revalidate offers written by an older contract before activating
        // them, so an upgrade cannot leave a path around current descriptor,
        // URI, hash or acceptance-window rules.
        validate_entity_input(
            pending.kind,
            &pending.handle,
            &pending.display_name,
            &pending.domain,
            &pending.jurisdiction,
            &pending.metadata_hash,
            &pending.metadata_uri,
            now,
            pending.expires_at,
        )?;
        validate_hash(&pending.terms_hash)?;
        if pending.accept_by >= pending.expires_at {
            return Err(Error::InvalidAcceptanceWindow);
        }
        if storage::entity_id_by_handle(&env, &pending.handle).is_some() {
            return Err(Error::HandleTaken);
        }
        if storage::entity_id_by_controller(&env, &pending.controller).is_some() {
            return Err(Error::ControllerTaken);
        }

        Self::remove_pending_entity(&env, &pending);
        let id = storage::next_entity_id(&env);
        let accepted_controller = pending.controller.clone();
        let accepted_issuer = pending.issuer.clone();
        let accepted_metadata_hash = pending.metadata_hash.clone();
        let accepted_terms_hash = pending.terms_hash.clone();
        let entity = Entity {
            id,
            kind: pending.kind,
            controller: pending.controller.clone(),
            handle: pending.handle.clone(),
            display_name: pending.display_name,
            domain: pending.domain,
            jurisdiction: pending.jurisdiction,
            metadata_hash: pending.metadata_hash,
            metadata_uri: pending.metadata_uri,
            issuer: pending.issuer.clone(),
            status: EntityStatus::Active,
            verified_at: now,
            expires_at: pending.expires_at,
            strikes: 0,
        };
        storage::put_entity(&env, &entity);
        storage::put_handle(&env, &entity.handle, id);
        storage::put_controller(&env, &entity.controller, id);
        storage::extend_instance(&env);

        EntityAccepted {
            pending_id,
            entity_id: id,
            controller: accepted_controller,
            issuer: accepted_issuer,
            metadata_hash: accepted_metadata_hash,
            terms_hash: accepted_terms_hash,
            accepted_at: now,
        }
        .publish(&env);

        EntityRegistered {
            id,
            kind: entity.kind,
            controller: entity.controller,
            handle: entity.handle,
            issuer: entity.issuer,
            verified_at: now,
            expires_at: entity.expires_at,
        }
        .publish(&env);
        Ok(id)
    }

    /// Cancels a pending badge. The issuer or intended controller may cancel
    /// at any time; after the acceptance deadline or badge expiry any
    /// authenticated caller may release the abandoned reservations.
    pub fn cancel_entity_proposal(env: Env, caller: Address, pending_id: u64) -> Result<(), Error> {
        caller.require_auth();
        let pending = storage::require_pending_entity(&env, pending_id)?;
        let now = env.ledger().timestamp();
        if caller != pending.issuer
            && caller != pending.controller
            && now <= pending.accept_by
            && now < pending.expires_at
        {
            return Err(Error::NotAuthorized);
        }
        Self::remove_pending_entity(&env, &pending);
        EntityProposalCancelled {
            pending_id,
            by: caller,
        }
        .publish(&env);
        Ok(())
    }

    pub fn get_pending_entity(env: Env, pending_id: u64) -> Option<PendingEntity> {
        storage::get_pending_entity(&env, pending_id)
    }

    pub fn get_pending_entity_by_controller(
        env: Env,
        controller: Address,
    ) -> Option<PendingEntity> {
        let id = storage::pending_entity_id_by_controller(&env, &controller)?;
        storage::get_pending_entity(&env, id)
    }

    /// Records that an organisation or a person passed manual verification.
    ///
    /// Admin-only: in phase 1 every badge is issued by hand, and this call is
    /// the last step of that checklist. Badges must be time-bound and renewed;
    /// permanent trust is deliberately not representable.
    #[allow(clippy::too_many_arguments)]
    pub fn register_entity(
        env: Env,
        kind: EntityKind,
        controller: Address,
        handle: String,
        display_name: String,
        domain: String,
        jurisdiction: String,
        metadata_hash: BytesN<32>,
        metadata_uri: String,
        expires_at: u64,
    ) -> Result<u64, Error> {
        let admin = Self::require_admin(&env)?;
        // The one-step path remains available for expert/multi-auth tooling,
        // but it cannot be used by the issuer alone. Browser onboarding should
        // use `propose_entity` / `accept_entity` instead.
        controller.require_auth();
        Self::require_not_paused(&env)?;
        let now = env.ledger().timestamp();
        validate_entity_input(
            kind,
            &handle,
            &display_name,
            &domain,
            &jurisdiction,
            &metadata_hash,
            &metadata_uri,
            now,
            expires_at,
        )?;

        if storage::entity_id_by_handle(&env, &handle).is_some()
            || storage::pending_entity_id_by_handle(&env, &handle).is_some()
        {
            return Err(Error::HandleTaken);
        }
        if storage::entity_id_by_controller(&env, &controller).is_some()
            || storage::pending_entity_id_by_controller(&env, &controller).is_some()
        {
            return Err(Error::ControllerTaken);
        }

        let id = storage::next_entity_id(&env);
        let entity = Entity {
            id,
            kind,
            controller: controller.clone(),
            handle: handle.clone(),
            display_name,
            domain,
            jurisdiction,
            metadata_hash,
            metadata_uri,
            issuer: admin.clone(),
            status: EntityStatus::Active,
            verified_at: now,
            expires_at,
            strikes: 0,
        };

        storage::put_entity(&env, &entity);
        storage::put_handle(&env, &handle, id);
        storage::put_controller(&env, &controller, id);
        storage::extend_instance(&env);

        EntityRegistered {
            id,
            kind,
            controller,
            handle,
            issuer: admin,
            verified_at: now,
            expires_at,
        }
        .publish(&env);

        Ok(id)
    }

    /// Repoints an entity at a new off-chain credential.
    ///
    /// Issuer-only. `metadata_hash` anchors the credential the issuer vetted;
    /// allowing the subject to replace it would let them substitute a new
    /// identity while the page continued to display the original issuer.
    /// Subject-owned profile data belongs in a separate, explicitly unverified
    /// document at the application layer.
    pub fn update_metadata(
        env: Env,
        caller: Address,
        id: u64,
        metadata_hash: BytesN<32>,
        metadata_uri: String,
    ) -> Result<(), Error> {
        validate_hash(&metadata_hash)?;
        validate_uri(&metadata_uri)?;
        let mut entity = storage::require_entity(&env, id)?;
        caller.require_auth();
        if caller != entity.issuer {
            return Err(Error::NotAuthorized);
        }
        entity.metadata_hash = metadata_hash.clone();
        entity.metadata_uri = metadata_uri.clone();
        storage::put_entity(&env, &entity);
        MetadataUpdated {
            id,
            metadata_hash,
            metadata_uri,
            by: caller,
        }
        .publish(&env);
        Ok(())
    }

    /// Extends a badge after re-verification by its fixed issuer. Also clears a
    /// suspension, since re-verification is exactly the thing that resolves one.
    pub fn renew_entity(env: Env, id: u64, expires_at: u64) -> Result<(), Error> {
        let mut entity = storage::require_entity(&env, id)?;
        let issuer = entity.issuer.clone();
        issuer.require_auth();
        if entity.status == EntityStatus::Revoked {
            return Err(Error::InvalidStatus);
        }
        let now = env.ledger().timestamp();
        if expires_at == 0 {
            return Err(Error::ExpiryRequired);
        }
        if expires_at <= now {
            return Err(Error::InvalidDateRange);
        }
        if expires_at > now.saturating_add(MAX_BADGE_LIFETIME) {
            return Err(Error::ExpiryTooFar);
        }
        entity.expires_at = expires_at;
        entity.status = EntityStatus::Active;
        entity.verified_at = now;
        storage::put_entity(&env, &entity);
        storage::clear_entity_suspended_by(&env, id);

        EntityStatusSet {
            id,
            status: EntityStatus::Active,
            expires_at,
            by: issuer,
        }
        .publish(&env);
        Ok(())
    }

    /// Suspends, revokes or reinstates a badge. The stored issuer owns permanent
    /// lifecycle decisions; the global arbiter may place and lift its own hold.
    ///
    /// `Revoked` is terminal — a revoked badge cannot come back, because a
    /// reader who saw "revoked" must never be contradicted later. Re-admitting
    /// someone means issuing a new entity under a new handle.
    pub fn set_entity_status(
        env: Env,
        caller: Address,
        id: u64,
        status: EntityStatus,
    ) -> Result<(), Error> {
        if status == EntityStatus::Expired {
            return Err(Error::InvalidStatus);
        }
        let mut entity = storage::require_entity(&env, id)?;
        let by = Self::require_issuer_or_arbiter(&env, &caller, &entity.issuer)?;
        // Revocation is terminal and belongs to the issuer permanently recorded
        // on this badge. The global arbiter may suspend during a complaint and
        // restore its own hold, but a compromised arbiter cannot destroy it.
        if caller != entity.issuer && status == EntityStatus::Revoked {
            return Err(Error::NotAuthorized);
        }
        if entity.status == EntityStatus::Revoked {
            return Err(Error::InvalidStatus);
        }
        if status == EntityStatus::Active && entity.expires_at <= env.ledger().timestamp() {
            // Reinstating an expired badge without re-verification would emit
            // a misleading Active event while the effective status stayed
            // Expired. The issuer must use `renew_entity` instead.
            return Err(Error::InvalidDateRange);
        }
        if entity.status == EntityStatus::Suspended
            && status == EntityStatus::Active
            && caller != entity.issuer
            && storage::entity_suspended_by(&env, id) != Some(caller.clone())
        {
            return Err(Error::NotAuthorized);
        }
        entity.status = status;
        storage::put_entity(&env, &entity);
        if status == EntityStatus::Suspended {
            storage::set_entity_suspended_by(&env, id, &caller);
        } else {
            storage::clear_entity_suspended_by(&env, id);
        }

        EntityStatusSet {
            id,
            status,
            expires_at: entity.expires_at,
            by,
        }
        .publish(&env);
        Ok(())
    }

    /// Starts an issuer-reviewed controller recovery. Only the current
    /// controller may nominate a destination. Any previous issuer approval is
    /// cleared, so approval is always bound to this exact proposal.
    pub fn propose_controller(
        env: Env,
        caller: Address,
        id: u64,
        new_controller: Address,
    ) -> Result<(), Error> {
        let entity = storage::require_entity(&env, id)?;
        caller.require_auth();
        if caller != entity.controller {
            return Err(Error::NotAuthorized);
        }
        if storage::entity_id_by_controller(&env, &new_controller).is_some()
            || storage::pending_entity_id_by_controller(&env, &new_controller).is_some()
        {
            return Err(Error::ControllerTaken);
        }
        storage::clear_approved_controller(&env, id);
        storage::set_pending_controller(&env, id, &new_controller);
        ControllerRotationProposed {
            id,
            current_controller: entity.controller,
            proposed_controller: new_controller,
        }
        .publish(&env);
        Ok(())
    }

    /// The issuer approves the exact pending destination after completing its
    /// recovery/re-verification policy. A proposal written before this contract
    /// upgrade has no approval entry and therefore fails closed until reviewed.
    pub fn approve_controller_rotation(env: Env, id: u64) -> Result<(), Error> {
        let entity = storage::require_entity(&env, id)?;
        let issuer = entity.issuer;
        issuer.require_auth();
        let pending = storage::pending_controller(&env, id).ok_or(Error::NoPendingController)?;
        storage::set_approved_controller(&env, id, &pending);
        ControllerRotationApproved {
            id,
            proposed_controller: pending,
            approved_by: issuer,
        }
        .publish(&env);
        Ok(())
    }

    /// Completes a recovery after the issuer approved this exact destination
    /// and that destination explicitly accepts it. Uniqueness is checked again
    /// at acceptance time so a stale proposal cannot overwrite a key in use.
    pub fn accept_controller(env: Env, id: u64) -> Result<(), Error> {
        let pending = storage::pending_controller(&env, id).ok_or(Error::NoPendingController)?;
        pending.require_auth();
        if storage::approved_controller(&env, id) != Some(pending.clone()) {
            return Err(Error::ControllerRotationNotApproved);
        }
        if storage::entity_id_by_controller(&env, &pending).is_some()
            || storage::pending_entity_id_by_controller(&env, &pending).is_some()
        {
            return Err(Error::ControllerTaken);
        }
        Self::apply_controller_rotation(&env, id, pending)
    }

    /// Cancels an unaccepted recovery. The current controller or issuer may
    /// cancel; the current controller remains in control throughout the flow.
    pub fn cancel_controller_rotation(env: Env, caller: Address, id: u64) -> Result<(), Error> {
        let entity = storage::require_entity(&env, id)?;
        caller.require_auth();
        if caller != entity.controller && caller != entity.issuer {
            return Err(Error::NotAuthorized);
        }
        let pending = storage::pending_controller(&env, id).ok_or(Error::NoPendingController)?;
        storage::clear_pending_controller(&env, id);
        storage::clear_approved_controller(&env, id);
        ControllerRotationCancelled {
            id,
            proposed_controller: pending,
            cancelled_by: caller,
        }
        .publish(&env);
        Ok(())
    }

    /// Public recovery state for wallets and operators coordinating the three
    /// asynchronous signatures.
    pub fn get_pending_controller(env: Env, id: u64) -> Option<Address> {
        storage::pending_controller(&env, id)
    }

    /// Returns the exact pending destination the issuer approved, if any.
    pub fn get_approved_controller(env: Env, id: u64) -> Option<Address> {
        storage::approved_controller(&env, id)
    }

    /// Backwards-compatible atomic rotation for recovery tooling.
    ///
    /// The badge's fixed issuer, current controller and destination controller
    /// must all consent.
    /// The issuer can therefore help coordinate recovery but cannot move a
    /// soulbound badge on its own. New integrations should prefer the
    /// propose/approve/accept flow above.
    pub fn rotate_controller(env: Env, id: u64, new_controller: Address) -> Result<(), Error> {
        let entity = storage::require_entity(&env, id)?;
        entity.issuer.require_auth();
        if storage::entity_id_by_controller(&env, &new_controller).is_some()
            || storage::pending_entity_id_by_controller(&env, &new_controller).is_some()
        {
            return Err(Error::ControllerTaken);
        }
        entity.controller.require_auth();
        new_controller.require_auth();
        Self::apply_controller_rotation(&env, id, new_controller)
    }

    fn apply_controller_rotation(env: &Env, id: u64, new_controller: Address) -> Result<(), Error> {
        let mut entity = storage::require_entity(env, id)?;
        let old_controller = entity.controller.clone();
        storage::remove_controller(env, &old_controller);
        entity.controller = new_controller.clone();
        storage::put_entity(env, &entity);
        storage::put_controller(env, &new_controller, id);
        storage::clear_pending_controller(env, id);
        storage::clear_approved_controller(env, id);

        ControllerRotated {
            id,
            old_controller,
            new_controller,
        }
        .publish(env);
        Ok(())
    }

    /// Records an upheld complaint.
    ///
    /// Strikes are the reputation collateral that replaces a cash stake in the
    /// MVP: they are public, they accumulate, and enough of them justify a
    /// revocation. Deciding *how many* is enough is an off-chain policy call.
    pub fn add_strike(env: Env, caller: Address, id: u64) -> Result<u32, Error> {
        let mut entity = storage::require_entity(&env, id)?;
        let by = Self::require_issuer_or_arbiter(&env, &caller, &entity.issuer)?;
        entity.strikes += 1;
        storage::put_entity(&env, &entity);

        StrikeAdded {
            id,
            strikes: entity.strikes,
            by,
        }
        .publish(&env);
        Ok(entity.strikes)
    }

    // -- relationships -----------------------------------------------------

    /// Attests that a person is, or was, affiliated with an organisation.
    ///
    /// `caller` decides how much the claim is worth, and the contract stamps it
    /// accordingly:
    ///
    /// * the organisation's controller -> [`Confirmation::CounterpartyConfirmed`]
    /// * the person's own controller   -> [`Confirmation::SelfAsserted`]
    /// * the admin                     -> [`Confirmation::IssuerConfirmed`]
    ///
    /// A recruiter can therefore list where they work without waiting for the
    /// company, and a reader can still see nobody but the recruiter said so.
    #[allow(clippy::too_many_arguments)]
    pub fn attest_relationship(
        env: Env,
        caller: Address,
        org: u64,
        person: u64,
        rel_type: RelationshipType,
        role: String,
        department: String,
        start_date: u64,
        end_date: u64,
        public_display: bool,
        detail_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        Self::require_not_paused(&env)?;
        validate_required_text(&role)?;
        validate_text(&department)?;
        if start_date == 0 || (end_date != 0 && end_date < start_date) {
            return Err(Error::InvalidDateRange);
        }

        let now = env.ledger().timestamp();
        if start_date > now {
            return Err(Error::InvalidDateRange);
        }
        let org_entity = Self::require_active(&env, org, now)?;
        let person_entity = Self::require_active(&env, person, now)?;
        if org_entity.kind != EntityKind::Organisation || person_entity.kind != EntityKind::Person {
            return Err(Error::WrongEntityKind);
        }

        let confirmation = Self::authorise_claim(
            &env,
            &caller,
            &org_entity.controller,
            &person_entity.controller,
        )?;

        // A company may attest an affiliation, but it may not publish a
        // statement about a natural person without that person's action (or
        // the issuer recording consent gathered in the verification case).
        // Company-confirmed claims therefore start unlisted and the subject can
        // publish them with `set_public_display` in a second transaction.
        if public_display && caller != person_entity.controller && caller != storage::admin(&env)? {
            return Err(Error::NotAuthorized);
        }

        let id = storage::next_claim_id(&env);
        let claim = Relationship {
            id,
            org,
            person,
            rel_type,
            role,
            department,
            start_date,
            end_date,
            status: ClaimStatus::Active,
            confirmation,
            public_display,
            detail_hash,
            confirmed_at: now,
            attested_by: caller.clone(),
        };

        storage::put_relationship(&env, &claim);
        // Best-effort: a full index does not block the claim. See `index_push`.
        storage::index_push(&env, &DataKey::OrgRels(org), id);
        storage::index_push(&env, &DataKey::PersonRels(person), id);
        storage::extend_instance(&env);

        RelationshipAttested {
            id,
            org,
            person,
            rel_type,
            public_display,
            confirmation,
            attested_by: caller,
        }
        .publish(&env);

        Ok(id)
    }

    /// Closes a relationship with an end date, without deleting it.
    ///
    /// History is the point: "left in March" is a different and more useful
    /// answer than "no record found".
    pub fn end_relationship(
        env: Env,
        caller: Address,
        id: u64,
        end_date: u64,
    ) -> Result<(), Error> {
        let mut claim = storage::require_relationship(&env, id)?;
        let org_entity = storage::require_entity(&env, claim.org)?;
        let person_entity = storage::require_entity(&env, claim.person)?;
        Self::authorise_claim(
            &env,
            &caller,
            &org_entity.controller,
            &person_entity.controller,
        )?;

        if claim.status != ClaimStatus::Active {
            return Err(Error::InvalidStatus);
        }

        if end_date == 0 || end_date < claim.start_date || end_date > env.ledger().timestamp() {
            return Err(Error::InvalidDateRange);
        }
        claim.end_date = end_date;
        claim.status = ClaimStatus::Ended;
        storage::put_relationship(&env, &claim);

        ClaimStatusSet {
            id,
            status: ClaimStatus::Ended,
            by: caller.clone(),
        }
        .publish(&env);
        RelationshipEnded {
            id,
            end_date,
            by: caller,
        }
        .publish(&env);
        Ok(())
    }

    /// Changes a relationship's state.
    ///
    /// The subject can always set `Withdrawn` on a claim about themselves. That
    /// is the on-chain form of the right to object: an organisation cannot pin
    /// a public statement about a person against their will.
    pub fn set_relationship_status(
        env: Env,
        caller: Address,
        id: u64,
        status: ClaimStatus,
    ) -> Result<(), Error> {
        if status == ClaimStatus::Expired {
            return Err(Error::InvalidStatus);
        }
        let mut claim = storage::require_relationship(&env, id)?;
        let org_entity = storage::require_entity(&env, claim.org)?;
        let person_entity = storage::require_entity(&env, claim.person)?;
        Self::authorise_status_change(
            &env,
            &caller,
            &org_entity.controller,
            &person_entity.controller,
            claim.status,
            status,
        )?;
        Self::validate_relationship_transition(claim.status, status)?;
        claim.status = status;
        storage::put_relationship(&env, &claim);

        ClaimStatusSet {
            id,
            status,
            by: caller,
        }
        .publish(&env);
        Ok(())
    }

    /// Flips whether the official verifier may render this relationship.
    /// Soroban storage remains publicly readable either way; this is display
    /// consent, not an erasure or an on-chain privacy mechanism.
    pub fn set_public_display(
        env: Env,
        caller: Address,
        id: u64,
        public_display: bool,
    ) -> Result<(), Error> {
        let mut claim = storage::require_relationship(&env, id)?;
        let person_entity = storage::require_entity(&env, claim.person)?;
        // Only the subject or the admin — an organisation must not be able to
        // publish an affiliation the person asked to keep private.
        Self::require_controller_or_admin(&env, &caller, &person_entity.controller)?;
        claim.public_display = public_display;
        storage::put_relationship(&env, &claim);
        PublicDisplaySet {
            id,
            public_display,
            by: caller,
        }
        .publish(&env);
        Ok(())
    }

    // -- mandates ----------------------------------------------------------

    /// Authorises a representative to act for an organisation, for a scope and
    /// a fixed window.
    ///
    /// This is the claim a candidate actually needs to check: not "is this
    /// person real" but "is this person allowed to be recruiting for that
    /// company today". Mandates are always time-bound; `valid_until` cannot be
    /// zero.
    ///
    /// `relationship` optionally ties the mandate to the affiliation it rests
    /// on. When given, it must be a relationship between the same two parties.
    #[allow(clippy::too_many_arguments)]
    pub fn issue_mandate(
        env: Env,
        caller: Address,
        org: u64,
        representative: u64,
        relationship: u64,
        mandate_type: MandateType,
        scope: String,
        territory: String,
        valid_from: u64,
        valid_until: u64,
        detail_hash: BytesN<32>,
    ) -> Result<u64, Error> {
        Self::require_not_paused(&env)?;
        validate_required_text(&scope)?;
        validate_text(&territory)?;
        if org == representative {
            return Err(Error::SameEntity);
        }
        if valid_from == 0
            || valid_until == 0
            || valid_until <= valid_from
            || valid_until <= env.ledger().timestamp()
        {
            return Err(Error::InvalidDateRange);
        }
        if valid_until - valid_from > MAX_MANDATE_LIFETIME {
            return Err(Error::ExpiryTooFar);
        }

        let now = env.ledger().timestamp();
        let org_entity = Self::require_active(&env, org, now)?;
        let rep_entity = Self::require_active(&env, representative, now)?;
        if org_entity.kind != EntityKind::Organisation {
            return Err(Error::WrongEntityKind);
        }

        if relationship != 0 {
            let rel = storage::require_relationship(&env, relationship)?;
            if rel.org != org || rel.person != representative {
                return Err(Error::RelationshipMismatch);
            }
        }

        let confirmation = Self::authorise_claim(
            &env,
            &caller,
            &org_entity.controller,
            &rep_entity.controller,
        )?;

        let id = storage::next_claim_id(&env);
        let claim = Mandate {
            id,
            org,
            representative,
            relationship,
            mandate_type,
            scope,
            territory,
            valid_from,
            valid_until,
            status: ClaimStatus::Active,
            confirmation,
            detail_hash,
            confirmed_at: now,
            attested_by: caller.clone(),
        };

        storage::put_mandate(&env, &claim);
        storage::index_push(&env, &DataKey::OrgMandates(org), id);
        storage::index_push(&env, &DataKey::PersonMandates(representative), id);
        storage::index_push(&env, &DataKey::PairMandates(org, representative), id);
        if confirmation != Confirmation::SelfAsserted {
            // Never evict a still-relevant confirmation: doing so could hide
            // an older live authority if a newer record later becomes
            // unusable. Inactive and expired records are pruned first; a pair
            // at the bounded capacity must close or wait out one before
            // issuing another.
            Self::index_confirmed_mandate(&env, &claim, now)?;
        }
        storage::put_live_mandate(&env, org, representative, id);
        storage::extend_instance(&env);

        MandateIssued {
            id,
            org,
            representative,
            mandate_type,
            valid_from,
            valid_until,
            confirmation,
            attested_by: caller,
        }
        .publish(&env);

        Ok(id)
    }

    /// Changes a mandate's state — the revocation path that makes the badge
    /// worth anything. A withdrawn mandate stops verifying the moment the
    /// transaction lands, everywhere the badge is embedded.
    pub fn set_mandate_status(
        env: Env,
        caller: Address,
        id: u64,
        status: ClaimStatus,
    ) -> Result<(), Error> {
        if status == ClaimStatus::Expired {
            return Err(Error::InvalidStatus);
        }
        let mut claim = storage::require_mandate(&env, id)?;
        let org_entity = storage::require_entity(&env, claim.org)?;
        let rep_entity = storage::require_entity(&env, claim.representative)?;
        Self::authorise_status_change(
            &env,
            &caller,
            &org_entity.controller,
            &rep_entity.controller,
            claim.status,
            status,
        )?;
        Self::validate_mandate_transition(claim.status, status)?;
        claim.status = status;
        storage::put_mandate(&env, &claim);
        if claim.confirmation != Confirmation::SelfAsserted {
            if status == ClaimStatus::Active {
                // A reactivated confirmation must be discoverable or the
                // state change fails atomically.
                Self::index_confirmed_mandate(&env, &claim, env.ledger().timestamp())?;
            } else {
                // Exact removal is safe even for a legacy oversized vector;
                // operators can drain one of those indexes without an
                // invocation trying to resolve hundreds of ledger entries.
                Self::remove_confirmed_mandate(&env, &claim);
            }
        }

        ClaimStatusSet {
            id,
            status,
            by: caller,
        }
        .publish(&env);
        Ok(())
    }

    // -- reads -------------------------------------------------------------

    /// Requests TTL extensions for a bounded slice of registry storage.
    ///
    /// Unlike the explorer's simulation-only reads, this call must be signed
    /// and submitted to persist its extensions. It requires no registry role:
    /// a dedicated, funded keeper account can pay the small network fee. Call
    /// repeatedly with the returned cursors until `done` is true.
    pub fn keepalive(
        env: Env,
        entity_cursor: u64,
        claim_cursor: u64,
        limit: u32,
    ) -> Result<KeepaliveResult, Error> {
        if limit == 0 || limit > MAX_KEEPALIVE_BATCH {
            return Err(Error::InvalidBatchSize);
        }
        storage::extend_instance(&env);

        let entity_count = storage::entity_count(&env);
        let claim_count = storage::claim_count(&env);
        let mut next_entity = if entity_cursor == 0 { 1 } else { entity_cursor };
        let mut next_claim = if claim_cursor == 0 { 1 } else { claim_cursor };
        let mut entities_touched = 0u32;
        let mut claims_touched = 0u32;
        let mut attempted = 0u32;

        while next_entity <= entity_count && attempted < limit {
            if let Some(entity) = storage::get_entity(&env, next_entity) {
                storage::entity_id_by_handle(&env, &entity.handle);
                storage::entity_id_by_controller(&env, &entity.controller);
                storage::entity_suspended_by(&env, next_entity);
                storage::pending_controller(&env, next_entity);
                storage::approved_controller(&env, next_entity);
                // Organisations may also be agency representatives, so touch
                // all four bounded indexes rather than relying on entity kind.
                storage::index(&env, &DataKey::OrgRels(next_entity));
                storage::index(&env, &DataKey::PersonRels(next_entity));
                storage::index(&env, &DataKey::OrgMandates(next_entity));
                storage::index(&env, &DataKey::PersonMandates(next_entity));
                entities_touched += 1;
            }
            next_entity += 1;
            attempted += 1;
        }

        attempted = 0;
        while next_claim <= claim_count && attempted < limit {
            if storage::get_relationship(&env, next_claim).is_some() {
                claims_touched += 1;
            } else if let Some(mandate) = storage::get_mandate(&env, next_claim) {
                storage::index(
                    &env,
                    &DataKey::PairMandates(mandate.org, mandate.representative),
                );
                storage::index(
                    &env,
                    &DataKey::ConfirmedPairMandates(mandate.org, mandate.representative),
                );
                storage::live_mandate(&env, mandate.org, mandate.representative);
                claims_touched += 1;
            }
            next_claim += 1;
            attempted += 1;
        }

        Ok(KeepaliveResult {
            next_entity,
            next_claim,
            entities_touched,
            claims_touched,
            done: next_entity > entity_count && next_claim > claim_count,
        })
    }

    pub fn entity_count(env: Env) -> u64 {
        storage::entity_count(&env)
    }

    pub fn claim_count(env: Env) -> u64 {
        storage::claim_count(&env)
    }

    pub fn get_entity(env: Env, id: u64) -> Option<Entity> {
        storage::get_entity(&env, id)
    }

    pub fn get_entity_by_handle(env: Env, handle: String) -> Option<Entity> {
        let id = storage::entity_id_by_handle(&env, &handle)?;
        storage::get_entity(&env, id)
    }

    pub fn get_entity_by_controller(env: Env, controller: Address) -> Option<Entity> {
        let id = storage::entity_id_by_controller(&env, &controller)?;
        storage::get_entity(&env, id)
    }

    /// The whole verifier page in one call: the record, its status with expiry
    /// already applied, and how many claims hang off it.
    pub fn check(env: Env, handle: String) -> Option<Check> {
        let id = storage::entity_id_by_handle(&env, &handle)?;
        Self::check_by_id(env, id)
    }

    /// [`Self::check`] by id, for callers that already resolved the handle.
    pub fn check_by_id(env: Env, id: u64) -> Option<Check> {
        let entity = storage::get_entity(&env, id)?;
        let now = env.ledger().timestamp();
        let effective_status = effective_entity_status(&entity, now);
        let (rel_key, mandate_key) = match entity.kind {
            EntityKind::Organisation => (DataKey::OrgRels(id), DataKey::OrgMandates(id)),
            EntityKind::Person => (DataKey::PersonRels(id), DataKey::PersonMandates(id)),
        };
        Some(Check {
            entity,
            effective_status,
            valid: effective_status == EntityStatus::Active,
            relationships: storage::index(&env, &rel_key).len(),
            mandates: storage::index(&env, &mandate_key).len(),
            checked_at: now,
        })
    }

    pub fn get_relationship(env: Env, id: u64) -> Option<Relationship> {
        storage::get_relationship(&env, id)
    }

    pub fn get_mandate(env: Env, id: u64) -> Option<Mandate> {
        storage::get_mandate(&env, id)
    }

    /// A relationship's status with expiry applied — `end_date` counts as the
    /// expiry, so a finished engagement never reads as `Active`.
    pub fn relationship_status(env: Env, id: u64) -> Option<ClaimStatus> {
        let claim = storage::get_relationship(&env, id)?;
        Some(effective_claim_status(
            claim.status,
            claim.end_date,
            env.ledger().timestamp(),
        ))
    }

    /// A mandate's status with expiry applied.
    pub fn mandate_status(env: Env, id: u64) -> Option<ClaimStatus> {
        let claim = storage::get_mandate(&env, id)?;
        Some(effective_claim_status(
            claim.status,
            claim.valid_until,
            env.ledger().timestamp(),
        ))
    }

    pub fn relationships_attested_by(env: Env, org: u64) -> Vec<u64> {
        storage::index(&env, &DataKey::OrgRels(org))
    }

    pub fn relationships_about(env: Env, person: u64) -> Vec<u64> {
        storage::index(&env, &DataKey::PersonRels(person))
    }

    pub fn mandates_issued_by(env: Env, org: u64) -> Vec<u64> {
        storage::index(&env, &DataKey::OrgMandates(org))
    }

    pub fn mandates_held_by(env: Env, representative: u64) -> Vec<u64> {
        storage::index(&env, &DataKey::PersonMandates(representative))
    }

    /// "May this person act for that company, right now?"
    ///
    /// The question a candidate being cold-DMed actually has. This deliberately
    /// means *company- or issuer-confirmed*: a representative's self-asserted
    /// vouch is useful evidence, but it is not an authorisation from the named
    /// company. The primary scan is a bounded, relevant-confirmation index
    /// which a representative's self-assertions cannot fill. It prunes
    /// inactive and expired mandates but never evicts a live or scheduled one.
    /// A shared scan budget keeps the confirmed index and legacy fallbacks
    /// below Stellar's ledger-footprint limit.
    pub fn is_authorised(env: Env, org: u64, representative: u64) -> bool {
        let now = env.ledger().timestamp();
        if !Self::is_entity_valid(&env, org, now)
            || !Self::is_entity_valid(&env, representative, now)
        {
            return false;
        }

        let confirmed_ids =
            storage::index(&env, &DataKey::ConfirmedPairMandates(org, representative));
        let mut remaining = MAX_AUTHORISATION_SCAN;
        if Self::has_authorising_mandate(
            &env,
            &confirmed_ids,
            org,
            representative,
            now,
            &mut remaining,
        ) {
            return true;
        }

        // Upgrade compatibility: confirmed mandates written before
        // `ConfirmedPairMandates` exist only in the general pair index.
        let pair_ids = storage::index(&env, &DataKey::PairMandates(org, representative));
        if Self::has_authorising_mandate(&env, &pair_ids, org, representative, now, &mut remaining)
        {
            return true;
        }

        // Older still: mandates written before `PairMandates` exist only in the
        // representative-wide index.
        let ids = storage::index(&env, &DataKey::PersonMandates(representative));
        Self::has_authorising_mandate(&env, &ids, org, representative, now, &mut remaining)
    }

    fn has_authorising_mandate(
        env: &Env,
        ids: &Vec<u64>,
        org: u64,
        representative: u64,
        now: u64,
        remaining: &mut u32,
    ) -> bool {
        let mut cursor = ids.len();
        while cursor > 0 && *remaining > 0 {
            cursor -= 1;
            *remaining -= 1;
            let Some(id) = ids.get(cursor) else {
                continue;
            };
            let Some(claim) = storage::get_mandate(env, id) else {
                continue;
            };
            if claim.org != org || claim.representative != representative {
                continue;
            }
            if claim.confirmation == Confirmation::SelfAsserted
                || claim.status != ClaimStatus::Active
                || now < claim.valid_from
                || now > claim.valid_until
            {
                continue;
            }
            if claim.relationship != 0 {
                let Some(relationship) = storage::get_relationship(env, claim.relationship) else {
                    continue;
                };
                if relationship.org != org
                    || relationship.person != representative
                    || !relationship.public_display
                    || effective_claim_status(relationship.status, relationship.end_date, now)
                        != ClaimStatus::Active
                {
                    continue;
                }
            }
            return true;
        }
        false
    }

    /// Adds a confirmed mandate to the exact-pair decision index. Existing
    /// inactive, expired, missing, malformed and self-asserted entries are
    /// pruned. Future-scheduled active mandates remain relevant because they
    /// may become authorising without another transaction.
    fn index_confirmed_mandate(env: &Env, claim: &Mandate, now: u64) -> Result<(), Error> {
        let key = DataKey::ConfirmedPairMandates(claim.org, claim.representative);
        let ids = storage::index(env, &key);
        // A previous contract used the larger discovery bound here. Fail
        // closed before resolving an oversized legacy vector: scanning all of
        // it would exceed Stellar's ledger-footprint limit. Closing individual
        // mandates still removes their ids and provides a bounded migration.
        if ids.len() > MAX_CONFIRMED_PAIR_LEN {
            return Err(Error::IndexFull);
        }
        let mut relevant = Vec::new(env);
        let mut cursor = 0u32;
        while cursor < ids.len() {
            let Some(id) = ids.get(cursor) else {
                cursor += 1;
                continue;
            };
            cursor += 1;
            if id == claim.id {
                continue;
            }
            let Some(existing) = storage::get_mandate(env, id) else {
                continue;
            };
            if existing.org == claim.org
                && existing.representative == claim.representative
                && existing.confirmation != Confirmation::SelfAsserted
                && existing.status == ClaimStatus::Active
                && now <= existing.valid_until
            {
                relevant.push_back(id);
            }
        }
        if relevant.len() >= MAX_CONFIRMED_PAIR_LEN {
            return Err(Error::IndexFull);
        }
        relevant.push_back(claim.id);
        storage::put_index(env, &key, &relevant);
        Ok(())
    }

    /// Removes one closed confirmation without resolving every indexed claim.
    /// This remains safe for an oversized index written by an older contract.
    fn remove_confirmed_mandate(env: &Env, claim: &Mandate) {
        let key = DataKey::ConfirmedPairMandates(claim.org, claim.representative);
        let ids = storage::index(env, &key);
        let mut relevant = Vec::new(env);
        let mut cursor = 0u32;
        while cursor < ids.len() {
            let Some(id) = ids.get(cursor) else {
                cursor += 1;
                continue;
            };
            cursor += 1;
            if id != claim.id {
                relevant.push_back(id);
            }
        }
        storage::put_index(env, &key, &relevant);
    }

    // -- internals ---------------------------------------------------------

    fn is_entity_valid(env: &Env, id: u64, now: u64) -> bool {
        match storage::get_entity(env, id) {
            Some(entity) => effective_entity_status(&entity, now) == EntityStatus::Active,
            None => false,
        }
    }

    fn remove_pending_entity(env: &Env, pending: &PendingEntity) {
        storage::remove_pending_entity(env, pending.id);
        storage::remove_pending_handle(env, &pending.handle);
        storage::remove_pending_entity_controller(env, &pending.controller);
    }

    fn require_admin(env: &Env) -> Result<Address, Error> {
        let admin = storage::admin(env)?;
        admin.require_auth();
        Ok(admin)
    }

    /// Entity-specific issuer authority is immutable across global admin
    /// handovers. The arbiter remains a global operational role.
    fn require_issuer_or_arbiter(
        env: &Env,
        caller: &Address,
        issuer: &Address,
    ) -> Result<Address, Error> {
        caller.require_auth();
        if caller == issuer || caller == &storage::arbiter(env)? {
            Ok(caller.clone())
        } else {
            Err(Error::NotAuthorized)
        }
    }

    fn require_controller_or_admin(
        env: &Env,
        caller: &Address,
        controller: &Address,
    ) -> Result<Address, Error> {
        caller.require_auth();
        if caller == controller || caller == &storage::admin(env)? {
            Ok(caller.clone())
        } else {
            Err(Error::NotAuthorized)
        }
    }

    fn authorise_claim(
        env: &Env,
        caller: &Address,
        org_controller: &Address,
        subject_controller: &Address,
    ) -> Result<Confirmation, Error> {
        caller.require_auth();
        if caller == org_controller {
            Ok(Confirmation::CounterpartyConfirmed)
        } else if caller == subject_controller {
            Ok(Confirmation::SelfAsserted)
        } else if caller == &storage::admin(env)? {
            Ok(Confirmation::IssuerConfirmed)
        } else {
            Err(Error::NotAuthorized)
        }
    }

    fn authorise_status_change(
        env: &Env,
        caller: &Address,
        org_controller: &Address,
        subject_controller: &Address,
        current: ClaimStatus,
        status: ClaimStatus,
    ) -> Result<(), Error> {
        caller.require_auth();
        if caller == &storage::admin(env)? {
            return Ok(());
        }
        if caller == &storage::arbiter(env)? {
            // The arbiter records complaint outcomes; it cannot resurrect a
            // claim as `Active` or declare work `Completed`.
            return match status {
                ClaimStatus::Disputed | ClaimStatus::Suspended | ClaimStatus::Withdrawn => Ok(()),
                _ => Err(Error::NotAuthorized),
            };
        }
        if caller == org_controller {
            // A party accused in a dispute cannot clear the arbiter's state by
            // itself. The admin may restore it after the off-chain review.
            if matches!(current, ClaimStatus::Disputed | ClaimStatus::Suspended)
                && status == ClaimStatus::Active
            {
                return Err(Error::NotAuthorized);
            }
            return Ok(());
        }
        if caller == subject_controller {
            // The subject's only power is to take a claim about themselves
            // down. They cannot make one look stronger.
            return match status {
                ClaimStatus::Withdrawn => Ok(()),
                _ => Err(Error::NotAuthorized),
            };
        }
        Err(Error::NotAuthorized)
    }

    fn validate_relationship_transition(
        current: ClaimStatus,
        next: ClaimStatus,
    ) -> Result<(), Error> {
        if matches!(
            next,
            ClaimStatus::Expired | ClaimStatus::Completed | ClaimStatus::Ended
        ) {
            return Err(Error::InvalidStatus);
        }
        // A subject's withdrawal is an on-chain objection, not a temporary
        // toggle the organisation can reverse. Closed relationships are also
        // historical facts; a new affiliation should be a new claim.
        if matches!(current, ClaimStatus::Withdrawn | ClaimStatus::Ended) && next != current {
            return Err(Error::InvalidStatus);
        }
        Ok(())
    }

    fn validate_mandate_transition(current: ClaimStatus, next: ClaimStatus) -> Result<(), Error> {
        if matches!(next, ClaimStatus::Expired | ClaimStatus::Ended) {
            return Err(Error::InvalidStatus);
        }
        // Withdrawn and completed mandates are terminal. Re-authorisation must
        // state a fresh scope and validity window in a new claim.
        if matches!(current, ClaimStatus::Withdrawn | ClaimStatus::Completed) && next != current {
            return Err(Error::InvalidStatus);
        }
        Ok(())
    }

    fn require_active(env: &Env, id: u64, now: u64) -> Result<Entity, Error> {
        let entity = storage::require_entity(env, id)?;
        if effective_entity_status(&entity, now) != EntityStatus::Active {
            return Err(Error::EntityNotActive);
        }
        Ok(entity)
    }

    fn require_not_paused(env: &Env) -> Result<(), Error> {
        if storage::paused(env) {
            return Err(Error::Paused);
        }
        Ok(())
    }
}
