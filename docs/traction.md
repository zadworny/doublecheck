# Traction and delivery evidence

DoubleCheck is pre-launch. This page separates inspectable engineering evidence, vNext testnet demo
state, and demand assertions. Testnet fixtures are not users and deployment is not production use.

## Inspectable delivery

| Evidence | Current state |
|---|---|
| Source licence | Apache 2.0 |
| Repository contract | vNext; passing test suite; optimized Wasm below the 128 KiB limit |
| Public contract | vNext Stellar testnet address `CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP` |
| Public Wasm | 60,131 bytes; SHA-256 `1ab20ff8c30b0f704b64dee4aed5d1dd111e5b24e33fb612ef9309aef5dc895a` |
| Public contract fixtures | 5 entities and 8 claims; demonstration data only |
| Hosted frontend | <https://doublecheck-lime.vercel.app> |
| Public read model | wallet-free Soroban simulations from the browser |
| Intake | application/report webhook bridge in repository source; requires private deployment configuration |
| Audit | no independent production audit |

The vNext test suite covers controller-consent onboarding, bounded renewal/mandates, personal-field
validation, immutable per-badge metadata authority, claim publication, strict confirmed mandate
evaluation, terminal and role-aware status changes, issuer-approved controller recovery, and
submitted keepalive behaviour.

The browser source includes a direct pair verifier, live iframe and share links, public credential
hash comparison, role-aware application/report intake, and an expert Freighter holder-write path.
None of those proves that a human verification operation is ready; testnet contract enforcement and
operational evidence quality are separate claims.

## Release distinction

The vNext testnet release now has:

1. rehearsed upgrade or clean deployment of the reviewed Wasm;
2. invariant and signed keepalive checks against deployed state;
3. regenerated binding from the final live contract specification;
4. frontend/API release with contract/network/webhook configuration verified; and
5. release evidence tying commit, Wasm hash, contract id, binding, and tests together.

The remaining release distinction is operational: controller acceptance exists in the ABI, while
browser issuer/acceptance workflows, staffed review, private evidence systems, and production audit
remain incomplete.

## Demand assertions

Project materials describe prospective partner pilots and an issuer/distribution pipeline. Those are
commercial assertions rather than independently verifiable usage metrics and should be accompanied
by current, permissioned evidence before being used externally. Fixture counts, visits to the demo,
applications, and webhook references must not be represented as verified users, approvals, retained
usage, or revenue.

Useful pilot evidence would include:

- organisations/recruiters that completed the actual KYC/KYB and controller-acceptance process;
- mandates checked by candidates and the proportion that prevented or resolved uncertainty;
- time to issue, withdraw, suspend, correct, and appeal;
- false-positive/false-negative and reviewer disagreement measures;
- privacy/deletion requests and complaint outcomes; and
- recurring use after the initial pilot, without exposing personal evidence.

## What blocks a production milestone

- complete KYC/KYB review, evidence security, policies, notices, and appeals;
- resolve the privacy treatment of durable handles/hashes and on-chain claim free text;
- implement real credential proof-suite/selective-disclosure verification;
- operate an indexer/API, production RPC, monitoring, and signed TTL/restore process;
- complete issuer/arbiter/controller transaction UX, passkey recovery, and fee sponsorship; and
- complete independent security audit plus production key custody and incident drills.

The sequencing and exit criteria live in [Roadmap](roadmap.md); current deployment evidence is in
[Deployment](deployment.md#current-environments).
