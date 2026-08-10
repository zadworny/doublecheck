# Security policy

## Status

**DoubleCheck has not received an independent production security audit.** The repository is
pre-production. The public Stellar testnet contract was upgraded to the reviewed vNext candidate on
10 August 2026 and the frontend binding was regenerated from its live specification, but testnet
deployment does not prove safe human verification operations. Do not use testnet records for
consequential trust decisions or deploy this system to mainnet without review and operational controls.

## Private reporting

Use [GitHub private security advisories](https://github.com/zadworny/doublecheck/security/advisories/new).
Do not open a public issue for an exploitable weakness or include real identity/complaint data in a
report.

Include the affected commit, contract id/network if relevant, attacker prerequisites, exact call or
HTTP sequence, expected/actual outcome, and impact. A minimal failing Rust test, Node validation test,
or browser reproduction is especially useful.

## In scope

### Soroban registry

- bypassing proposal/controller consent or reservation uniqueness;
- accepting/cancelling a proposal, rotating a controller, or changing metadata without the required
  authenticating role;
- registering permanent/overlong badges or mandates, or putting forbidden person descriptors in an
  `Entity`;
- forging `CounterpartyConfirmed`/`IssuerConfirmed`, or making `SelfAsserted` authority pass
  `is_authorised`;
- authorising through an inactive/expired badge, invalid window, mismatched/inactive linked
  relationship, or a masking newer mandate;
- bypassing role-aware transitions, terminal revocation/withdrawal/end/completion, suspension
  ownership, pause, or admin handover;
- index/storage manipulation that lets one subject corrupt or deny another's records beyond the
  documented pair-index and cap behaviour;
- event contents that materially disagree with committed state; and
- unsafe upgrade, keepalive, TTL, or restore behaviour that changes trust decisions or loses state.

### Frontend and wallet writes

- showing a positive mandate result when the strict dependencies are not met;
- leaking unpublished relationships through snapshots, direct routes, search, or feeds;
- presenting a stale/static iframe or share carrier as a live verified verdict;
- credential fetch/hash logic that causes cross-origin exfiltration, unbounded resource use, or a
  false integrity claim;
- signing/submitting for a different address, network, contract, or statement than reviewed;
- treating simulation, submission, or an unfinalised transaction as confirmed success; and
- ABI/network mismatch that silently changes the meaning of a read or write.

### Intake function

- request-size, schema/allowlist, honeypot, media-type, or sanitisation bypasses;
- SSRF/redirect or secret exposure involving the configured webhook;
- returning success/reference when the downstream review system did not accept delivery;
- injection, log disclosure, or cross-submission data exposure; and
- unauthorised access to application or complaint payloads caused by code in this repository.

## Operational and product reports

The following are important, but may require a privacy/support or operational process rather than a
code vulnerability fix:

- poor quality or fraudulent off-chain verification evidence;
- an incorrect human moderation, strike, suspension, or appeal outcome;
- a request to correct/delete private application or complaint data;
- loss/compromise of an operator key without a code exploit; and
- availability/rate limits of a public RPC or external webhook.

Use private reporting when uncertain; do not publish personal allegations.

## Design powers, not vulnerabilities by themselves

- The global admin can propose new badges, write issuer-confirmed claims, change the arbiter,
  pause, and upgrade. Each accepted badge permanently records its issuer; only that stored issuer
  may later replace its credential anchor, renew or revoke it, approve controller recovery, or use
  the issuer side of its lifecycle. Both roles require production custody, policy, and audit
  controls.
- The arbiter can record disputes/suspensions/strikes within its constrained role.
- A funded keeper may call permissionless `keepalive`; it cannot change business status.
- The private review operation decides whether evidence is sufficient. The contract proves the
  resulting signer/state, not that the human check was competent.

A bug that expands any of those powers or misattributes their outcome is in scope.

## Known and accepted limitations

Please check [`docs/roadmap.md`](docs/roadmap.md) before reporting these as new findings:

- the public vNext deployment remains unaudited testnet infrastructure with demonstration records;
- general per-entity history indexes cap at 512 ids and can omit later records from browser
  discovery, although every record is stored and event-emitted; strict authorisation uses a
  separate 64-entry confirmed-pair index and 128-record strict scan budget; it rejects new relevant
  confirmations at capacity rather than silently evicting a live one;
- contract upgrades have no on-chain timelock;
- public on-chain claim text can contain personal employment data;
- browser credential checking compares a SHA-256 anchor only; it does not verify a W3C proof suite,
  signature status, or selective disclosure;
- simulation-only reads do not persist TTL; a submitted keeper and archive-restore process are
  operational requirements;
- the explorer performs linear registry reads and relies on public RPC capacity;
- intake has no built-in durable queue, KYC/KYB evidence vault, reviewer console, policy/appeals
  engine, or application-level rate limiter; and
- passkey account abstraction, fee sponsorship, production indexer/API, browser extension, and full
  issuer/arbiter dashboards are incomplete.

Known limitation does not excuse an undocumented privilege escalation, data leak, or false-positive
verification built on top of it.

## Mainnet expectation

Before mainnet, complete independent contract/frontend review, key-custody and upgrade drills,
KYC/KYB/privacy and complaint/appeal operations, proof-suite decisions, scalable indexed reads,
submitted TTL maintenance/restore, monitoring, incident response, and production wallet transaction
UX. See [`docs/deployment.md`](docs/deployment.md#mainnet-gates).
