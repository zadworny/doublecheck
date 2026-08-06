<img width="1390" height="440" alt="github" src="https://github.com/user-attachments/assets/22f83114-c2ff-45d0-b3a2-bc6085259e3c" />

Trust infrastructure that lets a company cryptographically confirm the people and organisations who represent it

---

A recruiter messages you on LinkedIn about a job at a company you've heard of. Are they real? Do
they actually work there? Is that company even hiring? Today there is no way to check any of it in
under an hour, and job-scam fraud runs into the billions a year because of it.

DoubleCheck is the registry that answers those three questions in one click — no wallet, no account,
no crypto knowledge on the reader's side.

| | |
|---|---|
| [`SC/`](SC/) | Soroban smart contract (Rust) — the registry itself |
| [`FE/`](FE/) | React + Vite explorer — the public verifier |
| [`docs/`](docs/) | design rationale and deployment |

## How it works

A human at the issuer vets an organisation or a person and registers them on-chain. The
organisation's own key then attests who works for it, and issues time-bound **mandates** — "this
person may recruit for us, for this scope, until this date."

Anyone can then check a handle in a single read call, and the answer includes *who signed it*: a
claim confirmed by the company's own key reads differently from one the recruiter asserted about
themselves. Every badge and every mandate is revocable in one transaction and expires on its own
with no cron job.

## Live on Stellar testnet

| | |
|---|---|
| Contract | `CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP` |
| Explorer | [stellar.expert](https://stellar.expert/explorer/testnet/contract/CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP) |
| Seeded with | 5 entities, 8 claims — covering company-confirmed, self-asserted, withdrawn and expired |

## Run it

The explorer needs no configuration and no wallet — it reads the deployed testnet contract out of
the box:

```bash
cd FE && npm install && npm run dev
```

The contract needs the [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/install-cli)
(`brew install stellar-cli`):

```bash
cd SC && cargo test
```

## Start here

- **[`docs/design-report.md`](docs/design-report.md)** — scope, what stays off-chain, the
  personal-data decision, and how Stellar changes the chain the original plan named.
- **[`SC/README.md`](SC/README.md)** — build, test, deploy, and a full CLI walkthrough of the trust
  loop.
- **[`FE/README.md`](FE/README.md)** — running the explorer, how the data gets from chain to screen,
  and regenerating the contract bindings.
- **[`docs/deployment.md`](docs/deployment.md)** — putting the explorer on Vercel and the contract on
  Stellar, plus what to watch once it is live.

## Status

MVP. The contract implements the trust loop end to end with 28 passing tests and is deployed to
testnet. It has not been audited. See §10 of the [design report](docs/design-report.md) for what
is deliberately not built yet.

## Licence

Apache 2.0 — see [`LICENSE`](LICENSE).
