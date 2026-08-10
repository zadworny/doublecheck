import { isIP } from "node:net";

/**
 * Server-side intake contract. This module deliberately constructs a fresh,
 * allow-listed object: callers cannot smuggle arbitrary fields through to the
 * private review webhook.
 */

export const MAX_INTAKE_BYTES = 16 * 1024;

export const APPLICANT_TYPES = ["recruiter", "agency", "hiring-company"] as const;
export type ApplicantType = (typeof APPLICANT_TYPES)[number];

export const TEAM_SIZES = ["solo", "2-10", "11-50", "51-250", "251+"] as const;
export type TeamSize = (typeof TEAM_SIZES)[number];

export const READINESS_ITEMS = [
  "identity-liveness",
  "professional-profile",
  "work-email",
  "references",
  "business-registration",
  "domain-control",
  "code-of-conduct",
] as const;
export type ReadinessItem = (typeof READINESS_ITEMS)[number];

export const COMPLAINT_CATEGORIES = [
  "relationship-ended",
  "incorrect-details",
  "not-authorised",
  "suspected-fraud",
  "other",
] as const;
export type ComplaintCategory = (typeof COMPLAINT_CATEGORIES)[number];

export type IntakeTargetType = "claim" | "entity";

export interface ValidApplication {
  kind: "application";
  applicantType: ApplicantType;
  contactName: string;
  workEmail: string;
  jurisdiction: string;
  preferredHandle: string;
  organisationName?: string;
  website?: string;
  professionalProfile?: string;
  currentRole?: string;
  teamSize?: TeamSize;
  background: string;
  hiringNeed?: string;
  controllerAddress?: string;
  readiness: ReadinessItem[];
  notes?: string;
  termsAccepted: true;
  privacyAccepted: true;
  accuracyConfirmed: true;
}

export interface ValidComplaint {
  kind: "complaint";
  targetType: IntakeTargetType;
  targetId: string;
  targetLabel: string;
  category: ComplaintCategory;
  contactEmail: string;
  details: string;
  evidenceUrl?: string;
  privacyAccepted: true;
}

export type ValidIntake = ValidApplication | ValidComplaint;

export type ValidationResult =
  | { ok: true; value: ValidIntake }
  | { ok: false; errors: Record<string, string> };

const APPLICATION_KEYS = new Set([
  "kind",
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
  "controllerAddress",
  "readiness",
  "notes",
  "termsAccepted",
  "privacyAccepted",
  "accuracyConfirmed",
  "faxNumber",
]);

const COMPLAINT_KEYS = new Set([
  "kind",
  "targetType",
  "targetId",
  "targetLabel",
  "category",
  "contactEmail",
  "details",
  "evidenceUrl",
  "privacyAccepted",
  "faxNumber",
]);

/** Validate and normalize untrusted JSON without mutating the input. */
export function validateIntake(input: unknown): ValidationResult {
  if (!isRecord(input)) return invalid("body", "Expected a JSON object.");
  if (input.kind === "application") return validateApplication(input);
  if (input.kind === "complaint") return validateComplaint(input);
  return invalid("kind", "Expected application or complaint.");
}

