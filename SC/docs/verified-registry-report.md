# Verified Recruiter Badge on Stellar — research and MVP scope

**Status:** MVP contract implemented, 28 tests passing, deployed to Stellar testnet at
`CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP` and exercised end to end.
**Date:** 6 August 2026.
**Inputs:** the project's internal strategy and MVP documents, and the existing frontend at
`github.com/Prosper90/verified`.

---

## 1. Soroban or Rust? Both — they are different things

Soroban is Stellar's smart-contract platform. Rust is the language you write Soroban contracts in.
There is no separate "Soroban language". You write ordinary `no_std` Rust against the `soroban-sdk`
crate and compile to WebAssembly, which is what the network executes.

The stack this repository is pinned to:

| Piece | Value | Note |
|---|---|---|
| Language | Rust 1.96 | `soroban-sdk` 27 requires ≥ 1.91 |
| SDK | `soroban-sdk` 27.0.5 | current release on crates.io |
| Build target | `wasm32v1-none` | replaced `wasm32-unknown-unknown` for Soroban; already installed |
| CLI | `stellar-cli` | `cargo install --locked stellar-cli`; the old `soroban` binary is retired |
| Network | Stellar mainnet, protocol 27 | confirmed live against `mainnet.sorobanrpc.com` |

Some real network limits, queried from mainnet rather than quoted from a blog post, because two of
them shaped the design:

| Setting | Mainnet value | Consequence here |
|---|---|---|
| `contract_max_size_bytes` | 131,072 (128 KB) | our Wasm is 38 KB — under a third of the budget |
| `contract_data_entry_size_bytes` | 65,536 | caps how many claim ids one index entry can hold |
| `contract_data_key_size_bytes` | 250 | handles are capped at 64 chars, comfortably inside |
| `min_persistent_ttl` | 2,073,600 ledgers (120 days) | the TTL floor every new record gets |
| `max_entry_ttl` | 3,110,400 ledgers (180 days) | **no entry can be made to live longer than 180 days** |

That last row is the one people get wrong. Stellar charges rent and archives entries that nobody
extends. A badge with a 12-month expiry **cannot** be stored and forgotten for 12 months — see §7.

---

## 2. Trust direction — redacted from the public copy

This section compared the trust direction assumed by the internal strategy document against the one
the existing frontend implements, and explained why the contract supports both rather than picking
one. It is omitted here because it quotes an internal document.

What survives into the design, and is visible in §3, is the conclusion: **the contract does not
hard-code a direction.** Any claim can be written by either party, and the `confirmation` field
records which key signed it.

## 3. What we need, concretely

You asked for the core to be "add a new entity — company or person — and be able to check them".
That is right, and it is two of the five things below. The other three are what stops the badge
being decorative.

1. **Register an entity.** An organisation or a natural person that a human at Jobited vetted. Who
   they are, who verified them, when, and until when.
2. **Check an entity.** One call, no wallet, no login: is this handle real and still valid right
   now? This is the call behind every QR scan and every badge click.
3. **Attest a relationship.** "This person works here, as this, since then." With an end date, so
   the answer to "did they ever work there" stays available after they leave — a scammer's most
   common lie is a *stale* affiliation, not an invented one.
4. **Issue a mandate.** "This person may recruit for us, for this scope, until this date." This is
   the claim a candidate actually needs, and it is the one the strategy PDF is really about. Identity
   is table stakes; *authorisation* is the product.
5. **Revoke, suspend, expire.** Every one of the above must be reversible within one transaction,
   and must expire on its own without anybody remembering to act.

Everything else in the two PDFs is either off-chain (§4) or later (§6).

### Function list as built

**Registry**
- `register_entity(kind, controller, handle, display_name, domain, jurisdiction, metadata_hash, metadata_uri, expires_at) -> id`
- `update_metadata(caller, id, metadata_hash, metadata_uri)` — subject or admin
- `renew_entity(id, expires_at)` — admin; also clears a suspension
- `set_entity_status(caller, id, status)` — admin or arbiter; `Revoked` is terminal
- `rotate_controller(id, new_controller)` — admin only, for key loss; the only way a badge moves
- `add_strike(caller, id) -> strikes` — records an upheld complaint

**Claims**
- `attest_relationship(caller, org, person, rel_type, role, department, start_date, end_date, public_display, detail_hash) -> id`
- `end_relationship(caller, id, end_date)`
- `set_relationship_status(caller, id, status)`
- `set_public_display(caller, id, public_display)` — subject or admin only
- `issue_mandate(caller, org, representative, relationship, mandate_type, scope, territory, valid_from, valid_until, detail_hash) -> id`
- `set_mandate_status(caller, id, status)`

**Reads — all free, all wallet-free**
- `check(handle) -> Check` / `check_by_id(id)` — the verifier page in one round trip
- `is_authorised(org, representative) -> bool` — "may this person act for that company today?"
- `get_entity`, `get_entity_by_handle`, `get_entity_by_controller`
- `get_relationship`, `get_mandate`, `relationship_status`, `mandate_status`
- `relationships_attested_by`, `relationships_about`, `mandates_issued_by`, `mandates_held_by`
- `entity_count`, `claim_count`

