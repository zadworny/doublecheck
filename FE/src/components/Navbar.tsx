import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ConnectButton } from "./ConnectButton";
import { Logo } from "./Logo";
import { SearchBar } from "./SearchBar";
import { ThemeToggle } from "./ThemeToggle";

/** Module-level so the intro plays once per page load, not on every client-side navigation. */
let introPlayed = false;

export function Navbar() {
  // Home already leads with the large hero search — don't stack a second one here.
  const { pathname } = useLocation();
  const routePath = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const isHome = routePath === "/";
  const isRegistryIndependent = routePath === "/apply" || routePath === "/standard";

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
          <div
            className={`flex items-center gap-2 sm:hidden ${introClass}`}
            style={intro ? { animationDelay: "120ms" } : undefined}
          >
            <ConnectButton />
            <ThemeToggle />
          </div>
        </div>

        <nav className="flex items-center gap-1 overflow-x-auto sm:hidden" aria-label="Primary navigation">
          <NavLink to="/verify" active={routePath === "/verify"}>Check mandate</NavLink>
          <NavLink to="/apply" active={routePath === "/apply"}>Get verified</NavLink>
          <NavLink to="/manage" active={routePath === "/manage"}>Manage</NavLink>
          <NavLink to="/standard" active={routePath === "/standard"}>Our standard</NavLink>
        </nav>

        {!isHome && !isRegistryIndependent && (
          <div
            className={`flex-1 sm:max-w-md sm:flex-none md:max-w-lg lg:max-w-xl ${introClass}`}
            style={intro ? { animationDelay: "60ms" } : undefined}
          >
            <SearchBar />
          </div>
        )}

        <div
          className={`ml-auto hidden shrink-0 items-center gap-2 sm:flex ${introClass}`}
          style={intro ? { animationDelay: "120ms" } : undefined}
        >
          <nav className="flex items-center gap-1" aria-label="Primary navigation">
            <NavLink to="/verify" active={routePath === "/verify"}>Check mandate</NavLink>
            <NavLink to="/apply" active={routePath === "/apply"}>Get verified</NavLink>
            <NavLink to="/manage" active={routePath === "/manage"}>Manage</NavLink>
            <NavLink to="/standard" active={routePath === "/standard"}>Our standard</NavLink>
          </nav>
          <ConnectButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: string }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
        active
          ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      {children}
    </Link>
  );
}
