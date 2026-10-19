// Randomness is passed in so a pan can be replayed from a seed in tests.
export type Rng = () => number;

/** A small seeded generator (mulberry32). */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const rand = (rng: Rng, a: number, b: number) => a + rng() * (b - a);

export function poisson(rng: Rng, l: number) {
  let k = 0, p = 1;
  const L = Math.exp(-l);
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}
