/**
 * Deterministic pseudo-hash / pseudo-address generation.
 *
 * These are NOT cryptographic hashes — they exist purely so mock records in
 * this static MVP have stable, hash-looking identifiers (0x...) that always
 * derive from the same seed (e.g. a person or organisation's name), the way
 * a real chain identifier would be derived from signed content.
 */

/** 32-bit FNV-1a hash, used as the seed for expanding into longer hex strings. */
function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Simple splitmix32 PRNG so we can expand a single seed into many hex bytes. */
function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    return z;
  };
}

function toHex(rng: () => number, byteLength: number): string {
  let out = "";
  while (out.length < byteLength * 2) {
    out += rng().toString(16).padStart(8, "0");
  }
  return out.slice(0, byteLength * 2);
}

/** A 32-byte, 0x-prefixed hash-style ID (used for relationships, mandates, orgs — the "transaction/block hash" role). */
export function pseudoHash(seed: string): string {
  const rng = makeRng(fnv1a(seed));
  return `0x${toHex(rng, 32)}`;
}

/** A 20-byte, 0x-prefixed address-style ID (used for people — the "wallet address" role). */
export function pseudoAddress(seed: string): string {
  const rng = makeRng(fnv1a(`addr:${seed}`));
  return `0x${toHex(rng, 20)}`;
}
