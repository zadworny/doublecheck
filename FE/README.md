# DoubleCheck explorer

The public verifier: a React and Vite application that reads the registry contract on Stellar and
renders organisations, people, relationships and mandates.

There is no backend. Every record on screen comes from a *simulated* contract read issued directly
from the browser — no transaction, no signature, no fee, and nothing for the reader to install. The
product depends on that property: someone checking a counterparty cannot be asked to obtain a wallet
first.

## Running it

```bash
npm install
npm run dev
```

No configuration is required; the deployed testnet contract id is compiled into the generated
bindings. To target a different deployment, copy `.env.example` to `.env`:

| Variable | Default |
|---|---|
| `VITE_CONTRACT_ID` | the testnet deployment |
| `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

Vite inlines `VITE_*` variables at build time, so changing one has no effect until the next build.

```bash
npm run build     # tsc -b && vite build  ->  dist/
npm run preview
npm run lint
npm run bindings  # regenerate the contract client
```

Hosting is covered in [`docs/deployment.md`](../docs/deployment.md).

## How data reaches the page

```
src/contract/registry.ts      generated from the deployed contract — not hand-edited
src/lib/chain.ts              client construction, RPC config, bigint and timestamp helpers
src/data/registry.ts          contract records -> the shapes the UI renders
src/data/RegistryContext.tsx  loads once, exposes synchronous lookups to the pages
```

Soroban offers no query language: a key can be read, but the storage cannot be enumerated. The
contract assigns sequential ids and exposes `entity_count` and `claim_count`, so a full snapshot is a
walk from 1 to N — roughly a dozen reads at present size. `RegistryProvider` performs that walk once
on mount and hands the pages a plain in-memory snapshot, which is why every page below it remains
synchronous and the application has exactly one loading state.

This does not scale, by design. Beyond a few hundred records it should be replaced by an indexer
following the contract's events (`EntityRegistered`, `RelationshipAttested`, `MandateIssued`,
`ClaimStatusSet`, …). Nothing above `src/data/` would need to change.

### Record mapping

| Contract | UI |
|---|---|
| `Entity` with `kind: Organisation` | `Organisation` |
| `Entity` with `kind: Person` | `Person` |
| `Relationship`, `Mandate` | same, as a `Claim` union |
| `RelationshipType`, `MandateType` | identical string unions |
| `ClaimStatus` (numeric enum) | string union, with `Expired` derived |
| `u64` ids | decimal strings, used directly as route segments |
| `issuer: Address` | rendered as the signing key, not a name |
| `confirmation` | the "Self-asserted" / "Confirmed by the organisation" label |
| `bigint` Unix seconds | ISO strings for the date formatters |

### Two values are computed here rather than fetched

**Expiry.** The contract derives `Expired` at read time from a record's end date rather than storing
it. The same rule is reimplemented in `src/data/registry.ts` so a page render does not cost an extra
round trip per record. The contract remains authoritative — if that rule changes in `lib.rs`, it must
change here too.

**Status history.** The contract emits an event on every change but stores no timeline, so the status
history panel shows only what a record itself proves. An indexer would populate it properly.

## Regenerating the bindings

After redeploying the contract to a new address, or changing its interface:

```bash
npm run bindings
CONTRACT_ID=C… STELLAR_NETWORK=mainnet npm run bindings
```

`scripts/generate-bindings.mjs` runs the Stellar CLI and patches the places where the official output
does not satisfy this project's TypeScript configuration. Those patches live in the script, so they
survive regeneration; the comment at its head explains each one.

An in-place `upgrade()` keeps the same contract address, so regeneration is only needed when the
interface itself changes.

## Not implemented

The application is read-only.

**Report** opens a modal that submits nowhere. Complaints belong in an off-chain review queue, and
only the *outcome* of that review is ever written on-chain, via `add_strike` or `set_entity_status`.
See [the on-chain boundary](../docs/architecture.md#the-on-chain-boundary).

**Writing claims** — registering entities, attesting relationships, issuing mandates — is done with
the Stellar CLI; see [`SC/README.md`](../SC/README.md).

**Person records display a handle rather than a name**, because natural persons are registered with
an empty `display_name`. The name is served from the off-chain credential at `metadata_uri` so that it
remains erasable, and the on-chain `metadata_hash` proves which version was served. See
[Personal data](../docs/architecture.md#personal-data).
