# Deploying DoubleCheck

Two independent deployments. The contract goes to Stellar; the explorer goes to any static host.
Neither knows about the other's deployment process, and the explorer can be redeployed freely
without touching the chain.

- **Contract** — [`SC/README.md`](../SC/README.md) has the full walkthrough. Summarised in §3 below.
- **Explorer** — this document, §1 and §2.

---

## 1. Why the explorer is a static site

Worth stating plainly, because it determines the whole hosting question: **there is no backend.**

Every record on screen comes from a *simulated* contract read made directly from the reader's
browser to a Stellar RPC endpoint. Simulation is not a transaction — nothing is signed, submitted,
or charged, and the reader needs no wallet and no account. So the deployed artefact is a folder of
static files: HTML, JS, CSS.

That means:

- No serverless functions, no API routes, no cold starts, no compute bill.
- No secrets. Everything in `.env` is a public contract id and a public RPC URL; they are compiled
  into the bundle and that is fine.
- Any static host works — Vercel, Cloudflare Pages, Netlify, S3, GitHub Pages. The choice is about
  convenience, not capability.
- RPC traffic goes browser → Stellar, never through the host. Hosting costs do not scale with
  readers; RPC rate limits do. See §4.

## 2. Vercel

### What you need before starting

| | |
|---|---|
| A Vercel account | free Hobby tier is enough |
| The GitHub repo connected | `zadworny/doublecheck` |
| **Root Directory set to `FE`** | the app is not at the repo root — this is the step people miss |

Nothing else. No environment variables are required: the testnet contract id is baked into the
generated bindings, so a fresh clone deploys and works.

### Dashboard (recommended)

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

Same result, useful if you would rather not click through a dashboard.

```bash
npm i -g vercel
cd FE
vercel login          # opens a browser
vercel link           # creates .vercel/, already gitignored
vercel --prod
```

`vercel link` asks for the root directory — answer `./` because you are already inside `FE`. In CI,
replace `vercel login` with `VERCEL_TOKEN=…` from
[vercel.com/account/tokens](https://vercel.com/account/tokens).

### The one piece of config that matters

[`FE/vercel.json`](../FE/vercel.json) rewrites every path to `index.html`:

```json
{ "rewrites": [{ "source": "/:path*", "destination": "/index.html" }] }
```

React Router owns routes like `/org/1` and `/tx/7`, but those paths do not exist as files. Without
the rewrite the site works when you navigate inside it and 404s the moment anyone opens a link
directly or hits refresh — which is exactly what a shared verification link is. It works in `npm run
dev` either way, so this is easy to ship broken.

The same file sets a one-year immutable cache on `/assets/*`, which is safe because Vite fingerprints
those filenames.

### Custom domain

Vercel project → **Settings → Domains** → add e.g. `verify.jobited.com`, then add the CNAME it gives
you at your DNS provider. Certificates are automatic.

Note that the domain is also the trust surface: the whole product is someone checking a link they
were sent. Whatever domain you choose is the thing people will be taught to look for, so it is worth
picking once and keeping.

### Other hosts

Nothing here is Vercel-specific. Cloudflare Pages and Netlify need the same two settings — build
directory `FE`, output `dist` — plus their own spelling of the SPA fallback (`_redirects` containing
`/* /index.html 200` for both). Pick on preference.

## 3. Contract

Full walkthrough in [`SC/README.md`](../SC/README.md). In short:

```bash
cd SC
cargo test
stellar contract build --optimize
stellar contract deploy \
  --wasm target/wasm32v1-none/release/verified_recruiter_badge.optimized.wasm \
  --source jobited-admin --network testnet \
  -- --admin "$(stellar keys address jobited-admin)" \
     --arbiter "$(stellar keys address jobited-arbiter)"
```

Mainnet is the same commands with `--network mainnet` and funded keys. Before that happens, read
§9 and §10 of the [design report](design-report.md) — there are decisions to make about key custody
and personal data that are much cheaper to make before the first badge is issued than after.

**After redeploying to a new address**, regenerate the frontend's bindings so it reads the new
contract:

```bash
cd FE
CONTRACT_ID=C… STELLAR_NETWORK=testnet npm run bindings
```

An `upgrade()` in place keeps the same address, so badge links and QR codes already in circulation
survive and no regeneration is needed unless the interface changed.

## 4. What to watch after it is live

**RPC rate limits, not hosting.** `https://soroban-testnet.stellar.org` is a free public endpoint
with no uptime guarantee. Each page load currently makes roughly `entity_count + 2 × claim_count`
simulated reads — about a dozen today, growing linearly with the registry. Two things follow:

- For anything beyond a demo, move to a paid RPC provider and set `VITE_RPC_URL`. The RPC endpoint,
  not the web host, is the thing that falls over first.
- The linear read pattern is the real fix. It is why the indexer in §5 exists.

**Ledger archival.** Soroban charges rent and archives entries nobody touches for ~120 days. Reads
extend what they touch, so anything being checked stays live for free — but a registry that goes
quiet needs either a periodic sweep or a restore path. §7 of the design report covers both options.

## 5. Not deployed yet: the indexer

Deferred deliberately, and the next infrastructure decision after this one.

The explorer currently reconstructs the whole registry by walking ids 1..N on every page load. That
is honest at MVP scale and wrong at any real scale. The contract emits an event on every state
change — `EntityRegistered`, `EntityStatusSet`, `RelationshipAttested`, `MandateIssued`,
`ClaimStatusSet`, `StrikeAdded`, `ControllerRotated` — precisely so a follower process can maintain
a queryable mirror.

When it is built, note that **Vercel is the wrong host for it.** An indexer is a long-running process
that polls the network continuously; Vercel functions are short-lived and request-triggered. Railway,
Fly.io, Render, or a small VM. The explorer would then read from the indexer's API instead of the
chain, and nothing above `FE/src/data/` would have to change — which is why the loading logic is
isolated there.
