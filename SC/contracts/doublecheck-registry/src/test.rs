#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String, Vec,
};

const DAY: u64 = 86_400;
const YEAR: u64 = 365 * DAY;

struct Fixture {
    env: Env,
    client: VerifiedRegistryClient<'static>,
    admin: Address,
    arbiter: Address,
    contract_id: Address,
}

fn setup() -> Fixture {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_750_000_000);

    let admin = Address::generate(&env);
    let arbiter = Address::generate(&env);
    let contract_id = env.register(VerifiedRegistry, (admin.clone(), arbiter.clone()));
    let client = VerifiedRegistryClient::new(&env, &contract_id);

    Fixture {
        env,
        client,
        admin,
        arbiter,
        contract_id,
    }
}

fn hash(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

fn s(env: &Env, text: &str) -> String {
    String::from_str(env, text)
}

impl Fixture {
    fn now(&self) -> u64 {
        self.env.ledger().timestamp()
    }

    fn register_org(&self, controller: &Address, handle: &str) -> u64 {
        self.client.register_entity(
            &EntityKind::Organisation,
            controller,
            &s(&self.env, handle),
            &s(&self.env, "Acme Robotics GmbH"),
            &s(&self.env, "acme-robotics.de"),
            &s(&self.env, "Germany"),
            &hash(&self.env, 1),
            &s(&self.env, "https://verify.example.com/c/acme.json"),
            &(self.now() + YEAR),
        )
    }

    fn register_person(&self, controller: &Address, handle: &str) -> u64 {
        self.client.register_entity(
            &EntityKind::Person,
            controller,
            &s(&self.env, handle),
            &s(&self.env, ""),
            &s(&self.env, ""),
            &s(&self.env, ""),
            &hash(&self.env, 2),
            &s(&self.env, "https://verify.example.com/p/mara.json"),
            &(self.now() + YEAR),
        )
    }

    fn attest(&self, caller: &Address, org: u64, person: u64) -> u64 {
        self.client.attest_relationship(
            caller,
            &org,
            &person,
            &RelationshipType::CurrentEmployee,
            &s(&self.env, "Senior Technical Recruiter"),
            &s(&self.env, "Talent"),
            &(self.now() - 30 * DAY),
            &0,
            // Company attestations begin unlisted. The subject publishes them
            // separately after consent.
            &false,
            &hash(&self.env, 3),
        )
    }

    fn mandate(&self, caller: &Address, org: u64, rep: u64, relationship: u64) -> u64 {
        self.client.issue_mandate(
            caller,
            &org,
            &rep,
            &relationship,
            &MandateType::Recruitment,
            &s(&self.env, "Engineering hiring, robotics division"),
            &s(&self.env, "EU"),
            &(self.now() - DAY),
            &(self.now() + 90 * DAY),
            &hash(&self.env, 4),
        )
    }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

#[test]
fn registers_and_checks_an_entity_by_handle() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let id = f.register_org(&org_ctrl, "acme-robotics");

    assert_eq!(id, 1);
    assert_eq!(f.client.entity_count(), 1);

    let check = f.client.check(&s(&f.env, "acme-robotics")).unwrap();
    assert!(check.valid);
    assert_eq!(check.effective_status, EntityStatus::Active);
    assert_eq!(check.entity.id, 1);
    assert_eq!(check.entity.kind, EntityKind::Organisation);
    assert_eq!(check.entity.issuer, f.admin);
    assert_eq!(check.entity.controller, org_ctrl);
    assert_eq!(check.relationships, 0);
    assert_eq!(check.mandates, 0);
}

#[test]
fn resolves_an_entity_by_id_and_by_controller() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    let id = f.register_org(&ctrl, "acme-robotics");

    assert_eq!(
        f.client.get_entity(&id).unwrap().handle,
        s(&f.env, "acme-robotics")
    );
    assert_eq!(f.client.get_entity_by_controller(&ctrl).unwrap().id, id);
    assert!(f.client.get_entity(&99).is_none());
    assert!(f.client.check(&s(&f.env, "nobody")).is_none());
}

#[test]
fn one_step_registration_requests_both_issuer_and_controller_auth() {
    let f = setup();
    let controller = Address::generate(&f.env);
    f.register_person(&controller, "consenting-controller");

    let auths = f.env.auths();
    assert_eq!(auths.len(), 2);
    assert!(auths.iter().any(|(address, _)| address == &f.admin));
    assert!(auths.iter().any(|(address, _)| address == &controller));
}

#[test]
fn rejects_a_duplicate_handle() {
    let f = setup();
    f.register_org(&Address::generate(&f.env), "acme-robotics");
    let err = f
        .client
        .try_register_entity(
            &EntityKind::Organisation,
            &Address::generate(&f.env),
            &s(&f.env, "acme-robotics"),
            &s(&f.env, "Impostor GmbH"),
            &s(&f.env, "acme-robotics.co"),
            &s(&f.env, "Germany"),
            &hash(&f.env, 9),
            &s(&f.env, "https://verify.example.com/c/impostor.json"),
            &(f.now() + YEAR),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::HandleTaken);
}

#[test]
fn rejects_a_controller_that_already_holds_a_badge() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    f.register_org(&ctrl, "acme-robotics");
    let err = f
        .client
        .try_register_entity(
            &EntityKind::Person,
            &ctrl,
            &s(&f.env, "mara-lindqvist"),
            &s(&f.env, ""),
            &s(&f.env, ""),
            &s(&f.env, ""),
            &hash(&f.env, 9),
            &s(&f.env, "https://verify.example.com/p/duplicate.json"),
            &(f.now() + YEAR),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::ControllerTaken);
}

#[test]
fn rejects_handles_that_would_make_a_confusing_url() {
    let f = setup();
    for bad in [
        "ab",
        "Acme-Robotics",
        "acme robotics",
        "acme/robotics",
        ".hidden",
        "trailing-",
    ] {
        let err = f
            .client
            .try_register_entity(
                &EntityKind::Organisation,
                &Address::generate(&f.env),
                &s(&f.env, bad),
                &s(&f.env, ""),
                &s(&f.env, ""),
                &s(&f.env, ""),
                &hash(&f.env, 9),
                &s(&f.env, ""),
                &0,
            )
            .unwrap_err()
            .unwrap();
        assert_eq!(
            err,
            Error::InvalidHandle,
            "handle {bad:?} should be rejected"
        );
    }
}

