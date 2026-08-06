import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { search, type SearchResult } from "../data";
import { Identicon } from "./Identicon";

interface SearchBarProps {
  size?: "compact" | "large";
  placeholder?: string;
}

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  organisation: "Organisation",
  person: "Person",
  claim: "Claim",
};

export function SearchBar({ size = "compact", placeholder = "Search by name, company or claim ID..." }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const results = search(query).slice(0, 7);
  const showDropdown = focused && query.trim().length > 0;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function goToResult(result: SearchResult) {
    setQuery("");
    setFocused(false);
    if (result.kind === "organisation") navigate(`/org/${result.id}`);
    else if (result.kind === "person") navigate(`/person/${result.id}`);
    else navigate(`/tx/${result.id}`);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    if (results.length > 0) {
      goToResult(results[0]);
    } else {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setFocused(false);
    }
  }

  return (
    <div ref={containerRef} className={`relative w-full ${size === "large" ? "max-w-2xl" : "max-w-md"}`}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={placeholder}
            className={`w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
              size === "large" ? "py-3 text-base" : "py-1.5 text-sm"
            }`}
          />
        </div>
      </form>

      {showDropdown && (
        <div className="absolute z-40 mt-1.5 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">No matches for "{query}"</div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => goToResult(r)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/70"
                  >
                    {r.kind === "claim" ? (
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
                        </svg>
                      </span>
                    ) : (
                      <Identicon seed={r.id} size={28} />
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-slate-800 dark:text-slate-100">{r.label}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{r.sublabel}</span>
                    </span>
                    <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {KIND_LABEL[r.kind]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
