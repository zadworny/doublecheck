/**
 * Deterministic identicon generation.
 *
 * Produces a stable 5x5, horizontally-mirrored grid + a foreground/background
 * color pair from any seed string, in the style of wallet "blockies" avatars.
 * Same seed always produces the same avatar — no images, no network calls.
 */

function hashCode(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const GRID_SIZE = 5;

export interface IdenticonData {
  cells: boolean[][]; // [row][col], GRID_SIZE x GRID_SIZE, already mirrored
  foreground: string;
  background: string;
}

export function generateIdenticon(seed: string): IdenticonData {
  const rng = mulberry32(hashCode(seed));

  const hue = Math.floor(rng() * 360);
  const foreground = `hsl(${hue}, 65%, 45%)`;
  const background = `hsl(${hue}, 45%, 93%)`;

  const halfWidth = Math.ceil(GRID_SIZE / 2);
  const cells: boolean[][] = [];
  for (let row = 0; row < GRID_SIZE; row++) {
    const left: boolean[] = [];
    for (let col = 0; col < halfWidth; col++) {
      left.push(rng() > 0.55);
    }
    const mirrored = [...left].reverse().slice(GRID_SIZE % 2 === 0 ? 0 : 1);
    cells.push([...left, ...mirrored]);
  }

  return { cells, foreground, background };
}