function validateApplication(input: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  rejectUnknownKeys(input, APPLICATION_KEYS, errors);
  rejectHoneypot(input, errors);

  const applicantType = oneOf(input.applicantType, APPLICANT_TYPES);
  if (!applicantType) errors.applicantType = "Choose an applicant type.";

  const contactName = readText(input.contactName, "contactName", errors, {
    min: 2,
    max: 100,
    required: true,
  });
  const workEmail = readEmail(input.workEmail, "workEmail", errors);
  const jurisdiction = readText(input.jurisdiction, "jurisdiction", errors, {
    min: 2,
    max: 100,
    required: true,
  });
  const preferredHandle = readText(input.preferredHandle, "preferredHandle", errors, {
    min: 3,
    max: 64,
    required: true,
  });
  if (preferredHandle && !validHandle(preferredHandle)) {
    errors.preferredHandle = "Use 3–64 lowercase letters, numbers, dots, underscores or hyphens; start and end with a letter or number.";
  }
  const background = readText(input.background, "background", errors, {
    min: 20,
    max: 1_500,
    required: true,
    multiline: true,
  });

  const organisationRequired = applicantType === "agency" || applicantType === "hiring-company";
  const organisationName = readText(input.organisationName, "organisationName", errors, {
    min: 2,
    max: 140,
    required: organisationRequired,
  });
  const website = readHttpsUrl(input.website, "website", errors, organisationRequired);
  const professionalProfile = readHttpsUrl(
    input.professionalProfile,
    "professionalProfile",
    errors,
    applicantType === "recruiter",
  );
  const currentRole = readText(input.currentRole, "currentRole", errors, {
    min: 2,
    max: 120,
    required: applicantType === "recruiter",
  });
  const teamSize = readOptionalEnum(input.teamSize, "teamSize", TEAM_SIZES, errors);
  if (organisationRequired && !teamSize) errors.teamSize = "Choose an approximate team size.";
  const hiringNeed = readText(input.hiringNeed, "hiringNeed", errors, {
    min: 10,
    max: 1_000,
    required: applicantType === "hiring-company",
    multiline: true,
  });
  const controllerAddress = readController(input.controllerAddress, errors);
  const readiness = readEnumArray(input.readiness, "readiness", READINESS_ITEMS, errors);
  const notes = readText(input.notes, "notes", errors, {
    min: 0,
    max: 1_000,
    required: false,
    multiline: true,
  });

  requireTrue(input.termsAccepted, "termsAccepted", errors, "Accept the verification terms.");
  requireTrue(input.privacyAccepted, "privacyAccepted", errors, "Accept the privacy notice.");
  requireTrue(input.accuracyConfirmed, "accuracyConfirmed", errors, "Confirm the information is accurate.");

  if (Object.keys(errors).length > 0 || !applicantType || !contactName || !workEmail || !jurisdiction || !preferredHandle || !background) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: compact({
      kind: "application",
      applicantType,
      contactName,
      workEmail,
      jurisdiction,
      preferredHandle,
      organisationName,
      website,
      professionalProfile,
      currentRole,
      teamSize,
      background,
      hiringNeed,
      controllerAddress,
      readiness,
      notes,
      termsAccepted: true,
      privacyAccepted: true,
      accuracyConfirmed: true,
    }) as ValidApplication,
  };
}

function validateComplaint(input: Record<string, unknown>): ValidationResult {
  const errors: Record<string, string> = {};
  rejectUnknownKeys(input, COMPLAINT_KEYS, errors);
  rejectHoneypot(input, errors);

  const targetType = oneOf(input.targetType, ["claim", "entity"] as const);
  if (!targetType) errors.targetType = "Expected a claim or entity target.";

  const targetId = readText(input.targetId, "targetId", errors, {
    min: 1,
    max: 64,
    required: true,
  });
  if (targetId && !validTargetId(targetType, targetId)) {
    errors.targetId = "The report target is invalid.";
  }
  const targetLabel = readText(input.targetLabel, "targetLabel", errors, {
    min: 1,
    max: 240,
    required: true,
  });
  const category = oneOf(input.category, COMPLAINT_CATEGORIES);
  if (!category) errors.category = "Choose a report category.";
  const contactEmail = readEmail(input.contactEmail, "contactEmail", errors);
  const details = readText(input.details, "details", errors, {
    min: 10,
    max: 2_000,
    required: true,
    multiline: true,
  });
  const evidenceUrl = readHttpsUrl(input.evidenceUrl, "evidenceUrl", errors, false);
  requireTrue(input.privacyAccepted, "privacyAccepted", errors, "Accept the privacy notice.");

  if (
    Object.keys(errors).length > 0 ||
    !targetType ||
    !targetId ||
    !targetLabel ||
    !category ||
    !contactEmail ||
    !details
  ) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: compact({
      kind: "complaint",
      targetType,
      targetId,
      targetLabel,
      category,
      contactEmail,
      details,
      evidenceUrl,
      privacyAccepted: true,
    }) as ValidComplaint,
  };
}

