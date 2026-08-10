# DoubleCheck vNext

## Implementation summary

**Plain-English summary of the most important new features, improvements, and fixes delivered during the 10 August 2026 project review and release. Each section is ordered from highest to lowest business impact.**

### New features

- Public checker: anyone can see whether a recruiter currently has a real company mandate, without creating an account or connecting a wallet
- Application journey for recruiters, agencies, and hiring companies seeking verification
- Separate company-authorized mandate check, so a personal badge is never confused with permission to recruit for a company
- Recipient approval before a badge becomes active, preventing a badge from being issued to somebody without their consent
- Private reporting and complaint form, so suspicious or incorrect claims can be sent for review without publishing allegations
- Live share links, QR codes, and embeddable badges that show the current status instead of a stale "verified" image
- Portable credential integrity check: confirms that a shared credential file hasn't been altered from the original on-record version
- Holder dashboard for people and organisations to manage their own verification records
- Public verification-standard page explaining, in plain language, what a green result does and does not mean
- Issuer-approved account recovery path for genuine lost-access cases
- Safe record-maintenance process to keep long-lived demonstration records available
- Full implementation, audit, and deployment report, in both Markdown and a branded PDF
- Smoother page-entry animations across the product
- Broader automated and adversarial testing

### Improvements

- Made badge status safer and more meaningful: expiry, renewal, suspension, revocation, and accountability strikes now have clearer rules
- Strengthened who can approve, change, recover, or close a verification record
- Made recruiter-vouched and company-confirmed mandates clearly different, so users can understand the level of proof
- Rebuilt the original blockchain plan without issuing a speculative token or transferable collectible
- Improved privacy controls: people decide whether relationships appear in the official public interface
- Made credentials and record links harder to tamper with or substitute
- Improved public status pages to show expiry, suspension, revocation, strikes, and when information was last checked
- Made the app more reliable when the underlying blockchain data is temporarily unavailable
- Improved searches, public handles, QR sharing, and links people can safely share with employers or candidates
- Improved security protections for normal pages and safely embeddable badges
- Improved validation of text and links to reduce malformed or deceptive data
- Upgraded the existing demonstration record-keeper without losing existing demo data
- Regenerated the website's connection settings from the live record-keeper, reducing mismatch risk
- Expanded architecture, security, deployment, roadmap, and operational documentation

### Fixes

- Fixed a serious trust issue where a recruiter's own statement could appear to be company authorization
- Fixed inactive, expired, withdrawn, or revoked claims looking active to visitors
- Fixed private relationships being displayed publicly in the official interface
- Fixed unsafe account-recovery behavior that could have made a "non-transferable" badge too easy to hand over
- Fixed pages that hid revoked, suspended, or expired status instead of showing it clearly
- Fixed organisations being able to reopen records that should stay closed
- Fixed fake "report sent" messages; the interface now confirms only real server responses
- Fixed production complaint/application submissions failing to go through
- Fixed misleading wording that could overstate how a claim was confirmed
- Fixed mandate-record crowding that could hide a valid company confirmation
- Fixed incorrect permissions for withdrawing a mandate
- Fixed credential information briefly carrying over from one person or company page to another
- Fixed several page and navigation crashes caused by unavailable shared data
- Fixed stale page data and missing refresh behavior
- Fixed documentation that implied stronger privacy, deletion, or production readiness than the system can honestly promise
- Fixed documentation and screen copy that did not clearly distinguish demonstration status from production verification
- Fixed account lookup behavior that used an invalid account during read-only checks
- Fixed security headers and cache rules for embeddable badges
- Fixed long-term record-maintenance gaps and incorrect assumptions about read operations
- Fixed text and link edge cases that could make data look misleading or malformed

---

**Deployment status:** live on the public website, with the verification records running on a public test network.
