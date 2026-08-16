# SCF tranche deliverables

## Tranche 1

Tranche 1 (Deliverable Roadmap) - MVP

Context: DoubleCheck's registry contract and public verifier are already live on Stellar testnet. This tranche adds accessible account control and complete browser-based issuer workflows. It does not rebuild the registry.

### Deliverable 1 - Passkey accounts and sponsored Soroban transactions

Brief description:

Integrate maintained Stellar passkey smart-account tooling, e.g., Passkey Kit, behind an internal adapter so the implementation can be replaced if upstream tooling changes. Individuals will control their DoubleCheck identity through a passkey-controlled Soroban account using native secp256r1 verification.

Add sponsored transaction submission through a Stellar relayer, e.g., OpenZeppelin Relayer with Channels. Users will be able to accept entity proposals and manage publication consent without installing a wallet, managing a seed phrase, or holding XLM. Sponsored submission will be limited to contract calls authorized by the user.

How to measure completion:

A recorded public testnet demonstration shows a user creating a passkey-controlled account and accepting an entity proposal from a supported browser. The user installs no wallet extension, the account holds no XLM, and the user pays no XLM. Source code, deployed addresses, and transaction IDs are published.

Automated tests reject modified, expired, replayed, and disallowed authorizations. Tests demonstrate that the relayer cannot change the authorized contract, function, arguments, or invocation tree. Relayer refusal and rate-limiting paths are covered in CI, and the application does not report success until final ledger inclusion is confirmed.

Estimated date of completion: 30 September 2026

Budget: $11,400

### Deliverable 2 - Wallet-connected issuer console and complete testnet lifecycle

Brief description:

Integrate a unified Stellar wallet connection layer, e.g., Stellar Wallets Kit, into the issuer and organization administrator console, supporting wallets such as Freighter and xBull. The console will execute the complete DoubleCheck lifecycle against the deployed Soroban contract: entity proposal and acceptance, administrator enrollment, relationship attestation, subject-approved publication, mandate issuance and withdrawal, and public verification through Soroban RPC.

How to measure completion:

A recorded public testnet demonstration completes the lifecycle from entity proposal through relationship and mandate withdrawal. An unauthorized account fails to issue an attestation. Supported wallet connection and transaction-signing paths are documented and tested.

Before signing, every write displays the contract action and arguments in plain language. The console simulates, signs, submits, and confirms final ledger inclusion. The public verifier reads contract state directly through Soroban RPC and reflects withdrawal or expiry without relying on a DoubleCheck database or requiring a separate status-synchronization transaction.

Estimated date of completion: 15 October 2026

Budget: $10,200

## Tranche 2

Tranche 2 (Deliverable Roadmap) - Testnet

### Deliverable 1 - Contract governance, registry indexer, public API and SDK

Brief description:

Upgrade the testnet registry using established Stellar contract components, e.g., OpenZeppelin modules for role-based access control, pausing, upgradeability, and timelocked governance. Separate protocol administrator, arbiter, pauser, and upgrade authorities from organization-scoped permissions. Sensitive upgrades will require authorization from a 2-of-3 Stellar account and remain publicly visible during a ledger-based timelock.

Build a registry event indexer that consumes DoubleCheck contract events through Stellar RPC, persists its cursor, and retains an append-only event log for backup and replay. The indexer schema will be designed from the outset to support salted commitments and off-chain credential resolution. Existing testnet state will be bootstrapped through direct contract reads. On mainnet, indexing will begin from the deployment ledger, providing complete event history from launch.

A reconciler will compare indexed projections with authoritative contract state, mark divergent records as stale, and prevent stale data from producing a positive authorization result. Expose entity, relationship, mandate, and status-history queries through a documented public API and TypeScript SDK.

How to measure completion:

The upgraded contract is live on testnet, with tagged source code, contract address, WASM hash, and upgrade transaction published. Existing records remain readable. Automated tests demonstrate role separation, multisignature approval for sensitive actions, rejection of unauthorized calls, emergency pause behavior, continued withdrawal and revocation while new issuance is paused, visibility of queued upgrades, and rejection of execution before the timelock expires.

Starting from the bootstrap snapshot and retained event log, the indexer rebuilds its projections and produces the same current state as direct contract reads. Restart and replay tests produce no gaps or duplicate events. A deliberately modified projection is detected and marked stale.

The published API and TypeScript SDK retrieve entities, relationships, mandates, and recorded status history while distinguishing indexed results from direct contract reads. Current authorization decisions use authoritative Soroban state.

Estimated date of completion: 7 November 2026

Budget: $14,500

### Deliverable 2 - Soroban TTL keeper and restoration service

Brief description:

Implement the operational layer required by Soroban state archival. An off-chain keeper will monitor the registry contract code, contract instance, and tracked persistent entries, then submit permissionless TTL-extension transactions before archival.

When an archived persistent or instance entry is required for public verification, an operator-funded service will submit the required restoration transaction and retry the verification request. Readers will not need a wallet or XLM.

How to measure completion:

A recorded public testnet demonstration shows the keeper identifying entries within its configured extension window and submitting a successful TTL-extension transaction. Transaction IDs, outcomes, the latest completed run, failed submissions, and minimum remaining TTL are visible through operational monitoring.

A reproducible integration test in a controlled Stellar environment advances a persistent record beyond its TTL, restores it through the same operator-funded restoration path used by the service, and verifies it again without requiring the reader to connect a wallet or hold XLM. Tests cover interrupted runs, repeated execution, and failed submissions. The keeper receives no privileged registry role.

