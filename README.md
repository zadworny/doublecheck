<img width="1390" height="440" alt="github" src="https://github.com/user-attachments/assets/22f83114-c2ff-45d0-b3a2-bc6085259e3c" />

Trust infrastructure that lets a company cryptographically confirm the people and organisations who represent it

---

A recruiter makes contact about a role at a company. Is the person real? Do they actually work
there? Are they authorised to be recruiting for it right now? None of those questions can currently
be answered quickly, and job-scam fraud runs into billions a year in part because of it.

DoubleCheck answers all three from a single link — with no wallet, no account and no prior setup on
the reader's side.

| | |
|---|---|
| [`SC/`](SC/) | Soroban smart contract (Rust) — the registry itself |
| [`FE/`](FE/) | React + Vite explorer — the public verifier |
| [`docs/`](docs/) | architecture and deployment |

## How it works

An issuer vets an organisation or a person and registers them on-chain. The organisation's own key
then attests who is affiliated with it, and issues time-bound **mandates**: "this person may recruit
for us, within this scope, until this date."

Any handle can then be checked with a single read call, and the answer records *which key signed it*.
A claim confirmed by the organisation's own key is distinguishable from one the subject asserted
about themselves — verifiably so, without trusting the site presenting it. Every badge and every
mandate is revocable in one transaction and expires without any scheduled job.

## Live

| | |
|---|---|
| **Explorer** | **https://doublecheck-lime.vercel.app** |
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

- **[`docs/architecture.md`](docs/architecture.md)** — the data model, the trust model, where the
  on-chain boundary falls, and how personal data is handled.
- **[`SC/README.md`](SC/README.md)** — contract interface reference, build, test, deploy, and a CLI
  walkthrough of the full trust loop.
- **[`FE/README.md`](FE/README.md)** — running the explorer, how records travel from chain to screen,
  and regenerating the contract bindings.
- **[`docs/deployment.md`](docs/deployment.md)** — hosting, operations, and the deferred indexer.

## Status

MVP. The contract implements the trust loop end to end with 28 passing tests and is deployed to
testnet. It has not been audited. See
[Scope](docs/architecture.md#scope) and [Limitations](docs/architecture.md#limitations) for what is
deliberately absent.

## Licence

Apache 2.0 — see [`LICENSE`](LICENSE).
