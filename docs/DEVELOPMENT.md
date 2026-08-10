# Development guide

This guide is for contributors working on the registry, the explorer, or both. It complements the
component-level instructions in [`SC/README.md`](../SC/README.md) and
[`FE/README.md`](../FE/README.md); those documents remain the authoritative contract interface and
explorer behaviour references.

## Prerequisites

| Area | Required tools | Declared in |
|---|---|---|
| Contract | Rust stable with the `wasm32v1-none` target | [`SC/rust-toolchain.toml`](../SC/rust-toolchain.toml) |
| Contract tooling and deployments | Stellar CLI | [Smart-contract README](../SC/README.md#build-and-test) |
| Explorer | A current Node.js LTS release and npm | [`FE/package.json`](../FE/package.json) |

The frontend uses a public Stellar testnet RPC endpoint by default. No secret is required for local
read-only work. Values prefixed with `VITE_` are bundled into the browser, so they must be safe to
publish; configuration and defaults are shown in [`FE/.env.example`](../FE/.env.example).

## First local run

Clone the repository, then install and verify each independent component from its own directory.

```bash
# Explorer
cd FE
npm ci
npm run dev

# Contract (in a second terminal, from the repository root)
cd SC
cargo test
```

The explorer points at the deployed testnet registry unless a local `FE/.env` overrides its contract
id, RPC URL, or network passphrase. See the [Explorer README](../FE/README.md#running-it) before
targeting another deployment.

## Checks before a pull request

Run the checks that apply to the files you changed. Continuous integration runs all of the following
on pull requests and pushes to `main`.

| Area | Command | What it verifies |
|---|---|---|
| Explorer lint | `cd FE && npm run lint` | Static analysis with oxlint. |
| Explorer build | `cd FE && npm run build` | TypeScript project build and Vite production bundle. |
| Contract formatting | `cd SC && cargo fmt --all --check` | Rust formatting. |
| Contract lint | `cd SC && cargo clippy --all-targets -- -D warnings` | Lint-clean contract and tests. |
| Contract tests | `cd SC && cargo test` | Authorisation, status, lifecycle, and storage behaviour. |
| Contract Wasm | `cd SC && cargo build --target wasm32v1-none --release` | Deployable Wasm build; CI also enforces Stellar's 128 KB size limit. |

For a documentation-only change, verify the Markdown links you touch and check the rendered files
in GitHub or GitBook; source builds are not required solely because prose changed.

## Making a contract change

The contract is the source of truth. Treat an interface or data-model change as a change across the
following boundary:

```text
Rust types and entry points
        ↓
contract tests and emitted events
        ↓
generated TypeScript bindings
        ↓
chain-to-UI mapping and pages
        ↓
contract/explorer/documentation updates
```

1. Change the contract in `SC/contracts/doublecheck-registry/src/`. Keep the authorisation path and
   effective-status rules explicit; add or update a regression test in `test.rs` for every behaviour
   change.
2. Run the contract checks above. If the public interface changes, build or deploy the intended
   contract version before regenerating bindings.
3. Regenerate the explorer client from `FE/`:

   ```bash
   npm run bindings
   # A different deployment/network:
   CONTRACT_ID=C… STELLAR_NETWORK=testnet npm run bindings
   ```

   `FE/src/contract/registry.ts` is generated. Do not hand-edit it: update
   `FE/scripts/generate-bindings.mjs` when generation needs a durable compatibility fix.
4. Update `FE/src/data/registry.ts` first if a contract type changes. It is the intentional boundary
   between generated Soroban types and the UI's display-friendly data shapes. Then adapt affected
   pages and components.
5. Update the contract README for public entry points, [Architecture](architecture.md) for a design
   or policy change, and [Deployment](deployment.md) when deployment or operations change.

An in-place `upgrade()` preserves the contract address. A redeployment to a new address requires
both regenerated bindings and a deliberate explorer configuration change; existing share links
should continue to resolve only when the contract address is preserved.

## Making an explorer change

The explorer is a read-only, static React application. Its data path is deliberately narrow:

```text
generated contract client → src/lib/chain.ts → src/data/registry.ts
                         → RegistryContext → route pages → UI components
```

- Keep direct contract calls in `src/data/` and `src/lib/chain.ts`; pages should consume the
  synchronous snapshot exposed by `RegistryContext`.
- Add a route in `src/App.tsx`. The generic `:handle` route must remain after all static and
  prefixed routes, otherwise it captures them.
- A direct visit to any route must work after deployment. Preserve the SPA fallback in
  [`FE/vercel.json`](../FE/vercel.json) when changing hosting configuration.
- Treat the status derived by the contract as authoritative. The UI mirrors expiry calculations for
  efficient rendering, so update its mapping when the Rust rule changes.

See the [Explorer README](../FE/README.md#how-data-reaches-the-page) for the current record mapping
and the [Deployment guide](deployment.md#client-side-routing) for the deep-link requirement.

## Common maintenance tasks

| Task | Where to start |
|---|---|
| Point a local explorer at another registry | `FE/.env.example`, then `FE/.env` (untracked) |
| Refresh generated bindings | `FE/scripts/generate-bindings.mjs` and `npm run bindings` |
| Add a contract event for an indexer | `SC/contracts/doublecheck-registry/src/events.rs`, then [Deployment](deployment.md#deferred-the-indexer) |
| Add a durable project document | [Documentation index](README.md#keeping-this-documentation-useful) and root `SUMMARY.md` |
| Report a potential security issue | [Security policy](../SECURITY.md) — use private reporting |

## Troubleshooting

| Symptom | Likely cause and next check |
|---|---|
| Explorer loads but records are missing | Confirm the `VITE_CONTRACT_ID`, RPC URL, and network passphrase match the deployment; rebuild after editing `VITE_*` values. |
| A production deep link returns 404 | The static host is missing an SPA rewrite. For Vercel, preserve `FE/vercel.json`. |
| Generated bindings do not compile | Regenerate with the project script rather than editing the generated file; its compatibility patches are intentional. |
| Contract build misses the Wasm target | Run `rustup target add wasm32v1-none`, then retry from `SC/`. |
| A record should have expired but still appears active | Check the contract's effective-status function and the frontend mapping; expiry is derived at read time, not written by a background job. |

For production-readiness concerns — audit, key custody, personal data, RPC capacity, and archival —
follow the [Roadmap](roadmap.md) and [Deployment](deployment.md) rather than treating local success
as a launch criterion.
