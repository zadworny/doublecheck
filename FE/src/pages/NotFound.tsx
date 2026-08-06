import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <h1 className="text-2xl font-semibold">Nothing found at this address</h1>
      <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
        The record you're looking for doesn't exist in this explorer, or the ID was mistyped.
      </p>
      <Link to="/" className="mt-2 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
        ← Back to home
      </Link>
    </div>
  );
}