#[test]
fn reserves_product_routes_before_they_can_become_badge_handles() {
    let f = setup();
    for reserved in [
        "api", "apply", "badge", "manage", "me", "org", "person", "search", "standard", "tx",
        "verify",
    ] {
        let err = f
            .client
            .try_register_entity(
                &EntityKind::Organisation,
                &Address::generate(&f.env),
                &s(&f.env, reserved),
                &s(&f.env, "Reserved Route Ltd"),
                &s(&f.env, "example.com"),
                &s(&f.env, "Poland"),
                &hash(&f.env, 9),
                &s(&f.env, "https://verify.example.com/c/reserved.json"),
                &(f.now() + YEAR),
            )
            .unwrap_err()
            .unwrap();
        assert_eq!(err, Error::InvalidHandle, "reserved handle {reserved:?}");
    }
}

#[test]
fn badges_require_bounded_expiry_and_periodic_reverification() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    let no_expiry = f
        .client
        .try_register_entity(
            &EntityKind::Organisation,
            &ctrl,
            &s(&f.env, "permanent-trust"),
            &s(&f.env, "Permanent Trust Ltd"),
            &s(&f.env, "example.com"),
            &s(&f.env, "Poland"),
            &hash(&f.env, 9),
            &s(&f.env, "https://verify.example.com/c/permanent.json"),
            &0,
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(no_expiry, Error::ExpiryRequired);

    let too_far = f
        .client
        .try_register_entity(
            &EntityKind::Organisation,
            &ctrl,
            &s(&f.env, "far-future-trust"),
            &s(&f.env, "Far Future Trust Ltd"),
            &s(&f.env, "example.com"),
            &s(&f.env, "Poland"),
            &hash(&f.env, 9),
            &s(&f.env, "https://verify.example.com/c/future.json"),
            &(f.now() + MAX_BADGE_LIFETIME + 1),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(too_far, Error::ExpiryTooFar);
}

#[test]
fn natural_person_descriptors_must_stay_in_the_erasable_credential() {
    let f = setup();
    let err = f
        .client
        .try_register_entity(
            &EntityKind::Person,
            &Address::generate(&f.env),
            &s(&f.env, "mara-lindqvist"),
            &s(&f.env, "Mara Lindqvist"),
            &s(&f.env, ""),
            &s(&f.env, ""),
            &hash(&f.env, 2),
            &s(&f.env, "https://verify.example.com/p/mara.json"),
            &(f.now() + YEAR),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::PersonalDataNotAllowed);
}

#[test]
fn credential_anchors_reject_placeholders_unsafe_locations_and_control_text() {
    let f = setup();
    let zero = BytesN::from_array(&f.env, &[0; 32]);
    let invalid_hash = f
        .client
        .try_register_entity(
            &EntityKind::Organisation,
            &Address::generate(&f.env),
            &s(&f.env, "zero-anchor"),
            &s(&f.env, "Zero Anchor Ltd"),
            &s(&f.env, "example.com"),
            &s(&f.env, "Poland"),
            &zero,
            &s(&f.env, "https://verify.example.com/c/zero.json"),
            &(f.now() + YEAR),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(invalid_hash, Error::InvalidHash);

    let invalid_uri = f
        .client
        .try_register_entity(
            &EntityKind::Organisation,
            &Address::generate(&f.env),
            &s(&f.env, "unsafe-anchor"),
            &s(&f.env, "Unsafe Anchor Ltd"),
            &s(&f.env, "example.com"),
            &s(&f.env, "Poland"),
            &hash(&f.env, 9),
            &s(&f.env, "javascript:alert(1)"),
            &(f.now() + YEAR),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(invalid_uri, Error::InvalidUri);

    let invalid_text = f
        .client
        .try_register_entity(
            &EntityKind::Organisation,
            &Address::generate(&f.env),
            &s(&f.env, "spoofed-name"),
            &s(&f.env, "Trusted\nRevoked"),
            &s(&f.env, "example.com"),
            &s(&f.env, "Poland"),
            &hash(&f.env, 9),
            &s(&f.env, "https://verify.example.com/c/spoofed.json"),
            &(f.now() + YEAR),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(invalid_text, Error::InvalidText);
}

#[test]
fn public_text_and_uris_reject_invisible_format_controls() {
    let f = setup();

    // These cover each encoded range rejected by the bounded byte scanner.
    for spoofed in [
        "Acme\u{00ad}Ltd",
        "Acme\u{061c}Ltd",
        "Acme\u{180e}Ltd",
        "Acme\u{200b}Ltd",
        "Acme\u{202e}Ltd",
        "Acme\u{2066}Ltd",
        "Acme\u{feff}Ltd",
        "Acme\u{fff9}Ltd",
        "Acme\u{e0001}Ltd",
    ] {
        assert_eq!(validate_text(&s(&f.env, spoofed)), Err(Error::InvalidText));
    }

    assert_eq!(
        validate_uri(&s(
            &f.env,
            "https://verify.example.com/credential\u{202e}fdp.json",
        )),
        Err(Error::InvalidUri)
    );
    // Non-ASCII scripts and diacritics remain valid when they contain no
    // invisible formatting controls.
    assert_eq!(validate_text(&s(&f.env, "Zażółć 株式会社")), Ok(()));
}

#[test]
fn organisation_and_claim_trust_descriptors_cannot_be_empty() {
    let f = setup();
    for (display_name, domain, jurisdiction) in [
        ("", "example.com", "Poland"),
        ("Example Ltd", "", "Poland"),
        ("Example Ltd", "example.com", ""),
    ] {
        let err = f
            .client
            .try_register_entity(
                &EntityKind::Organisation,
                &Address::generate(&f.env),
                &s(&f.env, "missing-descriptor"),
                &s(&f.env, display_name),
                &s(&f.env, domain),
                &s(&f.env, jurisdiction),
                &hash(&f.env, 9),
                &s(&f.env, "https://verify.example.com/c/missing.json"),
                &(f.now() + YEAR),
            )
            .unwrap_err()
            .unwrap();
        assert_eq!(err, Error::InvalidText);
    }

    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let empty_role = f
        .client
        .try_attest_relationship(
            &org_ctrl,
            &org,
            &person,
            &RelationshipType::CurrentEmployee,
            &s(&f.env, ""),
            &s(&f.env, ""),
            &f.now(),
            &0,
            &false,
            &hash(&f.env, 3),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(empty_role, Error::InvalidText);

    let empty_scope = f
        .client
        .try_issue_mandate(
            &org_ctrl,
            &org,
            &person,
            &0,
            &MandateType::Recruitment,
            &s(&f.env, ""),
            &s(&f.env, ""),
            &f.now(),
            &(f.now() + DAY),
            &hash(&f.env, 4),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(empty_scope, Error::InvalidText);
}

#[test]
fn a_vetted_badge_is_not_active_until_its_controller_accepts() {
    let f = setup();
    let controller = Address::generate(&f.env);
    let pending = f.client.propose_entity(
        &EntityKind::Person,
        &controller,
        &s(&f.env, "mara-lindqvist"),
        &s(&f.env, ""),
        &s(&f.env, ""),
        &s(&f.env, ""),
        &hash(&f.env, 2),
        &s(&f.env, "https://verify.example.com/p/mara.json"),
        &hash(&f.env, 8),
        &(f.now() + 7 * DAY),
        &(f.now() + YEAR),
    );

    assert_eq!(f.client.entity_count(), 0);
    assert!(f.client.check(&s(&f.env, "mara-lindqvist")).is_none());
    assert_eq!(
        f.client
            .get_pending_entity_by_controller(&controller)
            .unwrap()
            .id,
        pending
    );

    let id = f.client.accept_entity(&pending);
    assert_eq!(id, 1);
    assert!(f.client.check_by_id(&id).unwrap().valid);
    assert!(f.client.get_pending_entity(&pending).is_none());
}

#[test]
fn acceptance_deadline_must_precede_the_proposed_badge_expiry() {
    let f = setup();
    let boundary = f.now() + 7 * DAY;
    let err = f
        .client
        .try_propose_entity(
            &EntityKind::Person,
            &Address::generate(&f.env),
            &s(&f.env, "expired-on-acceptance"),
            &s(&f.env, ""),
            &s(&f.env, ""),
            &s(&f.env, ""),
            &hash(&f.env, 2),
            &s(&f.env, "https://verify.example.com/p/expired.json"),
            &hash(&f.env, 8),
            &boundary,
            &boundary,
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InvalidAcceptanceWindow);
}

#[test]
fn expired_badge_proposals_can_be_released_without_activating() {
    let f = setup();
    let controller = Address::generate(&f.env);
    let pending = f.client.propose_entity(
        &EntityKind::Person,
        &controller,
        &s(&f.env, "mara-lindqvist"),
        &s(&f.env, ""),
        &s(&f.env, ""),
        &s(&f.env, ""),
        &hash(&f.env, 2),
        &s(&f.env, "https://verify.example.com/p/mara.json"),
        &hash(&f.env, 8),
        &(f.now() + DAY),
        &(f.now() + YEAR),
    );
    f.env.ledger().set_timestamp(f.now() + DAY + 1);

    let err = f.client.try_accept_entity(&pending).unwrap_err().unwrap();
    assert_eq!(err, Error::PendingEntityExpired);

    let cleaner = Address::generate(&f.env);
    f.client.cancel_entity_proposal(&cleaner, &pending);
    assert!(f.client.get_pending_entity(&pending).is_none());
}

// ---------------------------------------------------------------------------
// Expiry, suspension, revocation
// ---------------------------------------------------------------------------

#[test]
fn a_badge_stops_verifying_when_it_expires_without_any_transaction() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    f.register_org(&ctrl, "acme-robotics");

    f.env.ledger().set_timestamp(f.now() + YEAR + DAY);

    let check = f.client.check(&s(&f.env, "acme-robotics")).unwrap();
    assert!(!check.valid);
    assert_eq!(check.effective_status, EntityStatus::Expired);
    // The stored status is untouched — expiry is derived, not written.
    assert_eq!(check.entity.status, EntityStatus::Active);
}

#[test]
fn renewal_restores_a_lapsed_badge() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    let id = f.register_org(&ctrl, "acme-robotics");

    f.env.ledger().set_timestamp(f.now() + YEAR + DAY);
    assert!(!f.client.check_by_id(&id).unwrap().valid);

    f.client.renew_entity(&id, &(f.now() + YEAR));
    assert!(f.client.check_by_id(&id).unwrap().valid);
}

#[test]
fn the_arbiter_cannot_revoke() {
    // Revocation is terminal and cannot be undone by anyone, so the complaint
    // role must not be able to reach it. A compromised arbiter key can withhold
    // badges, not destroy them.
    let f = setup();
    let id = f.register_org(&Address::generate(&f.env), "acme-robotics");

    let err = f
        .client
        .try_set_entity_status(&f.arbiter, &id, &EntityStatus::Revoked)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    // It can still suspend, and lift its own suspension.
    f.client
        .set_entity_status(&f.arbiter, &id, &EntityStatus::Suspended);
    assert!(!f.client.check_by_id(&id).unwrap().valid);
    f.client
        .set_entity_status(&f.arbiter, &id, &EntityStatus::Active);
    assert!(f.client.check_by_id(&id).unwrap().valid);
}

#[test]
fn the_arbiter_cannot_lift_an_issuer_imposed_suspension() {
    let f = setup();
    let id = f.register_org(&Address::generate(&f.env), "acme-robotics");

    f.client
        .set_entity_status(&f.admin, &id, &EntityStatus::Suspended);
    let err = f
        .client
        .try_set_entity_status(&f.arbiter, &id, &EntityStatus::Active)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    f.client
        .set_entity_status(&f.admin, &id, &EntityStatus::Active);
    assert!(f.client.check_by_id(&id).unwrap().valid);
}

#[test]
fn a_full_index_does_not_block_claims_about_the_subject() {
    // `attest_relationship` indexes against the subject as well as the
    // attester, and index entries cannot be removed. If a full index failed the
    // write, one verified organisation could fill a person's index and
    // permanently prevent every other organisation from attesting about them.
    let f = setup();
    let spammer_ctrl = Address::generate(&f.env);
    let honest_ctrl = Address::generate(&f.env);
    let spammer = f.register_org(&spammer_ctrl, "spam-corp");
    let honest = f.register_org(&honest_ctrl, "acme-robotics");
    let victim = f.register_person(&Address::generate(&f.env), "mara-lindqvist");

    for _ in 0..MAX_INDEX_LEN {
        f.attest(&spammer_ctrl, spammer, victim);
    }
    assert_eq!(f.client.relationships_about(&victim).len(), MAX_INDEX_LEN);

    // The claim is still accepted and still readable by id; only the
    // convenience index stops growing.
    let id = f.attest(&honest_ctrl, honest, victim);
    let claim = f.client.get_relationship(&id).unwrap();
    assert_eq!(claim.org, honest);
    assert_eq!(f.client.relationships_about(&victim).len(), MAX_INDEX_LEN);
}

#[test]
fn the_arbiter_can_suspend_and_revocation_is_terminal() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    let id = f.register_org(&ctrl, "acme-robotics");

    f.client
        .set_entity_status(&f.admin, &id, &EntityStatus::Suspended);
    assert!(!f.client.check_by_id(&id).unwrap().valid);

    f.client
        .set_entity_status(&f.admin, &id, &EntityStatus::Revoked);
    let err = f
        .client
        .try_set_entity_status(&f.admin, &id, &EntityStatus::Active)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InvalidStatus);

    let err = f
        .client
        .try_renew_entity(&id, &(f.now() + YEAR))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InvalidStatus);
}

#[test]
fn a_stranger_cannot_change_an_entitys_status() {
    let f = setup();
    let id = f.register_org(&Address::generate(&f.env), "acme-robotics");
    let stranger = Address::generate(&f.env);
    let err = f
        .client
        .try_set_entity_status(&stranger, &id, &EntityStatus::Revoked)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);
}

