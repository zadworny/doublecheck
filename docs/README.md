# DoubleCheck documentation

DoubleCheck is a Stellar/Soroban registry for vetted organisations and people, their relationships,
and confirmed time-bound mandates. A reader can verify public state without a wallet; applications,
reports, and verification evidence remain off-chain.

The repository, public Stellar testnet contract, and generated frontend binding use the vNext
interface deployed on 10 August 2026. Read [Deployment](deployment.md#current-environments) before
making a claim about production readiness.

## Start here

| Need | Document |
|---|---|
| Stellar/Soroban integration reference: registries, TTL, events, indexer, passkeys, wallets, governance, credentials | [Stellar technical architecture](stellar-architecture.md) |
| Product, trust, consent, privacy, and Stellar design | [Architecture](architecture.md) |
| Contract interface, tests, keepalive, deploy/upgrade | [Smart-contract README](../SC/README.md) |
| Browser verifier, wallet writes, intake API, bindings | [Frontend README](../FE/README.md) |
| Local setup and safe interface-change workflow | [Development guide](DEVELOPMENT.md) |
| Hosting, contract release, secrets, TTL, and monitoring | [Deployment](deployment.md) |
| Repository/component ownership | [Repository guide](REPOSITORY.md) |
| Release gates and remaining work | [Roadmap](roadmap.md) |
| Vulnerability scope/private reporting | [Security policy](../SECURITY.md) |
| Evidence of shipped milestones | [Traction](traction.md) |
| Full vNext implementation/audit/deployment report | [Markdown](IMPLEMENTATION_REPORT_2026-08-10.md) · [PDF](IMPLEMENTATION_REPORT_2026-08-10.pdf) |
| Visual summary of new features, improvements, and fixes | [Markdown](IMPLEMENTED_CHANGES_SUMMARY_2026-08-10.md) · [PDF](IMPLEMENTED_CHANGES_SUMMARY_2026-08-10.pdf) |

## Sources of truth

| Subject | Canonical source |
|---|---|
| Contract behaviour, auth, records, limits, errors | `SC/contracts/doublecheck-registry/src/` and tests |
| Public ABI for a network | specification of the deployed contract on that exact network |
| Generated browser types | `FE/src/contract/registry.ts`, generated from the deployed ABI |
| Routes, public filtering, verifier and wallet UI | `FE/src/` |
| Intake request validation/delivery | `FE/api/` and `FE/server/` |
| Browser/server environment contract | `FE/.env.example` |
| Release and operations | [Deployment](deployment.md) |
| Product/legal work that code does not settle | [Architecture](architecture.md), [Roadmap](roadmap.md), and [Security](../SECURITY.md) |
| Automated checks | `.github/workflows/ci.yml` |

Source code is not evidence of deployment. An in-place contract upgrade can preserve an address while
changing its ABI; bindings must still be regenerated. A UI-derived safety check is not proof that an
older live contract enforces the same rule.

## Current status

- vNext source has controller-consent onboarding, bounded annual validity, issuer-controlled metadata
  anchors, stricter mandate checks, role-aware terminal status rules, and submitted keepalive.
- The frontend has public verification/live iframe, application/report intake, credential hash
  comparison, and Freighter holder-write work; full issuer/arbiter operations are not complete.
- The public testnet contract was upgraded in place and the binding regenerated from the live vNext
  specification; its preserved records remain demonstration fixtures.
- No independent production security audit has been completed.
- Full KYC/KYB operations, policies/appeals, proof-suite/selective-disclosure cryptography,
  indexer/API, extension, and passkey fee sponsorship remain.

Do not treat a testnet badge or intake reference as a production trust decision.

## Documentation maintenance

When behaviour changes:

1. update the nearest source comments/tests and component README;
2. update architecture/security for a changed trust or privacy promise;
3. update deployment for ABI, environment, secret, TTL, or operational changes;
4. update roadmap/traction to distinguish implemented, deployed, and operated; and
5. run link/anchor checks plus `git diff --check`.

Keep documents in this flat directory and add enduring pages to this index and root
[`SUMMARY.md`](../SUMMARY.md). Use explicit labels such as source-only, legacy testnet, planned, or
production-ready.
