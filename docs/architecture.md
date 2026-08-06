# Architecture

How the DoubleCheck registry is built, what it stores, and why the boundaries fall where they do.

For building and deploying the contract see [`SC/README.md`](../SC/README.md); for the explorer see
[`FE/README.md`](../FE/README.md); for hosting and operations see [`deployment.md`](deployment.md).

## Contents

- [The problem](#the-problem)
- [Platform and toolchain](#platform-and-toolchain)
- [Data model](#data-model)
- [Trust model](#trust-model)
- [Confirmation tiers](#confirmation-tiers)
- [The on-chain boundary](#the-on-chain-boundary)
- [Personal data](#personal-data)
- [Lifecycle and derived status](#lifecycle-and-derived-status)
- [Storage, rent and archival](#storage-rent-and-archival)
- [Implementing on Soroban](#implementing-on-soroban)
- [Scope](#scope)
- [Limitations](#limitations)

---

## The problem

A recruiter makes contact about a role at a company. Three questions follow, and none of them can
currently be answered quickly:

1. Is this person who they claim to be?
2. Do they actually work for the organisation they name?
3. Are they authorised to be recruiting for that role, right now?

Identity alone answers only the first. The third is the one that matters, and it is the one that
changes over time — a recruiter who legitimately represented a company last quarter may not today.
An answer that was true when it was written and is never revisited is worth very little.

The registry therefore records three things rather than one: **who was verified**, **who is
affiliated with whom**, and **who is authorised to act on whose behalf, until when**. All three are
revocable within a single transaction, and all three expire without anyone having to act.

### Why this is on a ledger

A database could hold the same records. What it could not do is let a reader verify them without
trusting the party serving the page.

Every claim in the registry carries the key that signed it. A reader can therefore distinguish a
mandate the hiring company confirmed with its own key from one the recruiter asserted about
themselves — and can do so even if the website presenting it is compromised, seized, or lying. That
property is the entire justification for the ledger. Remove it and a database is the better choice.

---

## Platform and toolchain

| Component | Version | Notes |
|---|---|---|
| Language | Rust 1.96 | `soroban-sdk` 27 requires ≥ 1.91 |
| SDK | `soroban-sdk` 27.0.5 | |
| Build target | `wasm32v1-none` | supersedes `wasm32-unknown-unknown` for Soroban |
| CLI | `stellar-cli` 27.x | the earlier `soroban` binary is retired |
| Network | Stellar, protocol 27 | |

### Network limits that shaped the design

Read from mainnet ledger configuration rather than quoted from documentation, since two of them
constrain the data model directly:

| Setting | Mainnet value | Consequence |
|---|---|---|
| `contract_max_size_bytes` | 131,072 (128 KB) | the contract compiles to 38 KB |
| `contract_data_entry_size_bytes` | 65,536 | bounds the claim-id index vectors |
| `contract_data_key_size_bytes` | 250 | handles are capped at 64 characters |
| `min_persistent_ttl` | 2,073,600 ledgers (~120 days) | the floor every new entry receives |
| `max_entry_ttl` | 3,110,400 ledgers (~180 days) | **no entry can be made to outlive 180 days** |

The last row is load-bearing. Soroban charges rent and archives entries nobody extends, so a badge
with a twelve-month expiry cannot simply be written and forgotten — see
[Storage, rent and archival](#storage-rent-and-archival).

---

## Data model

Three record types, defined in [`types.rs`](../SC/contracts/verified-recruiter-badge/src/types.rs).

### Entity

An organisation or a natural person that the issuer has vetted. Entities are identified by a
sequential `u64` and by a unique URL-safe `handle`.

| Field | Purpose |
|---|---|
| `kind` | `Organisation` or `Person` |
| `controller` | the address this badge is bound to; the key that acts for the entity |
| `handle` | unique public slug, the verifier's URL segment |
| `display_name`, `domain`, `jurisdiction` | public descriptive fields — see [Personal data](#personal-data) |
| `metadata_hash`, `metadata_uri` | SHA-256 of the off-chain credential, and where it is served |
| `issuer` | the address that performed the verification |
| `status`, `verified_at`, `expires_at` | badge lifecycle |
| `strikes` | count of upheld complaints |

Badges are **soulbound**: `controller` is fixed at registration and there is no transfer function.
`rotate_controller` exists solely for key recovery and is admin-gated, so verified status cannot be
sold or transferred to a different subject.

### Relationship

An attestation that a person is, or was, affiliated with an organisation: type
(`CurrentEmployee`, `PastContractor`, `AgencyRepresentative`, …), role, department, start and end
dates, and a `public_display` flag the subject controls.

Relationships are never deleted. A closed relationship keeps its end date, because "left in March" is
a materially different answer from "no record found" — and a stale affiliation is a more common
misrepresentation than an invented one.

### Mandate

An authorisation for a representative to act on an organisation's behalf: type, scope, territory,
and a validity window. Mandates are always time-bound; `valid_until` cannot be zero.

A mandate may optionally reference the relationship it rests on, in which case the contract enforces
that the relationship is between the same two parties. A representative may be a person or another
organisation, which is how an agency holding a mandate from a client company is represented.

Relationships and mandates share a single claim-id sequence, so one identifier is enough to resolve
any claim.

---

## Trust model

Three roles, all addresses, all configurable after deployment.

| Role | Capabilities |
|---|---|
| **admin** | registers, renews, suspends and revokes entities; rotates controllers; upgrades the contract |
| **entity controller** | attests its own organisation's relationships and mandates; withdraws claims about itself |
| **arbiter** | records the outcome of the off-chain complaint process — disputes, suspensions, strikes |

Constraints worth stating explicitly:

- **The admin cannot forge a company confirmation.** A claim the admin writes is recorded as
  `IssuerConfirmed`, never `CounterpartyConfirmed`. The distinction is visible to every reader.
- **`Revoked` is terminal.** A revoked badge cannot be reinstated, because a reader who saw
  "revoked" must never be contradicted later. Re-admitting a subject means issuing a new entity.
- **A subject can always withdraw a claim about themselves**, and only the subject or the admin can
  change a relationship's `public_display`. An organisation cannot pin a public statement about a
  person against their will.
- **Admin handover is two-step** (`propose_admin` / `accept_admin`), so a mistyped address cannot
  lock the registry.
- **Pausing does not block revocation.** The emergency stop blocks new registrations and new claims;
  status changes keep working, because pausing must never prevent taking a bad badge down.

---

## Confirmation tiers

Every claim records which key signed it, and the contract classifies the signer rather than letting
the caller assert it:

| Signer | Recorded as | What a reader can conclude |
|---|---|---|
| the organisation's controller | `CounterpartyConfirmed` | the organisation itself stated this |
| the subject's own controller | `SelfAsserted` | only the subject states this; their badge is the collateral |
| the admin | `IssuerConfirmed` | the issuer verified it out of band — DNS record, email-domain challenge, light KYB |

This is what allows the registry to serve both directions of trust without picking one. A recruiter
can list where they work without waiting for their employer to hold a key, and a reader can still
see that nobody but the recruiter said so. `IssuerConfirmed` is how an organisation with no wallet,
and no interest in acquiring one, is represented — which will be most organisations for a long time.

---

## The on-chain boundary

The governing principle: **the ledger stores decisions, not deliberations.**

The test for any given field: *if the operator's website were seized, replaced, or lying, would a
reader still need this to protect themselves?* If yes, it belongs on-chain. If no, it is a database
row.

### On-chain

| | Why |
|---|---|
| Who was verified, by whom, when, until when | the claim being made |
| Status, and every change to it | a revocation nobody can quietly reverse |
| Which key signed each claim | the property that distinguishes this from a database |
| Mandate scope and validity window | the authorisation itself |
| A hash of the off-chain credential | proves a fetched profile is the one the issuer signed |

### Off-chain

| | Why |
|---|---|
| Complaint reports and the review queue | an unreviewed accusation is not a fact; publishing raw reports immutably is defamation exposure with no corresponding benefit. `add_strike` and `set_entity_status` record the *outcome* |
| Verification evidence — ID documents, liveness checks, KYB reports, references | never appropriate for a public ledger |
| Billing and subscriptions | no on-chain behaviour depends on payment state |
| Search, listings, activity feeds | cheap and flexible off-chain, expensive and rigid on-chain |
| Names, headlines, logos | see [Personal data](#personal-data) |

---

## Personal data

Stellar ledger entries are public and effectively permanent. The GDPR grants data subjects a right to
erasure. These cannot both be satisfied for the same field, so the registry separates them.

**Organisations** store `display_name`, `domain` and `jurisdiction` in cleartext. A registered
company name is not personal data, and this lets organisation pages render entirely from the ledger.

**Natural persons** are registered with `display_name` left empty. On-chain there is then only an
address, a handle, dates and a hash; the name is served from the off-chain credential at
`metadata_uri`. Erasure means deleting that document, after which the on-chain hash is a commitment
to a document that no longer exists — the conventional resolution.

**Free-text claim fields** — `role`, `department`, `scope`, `territory` — are stored on-chain and do
constitute employment data about an identified person. They are capped at 128 characters and are
paired with `detail_hash` and `public_display`. Moving them off-chain behind `detail_hash` requires
no change to the contract's shape, should legal review call for it.

The contract does not enforce any of this. It is a policy the issuer applies at registration, and it
is far cheaper to settle before the first cohort than after.

---

## Lifecycle and derived status

Expiry is **derived at read time, never stored.** A badge past `expires_at` reads as `Expired`; a
mandate past `valid_until` reads as `Expired`; a relationship past its end date does the same. No
keeper job, no scheduled transaction, and no window in which a lapsed badge still reads as valid
because nobody ran the sweep.

The same rule is reimplemented in the explorer so a page render does not cost an extra round trip per
record. The contract remains authoritative; the duplication is noted in
[`FE/README.md`](../FE/README.md).

Revocation is immediate and propagates without enumeration. `is_authorised(org, representative)`
checks the mandate *and* both parties' badges, so revoking an organisation invalidates every mandate
it issued in one transaction, rather than requiring each to be cancelled individually.

---

## Storage, rent and archival

Soroban charges rent, and `max_entry_ttl` is roughly 180 days — shorter than a twelve-month badge.

The contract's approach: **every read extends the entries it touched.** A badge anyone is actively
checking stays live, paid for by the reads that check it. Attention pays for storage.

The consequence to plan for: an entry nobody reads for ~120 days is archived and must be restored
with a `RestoreFootprint` operation before the next read succeeds. Archival is recoverable, not
destructive. Two viable policies:

- **Accept it** — a badge nobody has checked in four months is arguably dormant. The verifier needs a
  restore path in its UI.
- **Sweep it** — a scheduled job calling `check()` across all handles keeps the registry warm for a
  few cents. Appropriate at small scale.

The on-chain index vectors (`relationships_about`, `mandates_held_by`, and so on) let the explorer
work with no backend at all and are capped at 512 claim ids per entity. Beyond that, the contract
emits an event on every state change — `EntityRegistered`, `EntityStatusSet`,
`RelationshipAttested`, `MandateIssued`, `ClaimStatusSet`, `StrikeAdded`, `ControllerRotated` —
which is what an indexer should consume.

---

## Implementing on Soroban

Three differences from the EVM equivalents of this design are worth recording, because they change
the implementation rather than merely the syntax.

**Soulboundness is enforced by absence, not by a standard.** Soroban has no NFT standard to make
non-transferable, so there is no `ERC-5484` analogue to inherit. An entity is bound to its
`controller` at registration and the contract exposes no transfer function at all. The property
holds more robustly than the EVM version: there is no inherited transfer path that must be
remembered and overridden.

**There is no attestation service to build on.** On EVM chains the Ethereum Attestation Service would
supply the mandate layer. Soroban has no equivalent, so this contract *is* the attestation service —
which is why `Mandate` is a first-class record with its own validity semantics rather than a schema
registered elsewhere. Marginally more code, one fewer external dependency, and the semantics are
defined here rather than inherited.

**Passkey smart wallets remove the adoption barrier.** The design depends on a subject holding a key,
and requiring a seed phrase would end adoption outside crypto-native audiences. Stellar's Protocol 21
secp256r1 support means a controller key can be a WebAuthn credential in a device's secure enclave —
Face ID or a fingerprint, no seed phrase. Readers need no key at all, since every read is a
simulation.

---

## Scope

Implemented: the trust loop end to end — register, attest, authorise, check, revoke, expire — with a
full test suite.

Deliberately not implemented, with the reasoning:

| | Status | Why |
|---|---|---|
| Cash staking and slashing | replaced by `strikes` | reputation slashing needs no custody, refunds, or token contract, and demand is unproven |
| W3C Verifiable Credential issuance | `metadata_hash` + `metadata_uri` only | those two fields are the anchor a VC needs; adding real credentials later requires no contract change |
| Badge tiers | folded into `confirmation` | tiers reduced to billing plus a field that already exists; a `tier` enum is an additive change |
| Browser extension, KYB integrations, dashboards | out of scope | consumers of this contract, not part of it |
| Fee collection, batch operations, on-chain search | out of scope | additive; none requires reshaping what exists |

---

## Limitations

**Not audited.** A security review of the authorisation paths, and a rehearsal of the upgrade path on
testnet, should both precede any mainnet deployment.

**The explorer does not scale.** It reconstructs the registry by walking ids `1..entity_count` and
`1..claim_count` on every page load, which is honest at MVP size and wrong beyond a few hundred
records. The contract's event stream exists so an indexer can replace this; nothing above
`FE/src/data/` would change.

**Status history is not stored.** Every change emits an event, but the contract keeps no timeline, so
the explorer shows only what a record itself proves. An indexer would resolve this.

**Index vectors are capped** at 512 claim ids per entity. Past that, `IndexFull` is returned and
callers must read events instead.

**Free RPC is a single point of failure.** Each page load makes roughly
`entity_count + 2 × claim_count` simulated reads against a public endpoint with no uptime guarantee.
See [`deployment.md`](deployment.md).