#[test]
fn strikes_accumulate_publicly() {
    let f = setup();
    let id = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    assert_eq!(f.client.add_strike(&f.arbiter, &id), 1);
    assert_eq!(f.client.add_strike(&f.arbiter, &id), 2);
    assert_eq!(f.client.get_entity(&id).unwrap().strikes, 2);
}

#[test]
fn rotating_a_controller_moves_the_badge_and_frees_the_old_key() {
    let f = setup();
    let old = Address::generate(&f.env);
    let new = Address::generate(&f.env);
    let id = f.register_person(&old, "mara-lindqvist");

    f.client.rotate_controller(&id, &new);

    assert_eq!(f.client.get_entity_by_controller(&new).unwrap().id, id);
    assert!(f.client.get_entity_by_controller(&old).is_none());
}

#[test]
fn controller_recovery_requires_current_issuer_and_destination() {
    let f = setup();
    let old = Address::generate(&f.env);
    let new = Address::generate(&f.env);
    let id = f.register_person(&old, "mara-lindqvist");

    f.client.propose_controller(&old, &id, &new);
    assert_eq!(f.client.get_entity_by_controller(&old).unwrap().id, id);
    assert!(f.client.get_entity_by_controller(&new).is_none());
    assert_eq!(f.client.get_pending_controller(&id), Some(new.clone()));
    assert!(f.client.get_approved_controller(&id).is_none());

    // Current + destination alone is not a contract-assisted transfer path.
    assert_eq!(
        f.client.try_accept_controller(&id).unwrap_err().unwrap(),
        Error::ControllerRotationNotApproved
    );
    assert_eq!(f.client.get_entity_by_controller(&old).unwrap().id, id);

    f.client.approve_controller_rotation(&id);
    assert_eq!(f.client.get_approved_controller(&id), Some(new.clone()));
    f.client.accept_controller(&id);
    assert_eq!(f.client.get_entity_by_controller(&new).unwrap().id, id);
    assert!(f.client.get_entity_by_controller(&old).is_none());
    assert!(f.client.get_pending_controller(&id).is_none());
    assert!(f.client.get_approved_controller(&id).is_none());
    assert_eq!(
        f.client.try_accept_controller(&id).unwrap_err().unwrap(),
        Error::NoPendingController
    );
}

