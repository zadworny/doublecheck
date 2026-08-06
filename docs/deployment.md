# Deploying DoubleCheck

Two independent deployments. The contract goes to Stellar; the explorer goes to any static host.
Neither knows about the other's deployment process, and the explorer can be redeployed freely
without touching the chain.

- **Contract** — [`SC/README.md`](../SC/README.md) has the full walkthrough; summarised below.
- **Explorer** — covered here.

---

## Why the explorer is a static site

This determines the entire hosting question: **there is no backend.**

Every record on screen comes from a *simulated* contract read issued directly from the reader's
browser to a Stellar RPC endpoint. Simulation is not a transaction: nothing is signed, submitted or
charged, and the reader needs no wallet and no account. The deployed artefact is therefore a folder
of static files.

That means:

- No serverless functions, no API routes, no cold starts, no compute bill.
- No secrets. Everything in `.env` is a public contract id and a public RPC URL; they are compiled
  into the bundle and that is fine.
- Any static host is sufficient — Vercel, Cloudflare Pages, Netlify, S3, GitHub Pages. The choice is
  one of convenience, not capability.
- RPC traffic goes browser → Stellar, never through the host. Hosting cost does not scale with
  readership; RPC rate limits do.

## Hosting the explorer

### Current deployment

| | |
|---|---|
| Production | https://doublecheck-lime.vercel.app |
| Project | `jobiteds-projects/doublecheck` |
| Deployed from | the Vercel CLI, run inside `FE/` |

**Git is not connected yet, so pushes to `main` do not redeploy.** Connecting it needs the Vercel
GitHub App authorised against `zadworny/doublecheck`, which is a click-through on GitHub's side:

