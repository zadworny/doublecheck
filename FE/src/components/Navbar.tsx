import { Link } from "react-router-dom";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-[#0b0e14]/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="m9 12 2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                <path
                  d="M12 3 4 6v6c0 5 3.4 8.7 8 9 4.6-.3 8-4 8-9V6l-8-3Z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Verified
              <span className="ml-1.5 hidden text-xs font-normal text-slate-400 sm:inline">Trust Explorer</span>
            </span>
          </Link>
          <div className="sm:hidden">
            <ThemeToggle />
          </div>
        </div>

        <div className="flex-1 sm:max-w-md sm:flex-none md:max-w-lg lg:max-w-xl">
          <SearchBar />
        </div>

        <div className="ml-auto hidden shrink-0 sm:block">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
