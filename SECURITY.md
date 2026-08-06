# Security policy

## Status

**This code has not been audited.** It is an MVP deployed to Stellar testnet only. Do not use it to
make trust decisions that matter, and do not deploy it to mainnet without an independent review of
the authorisation paths.

## Reporting a vulnerability

Report privately through
[GitHub's security advisories](https://github.com/zadworny/doublecheck/security/advisories/new)
rather than opening a public issue.

Please include what an attacker gains, the sequence of calls that gets them there, and which key
they need to control. A failing test against `SC/contracts/doublecheck-registry/src/test.rs` is
the most useful possible report.

## What is in scope

The contract's authorisation model is the primary concern:

- Anything that lets a caller write a claim attributed to a key they do not control, or that
  misreports `confirmation` — the field a reader relies on to distinguish a company-confirmed claim
  from a self-asserted one.
- Anything that lets a non-admin reach `Revoked`, which is terminal and irreversible.
- Anything that lets one entity permanently degrade another's records, given that index entries
  cannot be removed.
- Anything that lets a revoked, suspended or expired badge read as valid, or a live revocation fail
  to take effect.

Also in scope: personal data reaching the ledger through a path the model does not account for.

## What is out of scope

- **The absence of an audit**, and the deferred work listed in
  [`docs/architecture.md`](docs/architecture.md#limitations).
- **Off-chain verification quality.** The registry records that an issuer vetted a subject; whether
  that vetting was any good is a process question, not a contract one.
- **The admin key's power.** The admin can revoke any badge and upgrade the contract by design.
  Key custody is an operational control, not a contract-level one.
- **Testnet keys and data.** Everything in the seeded testnet deployment is disposable.
- Rate limits or availability of public RPC endpoints.

## Known and accepted

Recorded so they are not re-reported. The full list, with the work that would resolve each, is in
[`docs/roadmap.md`](docs/roadmap.md).


- `is_authorised(org, representative)` consults the **most recent** mandate between a pair. An older,
  still-valid mandate does not keep the pair authorised once a newer one lapses.
- Claim indexes stop growing at 512 entries per entity. Claims beyond that are still written and
  still readable by id, but will not appear in index reads. The contract's events are authoritative.
- `upgrade` takes effect immediately, with no timelock.
