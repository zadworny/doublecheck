# Traction

Where DoubleCheck stands today: what is built and verifiable, and what is not yet proven.

This is a pre-launch project. Everything below marked **shipped** can be checked by anyone from a
public link. Everything under [Demand](#demand) is where evidence is still being gathered — it is
listed rather than omitted so the gap is visible.

---

## Milestones

| Date | Milestone |
|---|---|
| 2026-08-05 | Project opened, Apache 2.0 |
| 2026-08-07 | Soroban registry contract and explorer frontend built |
| 2026-08-07 | Explorer switched from mock data to reading the live contract |
| 2026-08-07 | Contract deployed to Stellar testnet, explorer live on Vercel |
| 2026-08-07 | Authorisation model hardened after two defects found by inspection |

---

## Shipped

Each of these is independently checkable.

### The contract is live on testnet

`CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP` —
[view on stellar.expert](https://stellar.expert/explorer/testnet/contract/CDY4WIUWUJWDW4AKPTYFXTRONQQVS52PS2ZYFU2S5HEMW2U7LM5KRHKP)

It implements the full trust loop: an issuer registers an organisation, the organisation's own key
attests who is affiliated with it, and it issues time-bound mandates that expire without any
scheduled job. Every badge and every mandate is revocable in a single transaction.

### The verifier is public and needs nothing

**https://doublecheck-lime.vercel.app**

No wallet, no account, no extension, no prior setup on the reader's side. Reads are simulated from
the browser directly against the contract. This is the product's central claim and it is already
true — anyone can check any handle right now.

### Quality signals

| | |
|---|---|
| Test suite | 30 tests passing, covering the trust loop end to end |
| Contract size | 38 KB Wasm against a 128 KB network limit |
| Licence | Apache 2.0, source public |
| Security posture | Two authorisation defects found and fixed pre-audit; both covered by regression tests |

That last row is worth stating plainly. One defect let a compromised complaint key push records into
a terminal `Revoked` state and destroy the registry; the other let a single verified organisation
permanently block every other organisation from attesting anything about a given person. Both were
found by reading the privileged paths against the roles they enforce, before any external review.
See [Roadmap](roadmap.md#security-audit).

### Deliberate scope discipline

Cash staking and slashing, W3C Verifiable Credential issuance, badge tiers, a browser extension, KYB
integrations, fee collection and on-chain search were each considered and cut, with reasoning
recorded in [Architecture](architecture.md#scope). The MVP does one thing.

---

## Demand

<!-- TODO: fill in or delete each block below. Do not publish a block you cannot evidence. -->

**The problem is large and accelerating.** LinkedIn removed 80.6 million fake accounts in H2 2024.
US job and employment scam losses rose from $90M in 2020 to $501M in 2024 (FTC). An estimated 27% of
US job listings are ghost jobs.

**Pipeline.** 5 signed letters of intent from partner companies — Peridot Finance, Payroutes,
Wintrader, Spreadless and Guardian — piloting employee, external-representative and hiring-mandate
verification on testnet first, then mainnet here. See `Peridot LOI.pdf`.

**Prototype.** The working prototype these partners are piloting against is the live verifier above —
[https://doublecheck-lime.vercel.app](https://doublecheck-lime.vercel.app).

**First issuer.** Jobited, our first verification issuer, is an active EU recruitment operation:
5,000+ technical professionals, 10+ company relationships and 20+ recruiting mandates managed. It
supplies the first verified companies, recruiters and mandates. See `Jobited_DataRoom.pptx`.

**Distribution.** BTC-ECHO, the DACH crypto market leader at 2.75M monthly visits, backs the rollout
(contact: Jan Heinrich Meyer, meyer@btc-echo.de). [onchainhires.com](https://onchainhires.com), our
job board, is the first live surface for verified listings. Talks with Cointelegraph for global
reach are in progress.

**Usage.** _<Vercel analytics: unique visitors and page views since launch, and the window they cover>_

**Repository.** _<GitHub stars, forks, unique clones — only if the number helps you>_

**Recognition.** _<grants, hackathon placements, accelerator or cohort acceptance>_

> The testnet registry is currently seeded with 5 entities and 8 claims. That is fixture data chosen
> to exercise every state — company-confirmed, self-asserted, withdrawn and expired — not users. It
> is not counted as traction here and should not be presented as such.

---

## Why now

Job-scam fraud runs into billions a year, and part of why it works is that a person contacted about
a role cannot quickly answer three questions: is this person real, do they actually work there, and
are they authorised to be recruiting right now.

Two platform changes make answering them practical rather than theoretical. Stellar shipped passkey
smart wallets to mainnet, which removes the seed phrase — the single hardest adoption requirement
for any design that depends on a subject holding a key. And Soroban's read model lets a verifier
simulate reads for free from a browser, so the person doing the checking needs no wallet at all.
See [Architecture](architecture.md#implementing-on-soroban).

---

## What would change this page

The next milestone is mainnet. Three things block it, all of them deliberate:

1. **An independent security audit.** Finding two authorisation defects by inspection is not
   evidence there is no third.
2. **A personal-data decision.** Whether natural persons' names are written on-chain. Ledger entries
   are public and permanent; the GDPR grants a right to erasure. Needs legal review.
3. **Administrative key custody.** The admin key can revoke any badge and replace the contract code,
   and is currently a CLI keypair on a laptop. It needs to become a multisig or a passkey smart
   wallet with policy signers.

Full detail, plus what is scheduled after mainnet, is in the [Roadmap](roadmap.md).
