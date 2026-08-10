import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { HashId } from "../components/HashId";
import { Panel } from "../components/Panel";
import { useWallet } from "../context/WalletContext";
import { MandateType, RelationshipType } from "../contract/registry";
import { useRegistry } from "../data";
import type { Organisation, Person } from "../data/types";
import { chainConfig } from "../lib/chain";
import { FREIGHTER_URL, walletErrorMessage } from "../lib/wallet";
import {
  WriteFailure,
  canWithdrawHolderClaim,
  loadHolderClaim,
  loadHolderClaims,
  prepareMandate,
  preparePublication,
  prepareRelationship,
  prepareWithdrawal,
  submitMandate,
  submitPublication,
  submitRelationship,
  submitWithdrawal,
  type HolderClaim,
  type MandateInput,
  type PreparedClaim,
  type PreparedPublication,
  type PreparedWithdrawal,
  type RelationshipInput,
} from "../lib/write";

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
const PRIMARY =
  "inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-50";
const SECONDARY =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800";

const RELATIONSHIP_TYPES = [
  [RelationshipType.CurrentEmployee, "Current employee"],
  [RelationshipType.PastEmployee, "Past employee"],
  [RelationshipType.CurrentContractor, "Current contractor"],
  [RelationshipType.PastContractor, "Past contractor"],
  [RelationshipType.ExternalRepresentative, "External representative"],
  [RelationshipType.AgencyRepresentative, "Agency representative"],
  [RelationshipType.Advisor, "Advisor"],
] as const;

const MANDATE_TYPES = [
  [MandateType.Recruitment, "Recruitment"],
  [MandateType.Sales, "Sales"],
  [MandateType.Consulting, "Consulting"],
  [MandateType.Implementation, "Implementation"],
  [MandateType.Communications, "Communications"],
  [MandateType.Legal, "Legal"],
  [MandateType.Advisory, "Advisory"],
  [MandateType.EventRepresentation, "Event representation"],
  [MandateType.Partnership, "Partnership"],
] as const;

type Entity = Organisation | Person;
type Section = "relationship" | "mandate" | "publication" | "withdraw";
type OrganisationMandateRole = "authoriser" | "representative";
type Review =
  | { kind: "relationship"; prepared: PreparedClaim<RelationshipInput> }
  | { kind: "mandate"; prepared: PreparedClaim<MandateInput> }
  | { kind: "publication"; prepared: PreparedPublication }
  | { kind: "withdrawal"; prepared: PreparedWithdrawal };

interface CompletedWrite {
  title: string;
  claimId: string;
  transactionHash: string;
  ledger: number;
  explorerUrl: string;
}