#[test]
fn changing_a_recovery_destination_invalidates_issuer_approval() {
    let f = setup();
    let old = Address::generate(&f.env);
    let first = Address::generate(&f.env);
    let second = Address::generate(&f.env);
    let id = f.register_person(&old, "mara-lindqvist");

    f.client.propose_controller(&old, &id, &first);
    f.client.approve_controller_rotation(&id);
    assert_eq!(f.client.get_approved_controller(&id), Some(first));

    f.client.propose_controller(&old, &id, &second);
    assert_eq!(f.client.get_pending_controller(&id), Some(second));
    assert!(f.client.get_approved_controller(&id).is_none());
    assert_eq!(
        f.client.try_accept_controller(&id).unwrap_err().unwrap(),
        Error::ControllerRotationNotApproved
    );

    // The issuer may cancel a recovery it no longer approves.
    f.client.cancel_controller_rotation(&f.admin, &id);
    assert!(f.client.get_pending_controller(&id).is_none());
    assert_eq!(f.client.get_entity_by_controller(&old).unwrap().id, id);
}

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

#[test]
fn the_signer_decides_how_much_a_relationship_is_worth() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");

    let by_org = f.attest(&org_ctrl, org, person);
    let by_person = f.attest(&person_ctrl, org, person);
    let by_admin = f.attest(&f.admin, org, person);

    assert_eq!(
        f.client.get_relationship(&by_org).unwrap().confirmation,
        Confirmation::CounterpartyConfirmed
    );
    assert_eq!(
        f.client.get_relationship(&by_person).unwrap().confirmation,
        Confirmation::SelfAsserted
    );
    assert_eq!(
        f.client.get_relationship(&by_admin).unwrap().confirmation,
        Confirmation::IssuerConfirmed
    );
}

