# DoubleCheck frontend

The React/Vite application provides wallet-free public verification, a live embeddable badge,
manual-verification/report intake, and an expert Freighter holder dashboard for selected writes. A
Vercel Node function forwards private intake to a server-only webhook; intake is never written to
Stellar.

## Compatibility status

`src/contract/registry.ts` is generated from the current public testnet contract at
`CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP`. That address was upgraded to vNext on
10 August 2026; the checked-in binding was regenerated afterward from its live specification.

Frontend dependency checks explain contract decisions but do not replace them. Future contract
changes require another deploy, live-spec binding regeneration, rebuild, and read/write smoke test.

## Run and check

```bash
cd FE
npm install
npm run dev

npm test
npm run lint
npm run build
npm run preview
```

Plain `npm run dev` starts Vite only. Public reads work, but `/api/intake` requires `vercel dev` or a
deployed Vercel preview.

Public browser configuration:

| Variable | Default/purpose |
|---|---|
| `VITE_CONTRACT_ID` | vNext public testnet registry |
| `VITE_RPC_URL` | `https://soroban-testnet.stellar.org` |
| `VITE_NETWORK_PASSPHRASE` | Stellar testnet passphrase |

Vite compiles these into public JavaScript. Rebuild after changing them and keep all three on the
same network.

Server-only intake configuration:

| Variable | Purpose |
|---|---|
| `INTAKE_WEBHOOK_URL` | credential-free HTTPS destination for the private review system |
| `INTAKE_WEBHOOK_BEARER_TOKEN` | optional bearer credential sent by the function |

Never prefix the private variables with `VITE_`.

## Routes

| Path | Surface |
|---|---|
| `/<handle>` | canonical shareable public record |
| `/org/:id`, `/person/:id`, `/tx/:id` | public entity and claim detail |
| `/verify` | organisation/representative pair mandate verifier |
| `/badge/:handle` | compact, no-store live iframe target |
| `/search?q=` | public discovery |
| `/apply` | recruiter, agency, or hiring-company application |
| `/me` | connected controller's public record |
| `/manage` | expert/testnet Freighter holder claim dashboard |
| `/standard` | plain-language verification and privacy standard |

The generic `/:handle` route must remain last. Direct navigation/refresh depends on the SPA fallback
in `vercel.json`; verify that `/api/intake` still resolves to the function rather than the fallback.

## Public data path

```text
src/contract/registry.ts      generated deployed-ABI client; never hand-edit
src/lib/chain.ts              contract/network/RPC configuration and read helper
src/data/registry.ts          chain records → UI models, effective status, privacy filtering
src/data/RegistryContext.tsx  snapshot, lookups, 60-second/visibility refresh
```

The MVP walks `entity_count` and `claim_count` and fetches records into memory. It filters
relationships whose `public_display` is false before they enter public snapshots, direct claim
lookups, search, or feeds. This is intentionally small-scale; production needs an event indexer/API
with reconciliation and pagination.

Expiry is evaluated from the contract's ledger timestamp rather than the visitor's device clock. The
contract remains authoritative. The direct verifier requires active badges, dates, confirmed mandate
provenance, and any linked public relationship to agree before showing a positive result. The direct
pair check reads the deployed vNext contract before showing the strongest verdict.

## Live distribution

`SharePanel` creates:

- a stable handle link;
- a locally generated/downloadable SVG QR code;
- a live iframe pointed at `/badge/<handle>`; and
- neutral HTML/Markdown links for environments that cannot embed an iframe.

The iframe loads the current snapshot, labels testnet as non-production, and its response
is `no-store`. Link snippets do not contain a static “verified” claim, so they do not continue
asserting success after expiry/revocation. `vercel.json` permits external framing only for the badge
route; normal and wallet-write routes use same-origin frame protection. Test both boundaries under
the production CSP/cache headers.

## Credential anchor check

`CredentialPanel` performs a user-initiated fetch of a public credential only when:

- the URI is HTTPS with no embedded credentials;
- the response is successful and no more than 512 KiB; and
- the raw bytes or canonical JSON SHA-256 matches the on-chain metadata anchor.