export function Manage() {
  const wallet = useWallet();
  const registry = useRegistry();
  const actor = wallet.address ? registry.getByController(wallet.address) : undefined;
  const [section, setSection] = useState<Section>("relationship");
  const [claims, setClaims] = useState<HolderClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimsError, setClaimsError] = useState<string | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [completed, setCompleted] = useState<CompletedWrite | null>(null);

  const reloadClaims = useCallback(async () => {
    if (!actor) return;
    setClaimsLoading(true);
    setClaimsError(null);
    try {
      setClaims(await loadHolderClaims(actor));
    } catch (cause) {
      setClaimsError(writeErrorMessage(cause, "Could not read this badge's holder claim index."));
    } finally {
      setClaimsLoading(false);
    }
  }, [actor]);

  useEffect(() => {
    if (!actor) {
      setClaims([]);
      setClaimsError(null);
      return;
    }
    let cancelled = false;
    setClaimsLoading(true);
    setClaimsError(null);
    void loadHolderClaims(actor)
      .then((next) => {
        if (!cancelled) setClaims(next);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setClaimsError(writeErrorMessage(cause, "Could not read this badge's holder claim index."));
        }
      })
      .finally(() => {
        if (!cancelled) setClaimsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [actor]);

  async function handleCompleted(next: CompletedWrite) {
    setCompleted(next);
    registry.refresh();
    await reloadClaims();
  }

  if (!wallet.address) return <ConnectWallet />;
  if (!actor) return <NoControlledBadge address={wallet.address} />;

  if (completed) {
    return (
      <WriteConfirmed
        result={completed}
        onDone={() => {
          setCompleted(null);
          setReview(null);
        }}
      />
    );
  }

  if (review) {
    return (
      <ReviewTransaction
        review={review}
        onBack={() => setReview(null)}
        onCompleted={(next) => void handleCompleted(next)}
      />
    );
  }

  const canCreate = actor.status === "Active";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
          Holder console
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Manage on Stellar</h1>
        <p className="max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Prepare a precise claim, inspect exactly what it means, then let Freighter sign the real
          Soroban transaction. This page never asks for or receives a secret key.
        </p>
      </header>

      <Panel bodyClassName="p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{entityName(actor)}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                {actor.kind === "organisation" ? "Organisation" : "Person"} #{actor.id}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  actor.status === "Active"
                    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                }`}
              >
                {actor.status}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>Controller: <HashId value={actor.controller} /></span>
              <span>Freighter: {wallet.network ?? "connected"}</span>
              <span>Contract: <HashId value={chainConfig.contractId} /></span>
            </div>
          </div>
          <Link to={`/${actor.handle}`} className={SECONDARY}>View public record</Link>
        </div>
      </Panel>

      {!canCreate && (
        <Notice tone="warning">
          This badge is {actor.status.toLowerCase()}, so the contract will not accept new claims.
          Existing claims can still be withdrawn, and a relationship subject can still change its
          verifier listing below.
        </Notice>
      )}

      <div className="flex overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900/60">
        <SectionButton current={section} value="relationship" onClick={setSection}>
          Affiliation
        </SectionButton>
        <SectionButton current={section} value="mandate" onClick={setSection}>
          Mandate
        </SectionButton>
        {actor.kind === "person" && (
          <SectionButton current={section} value="publication" onClick={setSection}>
            Listing
          </SectionButton>
        )}
        <SectionButton current={section} value="withdraw" onClick={setSection}>
          Withdraw
        </SectionButton>
      </div>

      <div key={`${actor.id}:${section}`}>
        {section === "relationship" && (
          <RelationshipForm
            actor={actor}
            organisations={registry.organisations}
            people={registry.people}
            disabled={!canCreate}
            onReview={(prepared) => setReview({ kind: "relationship", prepared })}
          />
        )}
        {section === "mandate" && (
          <MandateForm
            actor={actor}
            organisations={registry.organisations}
            people={registry.people}
            holderClaims={claims}
            disabled={!canCreate}
            onReview={(prepared) => setReview({ kind: "mandate", prepared })}
          />
        )}
        {section === "publication" && actor.kind === "person" && (
          <PublicationForm
            actor={actor}
            organisations={registry.organisations}
            claims={claims}
            loading={claimsLoading}
            loadError={claimsError}
            onReload={() => void reloadClaims()}
            onReview={(prepared) => setReview({ kind: "publication", prepared })}
          />
        )}
        {section === "withdraw" && (
          <WithdrawalForm
            actor={actor}
            organisations={registry.organisations}
            people={registry.people}
            claims={claims}
            loading={claimsLoading}
            loadError={claimsError}
            onReload={() => void reloadClaims()}
            onReview={(prepared) => setReview({ kind: "withdrawal", prepared })}
          />
        )}
      </div>
    </div>
  );
}

function RelationshipForm({
  actor,
  organisations,
  people,
  disabled,
  onReview,
}: {
  actor: Entity;
  organisations: Organisation[];
  people: Person[];
  disabled: boolean;
  onReview: (prepared: PreparedClaim<RelationshipInput>) => void;
}) {
  const availableOrganisations = useMemo(
    () => organisations.filter((item) => item.status === "Active"),
    [organisations],
  );
  const availablePeople = useMemo(
    () => people.filter((item) => item.status === "Active"),
    [people],
  );
  const [counterpartyId, setCounterpartyId] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>(
    RelationshipType.CurrentEmployee,
  );
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [startDate, setStartDate] = useState(todayUtc());
  const [endDate, setEndDate] = useState("");
  const [publicDisplay, setPublicDisplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const organisation =
    actor.kind === "organisation"
      ? actor
      : availableOrganisations.find((item) => item.id === counterpartyId) ?? availableOrganisations[0];
  const person =
    actor.kind === "person"
      ? actor
      : availablePeople.find((item) => item.id === counterpartyId) ?? availablePeople[0];
  async function handleReview(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!organisation || !person) {
      setError(`No active ${actor.kind === "organisation" ? "person" : "organisation"} is available.`);
      return;
    }
    setBusy(true);
    try {
      onReview(
        await prepareRelationship({
          caller: actor.controller,
          actor,
          organisation,
          person,
          relationshipType,
          role,
          department,
          startAt: utcDaySeconds(startDate),
          endAt: endDate ? utcDaySeconds(endDate) : 0,
          publicDisplay,
        }),
      );
    } catch (cause) {
      setError(writeErrorMessage(cause, "Could not prepare this affiliation."));
    } finally {
      setBusy(false);
    }
  }

  const counterpart = actor.kind === "organisation" ? person : organisation;

  return (
    <Panel title={actor.kind === "organisation" ? "Attest a person's affiliation" : "Propose an affiliation"} bodyClassName="p-5">
      <form className="space-y-5" onSubmit={handleReview}>
        {actor.kind === "person" ? (
          <Notice tone="warning">
            This will be labelled <strong>self-asserted</strong>. It is your proposal and does not
            mean the organisation confirmed your role.
          </Notice>
        ) : (
          <Notice tone="info">
            Your organisation is the confirming counterparty. The record starts private because the
            person, not the company, controls whether an affiliation is listed by DoubleCheck. The
            plaintext contract record itself remains publicly inspectable.
          </Notice>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={actor.kind === "organisation" ? "Person" : "Organisation"}>
            <select
              className={INPUT}
              value={counterpart?.id ?? ""}
              onChange={(event) => setCounterpartyId(event.target.value)}
              disabled={disabled || (actor.kind === "organisation" ? !availablePeople.length : !availableOrganisations.length)}
              required
            >
              {(actor.kind === "organisation" ? availablePeople : availableOrganisations).map((item) => (
                <option key={item.id} value={item.id}>{entityName(item)} (@{item.handle})</option>
              ))}
            </select>
          </Field>
          <Field label="Relationship type">
            <select
              className={INPUT}
              value={relationshipType}
              onChange={(event) => setRelationshipType(Number(event.target.value) as RelationshipType)}
              disabled={disabled}
            >
              {RELATIONSHIP_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Role" hint="Written in plaintext to Stellar. Do not include sensitive data.">
            <input className={INPUT} value={role} onChange={(event) => setRole(event.target.value)} disabled={disabled} maxLength={128} required />
          </Field>
          <Field label="Department (optional)">
            <input className={INPUT} value={department} onChange={(event) => setDepartment(event.target.value)} disabled={disabled} maxLength={128} />
          </Field>
          <Field label="Start date" hint="Interpreted as 00:00 UTC.">
            <input type="date" className={INPUT} value={startDate} max={todayUtc()} onChange={(event) => setStartDate(event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="End date (optional)" hint="Leave empty for an ongoing affiliation.">
            <input type="date" className={INPUT} value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} disabled={disabled} />
          </Field>
        </div>

        {actor.kind === "person" && (
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800">
            <input type="checkbox" className="mt-0.5" checked={publicDisplay} onChange={(event) => setPublicDisplay(event.target.checked)} disabled={disabled} />
            <span>
              <strong className="block">Publish this self-asserted affiliation</strong>
              <span className="text-slate-500 dark:text-slate-400">If unchecked, it is omitted from DoubleCheck's public pages and search. The plaintext contract record is still publicly readable on Stellar.</span>
            </span>
          </label>
        )}

        <ErrorBox message={error} />
        <div className="flex justify-end">
          <button type="submit" className={PRIMARY} disabled={disabled || busy || !counterpart}>
            {busy ? "Hashing statement…" : "Review exact statement"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function MandateForm({
  actor,
  organisations,
  people,
  holderClaims,
  disabled,
  onReview,
}: {
  actor: Entity;
  organisations: Organisation[];
  people: Person[];
  holderClaims: HolderClaim[];
  disabled: boolean;
  onReview: (prepared: PreparedClaim<MandateInput>) => void;
}) {
  const availableOrganisations = useMemo(
    () => organisations.filter((item) => item.status === "Active" && item.id !== actor.id),
    [actor.id, organisations],
  );
  const availableRepresentatives = useMemo<Entity[]>(
    () => [
      ...people.filter((item) => item.status === "Active"),
      ...organisations.filter((item) => item.status === "Active" && item.id !== actor.id),
    ],
    [actor.id, organisations, people],
  );
  const [organisationRole, setOrganisationRole] = useState<OrganisationMandateRole>("authoriser");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [relationshipId, setRelationshipId] = useState("");
  const [mandateType, setMandateType] = useState<MandateType>(MandateType.Recruitment);
  const [scope, setScope] = useState("");
  const [territory, setTerritory] = useState("");
  const [validFrom, setValidFrom] = useState(nowUtcMinute());
  const [validUntil, setValidUntil] = useState(utcMinuteAfterDays(30));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actorIsRepresentative = actor.kind === "person" || organisationRole === "representative";
  const organisation = actorIsRepresentative
    ? availableOrganisations.find((item) => item.id === counterpartyId) ?? availableOrganisations[0]
    : actor;
  const representative = actorIsRepresentative
    ? actor
    : availableRepresentatives.find((item) => item.id === counterpartyId) ?? availableRepresentatives[0];
  const linkableRelationships = holderClaims.filter(
    (claim) =>
      claim.kind === "relationship" &&
      representative?.kind === "person" &&
      claim.organisationId === organisation?.id &&
      claim.subjectId === representative?.id &&
      claim.statusLabel === "Active" &&
      claim.publicDisplay === true,
  );
  const selectedRelationship = linkableRelationships.find((claim) => claim.id === relationshipId);
  const counterpart = actorIsRepresentative ? organisation : representative;

  async function handleReview(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!organisation || !representative) {
      setError(`No active ${actorIsRepresentative ? "organisation" : "representative"} is available.`);
      return;
    }
    setBusy(true);
    try {
      onReview(
        await prepareMandate({
          caller: actor.controller,
          actor,
          organisation,
          representative,
          relationshipId: selectedRelationship?.id ?? null,
          mandateType,
          scope,
          territory,
          validFrom: utcMinuteSeconds(validFrom),
          validUntil: utcMinuteSeconds(validUntil),
        }),
      );
    } catch (cause) {
      setError(writeErrorMessage(cause, "Could not prepare this mandate."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel title={actorIsRepresentative ? "Propose a mandate" : "Issue a time-bounded mandate"} bodyClassName="p-5">
      <form className="space-y-5" onSubmit={handleReview}>
        {actor.kind === "organisation" && (
          <Field label="Your organisation is acting as">
            <select
              className={INPUT}
              value={organisationRole}
              onChange={(event) => {
                setOrganisationRole(event.target.value as OrganisationMandateRole);
                setCounterpartyId("");
                setRelationshipId("");
              }}
              disabled={disabled}
            >
              <option value="authoriser">The hiring company / authorising organisation</option>
              <option value="representative">A representative agency proposing a mandate</option>
            </select>
          </Field>
        )}

        {actorIsRepresentative ? (
          <Notice tone="warning">
            A representative-created mandate is <strong>a self-asserted proposal only</strong>. It
            does not authorise this person or agency to act for the company and will not produce an
            authorised verdict.
          </Notice>
        ) : (
          <Notice tone="info">
            Your organisation will be the confirming signer. Keep the scope narrow and the validity
            window short enough for the engagement.
          </Notice>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={actorIsRepresentative ? "Organisation" : "Representative person or agency"}>
            <select
              className={INPUT}
              value={counterpart?.id ?? ""}
              onChange={(event) => {
                setCounterpartyId(event.target.value);
                setRelationshipId("");
              }}
              disabled={disabled || (actorIsRepresentative ? !availableOrganisations.length : !availableRepresentatives.length)}
              required
            >
              {(actorIsRepresentative ? availableOrganisations : availableRepresentatives).map((item) => (
                <option key={`${item.kind}:${item.id}`} value={item.id}>
                  {entityName(item)} (@{item.handle}){item.kind === "organisation" ? " · agency/organisation" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Mandate type">
            <select className={INPUT} value={mandateType} onChange={(event) => setMandateType(Number(event.target.value) as MandateType)} disabled={disabled}>
              {MANDATE_TYPES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Scope" hint="Written in plaintext to Stellar. State only what the representative may do.">
            <input className={INPUT} value={scope} onChange={(event) => setScope(event.target.value)} disabled={disabled} maxLength={128} required />
          </Field>
          <Field label="Territory (optional)">
            <input className={INPUT} value={territory} onChange={(event) => setTerritory(event.target.value)} disabled={disabled} maxLength={128} />
          </Field>
          <Field label="Valid from (UTC)">
            <input type="datetime-local" className={INPUT} value={validFrom} onChange={(event) => setValidFrom(event.target.value)} disabled={disabled} required />
          </Field>
          <Field label="Valid until (UTC)" hint="Must be after the start and no more than one year later.">
            <input type="datetime-local" className={INPUT} value={validUntil} min={validFrom} onChange={(event) => setValidUntil(event.target.value)} disabled={disabled} required />
          </Field>
        </div>

        <Field label="Supporting public affiliation (optional)" hint="Only active, published affiliations between this exact pair are offered.">
          <select className={INPUT} value={selectedRelationship?.id ?? ""} onChange={(event) => setRelationshipId(event.target.value)} disabled={disabled || !linkableRelationships.length}>
            <option value="">Standalone mandate</option>
            {linkableRelationships.map((claim) => (
              <option key={claim.id} value={claim.id}>#{claim.id} · {claim.typeLabel} · {claim.summary}</option>
            ))}
          </select>
        </Field>

        <ErrorBox message={error} />
        <div className="flex justify-end">
          <button type="submit" className={PRIMARY} disabled={disabled || busy || !counterpart}>
            {busy ? "Hashing statement…" : "Review exact statement"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function PublicationForm({
  actor,
  organisations,
  claims,
  loading,
  loadError,
  onReload,
  onReview,
}: {
  actor: Person;
  organisations: Organisation[];
  claims: HolderClaim[];
  loading: boolean;
  loadError: string | null;
  onReload: () => void;
  onReview: (prepared: PreparedPublication) => void;
}) {
  const [manualClaim, setManualClaim] = useState<HolderClaim | null>(null);
  const [manualId, setManualId] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const combinedClaims = manualClaim && !claims.some(
    (claim) => claim.kind === manualClaim.kind && claim.id === manualClaim.id,
  )
    ? [manualClaim, ...claims]
    : claims;
  const relationships = combinedClaims.filter(
    (claim) => claim.kind === "relationship" && claim.subjectId === actor.id,
  );
  const selected = relationships.find((claim) => claim.id === selectedId) ?? relationships[0];

  function handleReview(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selected) {
      setError("There is no relationship listing for this badge to change.");
      return;
    }
    try {
      onReview(
        preparePublication({
          caller: actor.controller,
          actor,
          claim: selected,
          publicDisplay: selected.publicDisplay !== true,
        }),
      );
    } catch (cause) {
      setError(writeErrorMessage(cause, "Could not prepare this listing change."));
    }
  }

  async function handleLookup() {
    setError(null);
    setLookingUp(true);
    try {
      const found = await loadHolderClaim(actor, manualId.trim());
      if (found.kind !== "relationship" || found.subjectId !== actor.id) {
        throw new WriteFailure(
          "controller",
          "Only a relationship naming this person can have its listing changed here.",
        );
      }
      setManualClaim(found);
      setSelectedId(found.id);
    } catch (cause) {
      setError(writeErrorMessage(cause, "Could not load that relationship reference."));
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <Panel title="Choose verifier listings" bodyClassName="p-5">
      <form className="space-y-5" onSubmit={handleReview}>
        <Notice tone="info">
          This controls only DoubleCheck&apos;s official public pages, search, feeds, and whether a
          linked mandate can verify. The relationship record is already public on Stellar. Listing
          it does not confirm its truth or give company authority.
        </Notice>

        {loading && <p className="text-sm text-slate-500">Reading holder claim indexes from Stellar…</p>}
        {loadError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-300">
            <span>{loadError}</span>
            <button type="button" className={SECONDARY} onClick={onReload}>Retry</button>
          </div>
        )}
        {!loading && !loadError && relationships.length === 0 && (
          <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No relationship naming this person was found in the bounded party index.
          </p>
        )}

        <div className="space-y-2">
          {relationships.map((claim) => {
            const organisation = organisations.find((item) => item.id === claim.organisationId);
            return (
              <label
                key={claim.id}
                className={`block cursor-pointer rounded-lg border p-3 transition ${
                  selected?.id === claim.id
                    ? "border-sky-500 bg-sky-500/5"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"
                }`}
              >
                <span className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="publication-claim"
                    value={claim.id}
                    checked={selected?.id === claim.id}
                    onChange={() => setSelectedId(claim.id)}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      Relationship #{claim.id}
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        claim.publicDisplay
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-violet-500/10 text-violet-700 dark:text-violet-300"
                      }`}>
                        {claim.publicDisplay ? "Listed" : "Not listed"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {claim.statusLabel}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">
                      {claim.typeLabel}: {claim.summary}
                    </span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
                      {organisation?.name ?? `Organisation #${claim.organisationId}`} · {claim.confirmationLabel}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-sm font-medium">Relationship not listed above?</div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Party indexes are bounded. Load a known claim number directly; only a relationship that
            names this person can proceed.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              className={INPUT}
              value={manualId}
              onChange={(event) => setManualId(event.target.value)}
              placeholder="Relationship claim number"
              aria-label="Relationship claim number"
            />
            <button
              type="button"
              className={SECONDARY}
              onClick={() => void handleLookup()}
              disabled={lookingUp || !/^[1-9]\d*$/.test(manualId.trim())}
            >
              {lookingUp ? "Looking up…" : "Load relationship"}
            </button>
          </div>
        </div>

        <ErrorBox message={error} />
        <div className="flex justify-end">
          <button type="submit" className={PRIMARY} disabled={!selected || loading || Boolean(loadError)}>
            {selected?.publicDisplay ? "Review removal from listings" : "Review public listing"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function WithdrawalForm({
  actor,
  organisations,
  people,
  claims,
  loading,
  loadError,
  onReload,
  onReview,
}: {
  actor: Entity;
  organisations: Organisation[];
  people: Person[];
  claims: HolderClaim[];
  loading: boolean;
  loadError: string | null;
  onReload: () => void;
  onReview: (prepared: PreparedWithdrawal) => void;
}) {
  const [manualClaim, setManualClaim] = useState<HolderClaim | null>(null);
  const [manualId, setManualId] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const combinedClaims = manualClaim && !claims.some(
    (claim) => claim.kind === manualClaim.kind && claim.id === manualClaim.id,
  )
    ? [manualClaim, ...claims]
    : claims;
  const withdrawable = combinedClaims.filter(canWithdrawHolderClaim);
  const [selectedId, setSelectedId] = useState("");
  const selected = withdrawable.find((claim) => `${claim.kind}:${claim.id}` === selectedId) ?? withdrawable[0];
  const [error, setError] = useState<string | null>(null);

  function handleReview(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!selected) {
      setError("There is no withdrawable claim for this badge.");
      return;
    }
    try {
      onReview(prepareWithdrawal({ caller: actor.controller, actor, claim: selected }));
    } catch (cause) {
      setError(writeErrorMessage(cause, "Could not prepare this withdrawal."));
    }
  }

  async function handleLookup() {
    setError(null);
    setLookingUp(true);
    try {
      const found = await loadHolderClaim(actor, manualId.trim());
      setManualClaim(found);
      setSelectedId(`${found.kind}:${found.id}`);
      if (!canWithdrawHolderClaim(found)) {
        setError(`Claim #${found.id} is already ${found.statusLabel.toLowerCase()} and cannot be withdrawn.`);
      }
    } catch (cause) {
      setError(writeErrorMessage(cause, "Could not load that claim reference."));
    } finally {
      setLookingUp(false);
    }
  }

  return (
    <Panel title="Withdraw a claim" bodyClassName="p-5">
      <form className="space-y-5" onSubmit={handleReview}>
        <Notice tone="warning">
          This transaction sets the claim to withdrawn and leaves its history on Stellar. vNext
          makes that state terminal. Testnet remains demonstration infrastructure, so do not use it
          for a consequential production decision.
        </Notice>

        {loading && <p className="text-sm text-slate-500">Reading holder claim indexes from Stellar…</p>}
        {loadError && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700 dark:text-rose-300">
            <span>{loadError}</span>
            <button type="button" className={SECONDARY} onClick={onReload}>Retry</button>
          </div>
        )}
        {!loading && !loadError && withdrawable.length === 0 && (
          <p className="rounded-lg border border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
            No claim controlled by or about this badge can currently be withdrawn.
          </p>
        )}

        <div className="space-y-2">
          {withdrawable.map((claim) => {
            const value = `${claim.kind}:${claim.id}`;
            const counterpart = counterpartName(claim, actor, organisations, people);
            return (
              <label key={value} className={`block cursor-pointer rounded-lg border p-3 transition ${selected?.id === claim.id && selected.kind === claim.kind ? "border-sky-500 bg-sky-500/5" : "border-slate-200 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700"}`}>
                <span className="flex items-start gap-3">
                  <input type="radio" name="claim" value={value} checked={selected?.id === claim.id && selected.kind === claim.kind} onChange={() => setSelectedId(value)} className="mt-1" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                      {claim.kind === "relationship" ? "Affiliation" : "Mandate"} #{claim.id}
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">{claim.statusLabel}</span>
                      {claim.kind === "relationship" && claim.publicDisplay === false && (
                        <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300">Not listed</span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm text-slate-600 dark:text-slate-300">{claim.typeLabel}: {claim.summary}</span>
                    <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">With {counterpart} · {claim.confirmationLabel}</span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div className="text-sm font-medium">Claim not listed?</div>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Party indexes are bounded. If you know the on-chain claim reference, load it directly;
            only a claim that names this badge as a party can proceed.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              className={INPUT}
              value={manualId}
              onChange={(event) => setManualId(event.target.value)}
              placeholder="Claim number"
              aria-label="Claim number"
            />
            <button type="button" className={SECONDARY} onClick={() => void handleLookup()} disabled={lookingUp || !/^[1-9]\d*$/.test(manualId.trim())}>
              {lookingUp ? "Looking up…" : "Load claim"}
            </button>
          </div>
        </div>

        <ErrorBox message={error} />
        <div className="flex justify-end">
          <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50" disabled={!selected || loading || Boolean(loadError)}>
            Review withdrawal
          </button>
        </div>
      </form>
    </Panel>
  );
}

function ReviewTransaction({
  review,
  onBack,
  onCompleted,
}: {
  review: Review;
  onBack: () => void;
  onCompleted: (result: CompletedWrite) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isWithdrawal = review.kind === "withdrawal";
  const isPublication = review.kind === "publication";
  const hasDetailHash = review.kind === "relationship" || review.kind === "mandate";
  const statement = review.prepared.exactStatement;
  const tier = review.prepared.confirmationLabel;

  async function handleSign() {
    setBusy(true);
    setError(null);
    try {
      if (review.kind === "relationship") {
        const receipt = await submitRelationship(review.prepared);
        onCompleted({
          title: "Affiliation confirmed on Stellar",
          claimId: receipt.result.toString(),
          transactionHash: receipt.hash,
          ledger: receipt.ledger,
          explorerUrl: receipt.explorerUrl,
        });
      } else if (review.kind === "mandate") {
        const receipt = await submitMandate(review.prepared);
        onCompleted({
          title: review.prepared.confirmation === "SelfAsserted" ? "Mandate proposal confirmed on Stellar" : "Mandate confirmed on Stellar",
          claimId: receipt.result.toString(),
          transactionHash: receipt.hash,
          ledger: receipt.ledger,
          explorerUrl: receipt.explorerUrl,
        });
      } else if (review.kind === "publication") {
        const receipt = await submitPublication(review.prepared);
        onCompleted({
          title: review.prepared.input.publicDisplay
            ? "Relationship listing enabled on Stellar"
            : "Relationship listing disabled on Stellar",
          claimId: review.prepared.input.claim.id,
          transactionHash: receipt.hash,
          ledger: receipt.ledger,
          explorerUrl: receipt.explorerUrl,
        });
      } else {
        const receipt = await submitWithdrawal(review.prepared);
        onCompleted({
          title: "Withdrawal confirmed on Stellar",
          claimId: review.prepared.input.claim.id,
          transactionHash: receipt.hash,
          ledger: receipt.ledger,
          explorerUrl: receipt.explorerUrl,
        });
      }
    } catch (cause) {
      setError(writeErrorMessage(cause, "Stellar did not confirm this transaction."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">Final review</p>
        <h1 className="text-2xl font-semibold tracking-tight">Read before signing</h1>
        <p className="text-sm leading-6 text-slate-500 dark:text-slate-400">
          The wallet prompt contains a Soroban transaction, not this prose. Confirm that this exact
          human-readable statement matches your intent before opening Freighter.
        </p>
      </header>

      <Panel bodyClassName="p-5">
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Confirmation tier</div>
            <div className={`mt-2 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${tier.includes("Self-asserted") ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : isWithdrawal ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" : isPublication ? "bg-sky-500/10 text-sky-700 dark:text-sky-300" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"}`}>
              {tier}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact statement</div>
            <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm font-medium leading-6 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
              {statement}
            </p>
          </div>

          {hasDetailHash && (
            <>
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">SHA-256 detail_hash</div>
                <div className="mt-2 break-all rounded-lg bg-slate-100 p-3 font-mono text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                  {review.prepared.detailHashHex}
                </div>
                <p className="mt-1 text-xs text-slate-500">The contract stores this digest of the canonical statement below.</p>
              </div>
              <details className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                <summary className="cursor-pointer text-sm font-medium">Canonical statement bytes</summary>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-600 dark:text-slate-300">{review.prepared.canonicalStatement}</pre>
              </details>
            </>
          )}

          <div className="grid gap-3 rounded-lg border border-slate-200 p-3 text-xs text-slate-500 sm:grid-cols-2 dark:border-slate-800 dark:text-slate-400">
            <span>Network: {networkName()}</span>
            <span>Contract: <HashId value={chainConfig.contractId} /></span>
          </div>

          <Notice tone="info">
            After you continue, the app re-checks the active Freighter account, network, and current
            on-chain controller; simulates the contract call; then asks Freighter to sign. Success is
            shown only after the ledger reports a confirmed transaction.
          </Notice>

          <ErrorBox message={error} />
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" className={SECONDARY} onClick={onBack} disabled={busy}>Back and edit</button>
            <button type="button" className={isWithdrawal ? "inline-flex items-center justify-center rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500 disabled:opacity-50" : PRIMARY} onClick={() => void handleSign()} disabled={busy}>
              {busy ? "Waiting for Stellar confirmation…" : "Confirm and open Freighter"}
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function WriteConfirmed({ result, onDone }: { result: CompletedWrite; onDone: () => void }) {
  return (
    <div className="mx-auto max-w-2xl py-8">
      <Panel bodyClassName="p-6 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <h1 className="mt-4 text-xl font-semibold">{result.title}</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Claim reference #{result.claimId} · confirmed in ledger {result.ledger}.</p>
        <div className="mx-auto mt-4 max-w-lg rounded-lg bg-slate-100 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          Transaction <HashId value={result.transactionHash} />
        </div>
        <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
          <a href={result.explorerUrl} target="_blank" rel="noreferrer" className={PRIMARY}>View Stellar transaction</a>
          <button type="button" className={SECONDARY} onClick={onDone}>Back to holder console</button>
        </div>
      </Panel>
    </div>
  );
}

function ConnectWallet() {
  const { connecting, failure, available, connect } = useWallet();
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <Panel bodyClassName="p-6">
        <h1 className="text-xl font-semibold">Connect the badge controller</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Holder actions require the current on-chain controller. Freighter keeps the secret key in
          the extension; DoubleCheck receives only the public address and signed transaction XDR.
        </p>
        {failure && <div className="mt-4"><ErrorBox message={walletErrorMessage(failure)} /></div>}
        <div className="mt-5">
          {available ? (
            <button type="button" className={PRIMARY} onClick={() => void connect()} disabled={connecting}>{connecting ? "Connecting…" : "Connect Freighter"}</button>
          ) : (
            <a href={FREIGHTER_URL} target="_blank" rel="noreferrer" className={PRIMARY}>Install Freighter</a>
          )}
        </div>
      </Panel>
    </div>
  );
}

function NoControlledBadge({ address }: { address: string }) {
  return (
    <div className="mx-auto max-w-lg py-12 text-center">
      <Panel bodyClassName="p-6">
        <h1 className="text-xl font-semibold">No controlled badge on this network</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          The configured Stellar registry does not map <HashId value={address} /> to an entity. A
          wallet connection cannot mint or claim a badge.
        </p>
        <Link to="/apply" className={`${PRIMARY} mt-5`}>Apply for verification</Link>
      </Panel>
    </div>
  );
}

function SectionButton({ current, value, onClick, children }: { current: Section; value: Section; onClick: (value: Section) => void; children: ReactNode }) {
  const active = current === value;
  return (
    <button type="button" onClick={() => onClick(value)} className={`min-w-32 flex-1 rounded-lg px-4 py-2 text-sm font-semibold transition ${active ? "bg-sky-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`} aria-pressed={active}>
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
      {label}
      <span className="mt-1.5 block">{children}</span>
      {hint && <span className="mt-1 block text-xs font-normal leading-5 text-slate-500 dark:text-slate-400">{hint}</span>}
    </label>
  );
}

function Notice({ tone, children }: { tone: "info" | "warning"; children: ReactNode }) {
  return (
    <div className={`rounded-lg border p-3 text-sm leading-6 ${tone === "warning" ? "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-200" : "border-sky-500/25 bg-sky-500/5 text-sky-800 dark:text-sky-200"}`}>
      {children}
    </div>
  );
}

function ErrorBox({ message }: { message: string | null }) {
  if (!message) return null;
  return <div role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm leading-6 text-rose-700 dark:text-rose-300">{message}</div>;
}

function counterpartName(claim: HolderClaim, actor: Entity, organisations: Organisation[], people: Person[]): string {
  const id = actor.id === claim.organisationId ? claim.subjectId : claim.organisationId;
  const entity = [...people, ...organisations].find((item) => item.id === id);
  return entity ? entityName(entity) : `entity #${id}`;
}

function entityName(entity: Entity): string {
  return entity.name || `@${entity.handle}`;
}

function writeErrorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof WriteFailure) return cause.message;
  if (cause instanceof Error && cause.message.trim()) return `${fallback} ${cause.message}`;
  return fallback;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowUtcMinute(): string {
  return new Date().toISOString().slice(0, 16);
}

function utcMinuteAfterDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

function utcDaySeconds(value: string): number {
  return Math.floor(new Date(`${value}T00:00:00.000Z`).getTime() / 1000);
}

function utcMinuteSeconds(value: string): number {
  return Math.floor(new Date(`${value}:00.000Z`).getTime() / 1000);
}

function networkName(): string {
  return chainConfig.networkPassphrase.includes("Test SDF") ? "Stellar Testnet" : "Stellar Public Network";
}
