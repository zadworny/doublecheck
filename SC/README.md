# DoubleCheck registry contract

The Soroban registry records vetted organisations and people, their relationships, and time-bound
mandates to act for an organisation. The contract derives expiry at read time and preserves who
signed every claim.

Design rationale is in [`docs/architecture.md`](../docs/architecture.md); production operations are
in [`docs/deployment.md`](../docs/deployment.md).

## Version status

| Version | Status |
|---|---|
| Repository vNext | 59 contract tests pass; optimized Wasm is 60,131 bytes |
| Public testnet | vNext at `CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP`, Wasm hash `1ab20ff8c30b0f704b64dee4aed5d1dd111e5b24e33fb612ef9309aef5dc895a` |
| Frontend binding | Generated from the upgraded live vNext specification |

The public testnet runs vNext, but the contract has not received an independent production audit and
the demonstration records do not prove the quality of off-chain verification.

## Layout

```text
contracts/doublecheck-registry/src/
  lib.rs       entry points and authorisation rules
  types.rs     public records, enums, keys, and errors
  storage.rs   persistent storage, indexes, and TTL extension
  events.rs    indexer-facing event definitions
  test.rs      behavioural and adversarial tests
scripts/
  keepalive.sh signed, cursor-based TTL maintenance loop
```

## Build and test

Install Rust, the `wasm32v1-none` target, and Stellar CLI 27.x or a compatible release.

```bash
rustup target add wasm32v1-none
cd SC
cargo test
cargo clippy --all-targets
stellar contract build --optimize
```

The optimized artifact from the current CLI is
`target/wasm32v1-none/release/doublecheck_registry.wasm`.

## Entity onboarding and consent

`propose_entity` → `accept_entity` is the normal path:

1. The issuer completes manual checks off-chain and calls `propose_entity`. The proposal commits the
   controller, public descriptor fields, credential hash/URI, terms hash, acceptance deadline, and
   badge expiry. It reserves the handle and controller but creates no active badge.
2. The intended controller authenticates `accept_entity(pending_id)` before `accept_by`. Only that
   transaction creates the active `Entity` and sets `verified_at`.
3. The issuer or controller can cancel at any time. After the acceptance deadline or proposed badge
   expiry, any authenticated caller can release an abandoned proposal and its reservations.

`accept_by` must be in the future, strictly before the proposed badge expiry, and no more than 30 days
from proposal. Every badge expiry is required, in the future, and no more than 400 days from issuance
or renewal. The preferred operational term is about one year, followed by re-verification.

The one-step `register_entity` remains for expert multi-auth tooling, but both the issuer admin and
the proposed controller must authenticate it. It is not an issuer-only shortcut around consent.

For `EntityKind::Person`, `display_name`, `domain`, and `jurisdiction` must be empty; the contract
rejects personal descriptors there. Names and verification evidence belong in off-chain credentials
stored where the issuer can support deletion. The on-chain handle, address, dates, hashes, and
free-text claim fields remain public; IPFS, mirrors, browser/CDN caches, and ledger anchors are not
guaranteed erasable.

Organisation badges require non-empty legal name, domain, and jurisdiction descriptors. Relationship
roles and mandate scopes are also required; department and territory remain optional.
Credential and terms hashes cannot be all-zero placeholders. Credential URIs are bounded to
`https://` or `ipfs://`; handles/text/URIs reject controls, invisible Unicode formatting characters,
and reserved product routes where applicable.

### Entity interface

