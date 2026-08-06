import { useState, type ReactNode } from "react";

interface CopyButtonProps {
  value: string;
  children: ReactNode;
  className?: string;
  /** Announced to screen readers and used as the tooltip. */
  label: string;
}

/** A button that copies `value` and confirms it, for share and embed snippets. */
export function CopyButton({ value, children, className = "", label }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API is unavailable outside secure contexts. The snippet is
      // still on screen and selectable, so degrade quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 ${className}`}
    >
      {copied ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {children}
        </>
      )}
    </button>
  );
}