1. [Vercel project settings → Git](https://vercel.com/jobiteds-projects/doublecheck/settings/git) →
   **Connect Git Repository** → GitHub → `zadworny/doublecheck`. Approve the app when GitHub asks.
2. Then, in **Settings → Build & Deployment**, set **Root Directory** to `FE`. This is required and
   easy to miss: the CLI deploys were run from inside `FE`, so it was implicit, but a Git-triggered
   build starts at the repo root and will fail with "no package.json found" without it.

Until that is done, redeploy by hand:

```bash
cd FE && npx vercel --prod
```

### Requirements

A Vercel account (the free tier suffices), the GitHub repository connected, and **Root Directory set
to `FE`** — the application is not at the repository root, and this is the step most often missed.

No environment variables are required: the testnet contract id is compiled into the generated
bindings, so a fresh clone deploys and works.

### Via the dashboard

1. [vercel.com/new](https://vercel.com/new) → **Import Git Repository** → select `zadworny/doublecheck`.
   Authorise Vercel for the repo if prompted.
2. On the configure screen:
   - **Framework Preset** — Vite (auto-detected).
   - **Root Directory** — click *Edit* and set it to `FE`. **Do this before deploying.** Left at the
     repo root, the build fails with "no package.json found".
   - Build Command, Output Directory, Install Command — leave as detected
     (`npm run build`, `dist`, `npm install`).
3. **Environment Variables** — skip. Add them only to point at a different contract or network:

   | Name | Example |
   |---|---|
   | `VITE_CONTRACT_ID` | `C…` |
   | `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` |
   | `VITE_NETWORK_PASSPHRASE` | `Test SDF Network ; September 2015` |

   Set them for Production, Preview and Development, then redeploy — Vite inlines `VITE_*` at build
   time, so changing one does nothing until the next build.
4. **Deploy.** First build takes a minute or two.
5. Check the deployment: open the root, then open a deep link directly such as `/tx/7` or
   `/org/1`, and refresh it. Both must render rather than 404 — that is what
   [`FE/vercel.json`](../FE/vercel.json) is for.

Every push to `main` redeploys production; every pull request gets its own preview URL.

### CLI

Equivalent, and scriptable.

```bash
npm i -g vercel
cd FE
vercel login          # opens a browser
vercel link           # creates .vercel/, already gitignored
vercel --prod
```

`vercel link` prompts for the root directory; answer `./`, since the working directory is already
`FE`. In CI, replace `vercel login` with a `VERCEL_TOKEN` from
[vercel.com/account/tokens](https://vercel.com/account/tokens).

### Client-side routing

[`FE/vercel.json`](../FE/vercel.json) rewrites every path to `index.html`:

```json
{ "rewrites": [{ "source": "/:path*", "destination": "/index.html" }] }
```

React Router owns routes such as `/org/1` and `/tx/7`, and those paths do not exist as files.
Without the rewrite the site works during in-app navigation and returns 404 the moment a link is
opened directly or refreshed — which is precisely what a shared verification link is. The
development server handles this regardless, so the defect only appears in production.

The same file sets a one-year immutable cache on `/assets/*`, which is safe because Vite fingerprints
those filenames.

### Custom domain

Vercel project → **Settings → Domains**, add the domain, then create the CNAME record it supplies at
the DNS provider. Certificates are issued automatically.

The domain is also the trust surface. The product is someone checking a link they were sent, so
whichever domain is chosen becomes the thing readers are taught to recognise; it is worth choosing
once and keeping.

### Other hosts

None of this is Vercel-specific. Cloudflare Pages and Netlify require the same two settings — build
directory `FE`, output `dist` — plus their own form of the SPA fallback, a `_redirects` file
containing `/* /index.html 200` in both cases.

## Deploying the contract

Full walkthrough in [`SC/README.md`](../SC/README.md). In short:

```bash
cd SC
cargo test
stellar contract build --optimize
stellar contract deploy \
  --wasm target/wasm32v1-none/release/verified_recruiter_badge.optimized.wasm \
  --source dc-admin --network testnet \
  -- --admin   "$(stellar keys address dc-admin)" \
     --arbiter "$(stellar keys address dc-arbiter)"
```

Mainnet uses the same commands with `--network mainnet` and funded keys. Two things should be settled
first: administrative key custody, and whether natural persons' names are stored on-chain. Both are
substantially cheaper to decide before the first badge is issued than after — see
[Personal data](architecture.md#personal-data) and [Trust model](architecture.md#trust-model).

**After redeploying to a new address**, regenerate the frontend's bindings so it reads the new
contract:

```bash
cd FE
CONTRACT_ID=C… STELLAR_NETWORK=testnet npm run bindings
```

An in-place `upgrade()` keeps the same address, so badge links and QR codes already in circulation
continue to resolve, and regeneration is only needed if the interface changed.

## Operating it

**RPC capacity, not hosting.** `https://soroban-testnet.stellar.org` is a free public endpoint with
no uptime guarantee. Each page load issues roughly `entity_count + 2 × claim_count` simulated reads —
around a dozen at present, growing linearly with the registry. Two consequences:

- Beyond a demonstration, move to a paid RPC provider and set `VITE_RPC_URL`. The RPC endpoint, not
  the web host, is the first component to fail under load.
- The linear read pattern is the underlying problem, and the reason the indexer below exists.

**Ledger archival.** Soroban charges rent and archives entries untouched for roughly 120 days. Reads
extend the entries they touch, so anything actively being checked stays live at no cost — but a
quiet registry needs either a periodic sweep or a restore path. Both options are set out in
[Storage, rent and archival](architecture.md#storage-rent-and-archival).

## Deferred: the indexer

Deliberately deferred, and the next infrastructure decision after hosting.

The explorer reconstructs the registry by walking ids `1..N` on every page load — acceptable at MVP
scale and unworkable beyond it. The contract emits an event on every state change precisely so that a
follower process can maintain a queryable mirror.

**Vercel is the wrong host for it.** An indexer polls the network continuously, whereas Vercel
functions are short-lived and request-triggered; Railway, Fly.io, Render or a small VM are
appropriate. The explorer would then read from the indexer's API rather than the chain, and nothing
above `FE/src/data/` would change — which is why the loading logic is isolated there.
