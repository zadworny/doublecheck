export function VerifiedBadge({ issuer, label = "Verified" }: { issuer?: string; label?: string }) {
  return (
    <span
      title={issuer ? `Identity verified by ${issuer}` : "Identity verified"}
      className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-inset ring-sky-500/20 dark:text-sky-400"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 4 5.5v6c0 5.25 3.4 9.6 8 10.5 4.6-.9 8-5.25 8-10.5v-6L12 2Zm-1.2 14-3.8-3.8 1.4-1.4 2.4 2.4 5.4-5.4 1.4 1.4-6.8 6.8Z" />
      </svg>
      {label}
    </span>
  );
}
