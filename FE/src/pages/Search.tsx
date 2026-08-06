import { Link, useSearchParams } from "react-router-dom";
import { useRegistry } from "../data";
import { Identicon } from "../components/Identicon";
import { Panel } from "../components/Panel";

export function Search() {
  const [params] = useSearchParams();
  const { search } = useRegistry();
  const q = params.get("q") ?? "";
  const results = search(q);

  const orgResults = results.filter((r) => r.kind === "organisation");
  const personResults = results.filter((r) => r.kind === "person");
  const claimResults = results.filter((r) => r.kind === "claim");

  function targetPath(kind: string, id: string) {
    if (kind === "organisation") return `/org/${id}`;
    if (kind === "person") return `/person/${id}`;
    return `/tx/${id}`;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Search results</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {results.length} result{results.length === 1 ? "" : "s"} for "{q}"
        </p>
      </div>

      {results.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 px-6 py-14 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No organisations, people or claim IDs match "{q}". Try a name, a handle, a domain, or a claim id.
        </div>
      ) : (
        <div className="space-y-6">
          {[
            { title: "Organisations", items: orgResults },
            { title: "People", items: personResults },
            { title: "Claims", items: claimResults },
          ]
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <Panel key={group.title} title={`${group.title} (${group.items.length})`}>
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/70">
                  {group.items.map((r) => (
                    <li key={`${r.kind}-${r.id}`}>
                      <Link
                        to={targetPath(r.kind, r.id)}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/70 dark:hover:bg-slate-900/40"
                      >
                        <Identicon seed={r.id} size={32} rounded={r.kind === "person"} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{r.label}</div>
                          <div className="truncate text-xs text-slate-500 dark:text-slate-400">{r.sublabel}</div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Panel>
            ))}
        </div>
      )}
    </div>
  );
}