For an IPFS anchor, private disclosure, or a host the browser cannot reach safely, the reader can
select a credential file and compare it locally without uploading it or contacting the anchored URI.
Both paths enforce the 512 KiB cap. Manual fetching avoids silently revealing every visitor's IP to
the credential host. A matching hash proves integrity relative to the anchor only. It does **not**
verify a W3C VC proof suite, issuer signature/key status, holder presentation, revocation registry,
or selective-disclosure proof.

## Application and report intake

`/apply` stages manual review for recruiter, agency, and hiring-company roles. It collects a
contract-compatible preferred handle, role-aware organisation/person details and readiness evidence,
an optional connected Stellar controller, and terms/privacy/accuracy consent. Its copy is explicit
that submission stays off-chain and is not a badge, approval, or blockchain transaction. A proposed
C… smart-account controller is accepted for assisted onboarding, but the current Freighter console
supports G… accounts only and says so before submission.

Report dialogs submit target entity/claim identifiers, category, detail, required contact email,
optional evidence URL, and privacy consent. Raw allegations remain private until a reviewed outcome
is written by an authorised contract role.

```text
Apply / ReportModal → src/lib/intake.ts → POST api/intake.ts
                    → server/intake-validation.ts → private HTTPS webhook
```

The function accepts only JSON, caps bodies at 16 KiB, applies strict field allowlists and
sanitisation, validates URLs/controllers, and checks a honeypot. It returns a reference and `202` only
after a successful webhook response. Missing configuration returns `503`; downstream rejection or
unavailability returns `502`. The UI must preserve those honest errors and never manufacture a
reference. Each forwarded envelope includes the server-controlled policy version
`doublecheck-intake-2026-08-10` so the review queue can retain the exact consent context.

`npm test` covers server validation and credential helpers without contacting the network. The
repository does not contain the durable review queue, encrypted evidence vault, reviewer access
control, KYC/KYB providers, decisions, notifications, policy, or appeals system.

## Holder wallet dashboard

`/manage` is an expert/testnet holder path using Freighter. It resolves the connected address to an
existing controller and supports:

- organisation- or person-initiated relationship attestations;
- organisation-confirmed mandates for a person or agency, or representative-self-asserted mandates;
- person-controlled opt-in/opt-out of official relationship listings, without calling the public
  Soroban record private;
- withdrawals of the holder's relationship/mandate claims; and
- holder-scoped index/direct reads so an unpublished relationship can still be
  challenged/withdrawn. Those records remain public on Stellar even when omitted from the verifier.

Before signing, `src/lib/write.ts` normalises bounded inputs, builds an exact human statement and
canonical JSON detail hash, pins the configured contract/network/controller, simulates the call, and
rejects unexpected extra signers. It then asks Freighter to sign/send and reports success only after
the RPC returns final ledger success, hash, and ledger number. Secret keys never enter the app.

This is not passkey account abstraction, fee sponsorship, or a full production console. Users need
Freighter, the correct funded network account, and fees. Issuer proposals/renewals/metadata/status,
arbiter outcomes, controller
acceptance/rotation, archived-footprint recovery, robust retry/replacement, and policy-gated operator
workflows remain to build.

Application and standard pages sit outside the registry-loading boundary, so a public RPC outage
does not prevent a prospective user from applying or reading the rules. Chain-backed verifier and
holder routes still fail closed when the registry cannot be read.

## Regenerate bindings

Generate only after the intended contract deployment/upgrade is final:

```bash
cd FE
CONTRACT_ID=<vnext-contract-id> STELLAR_NETWORK=testnet npm run bindings
npm test
npm run lint
npm run build
```

`scripts/generate-bindings.mjs` invokes Stellar CLI and applies documented TypeScript compatibility
patches. Review the generated diff. An in-place address-preserving upgrade still requires generation
when the ABI changed.

## Production gaps

- deploy/upgrade vNext and regenerate the live binding;
- independent security review and wallet transaction UX audit;
- complete issuer/arbiter/controller-consent dashboards;
- real KYC/KYB review/evidence/policy/appeals operations;
- proof-suite and selective-disclosure credential verification;
- indexer/API, production RPC, extension, and status history;
- passkey recovery and fee sponsorship; and
- monitored submitted keepalive/archive restore operations.

See [`docs/deployment.md`](../docs/deployment.md) and
[`docs/roadmap.md`](../docs/roadmap.md).