Estimated date of completion: 27 November 2026

Budget: $8,800

### Deliverable 3 - Signed credential and commitment layer

Brief description:

Replace cleartext relationship and mandate details in new ledger writes with salted cryptographic commitments. Claim content and salts will remain off-chain. Publish the claim schemas, canonicalization rules, commitment format, and test vectors.

Issue W3C Verifiable Credentials 2.0 secured with JOSE using an HTTPS issuer identifier and published verification key. Each credential will contain an opaque subject identifier, the Stellar network, the controller address accepted on-chain, the corresponding claim identifier, validity information, claim content, and the salt needed to verify the on-chain commitment.

The public verifier will validate the issuer signature, reproduce the commitment, and read current claim status directly from Soroban. Soroban will remain the authoritative source for withdrawal, expiry, and current authorization.

How to measure completion:

Versioned credential schemas, issuer verification information, canonicalization rules, commitment test vectors, and example credentials are published. A standalone reference script reproduces the on-chain commitment without importing DoubleCheck application code.

The verifier accepts a valid credential and rejects modified content, an invalid issuer signature, an unrecognized issuer, an incorrect controller address, an expired credential, a withdrawn claim, or a commitment mismatch. The interface reports issuer-signature verification, commitment matching, and current Soroban status as separate results.

Inspection of newly written relationship and mandate entries confirms that no cleartext claim text or salt is stored on-chain. Historical ledger entries are explicitly excluded from this claim because they cannot be removed.

Estimated date of completion: 16 December 2026

Budget: $9,700

## Tranche 3

Tranche 3 (Deliverable Roadmap) - Mainnet

### Deliverable 1 - Production hardening, custody, and operational readiness

Brief description:

Prepare the reviewed release candidate and production environment for mainnet. Configure separately controlled keys for upgrade, issuer, arbiter, pauser, relayer, and keeper operations, with 2-of-3 custody for upgrades. Harden production secrets, add configurable RPC and relayer providers, and implement monitoring for service health, ledger progress, reconciler drift, failed submissions, operational balances, and TTL durability.

Complete incident-response, recovery, key-rotation, deployment, and rollback runbooks. Run static analysis, dependency-security checks, integration tests, and failure-path tests across the contracts and supporting services. Implement remediation of findings from the security review completed between Tranche 2 and Tranche 3.

How to measure completion:

Production-equivalent testnet exercises cover multisignature approval, signer rotation, upgrade scheduling and cancellation, rejection of early upgrade execution, emergency pause and recovery, relayer failure, RPC provider failure, index reconstruction, and archived-entry restoration.

Monitoring alerts are demonstrated for projection drift, failed submissions, low operational balances, and low TTL headroom. Deployment configuration is version-controlled without storing production secrets in the repository. All critical and high-severity findings from the security review are resolved, regression-tested, and documented in a public triage report.

Estimated date of completion: 5 January 2027

Budget: $13,600

### Deliverable 2 - Open-source v1.0 and reproducible deployment

Brief description:

Publish the tagged open-source v1.0 release under a permissive license. The release will include the registry contracts, event and credential schemas, generated bindings, reference indexer and reconciler, OpenAPI description, TypeScript SDK, verifier, administrator console, passkey components, deployment configuration, operational documentation, contribution guide, and stewardship roadmap.

Publish a reproducible build manifest containing the pinned build environment, source commit, locked dependencies, build commands, and expected WASM hash.

How to measure completion:

Tagged releases, source archives, build instructions, and WASM hashes are published. Clean CI builds using the pinned environment reproduce the released contract WASM hash.

Using a clean environment and a separate team-controlled operator account, the published instructions deploy a fresh testnet instance and complete the documented verification lifecycle without unpublished steps or credentials. Automated contract, API, SDK, credential, and end-to-end tests pass against that deployment.

Estimated date of completion: 15 January 2027

Budget: $11,500

### Deliverable 3 - Mainnet launch and user acceptance testing

Brief description:

Deploy the reviewed DoubleCheck release to Stellar mainnet and activate the production registry, passkey onboarding, sponsored submission, issuer console, public verifier, registry indexer, TTL service, public API, TypeScript SDK, credential service, and embeddable badge.

Jobited will operate as the first production verification issuer under a published issuer policy. A technical onboarding package will be available for participating pilot organizations, but completion will not depend on any partner's participation or adoption result.

Complete comprehensive user acceptance testing across issuer administration, passkey-controlled subject flows, and wallet-free public verification. Address launch-blocking security and usability findings. Document essential production data-handling, retention, deletion, correction, and dispute procedures for off-chain information.

How to measure completion:

The mainnet contract address, deployment transactions, tagged source code, deployed WASM hash, build manifest, network configuration, and governance configuration are published. The deployed WASM matches the reviewed release artifact. All production components use the published mainnet deployment, and operational monitoring and the funded TTL keeper are active.

A recorded mainnet demonstration using controlled records completes entity acceptance, administrator enrollment, relationship publication, subject consent, mandate issuance, credential verification, withdrawal, and the resulting change in public verification status. The verifier distinguishes current representation from past representation and clearly states when a former representative has no current authority. Public verification requires no wallet, login, or XLM.

Jobited completes the production issuer workflow. The stable mainnet application, user guides, and end-to-end verification walkthrough are finalized. Usability or security findings designated as launch blockers are resolved and regression-tested. No tester score, partner activity, adoption target, or external operator action is required for completion. This is the final project deliverable.

Estimated date of completion: 3 February 2027

Budget: $16,300
