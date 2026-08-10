import { StrKey } from "@stellar/stellar-sdk";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Panel } from "../components/Panel";
import { useWallet } from "../context/WalletContext";
import {
  IntakeError,
  submitIntake,
  type ApplicantType,
  type ApplicationIntake,
  type IntakeReceipt,
  type ReadinessItem,
  type TeamSize,
} from "../lib/intake";

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const APPLICANTS: Array<{
  value: ApplicantType;
  title: string;
  description: string;
}> = [
  {
    value: "recruiter",
    title: "Recruiter",
    description: "An individual recruiter or independent talent professional.",
  },
  {
    value: "agency",
    title: "Recruiting agency",
    description: "An agency applying for organisation verification and recruiter seats.",
  },
  {
    value: "hiring-company",
    title: "Hiring company",
    description: "An employer that wants to confirm its recruiters and live mandates.",
  },
];

const READINESS: Array<{
  value: ReadinessItem;
  title: string;
  detail: string;
  for: ApplicantType[];
}> = [
  {
    value: "identity-liveness",
    title: "Government ID and liveness",
    detail: "For the person representing this application.",
    for: ["recruiter", "agency", "hiring-company"],
  },
  {
    value: "professional-profile",
    title: "Professional history",
    detail: "A LinkedIn, X, portfolio or comparable work-history profile.",
    for: ["recruiter", "agency"],
  },
  {
    value: "work-email",
    title: "Work email or affiliation",
    detail: "Access to an address on the employer or agency domain.",
    for: ["recruiter", "agency", "hiring-company"],
  },
  {
    value: "references",
    title: "References and track record",
    detail: "At least two candidate or client references can be checked.",
    for: ["recruiter", "agency"],
  },
  {
    value: "business-registration",
    title: "Business registration",
    detail: "Company registration and ownership information are available.",
    for: ["agency", "hiring-company"],
  },
  {
    value: "domain-control",
    title: "Company-domain control",
    detail: "A DNS or domain-email challenge can be completed.",
    for: ["agency", "hiring-company"],
  },
  {
    value: "code-of-conduct",
    title: "Code of conduct",
    detail: "You can accept expiry, complaints and revocation rules.",
    for: ["recruiter", "agency", "hiring-company"],
  },
];

type FormState = Omit<ApplicationIntake, "kind">;

const INITIAL_FORM: FormState = {
  applicantType: "recruiter",
  contactName: "",
  workEmail: "",
  jurisdiction: "",
  preferredHandle: "",
  organisationName: "",
  website: "",
  professionalProfile: "",
  currentRole: "",
  teamSize: "",
  background: "",
  hiringNeed: "",
  controllerAddress: "",
  readiness: [],
  notes: "",
  termsAccepted: false,
  privacyAccepted: false,
  accuracyConfirmed: false,
  faxNumber: "",
};

