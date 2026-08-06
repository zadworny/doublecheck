import { useState, type MouseEvent } from "react";
import { truncateHash } from "../lib/format";

interface HashIdProps {
  value: string;
  headLen?: number;
  tailLen?: number;
  className?: string;
  copyable?: boolean;
}

export function HashId({ value, headLen = 8, tailLen = 6, className = "", copyable = true }: HashIdProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — fail silently, this is a cosmetic affordance.
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[0.85em] ${className}`}>
      <span title={value}>{truncateHash(value, headLen, tailLen)}</span>
      {copyable && (
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Copy to clipboard"
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          )}
        </button>
      )}
    </span>
  );
}