#[test]
fn an_unrelated_wallet_cannot_attest_a_relationship() {
    let f = setup();
    let org = f.register_org(&Address::generate(&f.env), "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let stranger = Address::generate(&f.env);

    let err = f
        .client
        .try_attest_relationship(
            &stranger,
            &org,
            &person,
            &RelationshipType::CurrentEmployee,
            &s(&f.env, "CEO"),
            &s(&f.env, ""),
            &f.now(),
            &0,
            &true,
            &hash(&f.env, 3),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);
}

#[test]
fn relationships_need_an_organisation_on_one_side_and_a_person_on_the_other() {
    let f = setup();
    let a_ctrl = Address::generate(&f.env);
    let org_a = f.register_org(&a_ctrl, "acme-robotics");
    let org_b = f.register_org(&Address::generate(&f.env), "nordlicht-systems");

    let err = f
        .client
        .try_attest_relationship(
            &a_ctrl,
            &org_a,
            &org_b,
            &RelationshipType::CurrentEmployee,
            &s(&f.env, "Subsidiary"),
            &s(&f.env, ""),
            &f.now(),
            &0,
            &true,
            &hash(&f.env, 3),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::WrongEntityKind);
}

#[test]
fn a_revoked_organisation_cannot_attest_anything_new() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");

    f.client
        .set_entity_status(&f.admin, &org, &EntityStatus::Revoked);

    let err = f
        .client
        .try_attest_relationship(
            &org_ctrl,
            &org,
            &person,
            &RelationshipType::CurrentEmployee,
            &s(&f.env, "Recruiter"),
            &s(&f.env, ""),
            &f.now(),
            &0,
            &true,
            &hash(&f.env, 3),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::EntityNotActive);
}

#[test]
fn the_subject_can_withdraw_a_claim_about_themselves_but_cannot_strengthen_one() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);

    let err = f
        .client
        .try_set_relationship_status(&person_ctrl, &rel, &ClaimStatus::Completed)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    f.client
        .set_relationship_status(&person_ctrl, &rel, &ClaimStatus::Withdrawn);
    assert_eq!(
        f.client.get_relationship(&rel).unwrap().status,
        ClaimStatus::Withdrawn
    );
}

#[test]
fn only_the_subject_or_the_admin_controls_publication() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);

    let err = f
        .client
        .try_set_public_display(&org_ctrl, &rel, &false)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    f.client.set_public_display(&person_ctrl, &rel, &true);
    assert!(f.client.get_relationship(&rel).unwrap().public_display);
}

#[test]
fn a_company_cannot_publish_an_affiliation_without_subject_consent() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");

    let err = f
        .client
        .try_attest_relationship(
            &org_ctrl,
            &org,
            &person,
            &RelationshipType::CurrentEmployee,
            &s(&f.env, "Senior Technical Recruiter"),
            &s(&f.env, "Talent"),
            &(f.now() - DAY),
            &0,
            &true,
            &hash(&f.env, 3),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    let rel = f.attest(&org_ctrl, org, person);
    assert!(!f.client.get_relationship(&rel).unwrap().public_display);
    f.client.set_public_display(&person_ctrl, &rel, &true);
    assert!(f.client.get_relationship(&rel).unwrap().public_display);
}

#[test]
fn a_subject_withdrawal_is_terminal_and_cannot_be_reactivated() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);

    f.client
        .set_relationship_status(&person_ctrl, &rel, &ClaimStatus::Withdrawn);
    let err = f
        .client
        .try_set_relationship_status(&f.admin, &rel, &ClaimStatus::Active)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InvalidStatus);
}

#[test]
fn an_organisation_cannot_clear_an_arbiter_dispute() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);

    f.client
        .set_relationship_status(&f.arbiter, &rel, &ClaimStatus::Disputed);
    let err = f
        .client
        .try_set_relationship_status(&org_ctrl, &rel, &ClaimStatus::Active)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    f.client
        .set_relationship_status(&f.admin, &rel, &ClaimStatus::Active);
    assert_eq!(
        f.client.get_relationship(&rel).unwrap().status,
        ClaimStatus::Active
    );
}

#[test]
fn ending_a_relationship_keeps_the_history() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);

    let end = f.now();
    f.client.end_relationship(&org_ctrl, &rel, &end);

    let claim = f.client.get_relationship(&rel).unwrap();
    assert_eq!(claim.status, ClaimStatus::Ended);
    assert_eq!(claim.end_date, end);
    assert_eq!(claim.start_date, f.now() - 30 * DAY);
    assert_eq!(f.client.relationships_about(&person).len(), 1);
}

#[test]
fn generic_relationship_status_cannot_create_an_undated_ending() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);

    let err = f
        .client
        .try_set_relationship_status(&org_ctrl, &rel, &ClaimStatus::Ended)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InvalidStatus);
    let still_active = f.client.get_relationship(&rel).unwrap();
    assert_eq!(still_active.status, ClaimStatus::Active);
    assert_eq!(still_active.end_date, 0);

    f.client.end_relationship(&org_ctrl, &rel, &f.now());
    let ended = f.client.get_relationship(&rel).unwrap();
    assert_eq!(ended.status, ClaimStatus::Ended);
    assert_eq!(ended.end_date, f.now());
}

// ---------------------------------------------------------------------------
// Mandates — the claim a candidate actually checks
// ---------------------------------------------------------------------------

#[test]
fn a_live_mandate_authorises_and_withdrawal_takes_it_away_immediately() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);
    let mandate = f.mandate(&org_ctrl, org, person, rel);

    // A company-confirmed affiliation is still private until the subject opts
    // into verifier display, so it cannot silently support a green verdict.
    assert!(!f.client.is_authorised(&org, &person));
    f.client.set_public_display(&person_ctrl, &rel, &true);
    assert!(f.client.is_authorised(&org, &person));
    assert_eq!(
        f.client.mandate_status(&mandate).unwrap(),
        ClaimStatus::Active
    );

    f.client
        .set_mandate_status(&org_ctrl, &mandate, &ClaimStatus::Withdrawn);

    assert!(!f.client.is_authorised(&org, &person));
    assert_eq!(
        f.client.mandate_status(&mandate).unwrap(),
        ClaimStatus::Withdrawn
    );
}

