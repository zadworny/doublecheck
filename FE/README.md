# DoubleCheck explorer

The public verifier: a React + Vite app that reads the registry contract on Stellar and renders
organisations, people, relationships and mandates.

There is no backend. Every piece of data on screen comes from a *simulated* contract read made
straight from the browser — no transaction, no signature, no fee, and nothing for the reader to
install. That is the property the whole product depends on: a candidate checking a recruiter must
never be asked to get a wallet.

## Run it

```bash
npm install
npm run dev
```

It works with no configuration — the deployed testnet contract id is baked into the generated
bindings. To point it somewhere else, copy `.env.example` to `.env` and edit:

| Variable | Default |
|---|---|
| `VITE_CONTRACT_ID` | the testnet deployment |
| `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

```bash
npm run build     # tsc -b && vite build  ->  dist/
npm run preview
npm run lint
```

## How the data gets here

```
src/contract/registry.ts   generated from the deployed contract — do not hand-edit
src/lib/chain.ts           client construction, RPC config, bigint/timestamp helpers
src/data/registry.ts       contract records  ->  the shapes the UI renders
src/data/RegistryContext.tsx  loads once, exposes synchronous lookups to the pages
```

Soroban has no query language: you can read a key, but you cannot ask for "every entity". The
contract assigns sequential ids and exposes `entity_count` / `claim_count`, so a full snapshot is a
walk from 1 to N — about a dozen reads at current size. `RegistryProvider` does that walk once on
mount and hands the pages a plain in-memory snapshot, which is why every page below it stays
synchronous and there is exactly one loading state in the app.

**This deliberately does not scale.** Past a few hundred records it should be replaced by an indexer
following the contract's events (`EntityRegistered`, `RelationshipAttested`, `MandateIssued`,
`ClaimStatusSet`, …), which exist for that purpose. Nothing above `src/data/` would have to change.

### Two things are computed here rather than fetched

Expiry. The contract derives `Expired` at read time from a record's end date rather than storing it,
and the same three-line rule is reimplemented in `src/data/registry.ts` so a page does not cost an
extra round trip per record. The contract is the authority — if that rule changes in `lib.rs`, it
must change here too.

Status history. The contract emits an event on every change but does not store a timeline, so the
"Status history" panel shows only what the record itself proves. An indexer would fill this in
properly.

## Regenerating the bindings

After changing and redeploying the contract:

```bash
npm run bindings                                    # uses the default testnet contract
CONTRACT_ID=C... STELLAR_NETWORK=mainnet npm run bindings
```

`scripts/generate-bindings.mjs` runs the Stellar CLI and patches the three places where the official
output does not satisfy this project's tsconfig. Those patches are in the script, so they survive
regeneration — see the comment at the top of it for what and why.

## What is not wired up

The app is read-only. **Report** opens a modal and goes nowhere: reports belong in an off-chain
review queue, and only the *outcome* of that review is ever written on-chain (`add_strike`,
`set_entity_status`). Writing claims — registering entities, attesting, issuing mandates — is done
with the Stellar CLI today; see [`../SC/README.md`](../SC/README.md).

Person records show a handle rather than a name because natural persons are registered with an empty
`display_name` on purpose. The name lives in the off-chain credential at `metadata_uri` so it can be
erased; the on-chain `metadata_hash` proves which version you were served. See §5 of the
[design report](../docs/design-report.md).
