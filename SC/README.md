# Verified Recruiter Badge — Soroban contract

A public registry of vetted recruiters, the organisations they work for, and the mandates those
organisations have given them. Anyone can check a badge with no wallet, no login and no crypto
knowledge — one read call answers "is this counterparty real, and are they allowed to be
approaching me?"

Written in Rust for [Soroban](https://stellar.org/soroban), Stellar's smart-contract platform.

**Scope and design rationale: [`docs/design-report.md`](../docs/design-report.md) at the repo root.**
Read that first — it covers what stays off-chain, the personal-data decision, and where Stellar
differs from the chain the original plan named.

## Status

MVP. Implements the trust loop end to end, 28 tests passing, builds to a 38 KB Wasm (the mainnet
limit is 128 KB), **deployed and exercised on testnet** — see below. Not audited.

## Layout

```
contracts/verified-recruiter-badge/src/
  lib.rs        contract entry points and authorisation rules
  types.rs      on-chain data model — Entity, Relationship, Mandate, Check
  storage.rs    storage access and TTL/rent bookkeeping
  events.rs     the event feed an off-chain indexer should follow
  test.rs       test suite
```

## Build and test

```bash
rustup target add wasm32v1-none    # already installed here
cargo test                          # 28 tests
cargo clippy --all-targets
cargo build --target wasm32v1-none --release
```

## Live on testnet

Deployed and exercised end to end on 6 August 2026.

| | |
|---|---|
| Contract | `CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP` |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP) · [Stellar Lab](https://lab.stellar.org/r/testnet/contract/CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP) |
| Wasm hash | `2dd41aa8036406cb0d868a02bd354448dc183b2d17a169401464e3e4667cb542` |
| admin | `GCHCG2376NU6L7ZUTXCWC6A7D4PZMYHHODB7RJM6QRC6FWB5V5H72GQP` |
| arbiter | `GASB4EXRHAYHMJ2TXKVBU43OVBFX52BA6VGP77VFTEYPLW375724M72V` |

Seeded with 5 entities and 8 claims, chosen to exercise every path the UI has to render:

| | |
|---|---|
| `1` Acme Robotics GmbH · `2` a recruiter · `3` Beacon Talent Partners (agency) · `4`, `5` recruiters | entities |
| `1` company-confirmed relationship · `2` mandate, since withdrawn · `3` self-asserted relationship | claims 1–3 |
| `4` current employee · `5` past contractor, now reading as expired · `6` agency mandate, company to agency · `7` recruitment mandate resting on `4` · `8` self-asserted advisory role | claims 4–8 |

Check any of it with no key of your own — reads are simulated, so nothing is signed or charged:

```bash
export C=CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP
stellar contract invoke --id $C --source <any-funded-key> --network testnet -- \
  check --handle '"mara-lindqvist"'
```

## Deploy

Install the CLI (the old `soroban` binary is retired — it is `stellar` now):

```bash
brew install stellar-cli          # or: cargo install --locked stellar-cli
stellar network use testnet
```

Create the two role keys. `admin` issues and revokes badges; `arbiter` records the outcome of the
off-chain complaint queue. They can be the same key to start, and split later with `set_arbiter`.

```bash
stellar keys generate jobited-admin   --network testnet --fund
stellar keys generate jobited-arbiter --network testnet --fund
```

Build and deploy. `--optimize` runs `wasm-opt` (`stellar contract optimize` still works but is
deprecated). The CLI build already strips more than a plain `cargo build --release`: 38 KB against
the 128 KB mainnet ceiling.

```bash
stellar contract build --optimize

stellar contract deploy \
  --wasm target/wasm32v1-none/release/verified_recruiter_badge.optimized.wasm \
  --source jobited-admin --network testnet \
  -- \
  --admin   "$(stellar keys address jobited-admin)" \
  --arbiter "$(stellar keys address jobited-arbiter)"
```

Note the contract id it prints. Mainnet is the same commands with `--network mainnet` and funded
keys.

## Walking through the core flow

Two more keys, standing in for the company and the recruiter. In production these are the passkey
smart wallets described in §6 of the [design report](../docs/design-report.md), not CLI keypairs.

```bash
stellar keys generate jobited-acme --network testnet --fund
stellar keys generate jobited-mara --network testnet --fund
export C=<the contract id printed above>
export ZERO=0000000000000000000000000000000000000000000000000000000000000000
```

Two CLI quirks worth knowing before the first call, because the error messages are not obvious:
**`String` arguments need their JSON quotes** (`--handle '"acme-robotics"'`, empty string is
`'""'`), and **enums are passed as their integer value**, not the variant name — `--kind 0` for
`Organisation`, `1` for `Person`. `stellar contract invoke --id $C -- <fn> --help` prints the
expected form for every argument.

Register a company. `expires_at` is a Unix timestamp — twelve months is the recommended default, so
trust has to be renewed rather than assumed.

```bash
stellar contract invoke --id $C --source jobited-admin --network testnet -- \
  register_entity \
  --kind 0 \
  --controller jobited-acme \
  --handle '"acme-robotics"' \
  --display_name '"Acme Robotics GmbH"' \
  --domain '"acme-robotics.de"' \
  --jurisdiction '"Germany"' \
  --metadata_hash $ZERO \
  --metadata_uri '"https://verify.jobited.com/c/acme-robotics.json"' \
  --expires_at 1817588221
```

Register a recruiter. For natural persons leave `display_name` empty and serve the name from the
off-chain credential — see §5 of the [design report](../docs/design-report.md).

```bash
stellar contract invoke --id $C --source jobited-admin --network testnet -- \
  register_entity \
  --kind 1 --controller jobited-mara --handle '"mara-lindqvist"' \
  --display_name '""' --domain '""' --jurisdiction '""' \
  --metadata_hash $ZERO \
  --metadata_uri '"https://verify.jobited.com/p/mara-lindqvist.json"' \
  --expires_at 1817588221
```

Acme is entity `1`, Mara is entity `2` — entity ids are sequential and start at 1. Claim ids are a
separate sequence, also from 1, shared by relationships and mandates so one id is enough to look any
claim up.

The company attests the affiliation, then authorises her to recruit on its behalf. Because Acme's
own key signs, both claims are recorded as `CounterpartyConfirmed` (`confirmation: 1` in the emitted
event). Had Mara signed them herself they would read `SelfAsserted` (`0`), and the difference is
visible to anyone checking.

```bash
# -> claim id 1
stellar contract invoke --id $C --source jobited-acme --network testnet -- \
  attest_relationship --caller jobited-acme --org 1 --person 2 \
  --rel_type 0 --role '"Senior Technical Recruiter"' --department '"Talent"' \
  --start_date 1783460221 --end_date 0 --public_display true --detail_hash $ZERO

# -> claim id 2, resting on relationship 1
stellar contract invoke --id $C --source jobited-acme --network testnet -- \
  issue_mandate --caller jobited-acme --org 1 --representative 2 --relationship 1 \
  --mandate_type 0 --scope '"Engineering hiring, robotics division"' --territory '"EU"' \
  --valid_from 1786052221 --valid_until 1793828221 --detail_hash $ZERO
```

Now anyone can check. Reads are simulated rather than submitted, so they cost nothing and change
nothing — the CLI still wants a `--source` to simulate against, but any account works and it is
never charged. In the browser this is one `simulateTransaction` RPC call with no wallet at all.

```bash
stellar contract invoke --id $C --source jobited-admin --network testnet -- \
  check --handle '"mara-lindqvist"'

stellar contract invoke --id $C --source jobited-admin --network testnet -- \
  is_authorised --org 1 --representative 2
```

`check` returns the whole verifier page in one call:

```json
{"valid":true,"effective_status":0,"relationships":1,"mandates":1,"checked_at":1786052297,
 "entity":{"id":2,"kind":1,"handle":"mara-lindqvist","display_name":"",
           "controller":"GCINRBLO...X26A","issuer":"GCHCG237...2GQP",
           "metadata_uri":"https://verify.jobited.com/p/mara-lindqvist.json",
           "status":0,"strikes":0,"verified_at":1786052272,"expires_at":1817588221}}
```

And the company can take it away in one transaction (`3` = `Withdrawn`):

```bash
stellar contract invoke --id $C --source jobited-acme --network testnet -- \
  set_mandate_status --caller jobited-acme --id 2 --status 3
```

`is_authorised` goes false immediately, everywhere the badge is embedded. Mandates also expire on
their own at `valid_until`, and badges at `expires_at`, with no transaction and no cron job — expiry
is derived at read time rather than stored.

## Frontend

Generate typed TypeScript bindings from the deployed contract rather than hand-writing a client:

```bash
stellar contract bindings typescript \
  --network testnet --contract-id "$CONTRACT" --output-dir ./packages/registry
```

The [existing explorer](https://github.com/Prosper90/verified) maps onto this almost one-to-one;
see §8 of the [design report](../docs/design-report.md) for the field-by-field mapping.

## Upgrades

`upgrade(new_wasm_hash)` replaces the code while keeping the same contract address, so every badge
link and QR code already in circulation keeps working. Admin-only, and worth rehearsing on testnet
before it is ever needed on mainnet.