#[test]
fn a_mandate_stops_authorising_the_moment_its_window_closes() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let mandate = f.mandate(&org_ctrl, org, person, 0);

    f.env.ledger().set_timestamp(f.now() + 91 * DAY);

    assert!(!f.client.is_authorised(&org, &person));
    assert_eq!(
        f.client.mandate_status(&mandate).unwrap(),
        ClaimStatus::Expired
    );
    // Nothing was written to make that true.
    assert_eq!(
        f.client.get_mandate(&mandate).unwrap().status,
        ClaimStatus::Active
    );
}

#[test]
fn revoking_the_company_invalidates_the_mandates_it_handed_out() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    f.mandate(&org_ctrl, org, person, 0);

    assert!(f.client.is_authorised(&org, &person));
    f.client
        .set_entity_status(&f.admin, &org, &EntityStatus::Revoked);
    assert!(!f.client.is_authorised(&org, &person));
}

#[test]
fn a_mandate_must_point_at_a_relationship_between_the_same_two_parties() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let other_org_ctrl = Address::generate(&f.env);
    let other_org = f.register_org(&other_org_ctrl, "nordlicht-systems");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let foreign_rel = f.attest(&other_org_ctrl, other_org, person);

    let err = f
        .client
        .try_issue_mandate(
            &org_ctrl,
            &org,
            &person,
            &foreign_rel,
            &MandateType::Recruitment,
            &s(&f.env, "Engineering hiring"),
            &s(&f.env, ""),
            &f.now(),
            &(f.now() + DAY),
            &hash(&f.env, 4),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::RelationshipMismatch);
}

#[test]
fn mandates_must_be_time_bound() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");

    let err = f
        .client
        .try_issue_mandate(
            &org_ctrl,
            &org,
            &person,
            &0,
            &MandateType::Recruitment,
            &s(&f.env, "Everything, forever"),
            &s(&f.env, ""),
            &f.now(),
            &0,
            &hash(&f.env, 4),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InvalidDateRange);
}

#[test]
fn an_agency_can_hold_a_mandate_from_a_client_company() {
    let f = setup();
    let client_ctrl = Address::generate(&f.env);
    let agency_ctrl = Address::generate(&f.env);
    let client_org = f.register_org(&client_ctrl, "acme-robotics");
    let agency = f.register_org(&agency_ctrl, "beacon-talent");

    let mandate = f.mandate(&client_ctrl, client_org, agency, 0);

    assert!(f.client.is_authorised(&client_org, &agency));
    assert_eq!(f.client.mandates_held_by(&agency).len(), 1);
    assert_eq!(
        f.client.mandates_issued_by(&client_org).get(0).unwrap(),
        mandate
    );
}

#[test]
fn an_organisation_cannot_issue_a_mandate_to_itself() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");

    let err = f
        .client
        .try_issue_mandate(
            &org_ctrl,
            &org,
            &org,
            &0,
            &MandateType::Recruitment,
            &s(&f.env, "Engineering hiring"),
            &s(&f.env, "EU"),
            &f.now(),
            &(f.now() + DAY),
            &hash(&f.env, 4),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::SameEntity);
}

#[test]
fn a_self_asserted_mandate_is_visible_evidence_but_not_authorisation() {
    let f = setup();
    let org = f.register_org(&Address::generate(&f.env), "acme-robotics");
    let person_ctrl = Address::generate(&f.env);
    let person = f.register_person(&person_ctrl, "mara-lindqvist");

    let mandate = f.mandate(&person_ctrl, org, person, 0);
    assert_eq!(
        f.client.get_mandate(&mandate).unwrap().confirmation,
        Confirmation::SelfAsserted
    );
    assert!(!f.client.is_authorised(&org, &person));
}

#[test]
fn a_linked_relationship_must_still_be_live_for_a_mandate_to_authorise() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");
    let rel = f.attest(&org_ctrl, org, person);
    f.client.set_public_display(&person_ctrl, &rel, &true);
    f.mandate(&org_ctrl, org, person, rel);
    assert!(f.client.is_authorised(&org, &person));

    f.client
        .set_relationship_status(&person_ctrl, &rel, &ClaimStatus::Withdrawn);
    assert!(!f.client.is_authorised(&org, &person));
}

#[test]
fn a_newer_scheduled_mandate_does_not_mask_an_older_live_confirmation() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    f.mandate(&org_ctrl, org, person, 0);

    f.client.issue_mandate(
        &org_ctrl,
        &org,
        &person,
        &0,
        &MandateType::Recruitment,
        &s(&f.env, "A future hiring campaign"),
        &s(&f.env, "EU"),
        &(f.now() + 120 * DAY),
        &(f.now() + 180 * DAY),
        &hash(&f.env, 5),
    );

    assert!(f.client.is_authorised(&org, &person));
}

#[test]
fn unrelated_index_crowding_cannot_hide_a_pair_mandate() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");

    // Model a legacy representative-wide index filled by unrelated records.
    // The pair-specific index written by the new contract must remain usable.
    let mut crowded = Vec::new(&f.env);
    for id in 1..=MAX_INDEX_LEN {
        crowded.push_back(10_000 + u64::from(id));
    }
    f.env.as_contract(&f.contract_id, || {
        f.env
            .storage()
            .persistent()
            .set(&DataKey::PersonMandates(person), &crowded);
    });

    f.mandate(&org_ctrl, org, person, 0);
    assert!(f.client.is_authorised(&org, &person));
}

