#![cfg(test)]

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, BytesN, Env, String,
};

const DAY: u64 = 86_400;
const YEAR: u64 = 365 * DAY;

struct Fixture {
    env: Env,
    client: VerifiedRegistryClient<'static>,
    admin: Address,
    arbiter: Address,
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
            &true,
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
            &s(&f.env, ""),
            &0,
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
            &s(&f.env, ""),
            &0,
        )
        .unwrap_err()
        .unwrap();
    assert_eq!(err, Error::ControllerTaken);
}

#[test]
fn rejects_handles_that_would_make_a_confusing_url() {
    let f = setup();
    for bad in ["ab", "Acme-Robotics", "acme robotics", "acme/robotics"] {
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
fn the_arbiter_can_suspend_and_revocation_is_terminal() {
    let f = setup();
    let ctrl = Address::generate(&f.env);
    let id = f.register_org(&ctrl, "acme-robotics");

    f.client
        .set_entity_status(&f.arbiter, &id, &EntityStatus::Suspended);
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

    f.client.set_public_display(&person_ctrl, &rel, &false);
    assert!(!f.client.get_relationship(&rel).unwrap().public_display);
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

// ---------------------------------------------------------------------------
// Indexes and explorer reads
// ---------------------------------------------------------------------------

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
fn metadata_can_be_repointed_by_the_subject_but_not_by_a_stranger() {
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

    f.client
        .update_metadata(&ctrl, &id, &hash(&f.env, 7), &s(&f.env, "https://x/y.json"));
    assert_eq!(
        f.client.get_entity(&id).unwrap().metadata_hash,
        hash(&f.env, 7)
    );
}
