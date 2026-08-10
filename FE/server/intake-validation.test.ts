import assert from "node:assert/strict";
import { test } from "node:test";
import { StrKey } from "@stellar/stellar-sdk";
import { validateIntake } from "./intake-validation.ts";

const controller = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));

function recruiter(overrides: Record<string, unknown> = {}) {
  return {
    kind: "application",
    applicantType: "recruiter",
    contactName: "  Ada   Recruiter  ",
    workEmail: "ada@example.com",
    jurisdiction: "Poland",
    preferredHandle: "ada-recruiter",
    organisationName: "",
    website: "",
    professionalProfile: "https://www.linkedin.com/in/ada",
    currentRole: "Technical recruiter",
    teamSize: "",
    background: "Eight years recruiting engineers across Europe.",
    hiringNeed: "",
    controllerAddress: controller.toLowerCase(),
    readiness: ["identity-liveness", "references"],
    notes: "Line one.\u0000\nLine two.",
    termsAccepted: true,
    privacyAccepted: true,
    accuracyConfirmed: true,
    faxNumber: "",
    ...overrides,
  };
}

function complaint(overrides: Record<string, unknown> = {}) {
  return {
    kind: "complaint",
    targetType: "claim",
    targetId: "42",
    targetLabel: "Recruitment — Acme → Ada",
    category: "not-authorised",
    contactEmail: "candidate@example.com",
    details: "The company confirmed by email that this mandate is no longer valid.",
    evidenceUrl: "https://files.example.com/evidence/42",
    privacyAccepted: true,
    faxNumber: "",
    ...overrides,
  };
}

test("normalizes an allow-listed recruiter application", () => {
  const result = validateIntake(recruiter());
  assert.equal(result.ok, true);
  if (!result.ok || result.value.kind !== "application") return;
  assert.equal(result.value.contactName, "Ada Recruiter");
  assert.equal(result.value.controllerAddress, controller);
  assert.equal(result.value.notes, "Line one.\nLine two.");
  assert.equal("faxNumber" in result.value, false);
});

test("requires role-specific organisation verification fields", () => {
  const result = validateIntake(
    recruiter({
      applicantType: "agency",
      professionalProfile: "",
      currentRole: "",
      organisationName: "",
      website: "",
      teamSize: "",
    }),
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.organisationName);
  assert.ok(result.errors.website);
  assert.ok(result.errors.teamSize);
});

test("requires a contract-safe non-reserved public handle", () => {
  const reserved = validateIntake(recruiter({ preferredHandle: "verify" }));
  assert.equal(reserved.ok, false);
  if (!reserved.ok) assert.ok(reserved.errors.preferredHandle);

  const malformed = validateIntake(recruiter({ preferredHandle: ".hidden" }));
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.ok(malformed.errors.preferredHandle);
});

test("rejects unknown fields instead of forwarding them", () => {
  const result = validateIntake(recruiter({ admin: true }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.body ?? "", /Unexpected field/);
});

test("rejects a filled honeypot", () => {
  const result = validateIntake(recruiter({ faxNumber: "555-0100" }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.body ?? "", /Automated/);
});

test("requires exact consent booleans", () => {
  const result = validateIntake(recruiter({ privacyAccepted: "yes" }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.privacyAccepted);
});

test("accepts and sanitizes a complaint", () => {
  const result = validateIntake(complaint());
  assert.equal(result.ok, true);
  if (!result.ok || result.value.kind !== "complaint") return;
  assert.equal(result.value.targetId, "42");
  assert.equal(result.value.category, "not-authorised");
  assert.equal("faxNumber" in result.value, false);
});

test("rejects invalid complaint identifiers and unsafe evidence URLs", () => {
  const result = validateIntake(complaint({ targetId: "0", evidenceUrl: "http://example.com/file" }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.errors.targetId);
  assert.ok(result.errors.evidenceUrl);
});

test("uses numeric on-chain ids for both claim and entity report targets", () => {
  const entityId = validateIntake(
    complaint({ targetType: "entity", targetId: "42", targetLabel: "Ada Recruiter" }),
  );
  assert.equal(entityId.ok, true);

  for (const targetId of ["ada-recruiter", "ada.recruiter", "ada_recruiter"]) {
    const handle = validateIntake(
      complaint({ targetType: "entity", targetId, targetLabel: "Ada Recruiter" }),
    );
    assert.equal(handle.ok, false, targetId);
    if (!handle.ok) assert.ok(handle.errors.targetId);
  }
});

test("rejects literal local and private-network HTTPS URLs", () => {
  const unsafeUrls = [
    "https://localhost/evidence",
    "https://review.local/evidence",
    "https://127.0.0.1/evidence",
    "https://10.20.30.40/evidence",
    "https://172.16.0.1/evidence",
    "https://172.31.255.255/evidence",
    "https://192.168.10.20/evidence",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/evidence",
    "https://[fc00::1]/evidence",
    "https://[fd12::1]/evidence",
    "https://[fe80::1]/evidence",
    "https://[::ffff:127.0.0.1]/evidence",
  ];

  for (const evidenceUrl of unsafeUrls) {
    const result = validateIntake(complaint({ evidenceUrl }));
    assert.equal(result.ok, false, evidenceUrl);
    if (!result.ok) assert.match(result.errors.evidenceUrl ?? "", /public HTTPS URL/);
  }
});

test("applies the public-host URL policy to professional profiles and websites", () => {
  const profile = validateIntake(
    recruiter({ professionalProfile: "https://localhost/profile" }),
  );
  assert.equal(profile.ok, false);
  if (!profile.ok) assert.match(profile.errors.professionalProfile ?? "", /public HTTPS URL/);

  const website = validateIntake(
    recruiter({
      applicantType: "hiring-company",
      organisationName: "Example Hiring Company",
      website: "https://192.168.1.10/about",
      professionalProfile: "",
      currentRole: "",
      teamSize: "11-50",
      hiringNeed: "We are hiring a security engineering team.",
    }),
  );
  assert.equal(website.ok, false);
  if (!website.ok) assert.match(website.errors.website ?? "", /public HTTPS URL/);
});

test("strips Unicode format and control characters from reviewer-facing text", () => {
  const result = validateIntake(
    complaint({
      targetLabel: "Claim \u202E#24\u2066",
      details: "Visible\u200B evidence\u0085 remains readable after cleanup.",
    }),
  );

  assert.equal(result.ok, true);
  if (!result.ok || result.value.kind !== "complaint") return;
  assert.equal(result.value.targetLabel, "Claim #24");
  assert.equal(result.value.details, "Visible evidence remains readable after cleanup.");
  assert.doesNotMatch(result.value.targetLabel + result.value.details, /[\p{Cc}\p{Cf}]/u);
});

test("caps long free-text fields", () => {
  const result = validateIntake(complaint({ details: "x".repeat(2_001) }));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.match(result.errors.details ?? "", /no more than 2000/);
});