#[test]
fn same_pair_self_assertion_saturation_cannot_hide_a_new_confirmation() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let person_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&person_ctrl, "mara-lindqvist");

    let self_asserted = f.mandate(&person_ctrl, org, person, 0);
    let confirmed_key = DataKey::ConfirmedPairMandates(org, person);
    let no_confirmed_index: Option<Vec<u64>> = f.env.as_contract(&f.contract_id, || {
        f.env.storage().persistent().get(&confirmed_key)
    });
    assert!(no_confirmed_index.is_none());

    // Model both legacy lookup indexes saturated by this pair's own
    // self-assertions. The separate confirmed index remains untouched.
    let mut self_saturated = Vec::new(&f.env);
    for _ in 0..MAX_INDEX_LEN {
        self_saturated.push_back(self_asserted);
    }
    f.env.as_contract(&f.contract_id, || {
        f.env
            .storage()
            .persistent()
            .set(&DataKey::PairMandates(org, person), &self_saturated);
        f.env
            .storage()
            .persistent()
            .set(&DataKey::PersonMandates(person), &self_saturated);
    });

    let company_confirmed = f.mandate(&org_ctrl, org, person, 0);
    let confirmed: Vec<u64> = f.env.as_contract(&f.contract_id, || {
        f.env.storage().persistent().get(&confirmed_key).unwrap()
    });
    assert_eq!(confirmed.len(), 1);
    assert_eq!(confirmed.get(0), Some(company_confirmed));
    assert!(f.client.is_authorised(&org, &person));
}

#[test]
fn confirmed_pair_capacity_never_evicts_a_still_live_authorisation() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let now = f.now();
    let key = DataKey::ConfirmedPairMandates(org, person);

    // Construct the adversarial boundary directly: the maximum number of
    // distinct, live, company-confirmed mandates for exactly one pair.
    f.env.as_contract(&f.contract_id, || {
        let mut ids = Vec::new(&f.env);
        for offset in 0..MAX_CONFIRMED_PAIR_LEN {
            let id = 10_000 + u64::from(offset);
            storage::put_mandate(
                &f.env,
                &Mandate {
                    id,
                    org,
                    representative: person,
                    relationship: 0,
                    mandate_type: MandateType::Recruitment,
                    scope: s(&f.env, "Engineering hiring"),
                    territory: s(&f.env, "EU"),
                    valid_from: now - DAY,
                    valid_until: now + 90 * DAY,
                    status: ClaimStatus::Active,
                    confirmation: Confirmation::CounterpartyConfirmed,
                    detail_hash: hash(&f.env, 4),
                    confirmed_at: now,
                    attested_by: org_ctrl.clone(),
                },
            );
            ids.push_back(id);
        }
        storage::put_index(&f.env, &key, &ids);
    });

    let err = f
        .client
        .try_issue_mandate(
            &org_ctrl,
            &org,
            &person,
            &0,
            &MandateType::Recruitment,
            &s(&f.env, "A newer decision"),
            &s(&f.env, "EU"),
            &now,
            &(now + 30 * DAY),
            &hash(&f.env, 5),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::IndexFull);
    assert!(f.client.is_authorised(&org, &person));

    let unchanged: Vec<u64> = f.env.as_contract(&f.contract_id, || {
        f.env.storage().persistent().get(&key).unwrap()
    });
    assert_eq!(unchanged.len(), MAX_CONFIRMED_PAIR_LEN);
    assert_eq!(unchanged.get(0), Some(10_000));
    assert_eq!(
        unchanged.last(),
        Some(10_000 + u64::from(MAX_CONFIRMED_PAIR_LEN - 1))
    );

    // Closing one decision prunes it immediately and frees exactly one slot.
    f.client
        .set_mandate_status(&org_ctrl, &10_000, &ClaimStatus::Withdrawn);
    let replacement = f.mandate(&org_ctrl, org, person, 0);
    let after: Vec<u64> = f.env.as_contract(&f.contract_id, || {
        f.env.storage().persistent().get(&key).unwrap()
    });
    assert_eq!(after.len(), MAX_CONFIRMED_PAIR_LEN);
    assert_eq!(after.get(0), Some(10_001));
    assert_eq!(after.last(), Some(replacement));
    assert!(f.client.is_authorised(&org, &person));
}

#[test]
fn mandates_cannot_outlive_their_review_window() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");

    let err = f
        .client
        .try_issue_mandate(
            &org_ctrl,
            &org,
            &person,
            &0,
            &MandateType::Recruitment,
            &s(&f.env, "Too long"),
            &s(&f.env, ""),
            &f.now(),
            &(f.now() + MAX_MANDATE_LIFETIME + 1),
            &hash(&f.env, 4),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::ExpiryTooFar);
}

#[test]
fn withdrawn_mandates_cannot_be_reactivated() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    let mandate = f.mandate(&org_ctrl, org, person, 0);

    f.client
        .set_mandate_status(&org_ctrl, &mandate, &ClaimStatus::Withdrawn);
    let err = f
        .client
        .try_set_mandate_status(&f.admin, &mandate, &ClaimStatus::Active)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::InvalidStatus);
}

// ---------------------------------------------------------------------------
// Indexes and explorer reads
// ---------------------------------------------------------------------------

#[test]
fn submitted_keepalive_walks_the_registry_in_bounded_batches() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");
    f.attest(&org_ctrl, org, person);
    f.mandate(&org_ctrl, org, person, 0);

    let first = f.client.keepalive(&0, &0, &1);
    assert!(!first.done);
    assert_eq!(first.entities_touched, 1);
    assert_eq!(first.claims_touched, 1);

    let second = f
        .client
        .keepalive(&first.next_entity, &first.next_claim, &MAX_KEEPALIVE_BATCH);
    assert!(second.done);
    assert_eq!(second.entities_touched, 1);
    assert_eq!(second.claims_touched, 1);

    let err = f.client.try_keepalive(&0, &0, &0).unwrap_err().unwrap();
    assert_eq!(err, Error::InvalidBatchSize);
}

#[test]
fn claim_ids_are_unique_across_relationships_and_mandates() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");

    let rel = f.attest(&org_ctrl, org, person);
    let mandate = f.mandate(&org_ctrl, org, person, rel);

    // Entity ids and claim ids are separate sequences, both starting at 1.
    assert_eq!((org, person), (1, 2));
    assert_eq!((rel, mandate), (1, 2));
    assert_eq!(f.client.claim_count(), 2);
    assert!(f.client.get_relationship(&mandate).is_none());
    assert!(f.client.get_mandate(&rel).is_none());

    let check = f.client.check_by_id(&org).unwrap();
    assert_eq!(check.relationships, 1);
    assert_eq!(check.mandates, 1);
}

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

