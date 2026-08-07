import { Link } from "react-router-dom";
import { useWallet } from "../context/WalletContext";
import { useRegistry } from "../data";
import { NoRecordForAddress } from "../components/ConnectButton";
import { OrgDetail } from "./OrgDetail";
import { PersonDetail } from "./PersonDetail";
import { FREIGHTER_URL, walletErrorMessage } from "../lib/wallet";

/**
 * `/me` — the badge holder's own record, resolved from the connected wallet.
 *
 * The address is matched against controllers that are already public, so this
 * page shows nothing a visitor could not reach by searching for the handle. It
 * is a shortcut, not a private area: no signature is checked, and there is
 * deliberately nothing here that would be unsafe to show without one.
 */
export function MyRecord() {
  const { address, connecting, failure, available, connect } = useWallet();
  const { getByController } = useRegistry();

  if (!address) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4 py-16 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
            <path d="M16 12h2" strokeLinecap="round" />
          </svg>
        </span>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold">Connect to find your record</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            If a badge is soulbound to your Stellar address, this takes you straight to it. Your
            wallet is only asked for its public address — nothing is signed and no transaction is
            sent.
          </p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Checking someone else never needs a wallet. This is only a shortcut for badge holders.
          </p>
        </div>

        {available ? (
          <button
            type="button"
            onClick={() => void connect()}
            disabled={connecting}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500 disabled:opacity-60"
          >
            {connecting ? "Connecting…" : "Connect wallet"}
          </button>
        ) : (
          <a
            href={FREIGHTER_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-500"
          >
            Install Freighter
          </a>
        )}

        {failure && failure.error !== "rejected" && (
          <p className="max-w-sm text-xs text-amber-600 dark:text-amber-400">
            {walletErrorMessage(failure)}
          </p>
        )}

        <Link to="/" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          Back to the registry
        </Link>
      </div>
    );
  }

  const me = getByController(address);
  if (!me) return <NoRecordForAddress address={address} />;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-500/30 bg-sky-500/5 px-4 py-2.5 text-xs text-slate-600 dark:text-slate-300">
        Showing the record soulbound to your connected address. This is the same public page anyone
        checking you would see.
      </div>
      {me.kind === "organisation" ? <OrgDetail orgId={me.id} /> : <PersonDetail personId={me.id} />}
    </div>
  );
}