| Function | Authorisation and effect |
|---|---|
| `propose_entity(...) -> u64` | admin; creates a pending offer only |
| `accept_entity(pending_id) -> u64` | proposed controller; creates active entity |
| `cancel_entity_proposal(caller, pending_id)` | issuer/controller, or any authenticated caller after deadline/expiry |
| `get_pending_entity(...)`, `get_pending_entity_by_controller(...)` | public reads |
| `register_entity(...) -> u64` | admin and controller multi-auth |
| `update_metadata(caller, id, hash, uri)` | that badge's stored issuer only; subject cannot replace the vetted anchor |
| `renew_entity(id, expires_at)` | stored issuer after re-verification; clears suspension, never revocation |
| `set_entity_status(caller, id, status)` | stored issuer, or global arbiter under the rules below |
| `propose_controller(caller, id, new_controller)` | current controller only |
| `approve_controller_rotation(id)` | stored issuer after recovery review |
| `accept_controller(id)` | issuer-approved destination controller |
| `cancel_controller_rotation(caller, id)` | current controller or stored issuer |
| `get_pending_controller(id)`, `get_approved_controller(id)` | public recovery state |
| `rotate_controller(id, new_controller)` | compatibility path requiring stored issuer, current controller, and destination auth |
| `add_strike(caller, id)` | stored issuer or global arbiter; records an upheld off-chain outcome |

`Revoked` is stored-issuer-only and terminal. An arbiter may suspend and may lift only a suspension
that same arbiter placed; it cannot lift an issuer suspension or revoke. Issuer renewal represents a
new verification decision and can clear a suspension.

`Entity.issuer` is immutable. A global admin handover controls future issuance, configuration and
upgrades, but does not inherit lifecycle authority over the previous issuer's badges. This needs no
storage migration because every existing entity already stores its issuer; it does require the old
issuer key/custody process to remain available until its entire cohort has expired or been revoked.
There is deliberately no authority-reassignment escape hatch in this version.

Controller recovery is an asynchronous three-role flow: the current controller proposes an exact
destination, that badge's stored issuer approves it after its recovery/re-verification policy, and only
then may that destination accept. Replacing a proposal clears its approval. An older pending proposal
found during an upgrade has no approval entry and therefore fails closed until the issuer reviews it.

## Claims

The signer-derived confirmation is immutable evidence:

| Authenticated signer | Stored confirmation |
|---|---|
| organisation controller | `CounterpartyConfirmed` |
| subject/representative controller | `SelfAsserted` |
| admin/issuer | `IssuerConfirmed` |

An organisation cannot publish a relationship about a person unilaterally. Organisation-attested
relationships start unlisted; the subject or admin can change `public_display`. A subject may publish
their own self-assertion. Start dates cannot be in the future.

Status changes are role-aware. A subject can withdraw a claim about itself but cannot strengthen it.
An arbiter can dispute, suspend, or withdraw, but cannot activate or complete. An organisation cannot
clear an arbiter-created dispute/suspension itself. Relationship `Ended`/`Withdrawn` and mandate
`Completed`/`Withdrawn` are terminal; a changed agreement requires a new claim.

| Function | Purpose |
|---|---|
| `attest_relationship(...) -> u64` | records an organisation/person affiliation |
| `end_relationship(caller, id, end_date)` | closes a relationship without deleting history |
| `set_relationship_status(...)` | applies a permitted role-aware transition |
| `set_public_display(...)` | subject/admin publication control |
| `issue_mandate(...) -> u64` | records a non-empty scope and required validity window of at most 366 days; parties must differ |
| `set_mandate_status(...)` | applies a permitted role-aware transition |

## Authorisation reads

All read functions can be simulated without a wallet. Simulation is free of transaction fees and
does not mutate ledger state.

| Function | Result |
|---|---|
| `check(handle)`, `check_by_id(id)` | entity, effective status, and claim counts |
| `is_authorised(org, representative)` | strict current mandate decision |
| `get_entity*`, `get_relationship`, `get_mandate` | raw records |
| `relationship_status`, `mandate_status` | status with time-derived expiry |
| `relationships_*`, `mandates_*` | bounded per-entity claim-id indexes |
| `entity_count`, `claim_count`, `admin`, `arbiter`, `paused` | registry configuration/counters |

`is_authorised` requires all of the following:

