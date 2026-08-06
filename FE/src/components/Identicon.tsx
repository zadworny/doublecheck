import { useMemo } from "react";
import { generateIdenticon } from "../lib/identicon";

interface IdenticonProps {
  seed: string;
  size?: number;
  rounded?: boolean;
  className?: string;
}

export function Identicon({ seed, size = 40, rounded = true, className = "" }: IdenticonProps) {
  const { cells, foreground, background } = useMemo(() => generateIdenticon(seed), [seed]);
  const gridSize = cells.length;
  const cellSize = size / gridSize;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={`shrink-0 ${rounded ? "rounded-full" : "rounded-md"} ${className}`}
      role="img"
      aria-label="Identicon"
    >
      <rect width={size} height={size} fill={background} />
      {cells.map((row, rowIndex) =>
        row.map((filled, colIndex) =>
          filled ? (
            <rect
              key={`${rowIndex}-${colIndex}`}
              x={colIndex * cellSize}
              y={rowIndex * cellSize}
              width={cellSize}
              height={cellSize}
              fill={foreground}
            />
          ) : null,
        ),
      )}
    </svg>
  );
}
