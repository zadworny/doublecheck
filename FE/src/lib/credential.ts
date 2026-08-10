export const MAX_CREDENTIAL_BYTES = 512 * 1024;

export interface CredentialSummary {
  w3cVc2: boolean;
  types: string[];
  subjectName?: string;
  issuer?: string;
  validUntil?: string;
  proofPresent: boolean;
}

export interface CredentialVerification {
  matches: boolean;
  matchedRepresentation: "raw" | "canonical" | null;
  actualHash: string;
  summary: CredentialSummary | null;
}

export function isZeroHash(hash: string): boolean {
  return /^0{64}$/i.test(hash.trim());
}

/**
 * Syntactic guard for a user-triggered browser fetch of an on-chain URI.
 *
 * This cannot prevent DNS rebinding—the browser/network boundary still owns
 * that—but it avoids directly targeting loopback, link-local, or private
 * address literals, including URL-normalized IPv4-mapped IPv6 forms.
 */
export function isLocalOrPrivateHostname(input: string): boolean {
  const hostname = input.toLowerCase().replace(/\.+$/, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return true;
  }

  const address = hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(address)) {
    const octets = address.split(".").map(Number);
    if (octets.some((octet) => octet > 255)) return true;
    return isLocalOrPrivateIpv4(octets);
  }
  if (!address.includes(":")) return false;

  if (address === "::" || address === "::1") return true;
  const firstHextet = Number.parseInt(address.split(":", 1)[0] || "0", 16);
  if (firstHextet >= 0xfc00 && firstHextet <= 0xfdff) return true;
  if (firstHextet >= 0xfe80 && firstHextet <= 0xfebf) return true;

  // URL canonicalisation renders `::ffff:127.0.0.1` as `::ffff:7f00:1`.
  const mapped = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (!mapped) return false;
  const high = Number.parseInt(mapped[1], 16);
  const low = Number.parseInt(mapped[2], 16);
  return isLocalOrPrivateIpv4([
    high >>> 8,
    high & 0xff,
    low >>> 8,
    low & 0xff,
  ]);
}

function isLocalOrPrivateIpv4([first, second]: number[]): boolean {
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

/**
 * Stable JSON representation used by the issuer tooling for metadata anchors.
 * Parsed JSON contains no `undefined`, functions or cyclic objects, so a small
 * recursive sorter is sufficient and deliberately rejects non-JSON numbers.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Credential contains a non-finite number.");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
      .join(",")}}`;
  }
  throw new Error("Credential is not valid JSON data.");
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const source = new Uint8Array(bytes.byteLength);
  source.set(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", source);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function verifyCredentialBytes(
  bytes: Uint8Array,
  expectedHash: string,
): Promise<CredentialVerification> {
  const expected = expectedHash.trim().toLowerCase();
  const rawHash = await sha256Hex(bytes);
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return {
      matches: rawHash === expected,
      matchedRepresentation: rawHash === expected ? "raw" : null,
      actualHash: rawHash,
      summary: null,
    };
  }

  if (rawHash === expected) {
    return {
      matches: true,
      matchedRepresentation: "raw",
      actualHash: rawHash,
      summary: summarizeCredential(parsed),
    };
  }

  const canonicalBytes = new TextEncoder().encode(canonicalJson(parsed));
  const canonicalHash = await sha256Hex(canonicalBytes);
  return {
    matches: canonicalHash === expected,
    matchedRepresentation: canonicalHash === expected ? "canonical" : null,
    actualHash: canonicalHash,
    summary: summarizeCredential(parsed),
  };
}

export function summarizeCredential(value: unknown): CredentialSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const contexts = strings(record["@context"]);
  const types = strings(record.type);
  const subjectValue = Array.isArray(record.credentialSubject)
    ? record.credentialSubject[0]
    : record.credentialSubject;
  const subject = isRecord(subjectValue) ? subjectValue : undefined;
  const issuerValue = record.issuer;
  const issuer =
    typeof issuerValue === "string"
      ? issuerValue
      : isRecord(issuerValue) && typeof issuerValue.id === "string"
        ? issuerValue.id
        : undefined;
  const subjectName = subject
    ? firstString(subject.name, subject.displayName, subject.preferredName)
    : undefined;
  const validUntil = firstString(record.validUntil, record.expirationDate);

  return {
    w3cVc2:
      contexts.includes("https://www.w3.org/ns/credentials/v2") &&
      types.includes("VerifiableCredential"),
    types,
    subjectName,
    issuer,
    validUntil,
    proofPresent: isRecord(record.proof) || Array.isArray(record.proof),
  };
}

function strings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim().length > 0);
}
