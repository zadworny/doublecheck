import { Link } from "react-router-dom";
import { SearchBar } from "../components/SearchBar";

/**
 * Most arrivals here followed a link someone sent them, so this page says the
 * one thing that matters in that situation: no record was found, which is not
 * the same as a broken link, and is itself a reason for caution.
 */
export function NotFound() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-4 py-20 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold">No record found</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Nothing in the registry matches this address. That may be a mistyped link — or the person
          or organisation may simply never have been verified.
        </p>
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
          An unverified counterparty is not proof of anything, but it is a reason to check further
          before acting.
        </p>
      </div>

      <div className="w-full pt-2">
        <SearchBar size="large" placeholder="Search by name, handle or domain…" />
      </div>

      <Link to="/" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
        Back to the registry
      </Link>
    </div>
  );
}
