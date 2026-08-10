# DoubleCheck vNext

## Implementation summary

**New features, improvements, and fixes delivered during the 10 August 2026 project review and release.**

### New features

- Recipient-consented badge issuance workflow
- Pending application and controller acceptance
- Issuer-approved controller recovery
- Recruiter, agency, and hiring-company application flow
- Private application and complaint intake API
- Public mandate verifier
- Freighter-based holder management console
- W3C VC anchor and hash verification
- Live embeddable badge
- Public verification-standard page
- Stellar TTL keeper and archival operations
- Section-by-section page entry animations
- Expanded automated and adversarial tests
- Detailed Markdown implementation report
- Branded full implementation PDF report

### Improvements

- Translated the original EVM design into a Stellar/Soroban architecture
- Hardened badge expiry, renewal, suspension, revocation, and strikes
- Strengthened issuer authority and controller recovery rules
- Improved metadata, credential URI, privacy, and Unicode validation
- Improved relationship publication consent and privacy handling
- Hardened recruiter-vouched and company-confirmed mandates
- Added resource-safe mandate authorization indexes
- Improved entity status, expiry, strikes, and ledger-provenance displays
- Improved QR codes, sharing, search, and stable handle pages
- Improved frontend routing, context availability, and RPC behavior
- Improved security headers and safe external badge embedding
- Expanded architecture, security, deployment, roadmap, and operational documentation
- Regenerated frontend bindings from the live Stellar ABI
- Upgraded the existing testnet contract while preserving demonstration data

### Fixes

- Fixed private relationships appearing publicly
- Fixed self-asserted mandates appearing company-authorized
- Fixed scheduled, expired, withdrawn, and revoked claims appearing active
- Fixed organisations being able to reactivate improperly closed claims
- Fixed credential state leaking between entity pages
- Fixed incorrect controller withdrawal permissions
- Fixed simulation reads using an impossible Stellar account
- Fixed misleading verification and confirmation wording
- Fixed entity pages hiding important revoked, suspended, or expired states
- Fixed stale frontend registry state and missing refresh behavior
- Fixed static pages crashing outside registry context
- Fixed navbar search losing registry context
- Fixed fake complaint-submission success messages
- Fixed serverless intake TypeScript compilation and dependency packaging
- Fixed production `/api/intake` runtime failures
- Fixed embeddable badge framing and cache headers
- Fixed unsafe controller-transfer behavior
- Fixed mandate-index saturation and authorization-masking risks
- Fixed Stellar TTL assumptions and keeper coverage
- Fixed documentation that overstated privacy, erasability, or deployed behavior

---

**Deployment status:** source pushed to GitHub `main`, frontend deployed through Vercel, and the upgraded registry is live on Stellar testnet.

