# DoubleCheck registry contract

A Soroban contract holding a public registry of verified organisations and people, the relationships
between them, and the time-bound mandates that authorise someone to act on an organisation's behalf.

Reads are free and require no wallet: the verifier simulates them from the browser, so a person
checking a counterparty needs no account, no key and no prior setup.

Design rationale — the data model, the trust model, and where the on-chain boundary falls — is in
[`docs/architecture.md`](../docs/architecture.md).

## Status

MVP. 28 tests passing, 38 KB Wasm against a 128 KB network limit, deployed to testnet. **Not
audited**; see [Limitations](../docs/architecture.md#limitations).

## Layout

```
contracts/verified-recruiter-badge/src/
  lib.rs        contract entry points and authorisation rules
  types.rs      data model — Entity, Relationship, Mandate, Check
  storage.rs    storage access and TTL/rent bookkeeping
  events.rs     the event stream an indexer consumes
  test.rs       test suite
```

## Build and test

Requires the Rust toolchain and the [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli).

```bash
rustup target add wasm32v1-none
brew install stellar-cli          # or: cargo install --locked stellar-cli

cargo test
cargo clippy --all-targets
stellar contract build --optimize
```

`stellar contract build` strips more aggressively than a plain `cargo build --release` and writes to
`target/wasm32v1-none/release/`.

---

## Interface

### Registry

| Function | Authorised caller | Notes |
|---|---|---|
| `register_entity(kind, controller, handle, display_name, domain, jurisdiction, metadata_hash, metadata_uri, expires_at) -> u64` | admin | returns the new entity id |
| `update_metadata(caller, id, metadata_hash, metadata_uri)` | entity controller or admin | repoints the off-chain credential |
| `renew_entity(id, expires_at)` | admin | also clears a suspension |
| `set_entity_status(caller, id, status)` | admin or arbiter | `Revoked` is terminal |
| `rotate_controller(id, new_controller)` | admin | key recovery only; the sole way a badge moves |
| `add_strike(caller, id) -> u32` | admin or arbiter | records an upheld complaint |

### Claims

| Function | Authorised caller | Notes |
|---|---|---|
| `attest_relationship(caller, org, person, rel_type, role, department, start_date, end_date, public_display, detail_hash) -> u64` | org controller, subject, or admin | signer determines `confirmation` |
| `end_relationship(caller, id, end_date)` | org controller, subject, or admin | closes without deleting |
| `set_relationship_status(caller, id, status)` | see below | |
| `set_public_display(caller, id, public_display)` | subject or admin only | |
| `issue_mandate(caller, org, representative, relationship, mandate_type, scope, territory, valid_from, valid_until, detail_hash) -> u64` | org controller, representative, or admin | `valid_until` may not be zero |
| `set_mandate_status(caller, id, status)` | see below | |

Status transitions: the admin may set any status; the arbiter may set `Disputed`, `Suspended` or
`Withdrawn`; an organisation's controller may set any status on its own claims; a subject may only
set `Withdrawn` on a claim about themselves.

### Reads

All free, all wallet-free, all simulated.

| Function | Returns |
|---|---|
| `check(handle) -> Option<Check>` | the record, its status with expiry applied, and claim counts — a verifier page in one call |
| `check_by_id(id) -> Option<Check>` | the same, for callers that already resolved the handle |
| `is_authorised(org, representative) -> bool` | whether a live mandate exists between the pair *and* both badges are still valid |
| `get_entity(id)`, `get_entity_by_handle(handle)`, `get_entity_by_controller(address)` | `Option<Entity>` |
| `get_relationship(id)`, `get_mandate(id)` | `Option<Relationship>` / `Option<Mandate>` |
| `relationship_status(id)`, `mandate_status(id)` | `Option<ClaimStatus>` with expiry applied |
| `relationships_attested_by(org)`, `relationships_about(person)` | `Vec<u64>` of claim ids |
| `mandates_issued_by(org)`, `mandates_held_by(representative)` | `Vec<u64>` of claim ids |
| `entity_count()`, `claim_count()` | `u64` |
| `admin()`, `arbiter()`, `paused()` | current configuration |

`check` and `is_authorised` carry most of the product. The first renders a verifier page from one
round trip; the second answers "may this person act for that company today" in a single storage read,
and deliberately validates both parties' badges as well as the mandate, so revoking an organisation
invalidates its outstanding mandates without each needing to be cancelled.

### Governance

`propose_admin(new_admin)` / `accept_admin()` — two-step handover, so a mistyped address cannot lock
the registry. `set_arbiter(arbiter)`, `set_paused(paused)`, `upgrade(new_wasm_hash)`.

---

## Deploy

Create the two role keys. The admin issues and revokes badges; the arbiter records outcomes from the
off-chain complaint process. They may be the same address initially and separated later with
`set_arbiter`.

```bash
stellar network use testnet
stellar keys generate dc-admin   --network testnet --fund
stellar keys generate dc-arbiter --network testnet --fund

stellar contract build --optimize
stellar contract deploy \
  --wasm target/wasm32v1-none/release/verified_recruiter_badge.optimized.wasm \
  --source dc-admin --network testnet \
  -- \
  --admin   "$(stellar keys address dc-admin)" \
  --arbiter "$(stellar keys address dc-arbiter)"
```

Mainnet uses the same commands with `--network mainnet` and funded keys. See
[`docs/deployment.md`](../docs/deployment.md) for what to settle first.

## Walkthrough

Two further keys stand in for an organisation and a recruiter. In production these are passkey smart
wallets, not CLI keypairs.

```bash
stellar keys generate acme --network testnet --fund
stellar keys generate mara --network testnet --fund
export C=<contract id>
export ZERO=0000000000000000000000000000000000000000000000000000000000000000
```

Two CLI conventions to note first, because the error messages are opaque: **`String` arguments
require their JSON quotes** (`--handle '"acme-robotics"'`; empty is `'""'`), and **enums are passed
as their integer value** — `--kind 0` for `Organisation`, `1` for `Person`. Running
`stellar contract invoke --id $C -- <function> --help` prints the expected form of every argument.

Register an organisation. `expires_at` is a Unix timestamp; twelve months is the recommended default,
so trust is renewed rather than assumed.

```bash
stellar contract invoke --id $C --source dc-admin --network testnet -- \
  register_entity \
  --kind 0 \
  --controller acme \
  --handle '"acme-robotics"' \
  --display_name '"Acme Robotics GmbH"' \
  --domain '"acme-robotics.de"' \
  --jurisdiction '"Germany"' \
  --metadata_hash $ZERO \
  --metadata_uri '"https://verify.example.com/c/acme-robotics.json"' \
  --expires_at 1817588221
```

Register a recruiter. Natural persons are registered with `display_name` empty — the name is served
from the off-chain credential so it remains erasable. See
[Personal data](../docs/architecture.md#personal-data).

```bash
stellar contract invoke --id $C --source dc-admin --network testnet -- \
  register_entity \
  --kind 1 --controller mara --handle '"mara-lindqvist"' \
  --display_name '""' --domain '""' --jurisdiction '""' \
  --metadata_hash $ZERO \
  --metadata_uri '"https://verify.example.com/p/mara-lindqvist.json"' \
  --expires_at 1817588221
```

Entity ids are sequential from 1, so these are `1` and `2`. Claim ids are a separate sequence, also
from 1, shared between relationships and mandates.

The organisation attests the affiliation, then authorises the recruiter to act on its behalf. Because
the organisation's own key signs, both claims are recorded as `CounterpartyConfirmed`
(`confirmation: 1` in the emitted event). Had the recruiter signed them, they would read
`SelfAsserted` (`0`) — and that difference is visible to anyone checking.

```bash
# -> claim id 1
stellar contract invoke --id $C --source acme --network testnet -- \
  attest_relationship --caller acme --org 1 --person 2 \
  --rel_type 0 --role '"Senior Technical Recruiter"' --department '"Talent"' \
  --start_date 1740000000 --end_date 0 --public_display true --detail_hash $ZERO

# -> claim id 2, resting on relationship 1
stellar contract invoke --id $C --source acme --network testnet -- \
  issue_mandate --caller acme --org 1 --representative 2 --relationship 1 \
  --mandate_type 0 --scope '"Engineering hiring, robotics division"' --territory '"EU"' \
  --valid_from 1750000000 --valid_until 1760000000 --detail_hash $ZERO
```

Anyone can now check. Reads are simulated rather than submitted, so they cost nothing and change
nothing; the CLI still wants a `--source` to simulate against, but any account works and none is
charged. In a browser this is a single `simulateTransaction` call with no wallet involved.

```bash
stellar contract invoke --id $C --source dc-admin --network testnet -- \
  check --handle '"mara-lindqvist"'

stellar contract invoke --id $C --source dc-admin --network testnet -- \
  is_authorised --org 1 --representative 2
```

`check` returns a complete verifier page:

```json
{"valid":true,"effective_status":0,"relationships":1,"mandates":1,"checked_at":1786052297,
 "entity":{"id":2,"kind":1,"handle":"mara-lindqvist","display_name":"",
           "controller":"GCINRBLO...X26A","issuer":"GCHCG237...2GQP",
           "metadata_uri":"https://verify.example.com/p/mara-lindqvist.json",
           "status":0,"strikes":0,"verified_at":1786052272,"expires_at":1817588221}}
```

The organisation withdraws the mandate in one transaction (`3` = `Withdrawn`):

```bash
stellar contract invoke --id $C --source acme --network testnet -- \
  set_mandate_status --caller acme --id 2 --status 3
```

`is_authorised` returns false immediately, everywhere the badge is embedded. Mandates also expire at
`valid_until` and badges at `expires_at` with no transaction and no scheduled job, because expiry is
derived at read time rather than stored.

---

## Live testnet deployment

| | |
|---|---|
| Contract | `CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP` |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP) · [Stellar Lab](https://lab.stellar.org/r/testnet/contract/CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP) |
| Wasm hash | `2dd41aa8036406cb0d868a02bd354448dc183b2d17a169401464e3e4667cb542` |
| admin | `GCHCG2376NU6L7ZUTXCWC6A7D4PZMYHHODB7RJM6QRC6FWB5V5H72GQP` |
| arbiter | `GASB4EXRHAYHMJ2TXKVBU43OVBFX52BA6VGP77VFTEYPLW375724M72V` |

Seeded with 5 entities and 8 claims covering every path the explorer renders: company-confirmed and
self-asserted relationships, an agency-to-agency mandate, a withdrawn mandate, and a relationship
that has aged into `Expired` without any transaction.

## Upgrades

`upgrade(new_wasm_hash)` replaces the code while keeping the contract address, so badge links and QR
codes already in circulation continue to resolve. Admin-only, and worth rehearsing on testnet before
it is needed on mainnet.

Deploying to a *new* address instead requires regenerating the explorer's bindings — see
[`FE/README.md`](../FE/README.md).
