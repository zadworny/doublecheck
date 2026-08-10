import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useOptionalRegistry, type SearchResult } from "../data";
import { Identicon } from "./Identicon";

interface SearchBarProps {
  size?: "compact" | "large";
  placeholder?: string;
  /** Focus on mount. Only for the hero field, where typing is the primary action. */
  autoFocus?: boolean;
}

const KIND_LABEL: Record<SearchResult["kind"], string> = {
  organisation: "Organisation",
  person: "Person",
  claim: "Claim",
};

export function SearchBar({
  size = "compact",
  placeholder = "Search by name, handle, domain or claim id...",
  autoFocus = false,
}: SearchBarProps) {
  const registry = useOptionalRegistry();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const isLarge = size === "large";

  const results = registry ? registry.search(query).slice(0, 7) : [];
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

  // "/" focuses the search from anywhere on the page.
  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Any change to the query invalidates the previous highlight.
  useEffect(() => setActiveIndex(0), [query]);

  // Focus once the entry animation has settled, so the caret doesn't ride a moving field.
  useEffect(() => {
    if (!autoFocus) return;
    const id = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 700);
    return () => window.clearTimeout(id);
  }, [autoFocus]);

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
      goToResult(results[Math.min(activeIndex, results.length - 1)]);
    } else {
      navigate(`/search?q=${encodeURIComponent(query.trim())}`);
      setFocused(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
      setFocused(false);
      return;
    }
    if (!showDropdown || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    }
  }

  function clear() {
    setQuery("");
    inputRef.current?.focus();
  }

  return (
    <div ref={containerRef} className={`relative w-full ${isLarge ? "max-w-2xl" : "max-w-md"}`}>
      <form onSubmit={handleSubmit} role="search">
        <div className="relative">
          <svg
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${isLarge ? "left-4" : "left-3"}`}
            width={isLarge ? "20" : "16"}
            height={isLarge ? "20" : "16"}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Search the registry"
            role="combobox"
            aria-expanded={showDropdown}
            aria-controls="search-results"
            aria-autocomplete="list"
            aria-activedescendant={showDropdown && results.length > 0 ? `search-result-${activeIndex}` : undefined}
            autoComplete="off"
            spellCheck={false}
            className={`w-full border border-slate-300 bg-white text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 ${
              isLarge
                ? "rounded-xl py-4 pl-12 text-base shadow-sm hover:border-slate-400 focus:shadow-lg focus:shadow-sky-500/10 dark:hover:border-slate-600 sm:text-lg"
                : "rounded-lg py-1.5 pl-9 text-sm"
            } ${query ? (isLarge ? "pr-12" : "pr-9") : isLarge ? "pr-16" : "pr-3"}`}
          />

          {query ? (
            <button
              type="button"
              onClick={clear}
              aria-label="Clear search"
              className={`absolute top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${
                isLarge ? "right-3" : "right-2"
              }`}
            >
              <svg width={isLarge ? "18" : "14"} height={isLarge ? "18" : "14"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
              </svg>
            </button>
          ) : (
            isLarge && (
              <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 font-sans text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:block">
                /
              </kbd>
            )
          )}
        </div>
      </form>

      {showDropdown && (
        <div
          id="search-results"
          role="listbox"
          className={`absolute z-40 w-full overflow-hidden border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 ${
            isLarge ? "mt-2 rounded-xl" : "mt-1.5 rounded-lg"
          }`}
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-left text-sm text-slate-500 dark:text-slate-400">
              {registry
                ? `No matches for "${query}" — press Enter to search everything.`
                : "Press Enter to load the registry and search."}
            </div>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((r, i) => (
                <li key={`${r.kind}-${r.id}`}>
                  <button
                    type="button"
                    id={`search-result-${i}`}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => goToResult(r)}
                    className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                      i === activeIndex ? "bg-slate-100 dark:bg-slate-800/70" : ""
                    }`}
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