function rejectUnknownKeys(
  input: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  errors: Record<string, string>,
) {
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  if (unknown.length > 0) errors.body = `Unexpected field${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`;
}

function rejectHoneypot(input: Record<string, unknown>, errors: Record<string, string>) {
  if (typeof input.faxNumber !== "string") {
    errors.body = "Invalid submission metadata.";
  } else if (input.faxNumber.trim().length > 0) {
    errors.body = "Automated submission rejected.";
  }
}

function readText(
  input: unknown,
  field: string,
  errors: Record<string, string>,
  options: { min: number; max: number; required: boolean; multiline?: boolean },
): string | undefined {
  if (input === undefined || input === null || input === "") {
    if (options.required) errors[field] = "This field is required.";
    return undefined;
  }
  if (typeof input !== "string") {
    errors[field] = "Expected text.";
    return undefined;
  }
  const value = cleanText(input, options.multiline ?? false);
  if (options.required && value.length < options.min) errors[field] = `Use at least ${options.min} characters.`;
  if (value.length > options.max) errors[field] = `Use no more than ${options.max} characters.`;
  return value || undefined;
}

function readEmail(input: unknown, field: string, errors: Record<string, string>): string | undefined {
  const value = readText(input, field, errors, { min: 3, max: 254, required: true });
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) errors[field] = "Enter a valid email address.";
  return value;
}

function readHttpsUrl(
  input: unknown,
  field: string,
  errors: Record<string, string>,
  required: boolean,
): string | undefined {
  const value = readText(input, field, errors, { min: 8, max: 500, required });
  if (!value) return undefined;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || !parsed.hostname) throw new Error("unsafe URL");
    if (isLocalOrPrivateHostname(parsed.hostname)) {
      errors[field] = "Use a public HTTPS URL, not a local or private-network address.";
      return undefined;
    }
    return parsed.toString();
  } catch {
    errors[field] = "Enter a complete HTTPS URL.";
    return undefined;
  }
}

function readController(input: unknown, errors: Record<string, string>): string | undefined {
  const value = readText(input, "controllerAddress", errors, { min: 56, max: 56, required: false });
  if (!value) return undefined;
  const upper = value.toUpperCase();
  if (!isValidStellarController(upper)) {
    errors.controllerAddress = "Enter a valid Stellar G… account or C… contract address.";
    return undefined;
  }
  return upper;
}

/** Validate G… account and C… contract StrKeys without loading the browser SDK
 * in the serverless intake function. StrKeys are base32(version + 32 bytes +
 * little-endian CRC16-XModem checksum). */
function isValidStellarController(value: string): boolean {
  if (!/^[A-Z2-7]{56}$/.test(value)) return false;

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let accumulator = 0;
  const decoded: number[] = [];
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return false;
    accumulator = (accumulator << 5) | digit;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      decoded.push((accumulator >>> bits) & 0xff);
      accumulator &= (1 << bits) - 1;
    }
  }
  if (decoded.length !== 35 || bits !== 0) return false;
  if (decoded[0] !== 6 << 3 && decoded[0] !== 2 << 3) return false;

  let checksum = 0;
  for (let index = 0; index < 33; index += 1) {
    checksum ^= decoded[index] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      checksum = checksum & 0x8000 ? ((checksum << 1) ^ 0x1021) & 0xffff : (checksum << 1) & 0xffff;
    }
  }
  return decoded[33] === (checksum & 0xff) && decoded[34] === (checksum >>> 8);
}

