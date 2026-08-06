/** Truncates a hash/address to a head...tail display, e.g. 0x8f2a...c91d. */
export function truncateHash(id: string, headLen = 6, tailLen = 4): string {
  if (id.length <= headLen + tailLen + 3) return id;
  return `${id.slice(0, headLen)}...${id.slice(-tailLen)}`;
}

/** Formats an ISO date string as "12 Mar 2026". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Formats an ISO date string as a relative "3 days ago" style string. */
export function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHour < 24) return `${diffHour} hour${diffHour === 1 ? "" : "s"} ago`;
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return formatDate(iso);
}
