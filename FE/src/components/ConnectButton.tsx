import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useRegistry } from "../data";
import { Identicon } from "./Identicon";
import { FREIGHTER_URL, walletErrorMessage } from "../lib/wallet";

/**
 * Optional wallet connection, shown as secondary chrome.
 *
 * This must never read as a sign-in wall: the verifier works fully without it,
 * and the button exists only so a badge holder can jump to their own record.
 */
export function ConnectButton() {
  const { address, connecting, failure, available, connect, disconnect } = useWallet();
  const { getByController } = useRegistry();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const me = address ? getByController(address) : undefined;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (!address) {
    // No extension: point at the install page rather than a button that cannot work.
    if (!available) {
      return (
        <a
          href={FREIGHTER_URL}
          target="_blank"
          rel="noreferrer"
          title="Freighter is a Stellar wallet browser extension"
          className="hidden items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 sm:flex dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Get a wallet
        </a>
      );
    }

    return (
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => void connect()}
          disabled={connecting}
          title="Optional — find your own record. Verification never needs a wallet."
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {connecting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
              <path d="M16 12h2" strokeLinecap="round" />
            </svg>
          )}
          {connecting ? "Connecting…" : "Connect"}
        </button>

        {/* A dismissed prompt is the user's own choice — say nothing. Only
            actionable problems (wrong network, missing extension) get a box. */}
        {failure && failure.error !== "rejected" && (
          <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border border-amber-500/30 bg-white p-3 text-xs text-slate-600 shadow-xl dark:bg-slate-900 dark:text-slate-300">
            {walletErrorMessage(failure)}
          </div>
        )}
      </div>
    );
  }

  const short = `${address.slice(0, 4)}…${address.slice(-4)}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg border border-slate-300 py-1 pl-1 pr-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Identicon seed={me?.id ?? address} size={22} />
        <span className="font-mono text-xs">{short}</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-3 py-2.5 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">Connected address</div>
            <div className="mt-0.5 break-all font-mono text-[11px] text-slate-700 dark:text-slate-300">
              {address}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/me");
            }}
            className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/70"
          >
            {me ? "View my record" : "No record found"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              disconnect();
            }}
            className="w-full border-t border-slate-100 px-3 py-2.5 text-left text-sm text-slate-500 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/70"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

/** Shown on `/me` when the address holds no badge. */
export function NoRecordForAddress({ address }: { address: string }) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-500/10 text-slate-500 dark:text-slate-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">No badge for this address</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nothing in the registry is soulbound to{" "}
          <code className="break-all rounded bg-slate-100 px-1 py-0.5 text-xs dark:bg-slate-800">{address}</code>.
        </p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Badges are issued by an issuer after vetting — they cannot be self-minted, so connecting a
          wallet does not create one.
        </p>
      </div>
      <Link to="/" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
        Back to the registry
      </Link>
    </div>
  );
}
