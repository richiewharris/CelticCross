// The three dice, the chance of each face, and what a landing total means.

export type Die = 0 | 1 | 2;
export const DIE_IDS: readonly Die[] = [0, 1, 2];

export const DICE = [
  { sides: 4, name: "Caltrop", range: "1–4" },
  { sides: 6, name: "Wire cube", range: "1–6" },
  { sides: 8, name: "Twin cubes", range: "1–8" },
] as const;

/** The twin cubes stand on end 1 time in 16; otherwise the two cubes (1–4 each) turn freely on the rod and their faces add. */
export const UPRIGHT = 1 / 16;

/** [face, chance] for each die. */
export const DIST: readonly (readonly [number, number][])[] = [
  [1, 2, 3, 4].map(v => [v, 1 / 4] as [number, number]),
  [1, 2, 3, 4, 5, 6].map(v => [v, 1 / 6] as [number, number]),
  [[1, UPRIGHT], ...[2, 3, 4, 5, 6, 7, 8].map(v => [v, ((1 - UPRIGHT) * (4 - Math.abs(v - 5))) / 16] as [number, number])],
];

/** A full hand: all three dice. Hands are bit sets, bit d = die d still to roll. */
export const ALL = 7;
export const bit = (d: number) => 1 << d;

export type Rng = () => number;

/** Roll die d. */
export function sample(d: Die, rng: Rng): number {
  let x = rng();
  for (const [v, p] of DIST[d]) if ((x -= p) < 0) return v;
  return DIST[d][DIST[d].length - 1][0];
}

export type Landing = "win" | "bust" | "nine" | "draw" | "again" | null;

/** What landing on `total` with a roll of `value` means. */
export function landing(total: number, value: number): Landing {
  if (total === 20) return "win";
  if (total > 20) return "bust";
  if (total === 9) return "nine";
  if (total === 12) return "draw";
  if (total === 7 || value === 3) return "again";
  return null;
}

/** A small seeded generator (mulberry32) for tests and the simulator. */
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
