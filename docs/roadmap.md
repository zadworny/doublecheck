# Roadmap

Core trust rules exist in repository source and on the public vNext testnet contract. Generated
frontend binding matches its live specification. This roadmap separates deployed testnet software
from operated production verification.

## Implemented in vNext source

- issuer proposal → intended-controller acceptance before a badge becomes active;
- 30-day maximum acceptance window and approximately annual badge/mandate bounds;
- enforced empty natural-person descriptors and stored-issuer-only credential anchor updates;
- consent-controlled relationship publication;
- signer-derived confirmation and strict confirmed-mandate `is_authorised` semantics;
- newest-to-oldest pair-index mandate scan, legacy fallback, and public linked-relationship checks;
- role-aware status authority and terminal revocation/withdrawal/ended/completed states;
- three-party controller recovery (current controller proposal, stored issuer approval, destination
  acceptance), with triple-auth compatibility recovery;
- signed, permissionless, cursor-based `keepalive` batches;
- public pair verifier, live iframe, periodic/visibility refresh, and manual credential hash check;
- role-aware recruiter/agency/company application and private report intake through a strict webhook
  bridge; and
- an expert/testnet Freighter holder dashboard for affiliations, mandates, subject publication, and
  withdrawals.

Contract features are live on testnet. Browser issuer/controller acceptance, staffed verification,
and passkey-sponsored workflows remain incomplete, so deployment must not be confused with an
operated verification service.

## vNext testnet release completed

Completed on 10 August 2026:

1. Built and tested exact optimized candidate: 60,131 bytes, 59 contract tests, SHA-256
   `1ab20ff8c30b0f704b64dee4aed5d1dd111e5b24e33fb612ef9309aef5dc895a`.
2. Upgraded existing testnet address in place and preserved 5 entities plus 8 claims.
3. Confirmed counters, all entity reads, admin/arbiter, new ABI exports, and strict pair reads.
4. Regenerated TypeScript binding from final live specification and rebuilt frontend.
5. Updated public wording so testnet is labelled vNext but not production verification.

Exit condition: source, Wasm hash, contract id, binding, frontend, and release notes describe the same
network interface and behaviour.

## Make manual verification real

The intake form and webhook transport are a vertical slice, not KYC/KYB operations. Before admitting
real users:

- select organisation and person verification providers/processes;
- define recruiter, agency, and hiring-company evidence checklists and risk tiers;
- implement a private encrypted case/evidence store and least-privilege reviewer console;
- authenticate webhook delivery, add replay/idempotency controls and abuse/rate limiting;
- document approval, rejection, re-verification, suspension, revocation, strike, and conflict rules;
- implement notices, correction requests, complaints, escalation, and appeals with service levels;
- bind accepted terms/privacy document hashes to the exact on-chain proposal; and
- establish retention, deletion, access logging, vendor, and data-subject-request procedures.

No application submission should imply acceptance, and no raw report should become a public fact.
Only reviewed outcomes are written on-chain by an authorised role.

## Production trust and privacy

Before mainnet:

- obtain an independent Soroban and frontend audit and resolve findings;
- put admin/upgrade authority under production multisig/HSM-grade custody; separate arbiter, reviewer,
  webhook, deployer, and funded keeper responsibilities;
- rehearse compromise, lost-controller, wrong-proposal, pause, restore, and upgrade incidents;
- complete a DPIA/legal-basis analysis for immutable addresses, handles, dates, hashes, and public
  relationship/mandate text;
- decide whether `role`, `department`, `scope`, and `territory` move off-chain or into selectively
  disclosed/encrypted credentials; and
- publish security, privacy, moderation, appeals, and law-enforcement policies.

## Credential integrity and disclosure

The browser currently compares SHA-256 only. A production credential layer needs:

- a chosen W3C VC/proof format and canonicalisation suite;
- issuer key discovery, signature/proof validation, status/revocation, and expiry checks;
- holder binding and anti-replay rules;
- selective-disclosure or zero-knowledge requirements based on actual verifier use cases;
- secure issuance, rotation, deletion, and recovery; and
- UX that distinguishes “hash matches” from “issuer signature and disclosure proof verified.”

Do not market the current hash panel as cryptographic identity proof or selective disclosure.

## Scale reads and distribution

- build a resumable event indexer and query API with chain reconciliation and status history;
- remove full-registry browser scans and define pagination/cache/finality semantics;
- move general history discovery beyond the 512-entry per-entity limit and keep simultaneous
  confirmed mandates comfortably below the explicit 64-entry fail-closed pair bound;
- use production RPC capacity and monitor availability/rate limits;
- operate scheduled submitted keepalive plus archive restoration and fee-balance alerts;
- build a browser extension only after the verifier API and anti-spoofing UX are stable; and
- add verified-domain/discovery mechanisms without making the web origin a substitute for chain
  provenance.

## Transaction experience

The codebase has wallet/network/statement/sign/submit/confirm primitives, but needs complete,
reviewed product flows:

- controller acceptance/cancellation and controller rotation;
- relationship publication/withdrawal and mandate issuance/withdrawal;
- issuer proposal, renewal, metadata, suspension/revocation, and case-to-transaction review;
- arbiter outcome writes with policy evidence and dual control;
- transaction simulation review, final-ledger confirmation, retry/replacement, and error recovery;
- passkey smart accounts and lost-device recovery; and
- fee sponsorship/relaying that cannot change the user's authorised invocation.

Until those exist, controlled CLI or operator tooling must be documented and independently reviewed.

## Accepted current limitations

- public vNext contract and matching binding remain unaudited testnet infrastructure;
- contract and application have not received a production audit;
- on-chain status history exists only in events;
- browser reads are linear and depend on a public RPC endpoint;
- capped general indexes can omit stored claims from browser history discovery; strict confirmed
  authorisation instead rejects new relevant entries when its 64-entry pair index is full and has a
  shared 128-record scan budget across compatibility fallbacks;
- credential retrieval leaks the reader's IP to its host and verifies only a hash;
- intake has no built-in durable queue, reviewer UI, evidence vault, rate limiter, or appeal system;
- public claim free text may be personal employment data; and
- passkeys, fee sponsorship, extension, indexer/API, and full write dashboards remain unimplemented.

## Deliberately deferred

Cash staking/slashing and a project token are not release requirements. Public strikes and terminal
status already provide reputation consequences without custody or token economics. Reconsider only
with evidence that financial collateral improves outcomes and after regulatory analysis.

Badge pricing tiers, subscriptions, analytics, and marketplace features are also downstream of a
safe and credible trust operation, not substitutes for it.
