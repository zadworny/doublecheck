import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { HashId } from "../components/HashId";
import { Panel } from "../components/Panel";
import { StatusPill } from "../components/StatusPill";
import { CONFIRMATION_LABEL, useRegistry } from "../data";
import { readPairAuthorisation } from "../data/registry";
import type { Mandate, Organisation, Person } from "../data/types";
import { chainConfig } from "../lib/chain";
import { formatDate } from "../lib/format";

type Entity = Organisation | Person;
type DirectCheck =
  | { state: "idle" | "checking" }
  | { state: "ready"; authorised: boolean }
  | { state: "failed"; message: string };

interface VerdictCopy {
  tone: "positive" | "caution" | "negative" | "neutral";
  eyebrow: string;
  title: string;
  detail: string;
}

/**
 * Candidate-facing answer to the complete trust question.
 *
 * A green result needs more than an Active mandate record: both badges, the
 * public supporting relationship, dates, confirmation provenance, and the
 * contract's direct pair check all have to agree.
 */
export function Verify() {
  const [params, setParams] = useSearchParams();
  const {
    organisations,
    people,
    loadedAt,
    getMandatesBetween,
    getRelationship,
  } = useRegistry();

  const submittedRepresentative = params.get("representative") ?? "";
  const submittedOrganisation = params.get("organisation") ?? "";
  const [representativeInput, setRepresentativeInput] = useState(submittedRepresentative);
  const [organisationInput, setOrganisationInput] = useState(submittedOrganisation);

  useEffect(() => setRepresentativeInput(submittedRepresentative), [submittedRepresentative]);
  useEffect(() => setOrganisationInput(submittedOrganisation), [submittedOrganisation]);

  const representatives = useMemo<Entity[]>(
    () => [...people, ...organisations].sort((a, b) => a.name.localeCompare(b.name)),
    [people, organisations],
  );
  const representative = resolveEntity(submittedRepresentative, representatives);
  const organisation = resolveEntity(submittedOrganisation, organisations);
  const attempted = Boolean(submittedRepresentative || submittedOrganisation);
  const mandates =
    representative && organisation
      ? getMandatesBetween(organisation.id, representative.id)
      : [];
  // The contract scans newest-to-oldest for a currently live company/issuer
  // confirmation. A newer scheduled, withdrawn, or self-asserted claim does
  // not mask older authorisation that is still valid.
  const mandate = selectMandateForVerdict(mandates);
  const relationship = mandate?.relationshipId
    ? getRelationship(mandate.relationshipId)
    : undefined;
  const representativeId = representative?.id;
  const organisationId = organisation?.id;

  const [direct, setDirect] = useState<DirectCheck>({ state: "idle" });
  useEffect(() => {
    let cancelled = false;
    if (!representativeId || !organisationId) {
      setDirect({ state: "idle" });
      return;
    }

    setDirect({ state: "checking" });
    void readPairAuthorisation(organisationId, representativeId)
      .then((authorised) => {
        if (!cancelled) setDirect({ state: "ready", authorised });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setDirect({
          state: "failed",
          message: cause instanceof Error ? cause.message : String(cause),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [representativeId, organisationId, loadedAt]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (representativeInput.trim()) next.set("representative", representativeInput.trim());
    if (organisationInput.trim()) next.set("organisation", organisationInput.trim());
    setParams(next);
  }

  const verdict = buildVerdict(mandate, representative, organisation, direct);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sky-600 dark:text-sky-400">
          Candidate check
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Is this representative authorised right now?
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Match the person or agency with the organisation they claim to represent. The result
          checks dates, both badges, the supporting relationship, and who signed the mandate.
        </p>
      </header>

      <Panel title="Choose both parties">
        <form onSubmit={submit} className="grid gap-4 px-4 py-5 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <LookupField
            id="verify-representative"
            label="Recruiter or representative"
            value={representativeInput}
            onChange={setRepresentativeInput}
            list="representative-options"
            placeholder="Handle, id, or Stellar address"
          />
          <datalist id="representative-options">
            {representatives.map((entity) => (
              <option key={`${entity.kind}-${entity.id}`} value={entity.handle}>
                {entity.name} · #{entity.id}
              </option>
            ))}
          </datalist>

          <LookupField
            id="verify-organisation"
            label="Organisation"
            value={organisationInput}
            onChange={setOrganisationInput}
            list="organisation-options"
            placeholder="Handle, id, domain, or address"
          />
          <datalist id="organisation-options">
            {organisations.map((entity) => (
              <option key={entity.id} value={entity.handle}>
                {entity.name} · {entity.domain || `#${entity.id}`}
              </option>
            ))}
          </datalist>

          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
          >
            Check now
          </button>
        </form>
      </Panel>

      {attempted && (!representative || !organisation) && (
        <MissingSelection
          representativeMissing={!representative}
          organisationMissing={!organisation}
        />
      )}

      {representative && organisation && (
        <>
          <VerdictCard verdict={verdict} direct={direct} mandate={mandate} />

          <Panel title="Parties checked">
            <div className="grid divide-y divide-slate-100 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800/70">
              <EntitySummary label="Representative" entity={representative} />
              <EntitySummary label="Organisation" entity={organisation} />
            </div>
          </Panel>

          {mandate && (
            <Panel title="On-chain evidence">
              <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800/70">
                <EvidenceRow label="Mandate">
                  <Link to={`/tx/${mandate.id}`} className="font-mono text-sky-600 hover:underline dark:text-sky-400">
                    Claim #{mandate.id}
                  </Link>
                </EvidenceRow>
                <EvidenceRow label="Current evaluation">
                  <StatusPill status={mandate.status} />
                </EvidenceRow>
                <EvidenceRow label="Ledger claim status">{mandate.ledgerStatus}</EvidenceRow>
                <EvidenceRow label="Confirmation">
                  {CONFIRMATION_LABEL[mandate.confirmation]}
                </EvidenceRow>
                <EvidenceRow label="Signing key">
                  <HashId value={mandate.attestedBy} />
                </EvidenceRow>
                <EvidenceRow label="Written on">{formatDate(mandate.confirmedAt)}</EvidenceRow>
                <EvidenceRow label="Validity">
                  {formatDateTime(mandate.validFrom)} – {formatDateTime(mandate.validTo)}
                </EvidenceRow>
                <EvidenceRow label="Scope">{mandate.scope}</EvidenceRow>
                {mandate.territory && (
                  <EvidenceRow label="Territory">{mandate.territory}</EvidenceRow>
                )}
                <EvidenceRow label="Supporting relationship">
                  {relationship ? (
                    <Link to={`/tx/${relationship.id}`} className="text-sky-600 hover:underline dark:text-sky-400">
                      Claim #{relationship.id} · {relationship.status} · {CONFIRMATION_LABEL[relationship.confirmation]}
                    </Link>
                  ) : mandate.evaluation.relationshipStatus === "Missing" ? (
                    "Not publicly available — this prevents a positive verdict"
                  ) : (
                    "Standalone mandate"
                  )}
                </EvidenceRow>
              </dl>
              {mandates.length > 1 && (
                <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500 dark:border-slate-800/70 dark:text-slate-400">
                  {mandates.length} mandates exist for this pair. This check prefers the newest
                  currently usable company- or issuer-confirmed mandate; when none exists it shows
                  the newest live self-assertion or newest historical record.
                </p>
              )}
            </Panel>
          )}

          <p className="text-center text-xs text-slate-400 dark:text-slate-500">
            Snapshot read {new Date(loadedAt).toLocaleString()} ·{" "}
            <a href={chainConfig.explorerUrl} target="_blank" rel="noreferrer" className="underline hover:text-sky-500">
              inspect the registry contract
            </a>
          </p>
        </>
      )}
    </div>
  );
}

function buildVerdict(
  mandate: Mandate | undefined,
  representative: Entity | undefined,
  organisation: Organisation | undefined,
  direct: DirectCheck,
): VerdictCopy {
  if (!representative || !organisation) {
    return {
      tone: "neutral",
      eyebrow: "Incomplete check",
      title: "Choose both parties",
      detail: "A representative and an organisation are both required.",
    };
  }
  if (!mandate) {
    return {
      tone: "negative",
      eyebrow: "No mandate found",
      title: "Do not treat this representative as authorised",
      detail: "The registry contains no representation mandate between these two records.",
    };
  }

  const { evaluation } = mandate;
  if (!evaluation.live) {
    if (evaluation.code === "scheduled") {
      return {
        tone: "caution",
        eyebrow: "Scheduled",
        title: "This mandate is not active yet",
        detail: `It starts ${formatDateTime(mandate.validFrom)}. Check again after that time.`,
      };
    }
    if (evaluation.code === "expired") {
      return {
        tone: "negative",
        eyebrow: "Expired",
        title: "This mandate is no longer valid",
        detail: `Its validity window ended ${formatDateTime(mandate.validTo)}.`,
      };
    }
    if (
      evaluation.organisationStatus === "Revoked" ||
      evaluation.representativeStatus === "Revoked"
    ) {
      return {
        tone: "negative",
        eyebrow: "Revoked badge",
        title: "This pair cannot be verified",
        detail: evaluation.reasons.join(" "),
      };
    }
    return {
      tone: "negative",
      eyebrow: "Unavailable",
      title: "The required trust records are not all active",
      detail: evaluation.reasons.join(" "),
    };
  }

  if (mandate.confirmation === "SelfAsserted") {
    return {
      tone: direct.state === "ready" && !direct.authorised ? "negative" : "caution",
      eyebrow: "Self-asserted only",
      title: "The organisation did not confirm this mandate",
      detail:
        direct.state === "ready" && !direct.authorised
          ? "The representative signed this claim themselves, and the contract's direct pair check returned no. This is not proof that the organisation authorised them."
          : "The representative signed this claim themselves. Their identity badge may be active, but this is not proof that the organisation authorised them.",
    };
  }
  if (direct.state === "ready" && !direct.authorised) {
    return {
      tone: "negative",
      eyebrow: "Direct contract check: no",
      title: "Do not rely on this mandate",
      detail: "The contract's current pair check did not confirm authorisation, even though the loaded record appears active.",
    };
  }
  if (mandate.confirmation === "IssuerConfirmed") {
    const pairConfirmed = direct.state === "ready" && direct.authorised;
    return {
      tone: pairConfirmed ? "positive" : "caution",
      eyebrow: "Issuer-confirmed",
      title: pairConfirmed
        ? "The issuer verified an active mandate"
        : "An issuer-confirmed mandate appears active",
      detail: pairConfirmed
        ? "An independent registry issuer recorded this after an off-chain check; the organisation did not sign it directly."
        : "The records appear usable, but the direct contract pair check has not returned a positive result. The organisation did not sign this mandate directly.",
    };
  }
  const pairConfirmed = direct.state === "ready" && direct.authorised;
  return {
    tone: pairConfirmed ? "positive" : "caution",
    eyebrow: "Company-confirmed",
    title: pairConfirmed
      ? "This representative is authorised now"
      : "A company-confirmed mandate appears active",
    detail: pairConfirmed
      ? "The organisation's controller signed the live mandate, its required records are active, and the direct contract pair check agrees."
      : "The organisation signed the mandate and its visible dependencies appear active, but the direct contract pair check has not returned a positive result.",
  };
}

function VerdictCard({
  verdict,
  direct,
  mandate,
}: {
  verdict: VerdictCopy;
  direct: DirectCheck;
  mandate?: Mandate;
}) {
  const styles = {
    positive: "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100",
    caution: "border-amber-500/30 bg-amber-500/10 text-amber-950 dark:text-amber-100",
    negative: "border-red-500/30 bg-red-500/10 text-red-950 dark:text-red-100",
    neutral: "border-slate-300 bg-slate-100 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
  }[verdict.tone];

  return (
    <section aria-live="polite" className={`rounded-2xl border px-5 py-5 sm:px-6 ${styles}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-75">{verdict.eyebrow}</p>
          <h2 className="mt-1 text-xl font-semibold">{verdict.title}</h2>
          <p className="mt-2 text-sm leading-6 opacity-80">{verdict.detail}</p>
        </div>
        {mandate && <StatusPill status={mandate.status} size="md" />}
      </div>
      <div className="mt-4 border-t border-current/10 pt-3 text-xs opacity-75">
        {direct.state === "checking" && "Repeating the contract's direct pair check…"}
        {direct.state === "ready" &&
          `Direct contract pair check: ${direct.authorised ? "yes" : "no"}. This boolean does not identify who signed, so provenance above still controls the wording.`}
        {direct.state === "failed" &&
          "The direct pair check could not be repeated. The visible result uses the loaded on-chain records and does not claim an independent live confirmation."}
        {direct.state === "idle" && "Direct contract pair check not run."}
      </div>
    </section>
  );
}

function LookupField({
  id,
  label,
  value,
  onChange,
  list,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  list: string;
  placeholder: string;
}) {
  return (
    <label htmlFor={id} className="space-y-1.5">
      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
      <input
        id={id}
        list={list}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
      />
    </label>
  );
}

function MissingSelection({
  representativeMissing,
  organisationMissing,
}: {
  representativeMissing: boolean;
  organisationMissing: boolean;
}) {
  const missing = [
    representativeMissing ? "representative" : "",
    organisationMissing ? "organisation" : "",
  ].filter(Boolean);
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-4 text-sm text-red-800 dark:text-red-300">
      No verified {missing.join(" or ")} record matched that value. Check the handle, numeric id, or
      Stellar controller address. A missing record is not a positive verification.
    </div>
  );
}

function EntitySummary({ label, entity }: { label: string; entity: Entity }) {
  const href = `/${entity.kind === "organisation" ? "org" : "person"}/${entity.id}`;
  return (
    <div className="space-y-2 px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link to={href} className="font-semibold text-slate-900 hover:text-sky-600 dark:text-slate-100 dark:hover:text-sky-400">
          {entity.name}
        </Link>
        <StatusPill status={entity.status} />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        @{entity.handle} · entity #{entity.id}
      </p>
      <HashId value={entity.controller} />
    </div>
  );
}

function EvidenceRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="max-w-xl text-right font-medium text-slate-800 dark:text-slate-100">{children}</dd>
    </div>
  );
}

function resolveEntity<T extends Entity>(input: string, entities: T[]): T | undefined {
  const raw = input.trim();
  if (!raw) return undefined;
  const comparable = raw.startsWith("@") ? raw.slice(1) : raw;
  const lower = comparable.toLowerCase();
  const upper = comparable.toUpperCase();
  return entities.find(
    (entity) =>
      entity.id === comparable ||
      entity.handle.toLowerCase() === lower ||
      entity.controller.toUpperCase() === upper ||
      (entity.kind === "organisation" && entity.domain.toLowerCase() === lower),
  );
}

function selectMandateForVerdict(mandates: Mandate[]): Mandate | undefined {
  return (
    mandates.find(
      (mandate) => mandate.evaluation.live && mandate.confirmation !== "SelfAsserted",
    ) ??
    mandates.find((mandate) => mandate.evaluation.live) ??
    mandates[0]
  );
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