function readOptionalEnum<const T extends readonly string[]>(
  input: unknown,
  field: string,
  values: T,
  errors: Record<string, string>,
): T[number] | undefined {
  if (input === undefined || input === null || input === "") return undefined;
  const value = oneOf(input, values);
  if (!value) errors[field] = "Choose a valid option.";
  return value;
}

function readEnumArray<const T extends readonly string[]>(
  input: unknown,
  field: string,
  values: T,
  errors: Record<string, string>,
): T[number][] {
  if (!Array.isArray(input) || input.length > values.length) {
    errors[field] = "Expected a checklist selection.";
    return [];
  }
  const allowed = new Set<string>(values);
  const selected: T[number][] = [];
  for (const item of input) {
    if (typeof item !== "string" || !allowed.has(item) || selected.includes(item as T[number])) {
      errors[field] = "Checklist contains an invalid selection.";
      return [];
    }
    selected.push(item as T[number]);
  }
  return selected;
}

function requireTrue(input: unknown, field: string, errors: Record<string, string>, message: string) {
  if (input !== true) errors[field] = message;
}

function validTargetId(type: IntakeTargetType | undefined, id: string): boolean {
  return (type === "claim" || type === "entity") && /^[1-9]\d{0,19}$/.test(id);
}

const RESERVED_HANDLES = new Set([
  "api", "apply", "badge", "manage", "me", "org", "person", "search", "standard", "tx", "verify",
]);

function validHandle(value: string): boolean {
  return (
    /^[a-z0-9][a-z0-9._-]{1,62}[a-z0-9]$/.test(value) &&
    !RESERVED_HANDLES.has(value)
  );
}

function oneOf<const T extends readonly string[]>(input: unknown, values: T): T[number] | undefined {
  return typeof input === "string" && (values as readonly string[]).includes(input)
    ? (input as T[number])
    : undefined;
}

function cleanText(input: string, multiline: boolean): string {
  const normalized = input
    .normalize("NFKC")
    // Format controls include bidi overrides/isolates and zero-width text.
    // They have no review value and can make labels appear to say something
    // other than the stored text. Preserve only layout controls that the
    // multiline normalizer handles explicitly below.
    .replace(/\p{Cf}/gu, "")
    .replace(/\p{Cc}/gu, (character) =>
      multiline && (character === "\t" || character === "\n" || character === "\r")
        ? character
        : "",
    );
  if (multiline) {
    return normalized
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[\t ]+/g, " ").trimEnd())
      .join("\n")
      .trim();
  }
  return normalized.replace(/\s+/g, " ").trim();
}

/**
 * Reject literal hostnames that an automated evidence preview must never be
 * encouraged to fetch. This is deliberately a syntactic guard: a public DNS
 * name can still resolve or rebind to a private address, so the downstream
 * webhook/reviewer fetcher must resolve and enforce its own egress policy.
 */
function isLocalOrPrivateHostname(input: string): boolean {
  const hostname = input.toLowerCase().replace(/\.+$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return true;
  }

  const address = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  const version = isIP(address);
  if (version === 4) return isLocalOrPrivateIpv4(address);
  if (version !== 6) return false;

  if (address === "::" || address === "::1") return true;
  if (/^f[cd][0-9a-f]{2}(?::|$)/.test(address)) return true; // fc00::/7
  if (/^fe[89ab][0-9a-f](?::|$)/.test(address)) return true; // fe80::/10

  // URL canonicalisation renders IPv4-mapped literals as ::ffff:7f00:1.
  const mapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mapped) {
    const high = Number.parseInt(mapped[1], 16);
    const low = Number.parseInt(mapped[2], 16);
    const ipv4 = `${high >>> 8}.${high & 0xff}.${low >>> 8}.${low & 0xff}`;
    return isLocalOrPrivateIpv4(ipv4);
  }
  return false;
}

function isLocalOrPrivateIpv4(address: string): boolean {
  const [first, second] = address.split(".").map(Number);
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function compact<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(field: string, message: string): ValidationResult {
  return { ok: false, errors: { [field]: message } };
}