- both entity badges exist and are effectively `Active` and unexpired;
- the mandate belongs to the requested pair, is active, and is within `valid_from..valid_until`;
- confirmation is `CounterpartyConfirmed` or `IssuerConfirmed`, never `SelfAsserted`; and
- a non-zero linked relationship exists, matches the same parties, has subject/admin publication
  consent, and is effectively active.

The primary scan walks a pair index containing at most 64 relevant company- or issuer-confirmed
mandates. Self-assertions never enter it, so a representative cannot consume its capacity. Confirmed
issuance and status changes prune inactive, expired, missing, and malformed entries; future-scheduled
active mandates remain because they may become authoritative without another transaction. The
contract never evicts a still-live or scheduled confirmation: when all 64 slots remain relevant,
confirmed issuance or reactivation fails with `IndexFull` until one is closed or expires. For upgrade
compatibility, `is_authorised` then falls back to the older pair and representative-wide indexes,
within a shared 128-record strict scan budget. Every scan continues past scheduled, self-asserted, or
inactive records, so they cannot mask another indexed live confirmation. A standalone mandate with
relationship id `0` is allowed.

General party/history indexes remain capped at their earliest 512 ids and events remain the
authoritative discovery feed at larger scale. Production still needs an indexer and an operational
policy well before any exact pair approaches the confirmed capacity bound.

## Storage TTL and keepalive

Soroban persistent entries can archive independently of their business expiry. Contract reads call
TTL-extension helpers, but a simulated read is discarded and therefore **does not persist an
extension**. Page traffic does not pay registry rent.

`keepalive(entity_cursor, claim_cursor, limit)` requests extensions for bounded slices. It is
permissionless at the registry layer but must be invoked in a signed, submitted transaction whose
source account pays the network fee. `limit` is `1..50`. Repeatedly submit using the returned
`next_entity` and `next_claim` cursors until `done` is true. The included runner is:

```bash
cd SC
STELLAR_CONTRACT_ID=<vnext-contract-id> \
STELLAR_KEEPER_IDENTITY=<funded-cli-identity> \
STELLAR_NETWORK=testnet \
./scripts/keepalive.sh
```

Run it on a monitored schedule well before the extension threshold, persist/retry failed cursors,
and alert on failures. Already archived entries require a separate restore-footprint transaction;
keepalive is preventative, not a restore operation.

## Governance

- `propose_admin(new_admin)` / `accept_admin()` is a two-step handover for future issuance and global
  configuration; existing `Entity.issuer` values and their authority do not change.
- `set_arbiter(arbiter)` changes the complaint-outcome role.
- `set_paused(paused)` blocks new proposals/acceptance/claims while takedown paths remain available.
- `upgrade(new_wasm_hash)` changes code at the same contract address and is admin-authenticated.

Every material action emits an event, including proposal/cancellation, registration, metadata update,
controller rotation, status changes, relationship end, publication consent, strikes, governance,
pause, and upgrade.

## Deploy or upgrade vNext

For a clean deployment:

```bash
stellar network use testnet
stellar keys generate dc-admin --network testnet --fund
stellar keys generate dc-arbiter --network testnet --fund
cd SC
stellar contract build --optimize
stellar contract deploy \
  --wasm target/wasm32v1-none/release/doublecheck_registry.wasm \
  --source dc-admin --network testnet -- \
  --admin <admin-address> --arbiter <arbiter-address>
```

For the existing address, install the new Wasm and invoke `upgrade(new_wasm_hash)` through the
current admin. Rehearse against a copy of representative state first: vNext adds new persistent keys
and changes the public interface. Validate every legacy entity/claim and all security invariants
after the upgrade.

In either path, generate the TypeScript binding **from the deployed vNext specification after the
transaction is final**, update the frontend contract id if it changed, rebuild, and run a smoke test.
Do not generate from source and assume the live contract matches. See
[`FE/README.md`](../FE/README.md) and [`docs/deployment.md`](../docs/deployment.md).

The public testnet address runs vNext with 5 preserved demonstration entities and 8 claims. It proves
deployment and ABI compatibility only, not production verification readiness.
