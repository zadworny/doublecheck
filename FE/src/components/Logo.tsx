/**
 * The DoubleCheck logo, drawn as SVG rather than shipped as a bitmap so it
 * stays sharp at any size and costs nothing to load.
 *
 * Both parts use `currentColor`. The supplied artwork is white, which is right
 * on the dark theme and invisible on the light one; inheriting the surrounding
 * text colour keeps the mark legible either way without maintaining two files.
 */

interface LogoMarkProps {
  className?: string;
}

/** The mark on its own — two ticks in a rounded square. Also the favicon. */
export function LogoMark({ className = "h-8 w-8" }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="4" y="4" width="56" height="56" rx="15" stroke="currentColor" strokeWidth="4" />
      <path
        d="M13 32.5 22.5 42 39 21"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30.5 34 36.5 41 52 20"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface LogoProps {
  /** Hide the wordmark, e.g. on narrow screens. */
  markOnly?: boolean;
  className?: string;
}

/** Mark plus wordmark. The wordmark is real text, so it stays selectable. */
export function Logo({ markOnly = false, className = "" }: LogoProps) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark className="h-8 w-8 shrink-0" />
      {!markOnly && (
        <span className="text-lg font-bold tracking-tight">DoubleCheck</span>
      )}
    </span>
  );
}
