import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useToast } from "../context/ToastContext";
import { IntakeError, submitIntake, type ComplaintCategory } from "../lib/intake";

const CATEGORIES: Array<{ value: ComplaintCategory; label: string }> = [
  { value: "relationship-ended", label: "This relationship or mandate has ended" },
  { value: "incorrect-details", label: "The stated scope or role is incorrect" },
  { value: "not-authorised", label: "This person is not authorised to represent the organisation" },
  { value: "suspected-fraud", label: "Suspected fraudulent claim" },
  { value: "other", label: "Other" },
];

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  target: {
    type: "claim" | "entity";
    id: string;
    label: string;
  };
}

export function ReportModal({ open, onClose, target }: ReportModalProps) {
  const { showToast } = useToast();
  const [category, setCategory] = useState<ComplaintCategory>("relationship-ended");
  const [contactEmail, setContactEmail] = useState("");
  const [details, setDetails] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [faxNumber, setFaxNumber] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, submitting]);

  if (!open) return null;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      const receipt = await submitIntake({
        kind: "complaint",
        targetType: target.type,
        targetId: target.id,
        targetLabel: target.label,
        category,
        contactEmail,
        details,
        evidenceUrl,
        privacyAccepted,
        faxNumber,
      });
      reset();
      onClose();
      showToast(`Report received for private review. Reference: ${receipt.reference}`);
    } catch (cause) {
      if (cause instanceof IntakeError) {
        setError(cause.message);
        setFieldErrors(cause.fieldErrors);
      } else {
        setError("The review service did not confirm this report. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setCategory("relationship-ended");
    setContactEmail("");
    setDetails("");
    setEvidenceUrl("");
    setPrivacyAccepted(false);
    setFaxNumber("");
    setError(null);
    setFieldErrors({});
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!submitting) onClose();
      }}
      role="presentation"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-modal-title"
      >
        <div className="mb-1 flex items-center gap-2 text-red-500">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          </svg>
          <h2 id="report-modal-title" className="text-base font-semibold">
            Report this {target.type}
          </h2>
        </div>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400" title={target.label}>
          {target.label} · #{target.id}
        </p>
        <p className="mb-4 mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Reports and evidence stay in a private off-chain review queue. Submitting does not publicly
          label anyone or change the registry; only a reviewed outcome can affect status.
        </p>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4" noValidate>
          <Field label="Category" error={fieldErrors.category}>
            <select
              id="report-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as ComplaintCategory)}
              className={INPUT}
            >
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Contact email"
            hint="Required so the reviewer can follow up"
            error={fieldErrors.contactEmail}
          >
            <input
              id="report-contact-email"
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              maxLength={254}
              autoComplete="email"
              autoFocus
              className={INPUT}
            />
          </Field>

          <Field
            label="What happened?"
            hint="At least 10 characters; do not paste ID documents"
            error={fieldErrors.details}
          >
            <textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={2_000}
              rows={4}
              placeholder="Give dates and facts that help the review team understand the issue…"
              className={`${INPUT} resize-y`}
            />
          </Field>

          <Field
            label="Evidence link"
            hint="Optional HTTPS link; use a restricted-access link for private material"
            error={fieldErrors.evidenceUrl}
          >
            <input
              id="report-evidence-url"
              type="url"
              value={evidenceUrl}
              onChange={(event) => setEvidenceUrl(event.target.value)}
              maxLength={500}
              placeholder="https://…"
              className={INPUT}
            />
          </Field>

          <div className="sr-only" aria-hidden="true">
            <label htmlFor="report-fax-number">Fax number</label>
            <input
              id="report-fax-number"
              name="faxNumber"
              value={faxNumber}
              onChange={(event) => setFaxNumber(event.target.value)}
              tabIndex={-1}
              autoComplete="off"
            />
          </div>

          <div>
            <label className="flex cursor-pointer gap-3 text-sm leading-5 text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={privacyAccepted}
                onChange={(event) => setPrivacyAccepted(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600"
              />
              <span>
                I consent to private processing of this report and being contacted about the review.
                I understand allegations are not published on-chain.
              </span>
            </label>
            {fieldErrors.privacyAccepted && (
              <p className="ml-7 mt-1 text-xs text-red-600 dark:text-red-400">
                {fieldErrors.privacyAccepted}
              </p>
            )}
          </div>

          {error && (
            <div
              className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm text-red-700 dark:text-red-300"
              role="alert"
            >
              {error}
              <p className="mt-1 text-xs">Do not assume the report was received unless a reference is shown.</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "Sending securely…" : "Submit for private review"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        {hint && <span className="text-right text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
