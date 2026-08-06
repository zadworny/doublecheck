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
//! * **admin** — the issuing authority. Registers, renews, suspends
//!   and revokes entities. Cannot forge a company-confirmed claim: a claim it
//!   writes is stamped [`Confirmation::IssuerConfirmed`], never
//!   [`Confirmation::CounterpartyConfirmed`].
//! * **entity controller** — the wallet a verified organisation or person acts
//!   with. An organisation's controller attests its own relationships and
//!   issues its own mandates. A person's controller can always withdraw a claim
//!   about themselves.
//! * **arbiter** — records the outcome of the off-chain complaint pipeline:
//!   marks claims disputed, suspends them, adds strikes.
//!
//! Badges are soulbound. There is no transfer function; `rotate_controller` is
//! admin-only and exists for key loss.

mod events;
mod storage;
mod types;

#[cfg(test)]
mod test;

pub use types::*;

use soroban_sdk::{contract, contractimpl, contractmeta, Address, BytesN, Env, String, Vec};

use events::{
    ClaimStatusSet, ControllerRotated, EntityRegistered, EntityStatusSet, MandateIssued,
    RelationshipAttested, StrikeAdded,
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
    Ok(())
}

fn validate_text(text: &String) -> Result<(), Error> {
    if text.len() > MAX_TEXT_LEN {
        return Err(Error::TextTooLong);
    }
    Ok(())
}

