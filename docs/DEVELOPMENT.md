# Development guide

DoubleCheck contains a Soroban contract, a React/Vite browser application, and a Vercel Node intake
function. Work from each component directory and keep live-contract compatibility explicit.

## Prerequisites

| Area | Tools |
|---|---|
| Contract | Rust stable, `wasm32v1-none`, Stellar CLI 27.x/compatible |
| Frontend and API tests | Node.js 22-compatible LTS and npm |
| Wallet-write testing | Freighter configured for the same network and a funded controller account |

```bash
rustup target add wasm32v1-none
cd FE && npm ci
cd ../SC && cargo test
```

Copy [`FE/.env.example`](../FE/.env.example) to an untracked `FE/.env` only when overriding defaults.
Every `VITE_*` value is public in the browser bundle. `INTAKE_WEBHOOK_URL` and its optional bearer
token are server-only and must never be renamed with that prefix.

## Compatibility warning

The repository contract, public testnet address, and `FE/src/contract/registry.ts` currently share
the vNext interface deployed on 10 August 2026. Any later contract source change recreates an ABI
risk until that candidate is deployed and the binding is generated again from the final live
specification.

Do not hand-edit generated types to hide an ABI mismatch. For contract-dependent frontend work,
choose one of these honest environments:

- the deployed vNext test contract + its generated binding;
- a separate deployed candidate test contract + a binding generated from it; or
- contract unit tests/local tooling that do not claim to represent the public deployment.

## Local processes

```bash
# Browser app
cd FE
npm run dev

# Contract
cd SC
cargo test

# Intake validation tests (does not contact a webhook)
cd FE
npm test
```

Vite's dev server is not evidence that Vercel function routing works. Test `/api/intake` in a Vercel
preview or compatible local function runtime before release. Missing webhook configuration should
return `503`; it must never return a fake success/reference.

## Required checks

| Area | Command | Coverage |
|---|---|---|
| Frontend/API tests | `cd FE && npm test` | Node-native intake/credential validation |
| Frontend lint | `cd FE && npm run lint` | oxlint |
| Frontend build | `cd FE && npm run build` | TypeScript project build and Vite bundle |
| Contract format | `cd SC && cargo fmt --all --check` | Rust formatting |
| Contract lint | `cd SC && cargo clippy --all-targets -- -D warnings` | contract and test lints |
| Contract tests | `cd SC && cargo test` | trust, consent, status, expiry, index, and TTL behaviour |
| Deployable Wasm | `cd SC && stellar contract build --optimize` | exact optimized candidate |

CI also builds a release Wasm and enforces the 131,072-byte network limit. Do not make a prose count
or locally cached artifact a substitute for current test/build output.

For documentation-only changes, run `git diff --check`, verify relative links/anchors, and search for
stale claims such as “reads extend TTL,” “static/no backend,” “read-only,” or “vNext is deployed.”

## Contract-change workflow

```text
Rust types/entry points
        ↓
auth/lifecycle/privacy regression tests and event snapshots
        ↓
optimized Wasm and rehearsed testnet deployment/upgrade
        ↓
binding generated from the final live specification
        ↓
data mapping, read/write UX, browser/API tests
        ↓
architecture, security, deployment, and release documentation
```

1. Change `SC/contracts/doublecheck-registry/src/` and add tests for success, unauthorised callers,
   temporal boundaries, and terminal states. Update event snapshots intentionally.
2. Run all contract checks and record the exact candidate hash/size.
3. Rehearse an in-place upgrade against representative state or deploy a clean candidate. New
   persistent keys and ABI changes require explicit compatibility checks.
4. After finality, generate from that contract:

   ```bash
   cd FE
   CONTRACT_ID=<vnext-contract-id> STELLAR_NETWORK=testnet npm run bindings
   ```

5. Review `FE/src/contract/registry.ts`; never edit it by hand. Adapt the boundary in
   `FE/src/data/registry.ts` and any write builders in `FE/src/lib/write.ts`.
6. Run frontend/API checks and network smoke tests. A simulated write is preflight only; success
   requires `signAndSend` and final-ledger confirmation.
7. Update [`SC/README.md`](../SC/README.md), [Architecture](architecture.md),
   [Deployment](deployment.md), and [Security](../SECURITY.md) when promises change.

An in-place upgrade preserves the address but still needs regenerated bindings when the interface
changes. A new address additionally requires environment updates and an honest migration/link plan.

## Frontend data and write paths

Public read path:

```text
generated client → src/lib/chain.ts → src/data/registry.ts
                 → RegistryContext → route/component
```

The snapshot refreshes on a timer and when the document becomes visible. Keep unpublished
relationships out of every public snapshot, lookup, search, and feed path. `/badge/:handle` is
chrome-free and no-store; it must resolve live data, not cache a status assertion.

Private intake path:

```text
/apply or ReportModal → src/lib/intake.ts → POST /api/intake
                     → server/intake-validation.ts → private HTTPS webhook
```

The allowlist validator is the trust boundary. Update UI, client types, server allowlists, byte caps,
and Node tests together. Do not log raw application/report bodies. Intake never changes contract
state.

Wallet write path:

```text
connected Freighter controller → exact statement/canonical detail hash
                              → contract simulation → wallet signature
                              → submitted transaction → final confirmation
```

`src/lib/write.ts` and the `/manage` route implement holder affiliation, mandate, and withdrawal
flows. Preserve exact controller/network matching, active-badge rules, safe handling of unpublished
holder indexes, transaction review, and final confirmation. This is an expert/testnet Freighter
path; issuer/arbiter, passkey, sponsorship, and production recovery workflows are not implemented.

When adding routes, keep the generic `:handle` route after every static/prefixed route. Smoke-test
direct navigation and refresh through the production SPA rewrite.

## Common tasks

| Task | Start here |
|---|---|
| Point the app at a different registry | `FE/.env.example`; rebuild after `VITE_*` changes |
| Refresh live bindings | `FE/scripts/generate-bindings.mjs`, after deploy/upgrade finality |
| Change application/report schema | `FE/src/lib/intake.ts`, `FE/server/intake-validation.ts`, tests |
| Add holder transaction UX | `FE/src/lib/write.ts`, then route/page with statement review |
| Add indexer support | contract events, then [Deployment](deployment.md#rpc-indexing-and-monitoring) |
| Operate TTL | `SC/scripts/keepalive.sh`, then [Deployment](deployment.md#ttl-and-archival-operations) |
| Report a security issue | private process in [`SECURITY.md`](../SECURITY.md) |

## Troubleshooting

| Symptom | Check |
|---|---|
| Method missing/type mismatch | Deployed spec and generated binding likely differ; do not patch around it |
| Records missing | contract id, RPC, passphrase, archived state, public-display filtering, index cap |
| Wallet refuses/signs wrong network | Freighter address/network against all three configured network values |
| Simulation passed but UI has no change | confirm transaction was signed, submitted, final, and then refresh |
| Intake reports unavailable | server-only webhook configuration and downstream HTTPS acceptance |
| Deep link 404 | preserve host SPA fallback and test the real deployment |
| Quiet record archives | simulated reads do not persist TTL; inspect submitted keeper runs/restore |
| Credential hash mismatch | exact raw bytes vs canonical JSON; hash match is not proof-suite validation |

Local success is not a launch criterion. Follow [Roadmap](roadmap.md) and
[Deployment](deployment.md#mainnet-gates).
