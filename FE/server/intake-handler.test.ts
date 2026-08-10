import assert from "node:assert/strict";
import type { ServerResponse } from "node:http";
import { afterEach, beforeEach, test } from "node:test";
import handler from "../api/intake.ts";

const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;
const originalWebhookUrl = process.env.INTAKE_WEBHOOK_URL;
const originalWebhookToken = process.env.INTAKE_WEBHOOK_BEARER_TOKEN;

beforeEach(() => {
  delete process.env.INTAKE_WEBHOOK_URL;
  delete process.env.INTAKE_WEBHOOK_BEARER_TOKEN;
  globalThis.fetch = originalFetch;
  console.error = () => undefined;
});

afterEach(() => {
  restoreEnvironment("INTAKE_WEBHOOK_URL", originalWebhookUrl);
  restoreEnvironment("INTAKE_WEBHOOK_BEARER_TOKEN", originalWebhookToken);
  globalThis.fetch = originalFetch;
  console.error = originalConsoleError;
});

test("returns an honest 503 without fetching when intake is not configured", async () => {
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    throw new Error("fetch must not be called");
  };

  const response = createResponse();
  await handler(createRequest(application()), response.raw);

  assert.equal(response.status(), 503);
  assert.equal(fetchCalled, false);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(response.json(), {
    ok: false,
    error: "Intake is not configured right now. No information was sent.",
  });
});

test("returns 202 only after forwarding a sanitized envelope", async () => {
  process.env.INTAKE_WEBHOOK_URL = "https://review.example.test/intake";
  process.env.INTAKE_WEBHOOK_BEARER_TOKEN = "test-bearer";
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ url: String(input), init });
    return new Response(null, { status: 204 });
  };

  const response = createResponse();
  await handler(
    createRequest(
      application({
        contactName: "  Ada   Recruiter  ",
        notes: "Visible\u200B note.\u0000",
        faxNumber: "",
      }),
    ),
    response.raw,
  );

  assert.equal(response.status(), 202);
  assert.equal(calls.length, 1);
  const receipt = response.json();
  assert.equal(receipt.ok, true);
  assert.match(String(receipt.reference), /^APP-\d{8}-[0-9A-F]{20}$/);
  assert.match(String(receipt.receivedAt), /^\d{4}-\d{2}-\d{2}T/);

  const [call] = calls;
  assert.equal(call.url, "https://review.example.test/intake");
  assert.equal(call.init?.method, "POST");
  assert.equal(call.init?.redirect, "error");
  const headers = new Headers(call.init?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("authorization"), "Bearer test-bearer");
  assert.equal(typeof call.init?.body, "string");

  const envelope = JSON.parse(String(call.init?.body)) as {
    reference: string;
    receivedAt: string;
    source: string;
    policyVersion: string;
    submission: Record<string, unknown>;
  };
  assert.equal(envelope.reference, receipt.reference);
  assert.equal(envelope.receivedAt, receipt.receivedAt);
  assert.equal(envelope.source, "doublecheck-web");
  assert.equal(envelope.policyVersion, "doublecheck-intake-2026-08-10");
  assert.equal(envelope.submission.contactName, "Ada Recruiter");
  assert.equal(envelope.submission.notes, "Visible note.");
  assert.equal("faxNumber" in envelope.submission, false);
});

test("returns 502 when the configured webhook rejects the submission", async () => {
  process.env.INTAKE_WEBHOOK_URL = "https://review.example.test/intake";
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return new Response("rejected", { status: 409 });
  };

  const response = createResponse();
  await handler(createRequest(application()), response.raw);

  assert.equal(fetchCalls, 1);
  assert.equal(response.status(), 502);
  const body = response.json();
  assert.equal(body.ok, false);
  assert.match(String(body.error), /did not accept the submission/i);
  assert.equal("reference" in body, false);
});

function application(overrides: Record<string, unknown> = {}) {
  return {
    kind: "application",
    applicantType: "recruiter",
    contactName: "Ada Recruiter",
    workEmail: "ada@example.com",
    jurisdiction: "Poland",
    preferredHandle: "ada-recruiter",
    organisationName: "",
    website: "",
    professionalProfile: "https://profiles.example.com/ada",
    currentRole: "Technical recruiter",
    teamSize: "",
    background: "Eight years recruiting engineers across Europe.",
    hiringNeed: "",
    controllerAddress: "",
    readiness: ["identity-liveness", "references"],
    notes: "",
    termsAccepted: true,
    privacyAccepted: true,
    accuracyConfirmed: true,
    faxNumber: "",
    ...overrides,
  };
}

type HandlerRequest = Parameters<typeof handler>[0];

function createRequest(body: unknown): HandlerRequest {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  } as unknown as HandlerRequest;
}

function createResponse() {
  let responseBody = "";
  const headers = new Map<string, string | number | readonly string[]>();
  const response = {
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name.toLowerCase(), value);
      return response;
    },
    end(chunk?: string | Buffer) {
      responseBody = chunk?.toString() ?? "";
      return response;
    },
  };

  return {
    raw: response as unknown as ServerResponse,
    headers,
    status: () => response.statusCode,
    json: () => JSON.parse(responseBody) as Record<string, unknown>,
  };
}

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
