# Architecture

This document describes the vNext source and public testnet interface. The existing testnet address
was upgraded in place on 10 August 2026 and the checked-in binding was regenerated from its live
specification; see [`deployment.md`](deployment.md#current-environments).

## System boundary

DoubleCheck separates public, durable trust decisions from private operational evidence.

```text
applicant ──HTTPS──> /apply ──> /api/intake ──> private review webhook/queue
reporter  ──HTTPS──> report modal ─────────────> private review webhook/queue
                                                   │
                                                   │ manual KYC/KYB and case decision
                                                   ▼
issuer/controller wallet ──signed transaction──> Soroban registry
reader ──wallet-free simulation──> Stellar RPC ──> public verifier/live iframe
keeper ──signed submitted transactions──────────> TTL extension
```

The browser performs public contract reads directly. The Vercel function is used only for private
application and report intake; it validates a strict JSON shape and forwards accepted payloads to a
server-only HTTPS webhook. It does not write to the registry. A `202` and reference are returned
only after the webhook accepts the request; missing configuration returns `503` and downstream
failure returns `502`.

There is no production indexer, credential issuer, KYC/KYB integration, or automated case system in
the repository yet.

## Why use a ledger

A database could render the same screen, but its operator could rewrite who signed a claim or hide a
revocation. Soroban lets a reader independently establish the controller that authenticated a
statement and its current status. The ledger is justified only for that tamper-evident trust layer;
deliberation and sensitive evidence remain off-chain.

This design maps the original EVM plan to Stellar as follows:

| EVM concept | Stellar/Soroban design |
|---|---|
| Non-transferable NFT badge | `Entity` bound to a controller address; no transfer entry point |
| Attestation protocol/schema | First-class `Relationship` and `Mandate` contract records |
| ERC ownership/approval | Soroban address auth and explicit multi-party consent flows |
| Events/indexer | Soroban contract events, with a future external indexer/API |
| Transaction relayer | Future passkey smart-account and fee-sponsorship layer; not implemented |

## Data model

### PendingEntity

The issuer creates a `PendingEntity` only after off-chain review. It commits:

- kind, controller, handle, and allowed public organisation descriptors;
- issuer, credential hash/URI, and exact terms hash; and
- proposal time, acceptance deadline, and badge expiry.

The proposal reserves its handle and controller but has no verified status. `accept_by` is at most 30
days after proposal. The intended controller must authenticate `accept_entity`; only then is an
active `Entity` created. Issuer or controller may cancel at any time, and any authenticated account
may release an expired proposal.

The legacy one-step `register_entity` remains for coordinated multi-auth tooling and requires both
admin and controller authentication. It is not an issuer-only path.

### Entity

An `Entity` is a vetted organisation or natural person with a unique sequential id and URL-safe
handle.

| Field group | Meaning |
|---|---|
| `kind`, `controller`, `handle` | subject type, controlling address, stable public slug |
| `display_name`, `domain`, `jurisdiction` | public organisation descriptors; forced empty for people |
| `metadata_hash`, `metadata_uri` | non-zero SHA-256 anchor and bounded HTTPS/IPFS location of the issuer-vetted credential |
| `issuer`, `verified_at`, `expires_at` | decision provenance and bounded validity |
| `status`, `strikes` | current stored lifecycle and upheld-outcome count |

All badge expiries are non-zero, future-dated, and at most 400 days from issuance/renewal. Renewal is
a stored-issuer re-verification decision, updates `verified_at`, and can clear suspension. `Revoked`
is terminal.

The metadata anchor is issuer-controlled. Only that badge's immutable stored issuer may replace its
hash/URI; a subject or later global admin cannot substitute a different credential while retaining
the original issuer's trust display.
Subject-authored profile material must be separate and clearly unverified.

Controller recovery is a three-party flow: the current controller proposes an exact destination,
the stored issuer approves it after recovery/re-verification, and the destination then accepts.
Replacing the proposal invalidates any prior approval. The compatibility atomic path likewise
requires stored-issuer, current-controller, and destination authentication, so neither holder nor
issuer can unilaterally move a badge.

### Relationship

A `Relationship` states that a natural person is or was affiliated with an organisation. It records
type, a required role, optional department, dates, confirmation, signer, status, optional detail
hash, and publication choice. A relationship start cannot be future-dated.

Company-attested relationships are initially unlisted. The subject or admin controls
`public_display`; a subject can publish its own self-assertion. The public frontend omits unpublished
relationships from snapshots, search, feeds, and detail fetches.

### Mandate

A `Mandate` states that a person or another organisation may represent a different organisation for
a type, required scope, optional territory, and fixed time window. Its duration is at most 366 days.
It can stand alone (`relationship = 0`) or reference a relationship between exactly the same
parties.

Relationships and mandates share one claim-id sequence. General per-entity indexes make a small
registry readable without a backend and retain at most 512 ids; later records still exist and emit
events even when browser history discovery is full. Strict authorisation uses a separate bounded
organisation/representative index containing at most 64 relevant company- or issuer-confirmed
mandates. It prunes closed or expired entries and rejects a new relevant confirmation if every slot
is still live or scheduled, so capacity cannot silently turn a valid authorisation into a false
negative. Strict discovery has a shared 128-record scan budget across that index and legacy
fallbacks. Production scale still requires an event indexer and a policy well before a pair
approaches the contract limit.

## Trust and consent model

### Roles

| Role | Capabilities and limits |
|---|---|
| global admin | propose new badges, record issuer-confirmed claims, manage global roles/pause, and upgrade; a handover affects future issuance but does not inherit old badges |
| stored badge issuer | renew/revoke its badge, replace its vetted metadata anchor, suspend it, approve recovery, and record strikes; authority is fixed when the badge is accepted |
| entity controller | accept its badge, attest claims in its role, withdraw claims about itself, propose its own controller migration |
| arbiter | record complaint outcomes, strikes, disputes, and suspensions; cannot revoke or strengthen claims |
| keeper | no registry role; submits and pays for bounded `keepalive` calls |

Admin transfer is two-step. Pause prevents new onboarding/claims while status/takedown paths remain
available.

### Confirmation tiers

The contract derives confirmation from the authenticated signer:

| Signer | Confirmation | Authorisation weight |
|---|---|---|
| subject/representative controller | `SelfAsserted` | visible evidence only |
| organisation controller | `CounterpartyConfirmed` | accepted by strict mandate verification |
| admin/issuer | `IssuerConfirmed` | accepted by strict mandate verification |

An issuer-confirmed claim is distinguishable from a company-controller claim. The admin cannot make
its own statement appear counterparty-confirmed.

### Strict mandate authorisation

`is_authorised(org, representative)` returns true only when:

1. both entities exist, are active, and have not expired;
2. a mandate for exactly that pair is stored as active and is within its validity window;
3. its confirmation is counterparty- or issuer-confirmed, never self-asserted; and
4. a linked relationship, if present, exists, matches the same parties, has subject/admin
   publication consent, and is effectively active.

The contract scans the pair mandate index newest-to-oldest and skips ineligible records, so a newer
scheduled, withdrawn, expired, or self-asserted record does not mask an older live confirmation. A
representative-wide fallback preserves discovery of legacy pre-upgrade mandates.

The pair verifier in the frontend also displays the badge, date, confirmation, and relationship
dependencies and requires the deployed contract's direct `is_authorised` result before showing its
strongest verdict.

### Status authority and terminal states

- `Revoked` is terminal and stored-issuer-only.
- An arbiter can lift only a suspension that arbiter placed, not an issuer/admin suspension.
- A subject may withdraw a claim about itself but cannot activate, confirm, or complete it.
- An arbiter may dispute, suspend, or withdraw, but cannot activate or complete.
- An organisation cannot clear an arbiter-created dispute/suspension itself.
- Relationship `Ended`/`Withdrawn` and mandate `Completed`/`Withdrawn` are terminal. A renewed or
  changed assertion is a new claim.
- `Expired` is derived from timestamps and is never written as a stored status.

## Privacy boundary

The ledger stores decisions, not deliberations.

### Public on-chain data

- controllers, handles, issuer, timestamps, status, strikes, and event history;
- organisation descriptors;
- credential and detail hashes plus credential URI;
- relationship type, role, department, dates, signer, confirmation, and publication flag; and
- mandate type, scope, territory, validity, signer, and confirmation.

For a person, the contract enforces empty `display_name`, `domain`, and `jurisdiction`. The name, ID
documents, liveness/KYB evidence, contact details, applications, and raw complaints belong off-chain
where retention and erasure controls are possible.

This is a boundary, not a claim of GDPR completion. Handles, addresses, timestamps, hashes, and the
free-text `role`, `department`, `scope`, and `territory` can identify a person and remain publicly
durable. A legal basis, minimisation policy, retention schedule, data-subject process, and a decision
on moving claim text behind encrypted/off-chain disclosures are still required before production.

The frontend credential panel fetches a user-requested public HTTPS document of at most 512 KiB and
compares its SHA-256 hash (raw bytes or canonical JSON) to the on-chain anchor. This checks integrity
only. It does not validate a W3C VC proof suite, issuer signature, revocation list, or selective
disclosure. Fetch is manual because it reveals the reader's IP address to the credential host.

### Private off-chain data

- application and KYC/KYB evidence;
- contact details and controller onboarding communication;
- complaint allegations and attachments;
- review notes, policy reasoning, appeals, billing, and internal access logs.

The intake endpoint is merely transport into a private webhook. It caps requests at 16 KiB, rejects
unknown fields and invalid values, applies a honeypot, and creates references only on successful
delivery. It is not a review database or workflow, and no complaint is treated as fact on-chain until
an authorised outcome transaction is submitted.

## New-user onboarding and private case lifecycle

The intended operating flow is longer than the public form:

1. `Received` — create a private case from `/apply`, reserve no on-chain trust, and return only an
   intake reference.
2. `Triage` — deduplicate the applicant, select the person/agency/company path, and request the
   minimum evidence needed for that risk tier.
3. `Under review` — check identity/liveness, professional history, work email, references, and, for
   organisations, legal existence plus domain/signatory authority. Store provider references and
   decisions rather than raw identity documents wherever possible.
4. `Approved` or `rejected` — record reviewer, reason code, assurance level, policy/terms versions,
   audit timestamps, retention/deletion dates, and any required second approval. Rejection creates
   no badge.
5. `Proposed` — issue the exact off-chain credential, anchor its canonical hash and terms hash in a
   pending Soroban record, and notify the intended controller. This is still not a verified badge.
6. `Accepted` — the controller authenticates before the deadline; only this action activates the
   public badge. Add affiliations and mandates as separate, attributable records afterward.
7. `Monitored` — notify before expiry (for example 60/30/7 days), reverify before renewal, and route
   complaints through private triage, response, decision, correction, and appeal states.

Agency seats must remain separate person badges: an organisation verifies its authorised operator,
invites individual recruiters, and signs affiliations or mandates from an organisation-controlled
key. A company-confirmed mandate requires the company controller; a domain/email/KYB check performed
only by DoubleCheck is labelled issuer-confirmed, never company-confirmed.

The repository currently implements the public application transport and contract consent model,
not this durable case store, reviewer console, evidence integrations, notifications, billing, or
appeals operation. Application payloads and complaint allegations must never be copied into Soroban
free text or events.

## Lifecycle and expiry

Business expiry is evaluated using the ledger timestamp. No scheduled transaction is required for a
badge, relationship, or mandate to stop verifying when its stated window closes. Revoking an entity
also makes its outstanding mandates fail strict authorisation without enumerating every mandate.

Storage archival is separate. Soroban contract data has ledger TTL even if business validity is
longer. The contract requests extensions when storage helpers are executed, but an RPC simulation
does not commit those changes. Wallet-free verifier traffic therefore does **not** keep records alive.

The permissionless `keepalive` entry point touches bounded slices of entities and claims (`1..50`
attempts for each category per call) and returns resumable cursors. It must be signed and submitted;
the transaction source pays the fee. Operations must schedule calls until `done`, retry and monitor
them, and separately restore any entries that already archived. See
[`deployment.md`](deployment.md#ttl-and-archival-operations).

## Frontend surfaces

- public explorer, handle/entity/claim pages, search, and status-aware banners;
- direct organisation/representative mandate verifier at `/verify`;
- live iframe at `/badge/<handle>` plus QR and neutral link/embed carriers;
- manual public credential hash comparison;
- role-aware application at `/apply` and private report intake;
- an expert/testnet Freighter holder dashboard for relationship, mandate, subject publication, and
  withdrawal writes.

The holder dashboard requires wallet/network checks, exact transaction review, simulation, signing,
submission, and final-ledger confirmation; a simulation result alone is not success. Issuer and
arbiter consoles, fee sponsorship, and passkey accounts remain future work.

The current explorer reconstructs the registry by walking counters and fetching records. It refreshes
periodically and on visibility changes, but this approach is unsuitable beyond a small demo. Events
are the source for a future indexed API and status history.

## Deployment compatibility

Repository source, public testnet Wasm, and generated TypeScript binding now share the vNext
interface. The in-place upgrade preserved 5 demonstration entities and 8 claims. Post-upgrade reads
confirmed entity/claim counts, all five entity records, authorities, and new onboarding exports.

Future releases must repeat the same discipline: build/test the exact Wasm, rehearse compatibility,
wait for finality, regenerate bindings from the live contract, rebuild the frontend, and run
invariant/smoke checks. Testnet fixtures remain demonstrations, not proof of operational verification.

## Remaining limitations

- no independent production audit or formal verification;
- no complete KYC/KYB provider, review queue, evidence vault, policy, or appeals operation;
- no W3C proof-suite verification, selective-disclosure cryptography, or issuer key discovery;
- no indexer/API, scalable search, browser extension, or status-history service;
- no production passkey smart accounts, recovery design, or fee sponsorship;
- no complete issuer/controller write dashboard;
- public on-chain free text and the 512-entry per-entity/pair index visibility limit require resolution;
- public RPC availability and scheduled TTL/restore operations need production ownership.

See [`roadmap.md`](roadmap.md) for sequencing and [`SECURITY.md`](../SECURITY.md) for the security
boundary.