fn validate_uri(uri: &String) -> Result<(), Error> {
    if uri.len() > MAX_URI_LEN {
        return Err(Error::TextTooLong);
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
        Self::require_admin(&env)?;
        storage::set_pending_admin(&env, &new_admin);
        storage::extend_instance(&env);
        Ok(())
    }

    /// Step two of the admin handover, called by the proposed admin.
    pub fn accept_admin(env: Env) -> Result<(), Error> {
        let pending = storage::pending_admin(&env).ok_or(Error::NoPendingAdmin)?;
        pending.require_auth();
        storage::set_admin(&env, &pending);
        storage::clear_pending_admin(&env);
        storage::extend_instance(&env);
        Ok(())
    }

    pub fn set_arbiter(env: Env, arbiter: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        storage::set_arbiter(&env, &arbiter);
        storage::extend_instance(&env);
        Ok(())
    }

    /// Emergency stop. Blocks new registrations and new claims; reads, status
    /// changes and revocations keep working, because pausing must never prevent
    /// taking a bad badge down.
    pub fn set_paused(env: Env, paused: bool) -> Result<(), Error> {
        Self::require_admin(&env)?;
        storage::set_paused(&env, paused);
        storage::extend_instance(&env);
        Ok(())
    }

    /// Replaces the contract code. Keeps the same address, so every badge link
    /// and QR code already in circulation survives an upgrade.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) -> Result<(), Error> {
        Self::require_admin(&env)?;
        env.deployer().update_current_contract_wasm(new_wasm_hash);
        Ok(())
    }

    // -- entities ----------------------------------------------------------

    /// Records that an organisation or a person passed manual verification.
    ///
    /// Admin-only: in phase 1 every badge is issued by hand, and this call is
    /// the last step of that checklist. `expires_at` of `0` means no expiry,
    /// but the recommended default is twelve months so trust has to be renewed.
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
        Self::require_not_paused(&env)?;

        validate_handle(&handle)?;
        validate_text(&display_name)?;
        validate_text(&domain)?;
        validate_text(&jurisdiction)?;
        validate_uri(&metadata_uri)?;

        if storage::entity_id_by_handle(&env, &handle).is_some() {
            return Err(Error::HandleTaken);
        }
        if storage::entity_id_by_controller(&env, &controller).is_some() {
            return Err(Error::ControllerTaken);
        }

        let now = env.ledger().timestamp();
        if expires_at != 0 && expires_at <= now {
            return Err(Error::InvalidDateRange);
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
    /// Callable by the entity itself (it changed its address, logo, headline)
    /// or by the admin (it re-verified). The hash is what makes this safe: the
    /// subject can update the document, but the chain records exactly which
    /// version is current.
    pub fn update_metadata(
        env: Env,
        caller: Address,
        id: u64,
        metadata_hash: BytesN<32>,
        metadata_uri: String,
    ) -> Result<(), Error> {
        validate_uri(&metadata_uri)?;
        let mut entity = storage::require_entity(&env, id)?;
        Self::require_controller_or_admin(&env, &caller, &entity.controller)?;
        entity.metadata_hash = metadata_hash;
        entity.metadata_uri = metadata_uri;
        storage::put_entity(&env, &entity);
        Ok(())
    }

    /// Extends a badge after re-verification. Also clears a suspension, since
    /// re-verification is exactly the thing that resolves one.
    pub fn renew_entity(env: Env, id: u64, expires_at: u64) -> Result<(), Error> {
        let admin = Self::require_admin(&env)?;
        let mut entity = storage::require_entity(&env, id)?;
        if entity.status == EntityStatus::Revoked {
            return Err(Error::InvalidStatus);
        }
        let now = env.ledger().timestamp();
        if expires_at != 0 && expires_at <= now {
            return Err(Error::InvalidDateRange);
        }
        entity.expires_at = expires_at;
        entity.status = EntityStatus::Active;
        entity.verified_at = now;
        storage::put_entity(&env, &entity);

        EntityStatusSet {
            id,
            status: EntityStatus::Active,
            expires_at,
            by: admin,
        }
        .publish(&env);
        Ok(())
    }

    /// Suspends, revokes or reinstates a badge.
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
        let by = Self::require_admin_or_arbiter(&env, &caller)?;
        if status == EntityStatus::Expired {
            return Err(Error::InvalidStatus);
        }
        let mut entity = storage::require_entity(&env, id)?;
        if entity.status == EntityStatus::Revoked {
            return Err(Error::InvalidStatus);
        }
        entity.status = status;
        storage::put_entity(&env, &entity);

        EntityStatusSet {
            id,
            status,
            expires_at: entity.expires_at,
            by,
        }
        .publish(&env);
        Ok(())
    }

    /// Moves a badge to a new key after key loss.
    ///
    /// The only way a badge ever changes hands, and it is admin-gated precisely
    /// so it cannot be used to sell verified status. The subject is unchanged;
    /// only the key that speaks for them is.
    pub fn rotate_controller(env: Env, id: u64, new_controller: Address) -> Result<(), Error> {
        Self::require_admin(&env)?;
        if storage::entity_id_by_controller(&env, &new_controller).is_some() {
            return Err(Error::ControllerTaken);
        }
        let mut entity = storage::require_entity(&env, id)?;
        let old_controller = entity.controller.clone();
        storage::remove_controller(&env, &old_controller);
        entity.controller = new_controller.clone();
        storage::put_entity(&env, &entity);
        storage::put_controller(&env, &new_controller, id);

        ControllerRotated {
            id,
            old_controller,
            new_controller,
        }
        .publish(&env);
        Ok(())
    }

    /// Records an upheld complaint.
    ///
    /// Strikes are the reputation collateral that replaces a cash stake in the
    /// MVP: they are public, they accumulate, and enough of them justify a
    /// revocation. Deciding *how many* is enough is an off-chain policy call.
    pub fn add_strike(env: Env, caller: Address, id: u64) -> Result<u32, Error> {
        let by = Self::require_admin_or_arbiter(&env, &caller)?;
        let mut entity = storage::require_entity(&env, id)?;
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
        validate_text(&role)?;
        validate_text(&department)?;
        if start_date == 0 || (end_date != 0 && end_date < start_date) {
            return Err(Error::InvalidDateRange);
        }

        let now = env.ledger().timestamp();
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
        storage::index_push(&env, &DataKey::OrgRels(org), id)?;
        storage::index_push(&env, &DataKey::PersonRels(person), id)?;
        storage::extend_instance(&env);

        RelationshipAttested {
            id,
            org,
            person,
            rel_type,
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

        if end_date == 0 || end_date < claim.start_date {
            return Err(Error::InvalidDateRange);
        }
        claim.end_date = end_date;
        claim.status = ClaimStatus::Ended;
        storage::put_relationship(&env, &claim);

        ClaimStatusSet {
            id,
            status: ClaimStatus::Ended,
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
            status,
        )?;
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

    /// Flips whether the verifier page may render this relationship. The record
    /// stays on-chain either way; only its publication changes.
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
        validate_text(&scope)?;
        validate_text(&territory)?;
        if valid_from == 0 || valid_until == 0 || valid_until <= valid_from {
            return Err(Error::InvalidDateRange);
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
        storage::index_push(&env, &DataKey::OrgMandates(org), id)?;
        storage::index_push(&env, &DataKey::PersonMandates(representative), id)?;
        env.storage()
            .persistent()
            .set(&DataKey::LiveMandate(org, representative), &id);
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
            status,
        )?;
        claim.status = status;
        storage::put_mandate(&env, &claim);

        ClaimStatusSet {
            id,
            status,
            by: caller,
        }
        .publish(&env);
        Ok(())
    }

    // -- reads -------------------------------------------------------------

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
    /// The question a candidate being cold-DMed actually has. One storage read:
    /// it checks the most recent mandate between the pair, and requires both
    /// parties' badges to still be valid — a mandate from a revoked company is
    /// not an authorisation.
    pub fn is_authorised(env: Env, org: u64, representative: u64) -> bool {
        let key = DataKey::LiveMandate(org, representative);
        let Some(mandate_id) = env.storage().persistent().get::<_, u64>(&key) else {
            return false;
        };
        let Some(claim) = storage::get_mandate(&env, mandate_id) else {
            return false;
        };
        let now = env.ledger().timestamp();
        if claim.status != ClaimStatus::Active || now < claim.valid_from || now > claim.valid_until
        {
            return false;
        }
        Self::is_entity_valid(&env, org, now) && Self::is_entity_valid(&env, representative, now)
    }

    // -- internals ---------------------------------------------------------

    fn is_entity_valid(env: &Env, id: u64, now: u64) -> bool {
        match storage::get_entity(env, id) {
            Some(entity) => effective_entity_status(&entity, now) == EntityStatus::Active,
            None => false,
        }
    }

    fn require_admin(env: &Env) -> Result<Address, Error> {
        let admin = storage::admin(env)?;
        admin.require_auth();
        Ok(admin)
    }

    /// Either of two roles may sign, so the caller is named explicitly and then
    /// checked — `require_auth` can only assert a single known address.
    fn require_admin_or_arbiter(env: &Env, caller: &Address) -> Result<Address, Error> {
        caller.require_auth();
        if caller == &storage::admin(env)? || caller == &storage::arbiter(env)? {
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
