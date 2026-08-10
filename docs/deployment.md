# Deployment and operations

DoubleCheck currently has three deployable/runtime boundaries:

| Component | Runtime | Data |
|---|---|---|
| Soroban registry | Stellar network | public trust decisions and events |
| Vite application | CDN/static assets | browser verifier and wallet UI |
| `/api/intake` | Vercel Node function | validates and forwards private applications/reports |

The private webhook/review system is an external operational dependency, not implemented here. A
future indexer/API is also separate and will require a continuously running host.

## Current environments

| Resource | Current state |
|---|---|
| Hosted site | <https://doublecheck-lime.vercel.app> |
| Public testnet contract | vNext at `CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP` |
| Public testnet Wasm hash | `1ab20ff8c30b0f704b64dee4aed5d1dd111e5b24e33fb612ef9309aef5dc895a` |
| Upgrade transaction | [`b0aaf6f…`](https://stellar.expert/explorer/testnet/tx/b0aaf6f31e942e619b393505f90f15d57c73404e2707bf688b5d3f56758b7940) |
| Demo state | 5 entities and 8 claims preserved across upgrade |
| Repository contract | vNext source; 59 tests; optimized Wasm 60,131 bytes |
| Generated frontend binding | regenerated from live vNext testnet specification |

The existing address was upgraded in place on 10 August 2026. Post-upgrade smoke reads preserved all
five entities, both counters, admin and arbiter; an uncached ABI read exposed the new onboarding,
recovery, keepalive, and strict authorisation functions. This proves deployment compatibility, not
production verification quality or audit completion.

## Frontend and intake deployment

### Build

Set the Vercel project root to `FE`.

```bash
cd FE
npm ci
npm test
npm run lint
npm run build
```

Vite emits `dist/`. Browser routes are handled by React Router and the fallback in
[`FE/vercel.json`](../FE/vercel.json). Vercel resolves `/api/intake` as a function; verify that the
catch-all SPA rewrite does not shadow it in every preview/production deployment.

### Environment variables

Public values are compiled into the browser bundle:

| Variable | Purpose |
|---|---|
| `VITE_CONTRACT_ID` | exact deployed registry address |
| `VITE_RPC_URL` | Stellar RPC used for browser simulations |
| `VITE_NETWORK_PASSPHRASE` | network expected by reads and wallet writes |

Changing a `VITE_*` value requires a rebuild. These are public configuration, not secrets.

Private values exist only in the Vercel function environment:

| Variable | Required | Purpose |
|---|---|---|
| `INTAKE_WEBHOOK_URL` | for live intake | credential-free HTTPS review destination |
| `INTAKE_WEBHOOK_BEARER_TOKEN` | optional | bearer authentication to that webhook |

Never prefix a webhook URL or token with `VITE_`; doing so exposes it in browser JavaScript. Configure
the variables separately for preview and production as appropriate. Without `INTAKE_WEBHOOK_URL`,
the endpoint intentionally returns `503` and says nothing was sent.

### Intake contract

`POST /api/intake` accepts only JSON, caps the encoded body at 16 KiB, rejects unknown/invalid
fields, and checks a honeypot. It forwards a sanitised envelope containing a random reference,
receipt timestamp, source, the server-controlled consent-policy version, and the validated
submission. Redirects are rejected and the downstream call times out after eight seconds.

- `202`: downstream webhook accepted; show the returned `APP-…` or `RPT-…` reference.
- `400`/`413`/`415`/`422`: malformed, too large, wrong media type, or invalid submission.
- `503`: webhook missing/invalid; no delivery occurred.
- `502`: webhook rejected or could not be reached; no confirmation was recorded.

The function is an intake bridge, not durable storage. Production must define webhook
authentication, replay/idempotency handling, rate limiting/abuse protection, encrypted evidence
storage, access logs, retention/deletion, reviewer ownership, escalation, and appeals. Log references
and failure metadata, not sensitive payloads.

### Routes and cache checks

Smoke-test direct navigation and refresh for at least:

- `/apply`, `/verify`, `/me`, `/org/1`, `/tx/1`, and a valid `/<handle>`;
- `/badge/<handle>` both directly and inside a cross-site iframe; and
- `POST /api/intake` with configured, unconfigured, invalid, oversized, and honeypot payloads.

The live iframe response is marked `no-store`, discloses the vNext testnet demo, and re-reads the
registry. Hashed `/assets/*` files use immutable caching. HTML/Markdown share snippets are neutral
links rather than static "verified" assertions. Normal routes send same-origin frame protection;
only `/badge/*` deliberately permits cross-site framing, so smoke-test both the embed and the
clickjacking boundary.

Deploy through a connected Git integration or, from `FE/`, with the Vercel CLI:

```bash
cd FE
npx vercel --prod
```

After deployment, inspect the built environment and network calls rather than assuming the project
dashboard points to the intended contract/network.

## Contract release

### Build an immutable candidate

```bash
cd SC
cargo test
cargo clippy --all-targets
stellar contract build --optimize
shasum -a 256 target/wasm32v1-none/release/doublecheck_registry.wasm
```

Record the commit, toolchain versions, test output, byte size, Wasm hash, network, contract id, admin,
and arbiter in release evidence. Do not use an unreviewed local artifact.

### Choose upgrade or clean deployment

An in-place `upgrade(new_wasm_hash)` preserves the contract address and legacy data. vNext adds
persistent keys and changes the public specification, so first rehearse the exact upgrade against
representative testnet state. Check all entities, claims, controller/handle uniqueness, effective
statuses, mandate decisions, indexes, events, admin/arbiter/paused values, and keepalive cursors.

A clean deployment avoids legacy-state compatibility risk but creates a new address. Re-seeding or
migration must preserve provenance honestly; do not manufacture historical signatures. Existing
links, QR codes, and embeds must be redirected/reissued.

For a clean testnet deployment:

```bash
stellar network use testnet
stellar keys generate dc-admin --network testnet --fund
stellar keys generate dc-arbiter --network testnet --fund
cd SC
stellar contract build --optimize
stellar contract deploy \
  --wasm target/wasm32v1-none/release/doublecheck_registry.wasm \
  --source dc-admin --network testnet -- \
  --admin <admin-address> --arbiter <arbiter-address>
```

Mainnet must use production custody and funded accounts; CLI demo identities are not an acceptable
admin design.

### Regenerate binding after finality

Even an in-place upgrade requires new bindings when the interface changes. Wait for the deployed
contract to be final, then generate from that live specification:

```bash
cd FE
CONTRACT_ID=<vnext-contract-id> STELLAR_NETWORK=testnet npm run bindings
npm test
npm run lint
npm run build
```

Review the generated diff and confirm it contains vNext functions such as `propose_entity`,
`accept_entity`, controller-rotation consent, and `keepalive`. Set all three `VITE_*` network values
to the same environment. A source-generated type assumption is not evidence that the deployed Wasm
has the same ABI.

### Release smoke tests

On the target network, verify at minimum:

1. a proposal does not create a badge and only its controller can accept;
2. proposal/badge/mandate upper time bounds reject invalid dates;
3. a natural-person proposal rejects public descriptors;
4. metadata replacement rejects the subject and later global admin, and accepts the badge's stored
   issuer even after admin handover;
5. a self-asserted mandate is shown but never authorises;
6. linked mandate validity follows publication consent, relationship state, and both badges;
7. terminal states and arbiter/issuer suspension ownership hold;
8. a signed keepalive transaction advances cursors and commits TTL changes; and
9. confirmed-pair capacity fails closed without evicting a live mandate; and
10. verifier, live iframe, explorer, and wallet network checks read the released address.

Do not label the release production-ready until independent audit findings and operational controls
are resolved.

## TTL and archival operations

Business expiry and storage TTL are independent. Time-derived status stops verifying without a
transaction. Storage survival requires a transaction.

Simulation-only reads may execute extension code during simulation, but their ledger changes are
discarded. Public traffic does not persist TTL. Run `keepalive` from a dedicated funded source on a
monitored schedule. It requires no registry role and accepts `limit` from 1 through 50.

```bash
cd SC
STELLAR_CONTRACT_ID=<vnext-contract-id> \
STELLAR_KEEPER_IDENTITY=<funded-cli-identity> \
STELLAR_NETWORK=testnet \
./scripts/keepalive.sh
```

Operational requirements:

- repeatedly submit from returned cursors until `done = true`;
- retain run time, final ledger, cursors, records touched, transaction hashes, and fee balance;
- retry transient RPC/sequence failures safely and alert before the TTL threshold;
- keep the keeper key separate from admin/arbiter keys; and
- use a restore-footprint transaction for data already archived, then resume keepalive.

A dry-run or simulated invocation is not maintenance. Confirm final transaction status on-chain.

## RPC, indexing, and monitoring

The current frontend walks entity and claim counters and makes simulated reads from the browser. This
is acceptable only for a small demo. Before meaningful traffic:

- contract with a production RPC provider and monitor latency, errors, limits, and network identity;
- consume all registry events into a resumable indexer with reorg/finality handling;
- expose a least-data public API and reconcile indexed state against the chain;
- alert on admin/arbiter/controller changes, pause, upgrades, revocations, intake failures, keeper
  failure, archive risk, and abnormal submission volume; and
- retain an emergency runbook that does not prevent withdrawals or takedowns.

Vercel request functions are not an appropriate continuously polling indexer runtime. Use a durable
worker/VM and database.

## Mainnet gates

- independent contract/frontend security audit and upgrade rehearsal;
- multisig/HSM or equivalent admin custody, separation of arbiter and keeper, and recovery drills;
- implemented KYC/KYB operations, evidence security, reviewer permissions, policies, and appeals;
- privacy/legal review of public handles/hashes/free text and off-chain retention/erasure;
- a real credential proof-suite/selective-disclosure decision;
- indexer/API, production RPC, monitoring, backups, and signed keepalive/restore ownership;
- complete controller/issuer transaction UX or a documented controlled operating process; and
- incident response, disclosure contacts, release rollback/forward-fix plan, and audit sign-off.

See [`roadmap.md`](roadmap.md) and [`SECURITY.md`](../SECURITY.md).
