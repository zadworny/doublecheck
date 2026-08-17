# SCF tranche deliverables - edit list

Every change required to turn the submitted text
([scf-tranches-sent.md](scf-tranches-sent.md)) into the target text
([scf-tranches-final.md](scf-tranches-final.md)). 24 edits across 9 of the 8 deliverable fields plus
the Tranche 1 context block. Tranche 2 Deliverable 3 and Tranche 3 Deliverable 2 are unchanged.

Supersedes `scf-tranches-review.md`, whose base text does not match what was actually submitted.

## Tranche 1

### Context block

| # | From | To |
|---|---|---|
| 1 | `complete browser-based issuer workflows` | `the listed browser-based issuer workflows` |

### Deliverable 1 - Passkey accounts and sponsored Soroban transactions

| # | From | To |
|---|---|---|
| 2 | `e.g., Passkey Kit, behind an internal adapter` | `e.g., OpenZeppelin Smart Account Kit, behind an internal adapter` |
| 3 | `e.g., OpenZeppelin Relayer with Channels.` | `e.g., OpenZeppelin Relayer.` |

Measure section, date and budget unchanged.

### Deliverable 2 - Wallet-connected issuer console and complete testnet lifecycle

| # | From | To |
|---|---|---|
| 4 | `supporting wallets such as Freighter and xBull.` | `supporting a maintained wallet such as Freighter.` |
| 5 | `will execute the complete DoubleCheck lifecycle` | `will execute the listed DoubleCheck lifecycle` |
| 6 | `entity proposal and acceptance, administrator enrollment, relationship attestation` | `entity proposal and acceptance, relationship attestation` |
| 7 | `Before signing, every write displays` | `Before signing, every listed write displays` |

Date and budget unchanged.

## Tranche 2

### Deliverable 1 - Contract governance, registry indexer, public API and SDK

| # | From | To |
|---|---|---|
| 8 | `role-based access control, pausing, upgradeability, and timelocked governance.` | `role-based access control, pausing, and upgradeability.` |
| 9 | `2-of-3 Stellar account and remain publicly visible during a ledger-based timelock.` | `2-of-3 Stellar account and emit a public upgrade event.` |
| 10 | `...event log for backup and replay. Existing testnet state will be bootstrapped...` | insert between the two sentences: `The indexer schema will be designed from the outset to support salted commitments and off-chain credential resolution.` |
| 11 | `while new issuance is paused, visibility of queued upgrades, and rejection of execution before the timelock expires.` | `while new issuance is paused, and publication of upgrade events.` |

Date and budget unchanged.

### Deliverable 2 - Soroban TTL keeper and restoration service

| # | From | To |
|---|---|---|
| 12 | title: `Soroban TTL keeper and restoration service` | `Soroban TTL keeper and restoration workflow` |
| 13 | `When an archived persistent or instance entry is required for public verification, an operator-funded service will submit the required restoration transaction and retry the verification request.` | `When an archived persistent or instance entry is detected, an operator-funded restoration workflow will submit the required restoration transaction.` |
| 14 | `the same operator-funded restoration path used by the service, and verifies it again` | `the same operator-funded restoration workflow, and verifies it again` |

Date and budget unchanged.

### Deliverable 3 - Signed credential and commitment layer

No changes.

## Tranche 3

### Deliverable 1 - Production hardening, custody, and operational readiness

| # | From | To |
|---|---|---|
| 15 | `Prepare the reviewed release candidate` | `Prepare the production release candidate` |
| 16 | `...failure-path tests across the contracts and supporting services.` | append to that sentence: ` Implement remediation of findings received from the security review initiated after Tranche 2.` |
| 17 | `signer rotation, upgrade scheduling and cancellation, rejection of early upgrade execution, emergency pause and recovery` | `signer rotation, upgrade authorization and recovery, emergency pause and recovery` |
| 18 | `The release candidate, build artifacts, test results, and technical documentation are delivered for the SCF-provided security review. Audit-provider costs are excluded from this budget.` | `All critical, high, and medium-severity findings received before the mainnet release freeze are resolved, regression-tested, and documented.` |
| 19 | date: `3 January 2027` | `5 January 2027` |

Budget unchanged.

### Deliverable 2 - Open-source v1.0 and reproducible deployment

No changes.

### Deliverable 3 - Mainnet launch and professional user testing

| # | From | To |
|---|---|---|
| 20 | title: `Mainnet launch and professional user testing` | `Mainnet launch and user acceptance testing` |
| 21 | `Deploy the reviewed DoubleCheck release` | `Deploy the tagged DoubleCheck release` |
| 22 | `Complete SCF-provided professional user testing across issuer administration,` | `Complete documented user acceptance testing across issuer administration,` |
| 23 | `The deployed WASM matches the reviewed release artifact.` | `The deployed WASM matches the tagged v1.0 release artifact.` |
| 24 | `The stable mainnet application and testing instructions are supplied for SCF's professional user testing. Security or usability findings designated as launch blockers` | `The stable mainnet application, user guides, and end-to-end verification walkthrough are finalized. Usability or security findings designated as launch blockers` |

Date and budget unchanged.

## Checks before resubmitting

- The word `reviewed` must not appear anywhere in Tranche 3. Edits 15, 21 and 23 remove all three
  occurrences.
- The phrase `SCF-provided` must not appear anywhere. Edits 18 and 22 remove both occurrences.
- Total budget across all tranches is $96,000, unchanged.

## Two open items in the target version

Neither is introduced by the edits above; both exist in the target text as written.

1. **Dangling audit reference.** Edit 16 refers to "the security review initiated after Tranche 2",
   but no deliverable in Tranche 2 initiates one. Either add one sentence to the end of Tranche 2
   Deliverable 3's measure section:

   > On completion of this tranche, the release candidate, build artifacts, and test results are
   > prepared for independent security review. Audit-provider costs are excluded from this budget.

   or reword edit 16 to remove the reference:

   > Implement remediation of findings from any independent security review received before the
   > mainnet release freeze.

   The second option touches only one field. Note that the submitted text carried the disclaimer
   "Audit-provider costs are excluded from this budget", and edit 18 removes it; the first option
   restores it.

2. **Administrator enrollment appears in Tranche 3 but is removed from Tranche 1.** Edit 6 drops
   administrator enrollment from the Tranche 1 console lifecycle, but Tranche 3 Deliverable 3 still
   requires the mainnet demonstration to complete "entity acceptance, administrator enrollment,
   relationship publication...". Either keep it in both or remove it from both. To remove: delete
   `administrator enrollment, ` from the Tranche 3 Deliverable 3 measure section.
