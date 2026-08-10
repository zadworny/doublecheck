import { useState, type ChangeEvent, type ReactNode } from "react";
import type { Organisation, Person } from "../data/types";
import {
  isLocalOrPrivateHostname,
  isZeroHash,
  MAX_CREDENTIAL_BYTES,
  verifyCredentialBytes,
  type CredentialVerification,
} from "../lib/credential";
import { Panel } from "./Panel";

type Subject = Organisation | Person;
type State =
  | { status: "idle" | "loading" }
  | { status: "ready"; result: CredentialVerification }
  | { status: "error"; message: string };

export function CredentialPanel({ subject }: { subject: Subject }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const placeholder = isZeroHash(subject.metadataHash);
  const location = credentialLocation(subject.metadataUri);

  async function verify() {
    const safeUrl = location.safeUrl;
    if (!safeUrl) return;
    setState({ status: "loading" });
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await fetch(safeUrl, {
        signal: controller.signal,
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: { Accept: "application/vc+ld+json, application/json" },
      });
      if (!response.ok) throw new Error(`Credential host returned HTTP ${response.status}.`);
      const declaredSize = Number(response.headers.get("content-length") ?? 0);
      if (declaredSize > MAX_CREDENTIAL_BYTES) throw new Error("Credential document is too large.");
      const bytes = await readLimited(response, MAX_CREDENTIAL_BYTES);
      setState({
        status: "ready",
        result: await verifyCredentialBytes(bytes, subject.metadataHash),
      });
    } catch (cause) {
      const message =
        cause instanceof DOMException && cause.name === "AbortError"
          ? "Credential request timed out."
          : cause instanceof Error
            ? cause.message
            : "Credential could not be read.";
      setState({ status: "error", message });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function verifyFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_CREDENTIAL_BYTES) {
      setState({ status: "error", message: "Credential document is too large." });
      return;
    }
    setState({ status: "loading" });
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setState({
        status: "ready",
        result: await verifyCredentialBytes(bytes, subject.metadataHash),
      });
    } catch (cause) {
      setState({
        status: "error",
        message: cause instanceof Error ? cause.message : "Credential file could not be read.",
      });
    }
  }

  return (
    <Panel title="Off-chain credential anchor">
      <div className="space-y-4 px-4 py-4 text-sm">
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          Personal verification data is kept off-chain so issuer-controlled storage can support
          deletion. Stellar still retains the public URI, document hash, and status, while hosts,
          caches, or IPFS copies may persist. Fetching is manual because it contacts the credential
          host from your browser and may reveal your IP address to that host.
        </p>

        <dl className="space-y-2 text-xs">
          <CredentialRow label="Host" value={location.label} />
          <CredentialRow label="SHA-256 anchor" value={subject.metadataHash || "Not set"} mono />
        </dl>

        {placeholder ? (
          <Notice tone="neutral">
            This demonstration record uses a zero placeholder hash; no credential integrity claim is made.
          </Notice>
        ) : (
          <div className="space-y-3">
            {location.safeUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void verify()}
                  disabled={state.status === "loading"}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200"
                >
                  {state.status === "loading" ? "Checking…" : "Fetch and compare hash"}
                </button>
                <a
                  href={location.safeUrl}
                  target="_blank"
                  rel="noreferrer nofollow"
                  className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                >
                  Open credential host
                </a>
              </div>
            ) : (
              <Notice tone="neutral">{location.reason}</Notice>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:text-slate-200">
                Compare a local credential file
                <input
                  type="file"
                  accept=".json,application/json,application/vc+ld+json"
                  className="sr-only"
                  disabled={state.status === "loading"}
                  onChange={(event) => void verifyFile(event)}
                />
              </label>
              <span className="text-[11px] leading-4 text-slate-400">
                Checked in this browser; the file is not uploaded or fetched from its URI.
              </span>
            </div>
          </div>
        )}

        {state.status === "error" && <Notice tone="negative">{state.message}</Notice>}
        {state.status === "ready" && <VerificationResult result={state.result} />}
      </div>
    </Panel>
  );
}

function VerificationResult({ result }: { result: CredentialVerification }) {
  if (!result.matches) {
    return (
      <Notice tone="negative">
        Hash mismatch. The fetched document is not the credential currently anchored on Stellar. Do
        not rely on its contents.
      </Notice>
    );
  }
  return (
    <div className="space-y-3">
      <Notice tone="positive">
        Document integrity matches the on-chain SHA-256 anchor
        {result.matchedRepresentation === "canonical" ? " after canonical JSON ordering" : ""}.
      </Notice>
      {result.summary && (
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <CredentialRow
            label="Format"
            value={result.summary.w3cVc2 ? "W3C Verifiable Credential 2.0" : "JSON credential"}
          />
          <CredentialRow label="Proof field" value={result.summary.proofPresent ? "Present" : "Not present"} />
          {result.summary.subjectName && <CredentialRow label="Disclosed name" value={result.summary.subjectName} />}
          {result.summary.issuer && <CredentialRow label="Credential issuer" value={result.summary.issuer} />}
          {result.summary.validUntil && <CredentialRow label="Credential validity" value={result.summary.validUntil} />}
        </dl>
      )}
      <p className="text-[11px] leading-4 text-slate-400">
        Hash matching proves document integrity only. This verifier does not yet validate the VC proof
        suite or selective-disclosure presentation cryptographically.
      </p>
    </div>
  );
}

function CredentialRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-slate-400">{label}</dt>
      <dd className={`mt-0.5 break-all text-slate-700 dark:text-slate-200 ${mono ? "font-mono" : "font-medium"}`}>
        {value}
      </dd>
    </div>
  );
}

function Notice({ tone, children }: { tone: "positive" | "negative" | "neutral"; children: ReactNode }) {
  const classes =
    tone === "positive"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
      : tone === "negative"
        ? "border-red-500/30 bg-red-500/10 text-red-800 dark:text-red-300"
        : "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300";
  return <div className={`rounded-lg border px-3 py-2 text-xs leading-5 ${classes}`}>{children}</div>;
}

function credentialLocation(value: string): { label: string; safeUrl?: string; reason: string } {
  if (!value.trim()) return { label: "Not published", reason: "No off-chain credential URI is anchored." };
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { label: "Invalid URI", reason: "The anchored credential URI is malformed." };
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    return {
      label: url.protocol === "ipfs:" ? `IPFS · ${url.hostname}` : url.hostname || value,
      reason:
        url.protocol === "ipfs:"
          ? "IPFS anchors are not sent through a hard-coded gateway. Obtain the disclosed credential separately and compare it locally below."
          : "Only credential URLs using public HTTPS are fetched automatically.",
    };
  }
  const host = url.hostname.toLowerCase();
  if (isLocalOrPrivateHostname(host)) {
    return { label: host, reason: "Private or local-network credential hosts are not fetched." };
  }
  return { label: host, safeUrl: url.toString(), reason: "" };
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > limit) throw new Error("Credential document is too large.");
    return bytes;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new Error("Credential document is too large.");
    }
    chunks.push(value);
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}
