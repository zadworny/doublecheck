# Repository guide

DoubleCheck is a small monorepo with two deployable components and a flat documentation set. The
top-level split is intentional: the contract and the explorer have different toolchains, release
cycles, and runtime environments, while the documentation explains the boundary between them.

## Top-level map

| Path | Purpose | Notes |
|---|---|---|
| [`SC/`](../SC/) | Soroban registry contract, written in Rust | The ledger source of truth; builds to Wasm and is deployed to Stellar. |
| [`FE/`](../FE/) | Public React + Vite verifier | A static, read-only browser application; it talks directly to Stellar RPC. |
| [`docs/`](./) | Project, technical, operational, and product documentation | Kept flat for easy GitHub and GitBook browsing. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | Pull-request and `main` checks | Independently validates the contract and explorer. |
| [`README.md`](../README.md) | Short project introduction | The best entry point for a new reader. |
| [`SUMMARY.md`](../SUMMARY.md) | GitBook navigation | Keep it in sync when adding a permanent document. |
| [`SECURITY.md`](../SECURITY.md) | Vulnerability reporting and scope | Read before creating a public security issue. |

## Contract source map

The contract lives at `SC/contracts/doublecheck-registry/`.

| Path | Responsibility |
|---|---|
| `src/lib.rs` | Public contract entry points, authorisation checks, state transitions, and derived-status reads. |
| `src/types.rs` | Soroban contract types, enums, storage keys, field limits, and error codes. |
| `src/storage.rs` | Persistent and instance storage access, indexes, and time-to-live bookkeeping. |
| `src/events.rs` | Event definitions consumed by a future indexer. |
| `src/test.rs` | Behavioural and regression tests for the registry's trust rules. |
| `test_snapshots/` | Checked-in event snapshots asserted by the Soroban test suite. |

The workspace manifest is `SC/Cargo.toml`; the pinned Rust channel and Wasm target are in
`SC/rust-toolchain.toml`. Generated build output belongs under `SC/target/` and is ignored.

## Explorer source map

The explorer lives at `FE/` and is a single-page application.

| Path | Responsibility |
|---|---|
| `src/App.tsx` | Route table and top-level providers. |
| `src/pages/` | Route-level views: home, records, claims, search, current wallet record, and 404. |
| `src/components/` | Reusable visual and interaction components. |
| `src/data/registry.ts` | Converts contract records to the UI's models and loads the registry snapshot. |
| `src/data/RegistryContext.tsx` | Makes that snapshot and its lookups available to pages. |
| `src/contract/registry.ts` | Generated TypeScript client for the deployed contract; never edit it by hand. |
| `src/lib/chain.ts` | Browser-side RPC client, public network configuration, and timestamp helpers. |
| `src/context/` | Theme, toast, and wallet presentation state. |
| `scripts/generate-bindings.mjs` | Repeatable binding generation plus project-specific TypeScript compatibility patches. |
| `vercel.json` | SPA fallback and asset caching for Vercel. |

`FE/.env.example` documents optional browser-safe runtime configuration. Do not add secrets to it or
to `VITE_*` variables: Vite exposes those values in the built client bundle.

## Boundaries that should stay explicit

| Concern | Owner | Reason |
|---|---|---|
| Validity, authorisation, confirmation tier, and lifecycle | Contract | These are the trust assertions a reader must be able to verify independently. |
| Record discovery and display models | Explorer data layer | Keeps generated SDK types out of page components and allows an indexer to replace the MVP loader. |
| Verification evidence, complaint intake, billing, and search infrastructure | Off-chain systems | These need privacy, moderation, or flexible querying; only their reviewed outcomes belong on-chain. |
| Long-lived architectural and operational explanations | `docs/` | Makes critical choices discoverable without duplicating source code. |

The detailed rationale for this division is in [Architecture](architecture.md#the-on-chain-boundary).

## Generated, local, and ignored files

| Kind | Examples | Handling |
|---|---|---|
| Generated and committed | `FE/src/contract/registry.ts`, `SC/test_snapshots/` | Regenerate through the documented tool or test workflow; review the diff as source-derived output. |
| Generated and ignored | `SC/target/`, `FE/dist/`, `FE/node_modules/` | Never commit. Recreate locally or in CI. |
| Local configuration | `FE/.env`, `.stellar/`, `.vercel/` | Never commit; these can contain deployment-specific details or credentials. |
| Public examples | `FE/.env.example` | Keep accurate, safe to expose, and aligned with browser defaults. |

The root `.gitignore` also excludes loose root PDFs to prevent accidental inclusion of source
materials in this public repository. Project documentation belongs in `docs/`.

## Documentation conventions

Keep documentation in the flat `docs/` directory. Use uppercase filenames for new enduring project
guides (for example, `DEVELOPMENT.md`) and concise lowercase names for established topic pages that
already follow that convention (for example, `architecture.md`). Do not rename existing documents
solely for casing consistency; stable links are more valuable.

When adding a document:

1. Link it from [`docs/README.md`](README.md).
2. Add it to [`SUMMARY.md`](../SUMMARY.md) when it belongs in GitBook navigation.
3. Prefer source-relative links that work in GitHub and GitBook.
4. Mark changing network details, production claims, and future work clearly; do not turn testnet
   examples into production assurances.

## Release and review model

The contract and explorer are reviewed and built independently in CI. A push to `main` runs Rust
formatting, Clippy, tests, a Wasm build and size check for `SC/`, plus oxlint and the production
TypeScript/Vite build for `FE/`. See [Development](DEVELOPMENT.md#checks-before-a-pull-request) for
the exact commands.

Publishing the static explorer and deploying/upgrading the contract are separate operational actions
from merging code. Follow [Deployment](deployment.md) and the mainnet prerequisites in
[Roadmap](roadmap.md) before treating a merge as a production release.
