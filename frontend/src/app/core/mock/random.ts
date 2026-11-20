/** Tiny seeded PRNG (mulberry32), the backend seed uses the same one. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Weighted<T> = [T, number];

export function pick<T>(rng: () => number, items: Weighted<T>[]): T {
  let total = 0;
  for (const [, weight] of items) total += weight;
  const r = rng() * total;
  let cumulative = 0;
  for (const [value, weight] of items) {
    cumulative += weight;
    if (r < cumulative) return value;
  }
  return items[items.length - 1][0];
}
