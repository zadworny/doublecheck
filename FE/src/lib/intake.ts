export type ApplicantType = "recruiter" | "agency" | "hiring-company";
export type TeamSize = "solo" | "2-10" | "11-50" | "51-250" | "251+";
export type ReadinessItem =
  | "identity-liveness"
  | "professional-profile"
  | "work-email"
  | "references"
  | "business-registration"
  | "domain-control"
  | "code-of-conduct";

export type ComplaintCategory =
  | "relationship-ended"
  | "incorrect-details"
  | "not-authorised"
  | "suspected-fraud"
  | "other";

export interface ApplicationIntake {
  kind: "application";
  applicantType: ApplicantType;
  contactName: string;
  workEmail: string;
  jurisdiction: string;
  preferredHandle: string;
  organisationName: string;
  website: string;
  professionalProfile: string;
  currentRole: string;
  teamSize: TeamSize | "";
  background: string;
  hiringNeed: string;
  controllerAddress: string;
  readiness: ReadinessItem[];
  notes: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  accuracyConfirmed: boolean;
  /** Hidden bot trap. Real users always submit an empty value. */
  faxNumber: string;
}

export interface ComplaintIntake {
  kind: "complaint";
  targetType: "claim" | "entity";
  targetId: string;
  targetLabel: string;
  category: ComplaintCategory;
  contactEmail: string;
  details: string;
  evidenceUrl: string;
  privacyAccepted: boolean;
  /** Hidden bot trap. Real users always submit an empty value. */
  faxNumber: string;
}

export type IntakeSubmission = ApplicationIntake | ComplaintIntake;

export interface IntakeReceipt {
  reference: string;
  receivedAt: string;
}

/** A confirmed API rejection; network failures use status 0. */
export class IntakeError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, status = 0, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "IntakeError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

/**
 * Submit private intake data to the same-origin serverless bridge.
 * A resolved promise means the configured review service accepted it and
 * returned a reference; all other outcomes reject and must not be shown as a
 * successful submission.
 */
export async function submitIntake(submission: IntakeSubmission): Promise<IntakeReceipt> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(submission),
      // Intake is intentionally unauthenticated and must not depend on or
      // forward unrelated application cookies.
      credentials: "omit",
      signal: controller.signal,
    });

    const body = await readResponse(response);
    if (
      response.ok &&
      body.ok === true &&
      typeof body.reference === "string" &&
      typeof body.receivedAt === "string"
    ) {
      return { reference: body.reference, receivedAt: body.receivedAt };
    }

    const message =
      typeof body.error === "string"
        ? body.error
        : "The intake service did not confirm this submission. Nothing has been marked as received.";
    const fieldErrors = isStringRecord(body.fieldErrors) ? body.fieldErrors : {};
    throw new IntakeError(message, response.status, fieldErrors);
  } catch (error) {
    if (error instanceof IntakeError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new IntakeError("The intake service timed out. No submission confirmation was received.");
    }
    throw new IntakeError("Could not reach the intake service. No submission confirmation was received.");
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) return {};
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : {};
  } catch {
    return {};
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}
