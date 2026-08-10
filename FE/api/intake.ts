import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { MAX_INTAKE_BYTES, validateIntake, type ValidIntake } from "../server/intake-validation.ts";

type VercelRequest = IncomingMessage & { body?: unknown };

const INTAKE_POLICY_VERSION = "doublecheck-intake-2026-08-10";

interface ErrorBody {
  ok: false;
  error: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Private intake bridge for applications and complaints.
 *
 * The browser never sees the destination webhook. Nothing submitted here is
 * written to Stellar; only a reviewed outcome may later become an on-chain
 * status change. Configure INTAKE_WEBHOOK_URL in the Vercel project, never as
 * a VITE_* variable.
 */
export default async function handler(req: VercelRequest, res: ServerResponse) {
  secureJsonHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { ok: false, error: "Only POST is supported." });
  }

  const contentType = req.headers["content-type"] ?? "";
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return send(res, 415, { ok: false, error: "Send the submission as JSON." });
  }

  let input: unknown;
  try {
    input = await readJson(req);
  } catch (error) {
    if (error instanceof BodyTooLargeError) {
      return send(res, 413, { ok: false, error: `Submission exceeds ${MAX_INTAKE_BYTES} bytes.` });
    }
    return send(res, 400, { ok: false, error: "The request body is not valid JSON." });
  }

  const validation = validateIntake(input);
  if (!validation.ok) {
    return send(res, 422, {
      ok: false,
      error: validation.errors.body ?? "Please correct the highlighted information.",
      fieldErrors: validation.errors,
    });
  }

  const webhook = intakeWebhook();
  if (!webhook) {
    return send(res, 503, {
      ok: false,
      error: "Intake is not configured right now. No information was sent.",
    });
  }

  const reference = makeReference(validation.value.kind);
  const receivedAt = new Date().toISOString();

  try {
    const forwarded = await forward(webhook, {
      reference,
      receivedAt,
      source: "doublecheck-web",
      policyVersion: INTAKE_POLICY_VERSION,
      submission: validation.value,
    });
    if (!forwarded.ok) {
      console.error("Intake webhook rejected submission", { status: forwarded.status, reference });
      return send(res, 502, {
        ok: false,
        error: "The review service did not accept the submission. No confirmation was recorded; please try again.",
      });
    }
  } catch (error) {
    console.error("Intake webhook unavailable", {
      reference,
      error: error instanceof Error ? error.name : "UnknownError",
    });
    return send(res, 502, {
      ok: false,
      error: "The review service could not be reached. No confirmation was recorded; please try again.",
    });
  }

  return send(res, 202, { ok: true, reference, receivedAt });
}

async function readJson(req: VercelRequest): Promise<unknown> {
  const declaredLength = Number(req.headers["content-length"] ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_INTAKE_BYTES) throw new BodyTooLargeError();

  // Vercel normally parses JSON first. Keep the streaming path so this handler
  // behaves the same in local Node adapters and cannot bypass the size cap.
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) return parseRaw(req.body);
    if (typeof req.body === "string") return parseRaw(Buffer.from(req.body));
    const encoded = Buffer.from(JSON.stringify(req.body));
    if (encoded.byteLength > MAX_INTAKE_BYTES) throw new BodyTooLargeError();
    return req.body;
  }

  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_INTAKE_BYTES) throw new BodyTooLargeError();
    chunks.push(buffer);
  }
  return parseRaw(Buffer.concat(chunks));
}

function parseRaw(raw: Buffer): unknown {
  if (raw.byteLength > MAX_INTAKE_BYTES) throw new BodyTooLargeError();
  if (raw.byteLength === 0) throw new SyntaxError("empty body");
  return JSON.parse(raw.toString("utf8")) as unknown;
}

function intakeWebhook(): URL | null {
  const configured = process.env.INTAKE_WEBHOOK_URL?.trim();
  if (!configured) return null;
  try {
    const url = new URL(configured);
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("unsafe webhook URL");
    return url;
  } catch {
    console.error("INTAKE_WEBHOOK_URL must be a credential-free HTTPS URL");
    return null;
  }
}

async function forward(
  webhook: URL,
  body: {
    reference: string;
    receivedAt: string;
    source: "doublecheck-web";
    policyVersion: string;
    submission: ValidIntake;
  },
): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.INTAKE_WEBHOOK_BEARER_TOKEN?.trim();
  if (token) headers.Authorization = `Bearer ${token}`;

  return fetch(webhook, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "error",
    signal: AbortSignal.timeout(8_000),
  });
}

function makeReference(kind: ValidIntake["kind"]): string {
  const prefix = kind === "application" ? "APP" : "RPT";
  const day = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `${prefix}-${day}-${randomBytes(10).toString("hex").toUpperCase()}`;
}

function secureJsonHeaders(res: ServerResponse) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function send(res: ServerResponse, status: number, body: ErrorBody | Record<string, unknown>) {
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

class BodyTooLargeError extends Error {}