**Governance**
- `propose_admin` / `accept_admin` — two-step, so a typo cannot lock the registry
- `set_arbiter`, `set_paused`, `upgrade`

### Two read functions carry the whole product

`check(handle)` returns the record, its status *with expiry already applied*, and how many claims
hang off it. One RPC call renders a verifier page. No wallet, no indexer, no backend.

`is_authorised(org, representative)` answers the scam question directly and in a single storage
read. It deliberately checks more than the mandate: both parties' badges must still be valid too, so
a mandate from a company that was revoked yesterday stops authorising today, without anybody having
to walk that company's mandates and cancel them one by one.

---

## 4. What stays off-chain, and why

You said flagging can be off-chain. Agreed, and the line generalises: **the chain stores decisions,
not deliberations.**

| Stays off-chain | Why |
|---|---|
| The report/flag button and its review queue | An unreviewed accusation is not a fact. Publishing raw reports on an immutable ledger is a defamation exposure with no upside — the strategy PDF's own risk table says the same. `add_strike` and `set_entity_status` write the *outcome*. |
| Verification evidence — ID scans, liveness, KYB reports, references | Never goes on a public ledger under any circumstances. |
| Billing, subscriptions, Stripe | Nothing on-chain depends on payment state. |
| Search, listing, "latest claims" feeds | Cheap and flexible off-chain; expensive and rigid on-chain. |
| Names, headlines, logos, industry copy | See §5. |

| Goes on-chain | Why |
|---|---|
| Who was verified, by whom, when, until when | The claim being made. |
| Status, and every change to it | This is the actual product — a revocation nobody can quietly reverse. |
| Which key signed each claim | Lets a reader distinguish a company-confirmed mandate from a self-asserted one *without trusting jobited.com*. Remove this and the chain adds nothing over a database. |
| Mandate scope and validity window | The authorisation itself. |
| A hash of the off-chain credential | Proves the profile a reader fetched is the one Jobited signed. |

The test that decides which column something belongs in: *if jobited.com were seized, replaced, or
lying, would a reader still need this to protect themselves?* If yes, on-chain. If no, it is a
database row.

---

## 5. Personal data: the one place you should overrule me, deliberately

You asked to store all the info on-chain. The contract lets you, and I would not do it for natural
persons.

Stellar ledger entries are public and effectively permanent. GDPR gives an EU data subject the right
to erasure. Those cannot both be satisfied, and the strategy PDF's own risk table already commits to
the standard resolution: personal data off-chain, hash and status on-chain.

How this is handled:

- **Organisations** — `display_name`, `domain` and `jurisdiction` are stored in cleartext. A
  registered company name is not personal data, and this means org pages render entirely from chain.
- **People** — the model gives you `display_name` too, but for natural persons the recommendation is
  to **leave it empty** and serve the name from the off-chain credential at `metadata_uri`.
  On-chain there is then only a Stellar address, a handle, dates, and a hash. Erasure means deleting
  the off-chain document; the on-chain hash becomes a commitment to a document that no longer
  exists, which is the accepted pattern.
- Free-text claim fields (`role`, `department`, `scope`, `territory`) are on-chain and *are*
  employment data about an identified person. They are capped at 128 characters and paired with
  `detail_hash` + `public_display`. If counsel objects, move them off-chain behind `detail_hash`
  without touching the contract's shape.

The frontend is already built for this: it renders people by identicon and address, and
`Relationship` already carries `publicDisplay`. Nothing has to change in the UI.

This is a policy switch, not an architectural one. Get counsel to set it before the founding cohort,
not after.

---

## 6. What we cut, and what Stellar changes about the plan

Cut from the MVP, with the reasoning:

| Plan element | Decision | Why |
|---|---|---|
| Cash stake / slashable deposit | **Cut** — replaced by `strikes` | The plan's own open decision #3 calls reputation-slashing "simpler and cleaner to start". A cash stake means custody, refunds, and a token contract before you know anyone will pay. |
| W3C VC issuance, selective disclosure | **Cut** — the contract stores `metadata_hash` + `metadata_uri` | Those two fields are the anchor a VC needs. Adding real VCs later requires no contract change. |
| Browser extension, KYB APIs, dashboards | **Cut** | Consumers of this contract, not part of it. |
| Badge tiers (Recruiter / Agency / Company-Confirmed) | **Cut as a stored field** | Tiers turned out to be billing plus the `confirmation` field, which already exists. Adding a `tier` enum later is a struct extension. |
| Soulbound token semantics | **Kept, differently** | See below. |

### Stellar is not Base, and three of those differences matter

The strategy PDF recommends Base and never evaluates Stellar. Building on Stellar is a reasonable
call, but three of the plan's design choices do not port verbatim:

