# Outstanding work

What is deliberately not built or not yet decided, in the order it should be tackled. Scope
reasoning for each item is in [`architecture.md`](architecture.md); operational detail is in
[`deployment.md`](deployment.md).

---

## Blocking mainnet

These are not optional. Each is materially cheaper to resolve before the first badge is issued than
after.

### Security audit

Two authorisation defects have already been found and fixed by reading the privileged paths against
the roles they enforce:

- the arbiter could reach `Revoked`, which is terminal and undoable by anyone, so a compromised
  complaint key could have destroyed the registry;
- a full claim index aborted the write, letting one verified organisation permanently prevent every
  other organisation from attesting anything about a given person.

Both are fixed and covered by tests. Finding two by inspection is not evidence that there is no
third. An independent review of the authorisation paths should precede any mainnet deployment, along
with a rehearsal of the upgrade path on testnet.

See [`SECURITY.md`](../SECURITY.md) for scope and reporting.

### Personal-data policy

Whether natural persons' names are written on-chain. The registry currently leaves `display_name`
empty for people and serves the name from the off-chain credential, so it remains erasable — but the
contract does not enforce this, and it is a policy the issuer applies at registration.

Requires legal review. Ledger entries are public and permanent; the GDPR grants a right to erasure.
See [Personal data](architecture.md#personal-data).

### Administrative key custody

The admin key can revoke any badge and replace the contract code. It is currently a CLI keypair on a
laptop. For anything beyond testnet it should be a multisig or a passkey smart wallet with policy
signers.

Related: whether the arbiter stays the same address as the admin or becomes a separate one. The
contract supports either — `set_arbiter` is a single call.

---

## Before real traffic

### Paid RPC

The explorer reads `https://soroban-testnet.stellar.org`, a free public endpoint with no uptime
guarantee. Each page load issues roughly `entity_count + 2 × claim_count` simulated reads. The RPC
endpoint, not the web host, is the first thing to fail under load. Set `VITE_RPC_URL`.

### Archival policy

Soroban archives ledger entries untouched for ~120 days, and no entry can be made to outlive 180
days. Reads extend what they touch, so anything actively being checked stays live — but a quiet
registry needs either a scheduled sweep or a restore path in the verifier UI. Both options are in
[Storage, rent and archival](architecture.md#storage-rent-and-archival).

### Custom domain

The domain is the trust surface: the product is someone checking a link they were sent, so whichever
domain is chosen becomes the thing readers are taught to recognise. Worth choosing once and keeping.

---

## Next to build

### Indexer

The largest piece of deferred engineering, and the fix for the RPC read pattern above.

The explorer reconstructs the registry by walking ids `1..entity_count` and `1..claim_count` on every
page load. That is acceptable at MVP size and unworkable beyond a few hundred records. The contract
emits an event on every state change — `EntityRegistered`, `EntityStatusSet`, `RelationshipAttested`,
`MandateIssued`, `ClaimStatusSet`, `StrikeAdded`, `ControllerRotated` — specifically so a follower
process can maintain a queryable mirror.

Two constraints:

- **It cannot run on Vercel.** An indexer polls continuously; Vercel functions are short-lived and
  request-triggered. Railway, Fly.io, Render or a small VM.
- **Nothing above `FE/src/data/` should have to change.** The loading logic is isolated there
  precisely so the explorer can switch from reading the chain to reading an indexer's API.

It would also supply the status history the explorer currently cannot show: the contract emits every
change but stores no timeline, so the history panel today shows only what a record itself proves.

### Write path in the explorer

The application is read-only. Registering entities, attesting relationships and issuing mandates all
happen through the Stellar CLI. A production issuer needs an interface for the verification workflow,
and organisations need one for issuing and withdrawing their own mandates.

This is where passkey smart wallets belong — see
[Implementing on Soroban](architecture.md#implementing-on-soroban). Requiring a seed phrase would end
adoption outside crypto-native audiences.

### Complaint pipeline

The report button opens a modal that submits nowhere. Reports belong in an off-chain review queue;
only the outcome is ever written on-chain, through `add_strike` or `set_entity_status`. The contract
side is complete — what is missing is the queue, the review interface, and the process behind it.

---

## Known and accepted

Recorded so they are not mistaken for oversights. Also listed in [`SECURITY.md`](../SECURITY.md).

- `is_authorised(org, representative)` consults the **most recent** mandate between a pair. An older
  but still-valid mandate does not keep the pair authorised once a newer one lapses.
- Claim indexes stop growing at 512 entries per entity. Beyond that a claim is still written and
  readable by id but does not appear in index reads; the event stream stays complete.
- `upgrade` takes effect immediately, with no timelock.
- Free-text claim fields (`role`, `department`, `scope`, `territory`) are stored on-chain and do
  constitute employment data. Moving them behind `detail_hash` needs no change to the contract's
  shape.

---

## Explicitly out of scope

Considered and rejected for this stage, with reasoning in [Scope](architecture.md#scope): cash
staking and slashing, W3C Verifiable Credential issuance, badge tiers, a browser extension, KYB
integrations, fee collection, batch operations and on-chain search.
