# DoubleCheck documentation

This is the documentation home for DoubleCheck: a Stellar registry for verified
organisations and people, their relationships, and the time-bound mandates that
authorise someone to act for an organisation.

The product is intentionally split into a public verifier and an on-chain registry. A reader can
check a handle without a wallet, account, signature, or fee; the browser simulates a read against
the registry and renders the result. Start with the material that matches what you need to do.

## Start here

| If you need to… | Read | Why it is the right starting point |
|---|---|---|
| Understand the product and trust model | [Architecture](architecture.md) | Explains the problem, records, roles, confirmation tiers, privacy boundary, lifecycle, and known limitations. |
| Run or change the registry contract | [Smart-contract README](../SC/README.md) | The authoritative interface reference, local commands, deployment walkthrough, and CLI examples. |
| Run or change the public verifier | [Explorer README](../FE/README.md) | Explains the React application, routes, on-chain data loading, configuration, and binding generation. |
| Set up a local development workflow | [Development guide](DEVELOPMENT.md) | Covers prerequisites, repeatable checks, the safe contract-to-explorer change sequence, and CI. |
| Find a component or decide where a change belongs | [Repository guide](REPOSITORY.md) | Maps the repository layout, ownership boundaries, generated code, and documentation conventions. |

## Reference

| Document | Scope |
|---|---|
| [Architecture](architecture.md) | System design and the rationale behind the data, trust, privacy, lifecycle, storage, and deployment choices. |
| [Development guide](DEVELOPMENT.md) | Local setup, tests, build commands, interface changes, troubleshooting, and continuous integration. |
| [Repository guide](REPOSITORY.md) | Top-level structure, source map, generated artifacts, configuration, and how to keep documentation current. |
| [Deployment](deployment.md) | Static explorer hosting, contract deployment, operational requirements, and the future indexer. |
| [Roadmap](roadmap.md) | Mainnet blockers, work before real traffic, planned capabilities, and explicit non-goals. |
| [Traction](traction.md) | Shipped milestones, current testnet deployment, demand context, and the criteria for the next milestone. |
| [Security policy](../SECURITY.md) | Security posture, private vulnerability reporting, scope, and accepted limitations. |

## Source-of-truth guide

Avoid maintaining the same technical fact in several places. The following locations are canonical:

| Subject | Canonical location |
|---|---|
| Contract types, entry points, authorisation, errors, and events | `SC/contracts/doublecheck-registry/src/` and [Smart-contract README](../SC/README.md) |
| Explorer routes, presentation, and chain-to-UI mapping | `FE/src/` and [Explorer README](../FE/README.md) |
| Contract address and browser-facing network defaults | `FE/.env.example`, `FE/src/lib/chain.ts`, and generated `FE/src/contract/registry.ts` |
| Deployment and operations | [Deployment](deployment.md) |
| Product choices and non-code policy | [Architecture](architecture.md), [Roadmap](roadmap.md), and [Security policy](../SECURITY.md) |
| What runs on every pull request and push to `main` | `.github/workflows/ci.yml` |

The summaries in `docs/` should link to those sources rather than copy generated types, CLI output,
or implementation details. This keeps the documentation useful as the product grows.

## Current status

DoubleCheck is an MVP deployed to Stellar testnet. The public explorer is read-only and the
contract has **not** received an independent security audit. Do not treat a testnet record as a
production trust decision. The exact mainnet blockers and next work are maintained in the
[Roadmap](roadmap.md); reporting guidance is in the [Security policy](../SECURITY.md).

## Keeping this documentation useful

Documentation lives in this one flat `docs/` directory so it remains easy to browse in GitHub and
GitBook. When a change affects users, operators, or contributors:

1. Update the authoritative README or source comment nearest to the behaviour.
2. Update the relevant document in this directory when the change alters an architectural,
   operational, or product-level promise.
3. Add a row here and to the root [`SUMMARY.md`](../SUMMARY.md) when adding a new enduring document.
4. Use descriptive links and state whether a claim is testnet-only, planned, or production-ready.

The root [README](../README.md) is the short project introduction. This page is the durable map of
the technical and operational documentation.