export function Apply() {
  const { address } = useWallet();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [receipt, setReceipt] = useState<IntakeReceipt | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function chooseApplicant(applicantType: ApplicantType) {
    update("applicantType", applicantType);
    setError(null);
  }

  function toggleReadiness(value: ReadinessItem) {
    update(
      "readiness",
      form.readiness.includes(value)
        ? form.readiness.filter((item) => item !== value)
        : [...form.readiness, value],
    );
  }

  function advanceProfile(): boolean {
    const errors = validateProfile(form);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) {
      setError("Complete the required profile fields before continuing.");
      return false;
    }
    setStep(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
    return true;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (step === 1) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (step === 2) {
      advanceProfile();
      return;
    }

    const errors = validateFinal(form);
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) {
      setError("Review the controller address and required consents.");
      return;
    }

    setSubmitting(true);
    try {
      const nextReceipt = await submitIntake({ kind: "application", ...form });
      setReceipt(nextReceipt);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (cause) {
      if (cause instanceof IntakeError) {
        setError(cause.message);
        setFieldErrors(cause.fieldErrors);
        if (hasProfileError(cause.fieldErrors)) setStep(2);
      } else {
        setError("The intake service did not confirm this submission. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function restart() {
    setForm(INITIAL_FORM);
    setStep(1);
    setError(null);
    setFieldErrors({});
    setReceipt(null);
  }

  if (receipt) return <ApplicationReceived receipt={receipt} onRestart={restart} />;

  const roleTitle = APPLICANTS.find((item) => item.value === form.applicantType)?.title ?? "Applicant";
  const relevantReadiness = READINESS.filter((item) => item.for.includes(form.applicantType));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-400">
          Manual verification
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Apply to DoubleCheck</h1>
        <p className="max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          Tell the review team who you are and what can be independently checked. Applying starts a
          private, manual review; it does not verify you or create a badge.
        </p>
      </header>

      <div className="rounded-xl border border-sky-500/25 bg-sky-500/5 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
        <strong className="font-semibold text-sky-700 dark:text-sky-300">Off-chain by design.</strong>{" "}
        Application details, identity checks and references are never written to Stellar. If approved,
        a later consent step will show the exact credential hash and expiry before any on-chain badge is
        activated.
      </div>

      <StepIndicator current={step} />

      <form onSubmit={(event) => void handleSubmit(event)} noValidate>
        {step === 1 && (
          <Panel title="1. Who are you applying for?">
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {APPLICANTS.map((applicant) => {
                const selected = form.applicantType === applicant.value;
                return (
                  <button
                    key={applicant.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => chooseApplicant(applicant.value)}
                    className={`rounded-xl border p-4 text-left transition ${
                      selected
                        ? "border-sky-500 bg-sky-500/5 ring-1 ring-sky-500"
                        : "border-slate-200 hover:border-sky-300 dark:border-slate-700 dark:hover:border-sky-600"
                    }`}
                  >
                    <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {applicant.title}
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {applicant.description}
                    </span>
                  </button>
                );
              })}
            </div>
            <FormActions>
              <PrimaryButton>Continue as {roleTitle}</PrimaryButton>
            </FormActions>
          </Panel>
        )}

        {step === 2 && (
          <Panel title="2. Contact and verification profile">
            <div className="grid gap-5 p-4 sm:grid-cols-2">
              <Field label="Contact name" error={fieldErrors.contactName} required>
                <input
                  id="apply-contact-name"
                  value={form.contactName}
                  onChange={(event) => update("contactName", event.target.value)}
                  maxLength={100}
                  autoComplete="name"
                  className={INPUT}
                />
              </Field>
              <Field label="Contact or work email" error={fieldErrors.workEmail} required>
                <input
                  id="apply-work-email"
                  type="email"
                  value={form.workEmail}
                  onChange={(event) => update("workEmail", event.target.value)}
                  maxLength={254}
                  autoComplete="email"
                  className={INPUT}
                />
              </Field>
              <Field label="Country or jurisdiction" error={fieldErrors.jurisdiction} required>
                <input
                  id="apply-jurisdiction"
                  value={form.jurisdiction}
                  onChange={(event) => update("jurisdiction", event.target.value)}
                  maxLength={100}
                  autoComplete="country-name"
                  placeholder="e.g. Poland"
                  className={INPUT}
                />
              </Field>
              <Field
                label="Preferred public handle"
                hint="3–64 lowercase characters; availability is confirmed during review"
                error={fieldErrors.preferredHandle}
                required
              >
                <input
                  id="apply-preferred-handle"
                  value={form.preferredHandle}
                  onChange={(event) => update("preferredHandle", event.target.value.toLowerCase())}
                  minLength={3}
                  maxLength={64}
                  pattern="[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="e.g. ada-recruits"
                  className={`${INPUT} font-mono`}
                />
              </Field>

              {form.applicantType === "recruiter" ? (
                <Field label="Current role" error={fieldErrors.currentRole} required>
                  <input
                    id="apply-current-role"
                    value={form.currentRole}
                    onChange={(event) => update("currentRole", event.target.value)}
                    maxLength={120}
                    placeholder="e.g. Senior technical recruiter"
                    className={INPUT}
                  />
                </Field>
              ) : (
                <Field label="Approximate team size" error={fieldErrors.teamSize} required>
                  <select
                    id="apply-team-size"
                    value={form.teamSize}
                    onChange={(event) => update("teamSize", event.target.value as TeamSize | "")}
                    className={INPUT}
                  >
                    <option value="">Choose…</option>
                    <option value="solo">One person</option>
                    <option value="2-10">2–10</option>
                    <option value="11-50">11–50</option>
                    <option value="51-250">51–250</option>
                    <option value="251+">251+</option>
                  </select>
                </Field>
              )}

              <Field
                label={form.applicantType === "recruiter" ? "Agency or employer" : "Organisation legal name"}
                hint={form.applicantType === "recruiter" ? "Optional for independent recruiters" : undefined}
                error={fieldErrors.organisationName}
                required={form.applicantType !== "recruiter"}
              >
                <input
                  id="apply-organisation-name"
                  value={form.organisationName}
                  onChange={(event) => update("organisationName", event.target.value)}
                  maxLength={140}
                  autoComplete="organization"
                  className={INPUT}
                />
              </Field>
              <Field
                label="Organisation website"
                hint={form.applicantType === "recruiter" ? "Optional; HTTPS only" : "Used for a later domain challenge"}
                error={fieldErrors.website}
                required={form.applicantType !== "recruiter"}
              >
                <input
                  id="apply-website"
                  type="url"
                  value={form.website}
                  onChange={(event) => update("website", event.target.value)}
                  maxLength={500}
                  autoComplete="url"
                  placeholder="https://example.com"
                  className={INPUT}
                />
              </Field>
              <Field
                label="Professional profile"
                hint="LinkedIn, X or a professional portfolio; HTTPS only"
                error={fieldErrors.professionalProfile}
                required={form.applicantType === "recruiter"}
                className="sm:col-span-2"
              >
                <input
                  id="apply-professional-profile"
                  type="url"
                  value={form.professionalProfile}
                  onChange={(event) => update("professionalProfile", event.target.value)}
                  maxLength={500}
                  placeholder="https://…"
                  className={INPUT}
                />
              </Field>
              <Field
                label={backgroundLabel(form.applicantType)}
                hint="Do not paste ID numbers, private documents or reference contact details here."
                error={fieldErrors.background}
                required
                className="sm:col-span-2"
              >
                <textarea
                  id="apply-background"
                  value={form.background}
                  onChange={(event) => update("background", event.target.value)}
                  maxLength={1_500}
                  rows={5}
                  placeholder={backgroundPlaceholder(form.applicantType)}
                  className={`${INPUT} resize-y`}
                />
              </Field>
              {form.applicantType === "hiring-company" && (
                <Field
                  label="Current hiring need"
                  hint="What mandates or recruiter relationships do you want to confirm?"
                  error={fieldErrors.hiringNeed}
                  required
                  className="sm:col-span-2"
                >
                  <textarea
                    id="apply-hiring-need"
                    value={form.hiringNeed}
                    onChange={(event) => update("hiringNeed", event.target.value)}
                    maxLength={1_000}
                    rows={3}
                    className={`${INPUT} resize-y`}
                  />
                </Field>
              )}
            </div>

            <ErrorSummary message={error} errors={fieldErrors} />
            <FormActions>
              <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
              <PrimaryButton>Continue to readiness</PrimaryButton>
            </FormActions>
          </Panel>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <Panel title="3. Verification readiness">
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Select what you can provide during manual review. This checklist is planning
                    information, not a declaration that a check has passed.
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {relevantReadiness.map((item) => (
                      <label
                        key={item.value}
                        className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-3 hover:border-sky-300 dark:border-slate-700 dark:hover:border-sky-600"
                      >
                        <input
                          type="checkbox"
                          checked={form.readiness.includes(item.value)}
                          onChange={() => toggleReadiness(item.value)}
                          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600"
                        />
                        <span>
                          <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
                            {item.title}
                          </span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {item.detail}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <Field
                  label="Proposed Stellar controller"
                  hint="Optional G… account or C… smart-account address. Supplying it does not sign, mint or activate anything."
                  error={fieldErrors.controllerAddress}
                >
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="apply-controller"
                      value={form.controllerAddress}
                      onChange={(event) => update("controllerAddress", event.target.value)}
                      maxLength={56}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck={false}
                      placeholder="G… or C…"
                      className={`${INPUT} font-mono text-xs`}
                    />
                    {address && (
                      <button
                        type="button"
                        onClick={() => update("controllerAddress", address)}
                        className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        Use connected address
                      </button>
                    )}
                  </div>
                  {form.controllerAddress.trim().toUpperCase().startsWith("C") && (
                    <p className="mt-2 text-xs leading-5 text-amber-700 dark:text-amber-400">
                      Contract controllers need an assisted signing flow today. The current holder
                      console signs only from a Freighter G… account; passkey smart-account signing
                      is still planned.
                    </p>
                  )}
                </Field>

                <Field label="Anything else for the reviewer?" hint="Optional; do not include sensitive identity evidence.">
                  <textarea
                    id="apply-notes"
                    value={form.notes}
                    onChange={(event) => update("notes", event.target.value)}
                    maxLength={1_000}
                    rows={3}
                    className={`${INPUT} resize-y`}
                  />
                </Field>

                <div className="sr-only" aria-hidden="true">
                  <label htmlFor="apply-fax-number">Fax number</label>
                  <input
                    id="apply-fax-number"
                    name="faxNumber"
                    value={form.faxNumber}
                    onChange={(event) => update("faxNumber", event.target.value)}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-950/50">
                  <Consent
                    checked={form.termsAccepted}
                    onChange={(checked) => update("termsAccepted", checked)}
                    error={fieldErrors.termsAccepted}
                  >
                    I agree to the verification terms, code of conduct, expiry and revocation rules.
                  </Consent>
                  <Consent
                    checked={form.privacyAccepted}
                    onChange={(checked) => update("privacyAccepted", checked)}
                    error={fieldErrors.privacyAccepted}
                  >
                    I consent to private, off-chain processing for verification and follow-up. I
                    understand that approved public credential fields are handled separately.
                  </Consent>
                  <Consent
                    checked={form.accuracyConfirmed}
                    onChange={(checked) => update("accuracyConfirmed", checked)}
                    error={fieldErrors.accuracyConfirmed}
                  >
                    I confirm this application is accurate and I am authorised to submit it.
                  </Consent>
                </div>
              </div>

              <ErrorSummary message={error} errors={fieldErrors} />
              <FormActions>
                <SecondaryButton onClick={() => setStep(2)}>Back</SecondaryButton>
                <PrimaryButton disabled={submitting}>
                  {submitting ? "Sending securely…" : "Submit for manual review"}
                </PrimaryButton>
              </FormActions>
            </Panel>

            <p className="px-2 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
              A successful submission returns a review reference. It is not approval, KYC completion,
              a blockchain transaction or a promise that a badge will be issued.
            </p>
          </div>
        )}
      </form>
    </div>
  );
}

function ApplicationReceived({ receipt, onRestart }: { receipt: IntakeReceipt; onRestart: () => void }) {
  return (
    <div className="mx-auto max-w-xl py-8">
      <Panel>
        <div className="space-y-5 p-6 text-center sm:p-8">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 12 4 4L19 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <h1 className="text-xl font-semibold">Application received for manual review</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              The private review service accepted the application. Keep this reference for follow-up.
              No badge has been issued and nothing from the form was written to Stellar.
            </p>
          </div>
          <div className="rounded-lg bg-slate-100 px-4 py-3 dark:bg-slate-800/70">
            <div className="text-xs uppercase tracking-wide text-slate-400">Reference</div>
            <div className="mt-1 font-mono text-sm font-semibold text-slate-800 dark:text-slate-100">
              {receipt.reference}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 text-left dark:border-slate-800">
            <h2 className="text-sm font-semibold">What happens next</h2>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-xs leading-5 text-slate-500 dark:text-slate-400">
              <li>A reviewer contacts you and checks the role-specific identity, company, domain, and reference evidence.</li>
              <li>If approved, the issuer prepares the exact off-chain credential, expiry, public handle, and terms hash.</li>
              <li>You inspect that offer and explicitly accept it with the proposed Stellar controller before any badge becomes active.</li>
              <li>Only final ledger confirmation creates the public record; affiliation and live mandates are separate later steps.</li>
            </ol>
            <p className="mt-3 text-[11px] leading-4 text-amber-700 dark:text-amber-400">
              vNext is live on testnet, but the browser acceptance screen is not built yet. A review
              reference alone must never be presented as verification.
            </p>
            <Link to="/standard" className="mt-3 inline-block text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400">
              Read the verification standard
            </Link>
          </div>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Start another application
          </button>
        </div>
      </Panel>
    </div>
  );
}

function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const labels = ["Applicant type", "Profile", "Readiness & consent"];
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Application progress">
      {labels.map((label, index) => {
        const number = (index + 1) as 1 | 2 | 3;
        const active = number === current;
        const complete = number < current;
        return (
          <li
            key={label}
            aria-current={active ? "step" : undefined}
            className={`rounded-lg border px-3 py-2 text-xs font-medium ${
              active
                ? "border-sky-500 bg-sky-500/5 text-sky-700 dark:text-sky-300"
                : complete
                  ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                  : "border-slate-200 text-slate-400 dark:border-slate-800"
            }`}
          >
            <span className="mr-1.5 font-mono">{complete ? "✓" : number}.</span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  hint,
  error,
  required = false,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-red-500">*</span>}
        </span>
        {hint && <span className="text-right text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function Consent({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="flex cursor-pointer gap-3 text-sm leading-5 text-slate-600 dark:text-slate-300">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
        />
        <span>{children}</span>
      </label>
      {error && <p className="ml-7 mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

function FormActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
      {children}
    </div>
  );
}

function PrimaryButton({ children, disabled = false }: { children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function ErrorSummary({ message, errors }: { message: string | null; errors: Record<string, string> }) {
  if (!message) return null;
  const details = [...new Set(Object.values(errors))].slice(0, 4);
  return (
    <div className="mx-4 mb-3 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300" role="alert">
      <p>{message}</p>
      {details.length > 0 && (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
          {details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function validateProfile(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  if (form.contactName.trim().length < 2) errors.contactName = "Enter the review contact's name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.workEmail.trim())) errors.workEmail = "Enter a valid email address.";
  if (form.jurisdiction.trim().length < 2) errors.jurisdiction = "Enter a country or jurisdiction.";
  if (!/^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/.test(form.preferredHandle.trim())) {
    errors.preferredHandle = "Choose a 3–64 character lowercase handle that starts and ends with a letter or number.";
  } else if (["api", "apply", "badge", "manage", "me", "org", "person", "search", "standard", "tx", "verify"].includes(form.preferredHandle.trim())) {
    errors.preferredHandle = "That handle is reserved by the verifier. Choose another.";
  }
  if (form.background.trim().length < 20) errors.background = "Give at least 20 characters of background.";
  if (form.applicantType === "recruiter") {
    if (form.currentRole.trim().length < 2) errors.currentRole = "Enter your current role.";
    if (!validHttpsUrl(form.professionalProfile)) errors.professionalProfile = "Enter a complete HTTPS profile URL.";
  } else {
    if (form.organisationName.trim().length < 2) errors.organisationName = "Enter the organisation's legal name.";
    if (!validHttpsUrl(form.website)) errors.website = "Enter the organisation's HTTPS website.";
    if (!form.teamSize) errors.teamSize = "Choose an approximate team size.";
  }
  if (form.website && !validHttpsUrl(form.website)) errors.website = "Enter a complete HTTPS URL.";
  if (form.professionalProfile && !validHttpsUrl(form.professionalProfile)) {
    errors.professionalProfile = "Enter a complete HTTPS profile URL.";
  }
  if (form.applicantType === "hiring-company" && form.hiringNeed.trim().length < 10) {
    errors.hiringNeed = "Describe the hiring need in at least 10 characters.";
  }
  return errors;
}

function validateFinal(form: FormState): Record<string, string> {
  const errors: Record<string, string> = {};
  const address = form.controllerAddress.trim().toUpperCase();
  if (address && !StrKey.isValidEd25519PublicKey(address) && !StrKey.isValidContract(address)) {
    errors.controllerAddress = "Enter a valid Stellar G… account or C… contract address.";
  }
  if (!form.termsAccepted) errors.termsAccepted = "Accept the verification terms.";
  if (!form.privacyAccepted) errors.privacyAccepted = "Accept the privacy notice.";
  if (!form.accuracyConfirmed) errors.accuracyConfirmed = "Confirm the information is accurate.";
  return errors;
}

function validHttpsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && Boolean(parsed.hostname) && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function hasProfileError(errors: Record<string, string>): boolean {
  return [
    "applicantType",
    "contactName",
    "workEmail",
    "jurisdiction",
    "preferredHandle",
    "organisationName",
    "website",
    "professionalProfile",
    "currentRole",
    "teamSize",
    "background",
    "hiringNeed",
  ].some((key) => key in errors);
}

function backgroundLabel(applicantType: ApplicantType): string {
  if (applicantType === "recruiter") return "Recruiting background and track record";
  if (applicantType === "agency") return "Agency services, markets and track record";
  return "Why your company wants to join DoubleCheck";
}

function backgroundPlaceholder(applicantType: ApplicantType): string {
  if (applicantType === "recruiter") return "Industries, regions, years recruiting and the kinds of placements you make…";
  if (applicantType === "agency") return "Recruiting specialisms, markets, operating history and how recruiter seats are managed…";
  return "How recruiters currently represent your company and what you want candidates to be able to verify…";
}