1. **There is no ERC-5484.** Soroban has no NFT standard to make non-transferable, so soulboundness
   is not inherited from a token standard — it is enforced by *absence*. There is no transfer
   function. An entity is bound to its `controller` address at registration, and the only way it
   ever moves is `rotate_controller`, which is admin-gated and exists for key loss. The property the
   plan wanted ("a scammer cannot buy trust") holds, and arguably holds harder: on Base you must
   remember to override `_beforeTokenTransfer`; here there is nothing to forget.

2. **There is no Ethereum Attestation Service.** On Base, EAS would have been the mandate layer. On
   Stellar there is no equivalent, so *this contract is the attestation service* — which is why
   `Mandate` is a first-class record here rather than an EAS schema. Slightly more code, one less
   external dependency, and the attestation semantics are ours to define rather than EAS's.

3. **Stellar is better at the thing the plan called make-or-break.** The PDF says twice that the
   badge is worthless until someone with no crypto wallet can check it in two seconds, and reaches
   for account abstraction to get there. Stellar shipped passkey smart wallets to mainnet with
   Protocol 21's secp256r1 support: a recruiter's controller key can be a Face ID or fingerprint
   credential in their device's secure enclave, with no seed phrase anywhere. That is the plan's
   hardest adoption requirement, solved by the platform rather than by us.

Against that: Stellar has a smaller EVM-native credential-tooling ecosystem, and the crypto-recruiting
beachhead the plan picks is wallet-rich on EVM chains, not on Stellar. The verifier page is
chain-agnostic and wallet-free, so this costs less than it sounds like — but it is a real trade and
it should be a deliberate one.

---

## 7. Storage, rent, and the thing that will bite you in four months

Soroban charges rent, and `max_entry_ttl` is 180 days. A 12-month badge outlives the maximum
possible lifetime of the ledger entry holding it.

How the contract handles it: **every read extends what it touched.** A badge anyone is actually
checking stays live for free, paid for by the reads. This is the right economics — attention pays
for storage. But it has a consequence to plan for:

> A badge that nobody looks at for 120 days gets archived and must be restored (a
> `RestoreFootprint` operation) before the next read succeeds.

Two options, and you should pick one before the cohort launches:

- **Accept it.** Archival is recoverable, not destructive, and a badge nobody has checked in four
  months is arguably not doing anything. The verifier page needs a "restoring…" path.
- **Sweep it.** A weekly cron that calls `check()` on every handle costs a few cents and keeps the
  whole registry hot. Simple, and probably right at 20–50 entities.

The on-chain index vectors (`relationships_about(person)` and friends) exist so the frontend works
with no backend at all, and are capped at 512 claim ids per entity. Past that, the contract emits an
event for every state change — `EntityRegistered`, `EntityStatusSet`, `RelationshipAttested`,
`MandateIssued`, `ClaimStatusSet`, `StrikeAdded`, `ControllerRotated` — which is what an indexer
should build the explorer from once the registry outgrows the MVP.

---

## 8. Wiring it to the frontend you already have

The mapping is close to one-to-one, which is a good sign for both designs:

| `src/data/types.ts` | Contract |
|---|---|
| `Organisation` | `Entity` with `kind: Organisation` |
| `Person` | `Entity` with `kind: Person` |
| `Relationship` | `Relationship` |
| `Mandate` | `Mandate` |
| `RelationshipType`, `MandateType` | same enums, same variants |
| `RelationshipStatus`, `MandateStatus` | merged into one `ClaimStatus` |
| `id` (pseudo-hash) | `u64` — sequential, so the explorer's "block height" framing still works |
| `issuer: "Jobited"` | `issuer: Address` — the key that actually signed |
| `verified: boolean` | `Check.valid`, derived, expiry-aware |
| `history: StatusEvent[]` | contract events, or the off-chain indexer |

The one thing the frontend has that the contract does not is `blockNumber`. Use the entity `id` for
the same visual purpose, or read the real ledger sequence from the transaction that created it.

Generate typed bindings straight from the deployed contract — no hand-written client:

```bash
stellar contract bindings typescript \
  --network testnet --contract-id <C...> --output-dir ../verified/packages/registry
```

Then replace the bodies of `getOrganisation`, `getPerson`, `getRelationship` and `getMandate` in
`src/data/` with contract calls. The rest of the UI does not need to know.

---

## 9. Open decisions — redacted from the public copy

This section listed the decisions the project owners need to make before the founding cohort:
personal data on-chain for natural persons, admin key custody, arbiter separation, badge expiry,
archival policy, and confirming Stellar over the chain named in the original plan. The technical
substance behind each is in §5, §6 and §7.

## 10. Honest scope statement

This is an MVP and it is not audited. It implements the trust loop — register, attest, authorise,
check, revoke, expire — with a complete test suite, and deliberately implements nothing else.

Not present, by choice: staking and token transfers, W3C Verifiable Credential issuance, batch
operations, pagination beyond the 512-claim index cap, on-chain search, and any kind of fee
collection. Each is additive and none requires reshaping what is here.

Before mainnet: a security review of the authorisation paths, a rehearsal of the upgrade path on
testnet, and a decision on §9.1.
