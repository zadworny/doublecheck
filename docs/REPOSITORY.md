# Repository guide

DoubleCheck is a small monorepo with one Soroban contract, a browser application, and a request-driven
intake function. They share a frontend package but have different trust and secret boundaries.

## Top-level map

| Path | Responsibility |
|---|---|
| [`SC/`](../SC/) | Rust/Soroban registry, tests, event snapshots, and keeper runner |
| [`FE/`](../FE/) | React/Vite application, generated contract client, Vercel API, validation tests |
| [`docs/`](./) | Architecture, development, deployment, roadmap, and project evidence |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | contract and frontend/API checks |
| [`README.md`](../README.md) | short project introduction and source-vs-live status |
| [`SUMMARY.md`](../SUMMARY.md) | GitBook navigation |
| [`SECURITY.md`](../SECURITY.md) | private reporting and accepted security boundary |

The future private review system and event indexer/API are not present in this repository.

## Contract source map

Contract root: `SC/contracts/doublecheck-registry/`.

| Path | Responsibility |
|---|---|
| `src/lib.rs` | entry points, auth, validations, transitions, and effective reads |
| `src/types.rs` | public records/enums, storage keys, limits, and errors |
| `src/storage.rs` | instance/persistent storage, indexes, reservations, and TTL extension |
| `src/events.rs` | proposal, consent, metadata, claim, status, governance, and upgrade events |
| `src/test.rs` | behavioural/adversarial trust regression suite |
| `test_snapshots/` | generated and committed event snapshots reviewed with test changes |
| `SC/scripts/keepalive.sh` | signed cursor loop for preventative TTL maintenance |

`SC/target/` is generated/ignored. The optimized deploy candidate is built through Stellar CLI; CI's
release build additionally enforces the network byte limit.

## Browser application source map

| Path | Responsibility |
|---|---|
| `FE/src/App.tsx` | route order and top-level providers |
| `FE/src/pages/` | public explorer, direct verifier, live badge, application, wallet record/console |
| `FE/src/components/` | status/provenance, credential, sharing, reporting, and common UI |
| `FE/src/data/registry.ts` | generated contract records → public display models; privacy filtering |
| `FE/src/data/RegistryContext.tsx` | refreshable registry snapshot and lookups |
| `FE/src/lib/chain.ts` | network configuration and read client |
| `FE/src/lib/credential.ts` | bounded HTTPS fetch, canonicalisation, and SHA-256 comparison |
| `FE/src/lib/intake.ts` | application/report client and honest response handling |
| `FE/src/lib/write.ts` | Freighter controller checks, canonical statements, simulation/sign/send/finality |
| `FE/src/context/WalletContext.tsx` | optional public wallet connection state |
| `FE/src/contract/registry.ts` | generated live-ABI client; never hand-edit |
| `FE/scripts/generate-bindings.mjs` | repeatable live specification generation/compatibility patches |
| `FE/vercel.json` | SPA/function routing assumptions, security headers, cache policy |

Important routes include `/apply`, `/verify`, `/badge/:handle`, `/me`, `/manage`, `/standard`, and
public record/claim paths. The generic `/:handle` matcher must remain after static and prefixed
routes.

The live badge is not a static image. It is a small iframe page that refreshes registry state; other
HTML/Markdown carriers are neutral links. Public data loading must never re-introduce a relationship
whose `public_display` is false.

## Intake function source map

| Path | Responsibility |
|---|---|
| `FE/api/intake.ts` | Vercel HTTP method/content/byte checks, secure forwarding, references/errors |
| `FE/server/intake-validation.ts` | strict application/report schemas and sanitisation |
| `FE/server/*.test.ts` | Node-native intake and credential regression tests |
| `FE/.env.example` | public chain configuration and named server-only webhook variables |

Browser `VITE_*` values are public. `INTAKE_WEBHOOK_URL` and
`INTAKE_WEBHOOK_BEARER_TOKEN` are runtime secrets and must exist only in the function environment.
The API stores nothing and writes nothing on-chain; the webhook/review system owns durable private
records.

## Ownership boundaries

| Concern | Owner |
|---|---|
| verification validity, consent, signer provenance, status authority | contract |
| public discovery/rendering and local dependency explanation | frontend data/UI |
| transaction statement review and wallet/network/finality checks | wallet client plus contract |
| applications, raw reports, KYC/KYB evidence, policies, appeals | private off-chain operation |
| event history, scalable discovery, reconciliation | future indexer/API |
| TTL survival | signed keeper/restore operation; never simulated browser reads |

See [Architecture](architecture.md) for the rationale.

## Generated, local, and secret files

| Kind | Examples | Rule |
|---|---|---|
| Generated and committed | `FE/src/contract/registry.ts`, Soroban snapshots | regenerate via documented workflow; review diffs |
| Generated and ignored | `SC/target/`, `FE/dist/`, `FE/node_modules/` | never commit |
| Local deployment state | `FE/.env`, `.stellar/`, `.vercel/` | never commit |
| Public example | `FE/.env.example` | names secrets but contains no secret value |

The checked-in generated binding targets the vNext public testnet ABI deployed on 10 August 2026.
Future source changes still do not update it automatically: regenerate only after the exact candidate
is live and final.

## Release boundary

A merge, contract deployment/upgrade, binding regeneration, frontend deploy, webhook configuration,
and operational activation are distinct actions. The supported environment is the tuple:

```text
commit + Wasm hash + contract id/network + live ABI/binding
       + browser environment + server secret environment + release evidence
```

Follow [Development](DEVELOPMENT.md) for changes and [Deployment](deployment.md) for release/TTL
operations. Never advertise source-only rules as live guarantees.

## Documentation conventions

Keep durable documents in this flat directory, link them from [`docs/README.md`](README.md), and add
them to [`SUMMARY.md`](../SUMMARY.md) when appropriate. Prefer relative links. Mark facts as source,
legacy testnet, planned, or production. Update security/architecture when auth/privacy changes and
deployment when ABI/environment/operations change.
