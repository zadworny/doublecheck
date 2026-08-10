import type { ReactNode } from "react";
import { Panel } from "../components/Panel";

const NAV_ITEMS = [
  ["gate", "Verification gate"],
  ["evidence", "Evidence levels"],
  ["stellar", "Stellar trust model"],
  ["privacy", "Privacy boundary"],
  ["lifecycle", "Expiry"],
  ["complaints", "Complaints"],
  ["green", "What green means"],
  ["status", "Production status"],
] as const;

/** Public, plain-language description of the standard DoubleCheck is built to enforce. */
export function Standard() {
  return (
    <article className="mx-auto max-w-5xl space-y-10 pb-10">
      <header className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-5 py-8 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 sm:px-8 sm:py-10">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <Chip tone="blue">Public standard · testnet draft</Chip>
            <Chip tone="amber">Not independently audited</Chip>
            <Chip tone="slate">Human review + signed evidence</Chip>
          </div>
          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
            DoubleCheck transparency standard
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
            What a verification means, who said it, and when it stops being true
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
            DoubleCheck separates identity, affiliation, and authority. A person can have a valid
            identity badge without being authorised by a particular company. A relationship can be
            real without granting a mandate. The verifier only gives its strongest result when the
            evidence needed for the exact question is current and attributable.
          </p>
        </div>

        <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
          <Principle
            title="Attributable"
            detail="Every claim records the Stellar address that authorised it."
          />
          <Principle
            title="Time-bound"
            detail="Badges and mandates expire; permanent trust is not representable."
          />
          <Principle
            title="Correctable"
            detail="Suspension and withdrawal remain possible without publishing raw allegations."
          />
        </div>
      </header>

      <nav aria-label="On this page" className="flex flex-wrap gap-2">
        {NAV_ITEMS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-sky-400 hover:text-sky-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-400"
          >
            {label}
          </a>
        ))}
      </nav>

      <Section
        id="gate"
        number="01"
        title="The intended verification gate"
        intro="The contract can prove which keys agreed and which credential hash was anchored. It cannot judge a passport, company filing, or liveness check. Those checks are an issuer responsibility and must be completed before an offer is placed on-chain."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Checklist
            title="For a natural person"
            items={[
              "Confirm the subject is a real person using proportionate identity and anti-impersonation evidence.",
              "Confirm control of the contact channel and the Stellar controller that will hold the badge.",
              "Check for duplicate, manipulated, expired, or materially inconsistent evidence.",
              "Obtain informed acceptance of the exact public handle, credential hash, expiry, and terms hash.",
              "Keep raw identity evidence private and retain it only for a defined operational or legal need.",
            ]}
          />
          <Checklist
            title="For an organisation"
            items={[
              "Confirm legal existence and the organisation name and jurisdiction being asserted.",
              "Confirm control of an official domain or another authoritative company channel.",
              "Confirm that the accepting controller or signatory may act for the organisation.",
              "Record the reviewed credential hash, public descriptors, expiry, and acceptance terms.",
              "Re-check material changes rather than carrying old evidence into a renewed badge.",
            ]}
          />
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-5">
          {[
            ["1", "Review", "Issuer checks private evidence off-chain."],
            ["2", "Propose", "Issuer commits the exact badge and terms hashes."],
            ["3", "Accept", "The intended controller signs before the deadline."],
            ["4", "Activate", "Only then does an active entity badge exist."],
            ["5", "Attest", "Relationships and mandates are separate signed records."],
          ].map(([step, title, detail]) => (
            <div key={step} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/10 text-xs font-bold text-sky-700 dark:text-sky-400">
                {step}
              </span>
              <h3 className="mt-2 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
            </div>
          ))}
        </div>

        <Note tone="neutral">
          The preferred contract path is issuer proposal followed by controller acceptance. An
          expert atomic registration path also exists, but it requires both issuer and controller
          authorisation. Neither path proves that the issuer&apos;s human review was competent; that
          remains an operational trust decision.
        </Note>
        <Note tone="warning">
          This consent flow is deployed on Stellar testnet and exposed by the generated binding,
          but the browser acceptance screen and staffed verification operation are not complete.
          Testnet availability is not a production verification promise.
        </Note>
      </Section>

      <Section
        id="evidence"
        number="02"
        title="Badges, relationships, and mandate evidence"
        intro="These are evidence layers, not paid status levels. DoubleCheck currently has no commercial gold/silver badge enum and no transferable reputation token."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <EvidenceCard
            index="A"
            title="Entity badge"
            subtitle="Who is this?"
            detail="An issuer-vetted person or organisation, bound to a controller address, with an active, suspended, revoked, or expired state."
          />
          <EvidenceCard
            index="B"
            title="Relationship"
            subtitle="How are they connected?"
            detail="An employment, contractor, agency, or representative affiliation. Public listing requires the subject's action or issuer-recorded consent."
          />
          <EvidenceCard
            index="C"
            title="Mandate"
            subtitle="What may they do now?"
            detail="A scoped, time-bound authorisation from an organisation to a person or agency. A badge alone never supplies this authority."
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="hidden grid-cols-[0.9fr_1.2fr_1.4fr] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900 dark:text-slate-400 sm:grid">
            <span>Confirmation</span>
            <span>What the signature proves</span>
            <span>Candidate-facing treatment</span>
          </div>
          <EvidenceRow
            tone="amber"
            title="Self-asserted"
            proof="The representative signed their own claim."
            treatment="Visible context only. It is not company authorisation and must never produce a green result."
          />
          <EvidenceRow
            tone="blue"
            title="Issuer-confirmed"
            proof="The registry issuer recorded an out-of-band check."
            treatment="Can support a positive result when the mandate and all dependencies are live, but the company did not sign directly."
          />
          <EvidenceRow
            tone="green"
            title="Company-confirmed"
            proof="The organisation controller signed the mandate."
            treatment="Strongest available provenance. It can be green only while dates, badges, and any linked relationship remain valid."
          />
        </div>
      </Section>

      <Section
        id="stellar"
        number="03"
        title="What Stellar adds to the trust model"
        intro="DoubleCheck uses a Soroban registry on Stellar rather than an EVM NFT or third-party attestation service. The useful property is independently attributable, current state—not a token image."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <TrustCard
            title="Issuer and arbiter"
            detail="The issuer registers, renews, and may permanently revoke badges. A separate arbiter can record complaint outcomes but cannot permanently revoke an entity."
          />
          <TrustCard
            title="Controller signatures"
            detail="Soroban address authorisation identifies who accepted a badge or wrote a claim. Recovery requires the current controller, stored issuer, and exact destination rather than enabling a sale-like transfer."
          />
          <TrustCard
            title="Wallet-free checking"
            detail="A reader simulates public contract reads without signing or paying. Writes still require the relevant authorised key."
          />
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Panel title="The ledger can prove">
            <BulletList
              items={[
                "The record contents returned by the configured contract.",
                "Which Stellar address authorised a claim and which confirmation class applies.",
                "Status, validity windows, issuer address, controller address, and anchored hashes.",
                "That a revocation or withdrawal cannot be hidden by changing only the website.",
              ]}
            />
          </Panel>
          <Panel title="The ledger cannot prove by itself:">
            <BulletList
              items={[
                "That the issuer performed a good identity or company check.",
                "That a message, job description, payment request, or interview came from the recorded controller.",
                "That free-text scope matches the situation a candidate is facing.",
                "That the admin key, RPC endpoint, or web application is perfectly operated.",
              ]}
            />
          </Panel>
        </div>
        <Note tone="warning">
          The global admin can issue future badges and upgrade the contract; each badge&apos;s stored
          issuer retains renewal, recovery, and revocation authority over that badge. Mainnet
          operation therefore requires reviewed upgrade procedures and strong custody for both
          roles; on-chain code does not remove that governance trust.
        </Note>
      </Section>

      <Section
        id="privacy"
        number="04"
        title="Privacy and the verifiable-credential boundary"
        intro="Stellar contract data is public and should be treated as durable. DoubleCheck stores trust outcomes and commitments on-chain, not the sensitive evidence used to reach them."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <BoundaryCard
            tone="chain"
            title="Public on-chain"
            items={[
              "Entity ids, public handles, Stellar addresses, issuer, status, and dates.",
              "Organisation descriptors such as legal name, domain, and jurisdiction.",
              "Published relationship and mandate fields, including role, scope, and territory.",
              "Hashes and URIs that anchor the reviewed off-chain credential.",
            ]}
          />
          <BoundaryCard
            tone="private"
            title="Private off-chain"
            items={[
              "Identity documents, liveness material, KYB reports, references, and contact data.",
              "Full natural-person profile details; the contract rejects person name, domain, and jurisdiction fields.",
              "Raw complaints, allegations, reviewer notes, and submitted evidence.",
              "Billing and other operational data that does not improve independent verification.",
            ]}
          />
        </div>
        <Note tone="neutral">
          A metadata hash is a tamper-evident anchor, not encryption and not a W3C Verifiable
          Credential by itself. The verifier can manually fetch a public HTTPS document and compare
          its hash, but VC proof-suite validation, issuance, selective disclosure, and holder
          presentation are not complete product capabilities today. Deleting an off-chain profile can make its personal details unavailable, but the
          public handle, addresses, dates, and hash remain on the ledger.
        </Note>
      </Section>

      <Section
        id="lifecycle"
        number="05"
        title="Expiry, reverification, and availability"
        intro="Trust is evaluated at read time. Expiry does not need a scheduled status-changing transaction, but renewal does require the issuer to act after reverification."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <LifecycleCard title="Issued" detail="Issuer and controller approve the bounded badge." />
          <LifecycleCard title="Active" detail="The stored status and current time permit verification." />
          <LifecycleCard title="Review" detail="The issuer may renew; a complaint may dispute or suspend." />
          <LifecycleCard title="Stops" detail="Expiry, withdrawal, suspension, or revocation removes the positive result." />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Fact title="Badge lifetime">
            The current contract requires a non-zero expiry and caps a badge&apos;s issued or renewed
            lifetime at 400 days. Renewal updates the verification timestamp and cannot resurrect a
            permanently revoked badge.
          </Fact>
          <Fact title="Mandate lifetime">
            Every mandate needs a start and end, and its window is capped at 366 days. A future
            mandate is scheduled, not active; an ended linked relationship also prevents
            authorisation.
          </Fact>
        </div>
        <Note tone="warning">
          Ledger storage availability is separate from trust expiry. Simulated browser reads do not
          submit TTL extensions. A production operator needs signed TTL maintenance, monitoring, and
          restoration procedures so an archived entry is reported as unavailable rather than
          misdescribed as revoked or expired.
        </Note>
      </Section>

      <Section
        id="complaints"
        number="06"
        title="Complaints, due process, and appeals"
        intro="An allegation is not a verified fact. Complaint details belong in a private review queue; only a reviewed status outcome belongs on the public registry."
      >
        <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Panel title="Minimum due-process standard">
            <ol className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {[
                ["Receive privately", "Return a reference, minimise personal data, and do not publish the accusation."],
                ["Triage", "Check jurisdiction, urgency, conflicts, duplication, and whether temporary suspension is proportionate."],
                ["Notify and hear", "Where safe and lawful, tell the affected party the substance and allow a factual response."],
                ["Decide", "Use a reasoned, authorised outcome: no action, dispute, suspension, withdrawal, strike, or admin revocation."],
                ["Review", "Provide a separate appeal or correction path and retain only what the stated process requires."],
              ].map(([title, detail], index) => (
                <li key={title} className="flex gap-3 px-4 py-3">
                  <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <div className="space-y-4">
            <Fact title="What exists in code">
              The application has a private off-chain complaint intake path, and the contract has
              dispute, suspension, withdrawal, strike, and entity-status controls. A receipt means
              only that intake accepted a report; it is not a public flag or a finding.
            </Fact>
            <Fact title="What is not yet a production promise">
              Published review SLAs, reviewer independence, evidence-retention periods, staffed
              escalation, and a dedicated on-chain appeal case object are not established product
              capabilities. They must be operationally defined before production use.
            </Fact>
            <Fact title="Terminal outcomes">
              Entity revocation and subject-withdrawn claims are intentionally terminal in the
              current model. A mistaken terminal outcome cannot simply be relabelled Active; any
              remediation needs a new reviewed record and a clear public history.
            </Fact>
          </div>
        </div>
      </Section>

      <Section
        id="green"
        number="07"
        title="What a green result means—and does not mean"
        intro="Green is deliberately narrow. It answers whether the registry currently supports a particular organisation–representative authorisation, not whether every surrounding claim or interaction is safe."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <MeaningCard
            positive
            title="Green means"
            items={[
              "The selected organisation and representative both have active, unexpired badges.",
              "At least one current mandate was company-confirmed or issuer-confirmed; self-assertion is excluded.",
              "The mandate is inside its validity window and has not been withdrawn, suspended, disputed, or completed.",
              "If it references a relationship, that relationship is active and approved for public display.",
              "The direct contract pair check returned yes at the time shown by the verifier.",
            ]}
          />
          <MeaningCard
            title="Green does not mean"
            items={[
              "DoubleCheck endorses the person, company, role, offer, conduct, or commercial terms.",
              "Every email, profile, phone number, website, document, or payment request is genuine.",
              "The proposed activity falls inside the displayed scope—you must read and compare it.",
              "The status cannot change after you check; mandates can be withdrawn and badges can be suspended or revoked.",
              "You should skip ordinary safety checks or send money, secrets, or identity documents to the contact.",
            ]}
          />
        </div>
        <Note tone="warning">
          A self-asserted mandate is never green. It says only that a verified controller made the
          assertion and put their public reputation behind it; it does not say the named company
          authorised them.
        </Note>
      </Section>

      <Section
        id="status"
        number="08"
        title="Honest production status"
        intro="DoubleCheck is an evolving MVP on Stellar testnet. The code implements meaningful trust constraints, but a testnet deployment is not an accredited verification service or a production security guarantee."
      >
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <StatusRow area="Network" state="vNext testnet demo" detail="The public address runs the reviewed vNext candidate; its preserved records are demonstrations and testnet can be reset or redeployed." />
          <StatusRow area="Contract" state="vNext deployed, unaudited" detail="The consent, privacy, expiry, status, and governance interface is live on testnet and exposed by the generated binding, but has no independent production audit." />
          <StatusRow area="Verification operations" state="Draft standard" detail="The contract supports issuer proposals and controller acceptance; the quality, accreditation, and staffing of human review are not proven by the chain." />
          <StatusRow area="Complaints" state="Intake code present" detail="Actual availability, reviewer staffing, response times, retention, and appeals depend on deployment and operations." />
          <StatusRow area="Credentials" state="Anchor + manual integrity check" detail="Public HTTPS documents can be hash-checked; full W3C VC proof and selective-disclosure validation is not yet claimed." />
          <StatusRow area="Infrastructure" state="Pre-production" detail="Paid RPC, indexing, monitoring, submitted TTL maintenance/restoration, and hardened key custody remain operational requirements." />
        </div>
        <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-4 text-sm leading-6 text-red-900 dark:text-red-200">
          <strong>Do not use the current testnet deployment for a consequential trust decision.</strong>{" "}
          Before mainnet, the contract and authorization paths need independent review, administrative
          keys need production custody, the privacy and complaint processes need accountable owners,
          and the exact deployed code and public wording need to be reconciled.
        </div>
      </Section>
    </article>
  );
}

function Section({
  id,
  number,
  title,
  intro,
  children,
}: {
  id: string;
  number: string;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-5">
      <div className="flex gap-4">
        <span className="pt-1 font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">{number}</span>
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-2xl">{title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">{intro}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Chip({ tone, children }: { tone: "blue" | "amber" | "slate"; children: ReactNode }) {
  const style = {
    blue: "bg-sky-500/10 text-sky-700 ring-sky-500/20 dark:text-sky-400",
    amber: "bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-400",
    slate: "bg-slate-500/10 text-slate-600 ring-slate-500/20 dark:text-slate-300",
  }[tone];
  return <span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${style}`}>{children}</span>;
}

function Principle({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function Checklist({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel title={title}>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
        {items.map((item) => (
          <li key={item} className="flex gap-3 px-4 py-3 text-sm leading-5 text-slate-600 dark:text-slate-300">
            <CheckIcon />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CheckIcon() {
  return (
    <svg className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
      <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EvidenceCard({ index, title, subtitle, detail }: { index: string; title: string; subtitle: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <span className="font-mono text-xs font-semibold text-sky-600 dark:text-sky-400">{index}</span>
      <h3 className="mt-2 font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs font-medium text-slate-400">{subtitle}</p>
      <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function EvidenceRow({ tone, title, proof, treatment }: { tone: "amber" | "blue" | "green"; title: string; proof: string; treatment: string }) {
  const dot = { amber: "bg-amber-500", blue: "bg-sky-500", green: "bg-emerald-500" }[tone];
  return (
    <div className="grid gap-2 border-t border-slate-100 px-4 py-3 text-sm first:border-t-0 dark:border-slate-800/70 sm:grid-cols-[0.9fr_1.2fr_1.4fr]">
      <span className="flex items-center gap-2 font-semibold"><span className={`h-2 w-2 rounded-full ${dot}`} />{title}</span>
      <span className="text-slate-600 dark:text-slate-300">{proof}</span>
      <span className="text-slate-500 dark:text-slate-400">{treatment}</span>
    </div>
  );
}

function TrustCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
      {items.map((item) => (
        <li key={item} className="flex gap-2.5 px-4 py-3 text-sm leading-5 text-slate-600 dark:text-slate-300">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" />
          {item}
        </li>
      ))}
    </ul>
  );
}

function BoundaryCard({ tone, title, items }: { tone: "chain" | "private"; title: string; items: string[] }) {
  const style = tone === "chain" ? "border-sky-500/25 bg-sky-500/5" : "border-violet-500/25 bg-violet-500/5";
  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LifecycleCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="relative rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
      <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-sky-500" />
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{detail}</p>
    </div>
  );
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900/60">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{children}</p>
    </div>
  );
}

function MeaningCard({ positive = false, title, items }: { positive?: boolean; title: string; items: string[] }) {
  const style = positive ? "border-emerald-500/25 bg-emerald-500/5" : "border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900/50";
  return (
    <div className={`rounded-xl border p-4 ${style}`}>
      <h3 className="text-base font-semibold">{title}</h3>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm leading-5 text-slate-600 dark:text-slate-300">
            {positive ? <CheckIcon /> : <MinusIcon />}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MinusIcon() {
  return (
    <svg className="mt-0.5 shrink-0 text-slate-400" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function Note({ tone, children }: { tone: "neutral" | "warning"; children: ReactNode }) {
  const style = tone === "warning"
    ? "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-200"
    : "border-sky-500/20 bg-sky-500/5 text-slate-600 dark:text-slate-300";
  return <div className={`mt-4 rounded-xl border px-4 py-3 text-sm leading-6 ${style}`}>{children}</div>;
}

function StatusRow({ area, state, detail }: { area: string; state: string; detail: string }) {
  return (
    <div className="grid gap-1 border-t border-slate-100 px-4 py-3 first:border-t-0 dark:border-slate-800/70 sm:grid-cols-[0.8fr_1fr_2fr] sm:gap-4">
      <span className="text-sm font-semibold">{area}</span>
      <span className="text-sm font-medium text-sky-700 dark:text-sky-400">{state}</span>
      <span className="text-sm leading-5 text-slate-500 dark:text-slate-400">{detail}</span>
    </div>
  );
}