#[test]
fn pausing_blocks_new_records_but_never_blocks_taking_one_down() {
    let f = setup();
    let org_ctrl = Address::generate(&f.env);
    let org = f.register_org(&org_ctrl, "acme-robotics");
    let person = f.register_person(&Address::generate(&f.env), "mara-lindqvist");

    f.client.set_paused(&true);
    assert!(f.client.paused());

    let err = f
        .client
        .try_attest_relationship(
            &org_ctrl,
            &org,
            &person,
            &RelationshipType::CurrentEmployee,
            &s(&f.env, "Recruiter"),
            &s(&f.env, ""),
            &f.now(),
            &0,
            &true,
            &hash(&f.env, 3),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::Paused);

    // Revocation still works while paused.
    f.client
        .set_entity_status(&f.admin, &org, &EntityStatus::Revoked);
    assert!(!f.client.check_by_id(&org).unwrap().valid);
}

#[test]
fn admin_handover_takes_two_steps() {
    let f = setup();
    let new_admin = Address::generate(&f.env);

    f.client.propose_admin(&new_admin);
    assert_eq!(f.client.admin(), f.admin);

    f.client.accept_admin();
    assert_eq!(f.client.admin(), new_admin);

    // The handover is spent; a second accept has nothing to act on.
    let err = f.client.try_accept_admin().unwrap_err().unwrap();
    assert_eq!(err, Error::NoPendingAdmin);
}

#[test]
fn admin_handover_only_changes_the_issuer_for_future_badges() {
    let f = setup();
    let old_controller = Address::generate(&f.env);
    let old_badge = f.register_person(&old_controller, "original-cohort");
    let new_admin = Address::generate(&f.env);

    f.client.propose_admin(&new_admin);
    f.client.accept_admin();

    let new_controller = Address::generate(&f.env);
    let new_badge = f.register_person(&new_controller, "new-cohort");
    assert_eq!(f.client.get_entity(&old_badge).unwrap().issuer, f.admin);
    assert_eq!(f.client.get_entity(&new_badge).unwrap().issuer, new_admin);

    // The new global admin cannot rewrite or revoke a badge issued by its
    // predecessor.
    let err = f
        .client
        .try_update_metadata(
            &new_admin,
            &old_badge,
            &hash(&f.env, 7),
            &s(&f.env, "https://x/old.json"),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);
    let err = f
        .client
        .try_set_entity_status(&new_admin, &old_badge, &EntityStatus::Revoked)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);
    let err = f
        .client
        .try_add_strike(&new_admin, &old_badge)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    // Each cohort's stored issuer retains its own lifecycle authority.
    f.client.update_metadata(
        &f.admin,
        &old_badge,
        &hash(&f.env, 7),
        &s(&f.env, "https://x/old.json"),
    );
    assert_eq!(f.client.add_strike(&f.admin, &old_badge), 1);
    assert_eq!(f.client.add_strike(&f.arbiter, &old_badge), 2);
    f.client
        .set_entity_status(&f.admin, &old_badge, &EntityStatus::Revoked);

    let err = f
        .client
        .try_update_metadata(
            &f.admin,
            &new_badge,
            &hash(&f.env, 8),
            &s(&f.env, "https://x/new.json"),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);
    f.client.update_metadata(
        &new_admin,
        &new_badge,
        &hash(&f.env, 8),
        &s(&f.env, "https://x/new.json"),
    );
}

#[test]
fn stored_issuer_signs_renewal_and_recovery_after_admin_handover() {
    let f = setup();
    let controller = Address::generate(&f.env);
    let badge = f.register_person(&controller, "fixed-issuer");
    let new_admin = Address::generate(&f.env);
    f.client.propose_admin(&new_admin);
    f.client.accept_admin();

    f.client.renew_entity(&badge, &(f.now() + YEAR));
    let renewal_auths = f.env.auths();
    assert_eq!(renewal_auths.len(), 1);
    assert_eq!(renewal_auths[0].0, f.admin);

    let destination = Address::generate(&f.env);
    f.client
        .propose_controller(&controller, &badge, &destination);
    f.client.approve_controller_rotation(&badge);
    let approval_auths = f.env.auths();
    assert_eq!(approval_auths.len(), 1);
    assert_eq!(approval_auths[0].0, f.admin);

    let err = f
        .client
        .try_cancel_controller_rotation(&new_admin, &badge)
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);
    f.client.cancel_controller_rotation(&f.admin, &badge);

    f.client
        .propose_controller(&controller, &badge, &destination);
    f.client.approve_controller_rotation(&badge);
    f.client.accept_controller(&badge);

    let final_controller = Address::generate(&f.env);
    f.client.rotate_controller(&badge, &final_controller);
    let atomic_auths = f.env.auths();
    assert_eq!(atomic_auths.len(), 3);
    assert!(atomic_auths.iter().any(|(address, _)| address == &f.admin));
    assert!(atomic_auths
        .iter()
        .any(|(address, _)| address == &destination));
    assert!(atomic_auths
        .iter()
        .any(|(address, _)| address == &final_controller));
    assert!(!atomic_auths
        .iter()
        .any(|(address, _)| address == &new_admin));
}

#[test]
fn only_the_issuer_can_replace_the_anchored_credential() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    let id = f.register_person(&ctrl, "mara-lindqvist");
    let stranger = Address::generate(&f.env);

    let err = f
        .client
        .try_update_metadata(
            &stranger,
            &id,
            &hash(&f.env, 7),
            &s(&f.env, "https://x/y.json"),
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    let err = f
        .client
        .try_update_metadata(&ctrl, &id, &hash(&f.env, 7), &s(&f.env, "https://x/y.json"))
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::NotAuthorized);

    f.client.update_metadata(
        &f.admin,
        &id,
        &hash(&f.env, 7),
        &s(&f.env, "https://x/y.json"),
    );
    assert_eq!(
        f.client.get_entity(&id).unwrap().metadata_hash,
        hash(&f.env, 7)
    );
}
