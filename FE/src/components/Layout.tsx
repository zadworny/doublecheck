import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { chainConfig } from "../lib/chain";

const IS_TESTNET = chainConfig.networkPassphrase.includes("Test SDF");

export function Layout() {
  return (
    <div className="flex min-h-full flex-col">
      <Navbar />
      {IS_TESTNET && (
        <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-center text-xs text-amber-700 dark:text-amber-400">
          Testnet — these records are real on-chain claims, but the network is a test network and the
          entities are demonstration accounts.
        </div>
      )}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 dark:border-slate-800 dark:text-slate-500">
        DoubleCheck — read live from{" "}
        <a
          href={chainConfig.explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-sky-500"
        >
          <code>{chainConfig.contractId.slice(0, 6)}…{chainConfig.contractId.slice(-4)}</code>
        </a>{" "}
        on Stellar.
      </footer>
    </div>
  );
}
