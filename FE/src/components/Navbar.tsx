import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

/** Module-level so the intro plays once per page load, not on every client-side navigation. */
let introPlayed = false;

export function Navbar() {
  // Home already leads with the large hero search — don't stack a second one here.
  const isHome = useLocation().pathname === "/";

  const [intro] = useState(!introPlayed);
  useEffect(() => {
    introPlayed = true;
  }, []);
  const introClass = intro ? "animate-fade-in" : "";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur-md dark:border-slate-800 dark:bg-[#0b0e14]/80">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <Link to="/" className={`shrink-0 ${introClass}`} aria-label="DoubleCheck home">
            <Logo />
          </Link>
          <div className={`sm:hidden ${introClass}`} style={intro ? { animationDelay: "120ms" } : undefined}>
            <ThemeToggle />
          </div>
        </div>

        {!isHome && (
          <div
            className={`flex-1 sm:max-w-md sm:flex-none md:max-w-lg lg:max-w-xl ${introClass}`}
            style={intro ? { animationDelay: "60ms" } : undefined}
          >
            <SearchBar />
          </div>
        )}

        <div
          className={`ml-auto hidden shrink-0 sm:block ${introClass}`}
          style={intro ? { animationDelay: "120ms" } : undefined}
        >
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
