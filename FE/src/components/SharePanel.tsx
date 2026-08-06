import { useMemo, useState } from "react";
import { CopyButton } from "./CopyButton";
import { Panel } from "./Panel";
import { qrDataUri, qrSvg } from "../lib/qr";
import type { Organisation, Person } from "../data/types";

/**
 * The distribution layer.
 *
 * A registry entry nobody can share is worth very little: the reader has to
 * arrive at it from somewhere, usually from the person being checked. This
 * panel produces the three carriers that get someone there — a link, a QR code
 * for calls and DMs, and an embed for email signatures and profiles.
 *
 * Every carrier resolves to the live verifier rather than encoding a result.
 * A badge that asserted "verified" on its own would keep asserting it after a
 * revocation, which is the failure mode the registry exists to prevent.
 */

type Subject = Organisation | Person;

const TABS = [
  { key: "link", label: "Link" },
  { key: "qr", label: "QR code" },
  { key: "embed", label: "Embed" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SharePanel({ subject }: { subject: Subject }) {
  const [tab, setTab] = useState<TabKey>("link");

  // Handle-based, not id-based: a handle survives a re-deployment to a new
  // contract and is legible in an email signature.
  const url = `${window.location.origin}/${subject.handle}`;
  const label = subject.name || subject.handle;

  const qr = useMemo(() => qrSvg(url, { color: "currentColor" }), [url]);
  const download = useMemo(() => qrDataUri(url, { color: "#0f172a" }), [url]);

  const embedHtml =
    `<a href="${url}" rel="noopener">` +
    `Verified on DoubleCheck &mdash; ${escapeHtml(label)}` +
    `</a>`;
  const embedMarkdown = `[Verified on DoubleCheck — ${label}](${url})`;

  return (
    <Panel title="Share this verification">
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sharing format">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t.key
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "link" && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800/70">
                {url}
              </code>
              <CopyButton value={url} label="Copy the verification link">
                Copy
              </CopyButton>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Anyone can open this — no account, no wallet, nothing to install.
            </p>
          </div>
        )}

        {tab === "qr" && (
          <div className="flex flex-wrap items-center gap-5">
            <div
              className="h-36 w-36 shrink-0 rounded-lg bg-white p-2 text-slate-900"
              // The QR is generated locally from the URL above; there is no
              // remote content and nothing user-supplied in the markup.
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Show this on a call or paste it into a message. Scanning it opens the verification
                page in any phone camera.
              </p>
              <a
                href={download}
                download={`doublecheck-${subject.handle}.svg`}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download SVG
              </a>
            </div>
          </div>
        )}

        {tab === "embed" && (
          <div className="space-y-4">
            <Snippet
              heading="HTML — email signatures, websites"
              value={embedHtml}
              copyLabel="Copy the HTML embed"
            />
            <Snippet
              heading="Markdown — READMEs, docs"
              value={embedMarkdown}
              copyLabel="Copy the Markdown embed"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              These embed a <em>link</em>, not a result. Anyone following it sees the current status,
              so a badge cannot keep claiming to be valid after it has been revoked or has expired.
            </p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function Snippet({
  heading,
  value,
  copyLabel,
}: {
  heading: string;
  value: string;
  copyLabel: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{heading}</span>
        <CopyButton value={value} label={copyLabel}>
          Copy
        </CopyButton>
      </div>
      <pre className="overflow-x-auto rounded-md bg-slate-100 px-3 py-2 text-xs dark:bg-slate-800/70">
        <code>{value}</code>
      </pre>
    </div>
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
