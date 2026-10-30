// Fiche rule experiments: exact best play and a match simulator for candidate variants.
//   npx tsx sim/fiche-variants.ts [--matches 20000]
// Base rules are the live ones (a three can be rerolled or kept). Variants:
//   carry  - a drawn round adds its stake to the next round (worth 2, then 3…); matches are to points
//   seven  - landing on 7: roll again, or pass the next roll to the rival
//   draft  - each round, a single roll decides who picks first; players pick three dice in turn from a
//            pool of six (two of each kind). "alt" = A B A B A B, "snake" = A B B A A B
import { DIST, landing, seeded, type Rng } from "../src/games/fiche/engine/dice";

type Hand = [number, number, number]; // count of caltrops, wire cubes, twin cubes
/** seven: false = 7 always rolls again; "free" = may pass the next roll to the rival;
 *  "costly" = may pass, but must discard one of your own dice; "choose" = may pass and pick the rival's die. */
type Seven = false | "free" | "costly" | "choose";
interface Rules { seven: Seven; pool?: Hand }
const enc = (h: Hand) => h[0] + 4 * h[1] + 16 * h[2];
const dec = (n: number): Hand => [n % 4, ((n / 4) | 0) % 4, (n / 16) | 0];
const size = (n: number) => { const h = dec(n); return h[0] + h[1] + h[2]; };
const take = (n: number, d: number) => n - [1, 4, 16][d];
const has = (n: number, d: number) => dec(n)[d] > 0;

// ---------- Exact values (draw = 1/2) for the player about to act ----------
function solver(R: Rules) {
  const memo = new Map<string, number>();
  // V: roller to choose a die. forced: die that must be rolled (last die after a kept three / seven), or -1.
  function V(t: number, hp: number, ho: number, forced: number): number {
    const k = `${t},${hp},${ho},${forced}`;
    const m = memo.get(k); if (m !== undefined) return m;
    let v: number;
    if (forced >= 0) v = rollValue(t, 0, ho, forced);
    else if (!size(hp)) v = size(ho) ? 1 - V(t, ho, 0, -1) : 0.5;
    else { v = -1; for (let d = 0; d < 3; d++) if (has(hp, d)) v = Math.max(v, rollValue(t, take(hp, d), ho, d)); }
    memo.set(k, v); return v;
  }
  function rollValue(t: number, hpAfter: number, ho: number, d: number): number {
    let s = 0;
    for (const [r, p] of DIST[d]) s += p * (r === 3 && t + 3 !== 20 ? Math.max(keep(t, hpAfter, ho, d), reroll(t, hpAfter, ho, d)) : after(t + r, r, d, hpAfter, ho));
    return s;
  }
  const keep = (t: number, hp: number, ho: number, d: number) => after(t + 3, 3, d, hp, ho);
  function reroll(t: number, hp: number, ho: number, d: number) {
    let rest = 0, q = 0;
    for (const [r, p] of DIST[d]) { if (r === 3) q += p; else rest += p * after(t + r, r, d, hp, ho); }
    const rr = rest / (1 - q), kp = keep(t, hp, ho, d);
    return rr >= kp ? rr : rest + q * kp;
  }
  function again(T: number, d: number, hp: number, ho: number) { return size(hp) ? V(T, hp, ho, -1) : V(T, 0, ho, d); }
  function after(T: number, r: number, d: number, hp: number, ho: number): number {
    const what = landing(T, r);
    if (what === "win") return 1;
    if (what === "bust" || what === "nine") return 0;
    if (what === "draw") return 0.5;
    if (what === "again") {
      const a = again(T, d, hp, ho);
      return R.seven && T === 7 && size(ho) ? Math.max(a, passValue(T, hp, ho)) : a;
    }
    if (size(ho)) return 1 - V(T, ho, hp, -1);
    return size(hp) ? V(T, hp, 0, -1) : 0.5;
  }
  /** Best value of passing at 7 under this rule set, or -1 if passing isn't allowed. */
  function passValue(T: number, hp: number, ho: number): number {
    if (R.seven === "free") return 1 - V(T, ho, hp, -1);
    if (R.seven === "costly") { let v = -1; for (let x = 0; x < 3; x++) if (has(hp, x)) v = Math.max(v, 1 - V(T, ho, take(hp, x), -1)); return v; }
    if (R.seven === "choose") { let v = -1; for (let e = 0; e < 3; e++) if (has(ho, e)) v = Math.max(v, 1 - rollValue(T, take(ho, e), hp, e)); return v; }
    return -1;
  }
  return { V, rollValue, keep, reroll, again, passValue };
}

// ---------- Playing a round ----------
type Policy = "shrewd" | "casual";
interface RoundEnd { winner: 0 | 1 | 2; rolls: number }

function playRound(R: Rules, S: ReturnType<typeof solver>, hands: [number, number], starter: 1 | 2, pol: [Policy, Policy], rng: Rng): RoundEnd {
  let t = 0, turn = starter, forced = -1, rolls = 0;
  const h: Record<1 | 2, number> = { 1: hands[0], 2: hands[1] };
  const other = (p: 1 | 2): 1 | 2 => (p === 1 ? 2 : 1);
  const sample = (d: number) => { let x = rng(); for (const [v, p] of DIST[d]) if ((x -= p) < 0) return v; return DIST[d][DIST[d].length - 1][0]; };
  for (;;) {
    const p = turn, o = other(p), shrewd = pol[p - 1] === "shrewd";
    if (forced < 0 && !size(h[p])) {
      if (!size(h[o])) return { winner: 0, rolls };
      turn = o; continue;
    }
    let d: number;
    if (forced >= 0) d = forced; // (a die chosen for this player at 7 is already out of their hand)
    else {
      const opts = [0, 1, 2].filter(x => has(h[p], x));
      d = shrewd ? opts.reduce((a, x) => (S.rollValue(t, take(h[p], x), h[o], x) > S.rollValue(t, take(h[p], a), h[o], a) ? x : a)) : opts[(rng() * opts.length) | 0];
      h[p] = take(h[p], d);
    }
    forced = -1;
    let r = sample(d); rolls++;
    // A held three: reroll (replaces it) or keep.
    while (r === 3 && t + 3 !== 20) {
      const rerolls = shrewd ? S.reroll(t, h[p], h[o], d) >= S.keep(t, h[p], h[o], d) : rng() < 0.5;
      if (!rerolls) break;
      r = sample(d); rolls++;
    }
    t += r;
    const what = landing(t, r);
    if (what === "win") return { winner: p, rolls };
    if (what === "bust" || what === "nine") return { winner: o, rolls };
    if (what === "draw") return { winner: 0, rolls };
    if (what === "again") {
      const pv = R.seven && t === 7 && size(h[o]) ? S.passValue(t, h[p], h[o]) : -1;
      if (pv >= 0) {
        const pass = shrewd ? pv > S.again(t, d, h[p], h[o]) : rng() < 0.5;
        if (pass) {
          if (R.seven === "costly") {
            const opts = [0, 1, 2].filter(x => has(h[p], x));
            if (!opts.length) { /* nothing to discard: can't pass */ } else {
              const x = shrewd ? opts.reduce((a, y) => (1 - S.V(t, h[o], take(h[p], y), -1) > 1 - S.V(t, h[o], take(h[p], a), -1) ? y : a)) : opts[(rng() * opts.length) | 0];
              h[p] = take(h[p], x); turn = o; continue;
            }
          } else if (R.seven === "choose") {
            const opts = [0, 1, 2].filter(e => has(h[o], e));
            const e = shrewd ? opts.reduce((a, y) => (1 - S.rollValue(t, take(h[o], y), h[p], y) > 1 - S.rollValue(t, take(h[o], a), h[p], a) ? y : a)) : opts[(rng() * opts.length) | 0];
            turn = o; h[o] = take(h[o], e); forced = e; continue;
          } else { turn = o; continue; }
        }
      }
      if (!size(h[p])) forced = d;
      continue;
    }
    if (size(h[o])) turn = o;
    else if (!size(h[p])) return { winner: 0, rolls };
  }
}

// ---------- Drafting ----------
let POOL = enc([2, 2, 2]);
function draftOrder(kind: "alt" | "snake", first: 1 | 2): (1 | 2)[] {
  const s: (1 | 2)[] = kind === "alt" ? [1, 2, 1, 2, 1, 2] : [1, 2, 2, 1, 1, 2];
  return first === 1 ? s : s.map(x => (x === 1 ? 2 : 1));
}
/** Value for player 1 of the round once drafted. */
function roundValue(S: ReturnType<typeof solver>, h1: number, h2: number, starter: 1 | 2) {
  return starter === 1 ? S.V(0, h1, h2, -1) : 1 - S.V(0, h2, h1, -1);
}
function draft(S: ReturnType<typeof solver>, kind: "alt" | "snake", first: 1 | 2, starter: 1 | 2, pol: [Policy, Policy], rng: Rng): [number, number] {
  const order = draftOrder(kind, first);
  const memo = new Map<string, number>();
  // Best value for player 1 from this point with both drafting well.
  function best(i: number, pool: number, h1: number, h2: number): number {
    if (i === 6) return roundValue(S, h1, h2, starter);
    const k = `${i},${pool},${h1},${h2}`; const m = memo.get(k); if (m !== undefined) return m;
    const p = order[i]; let v = p === 1 ? -1 : 2;
    for (let d = 0; d < 3; d++) if (has(pool, d)) {
      const x = best(i + 1, take(pool, d), p === 1 ? h1 + [1, 4, 16][d] : h1, p === 2 ? h2 + [1, 4, 16][d] : h2);
      v = p === 1 ? Math.max(v, x) : Math.min(v, x);
    }
    memo.set(k, v); return v;
  }
  let pool = POOL, h1 = 0, h2 = 0;
  for (let i = 0; i < 6; i++) {
    const p = order[i], opts = [0, 1, 2].filter(d => has(pool, d));
    let d: number;
    if (pol[p - 1] === "casual") d = opts[(rng() * opts.length) | 0];
    else {
      const score = (x: number) => best(i + 1, take(pool, x), p === 1 ? h1 + [1, 4, 16][x] : h1, p === 2 ? h2 + [1, 4, 16][x] : h2);
      d = opts.reduce((a, x) => (p === 1 ? (score(x) > score(a) ? x : a) : (score(x) < score(a) ? x : a)));
    }
    pool = take(pool, d);
    if (p === 1) h1 += [1, 4, 16][d]; else h2 += [1, 4, 16][d];
  }
  return [h1, h2];
}

// ---------- Matches ----------
/** otherStarts: the side that loses the pick roll rolls first in the round (else the usual starter). */
interface Variant { name: string; carry: boolean; seven: Seven; draft: false | "alt" | "snake"; pool?: Hand; otherStarts?: boolean; best?: 3 | 5 }
function simulate(v: Variant, pol: [Policy, Policy], matches: number, best: 3 | 5, seed: number) {
  POOL = enc(v.pool ?? [2, 2, 2]);
  const S = solver({ seven: v.seven }), rng = seeded(seed), need = Math.ceil(best / 2);
  let p1 = 0, rounds = 0, draws = 0, starterWins = 0, decided = 0, rollsTotal = 0, firstPickWins = 0, firstPickDecided = 0;
  for (let m = 0; m < matches; m++) {
    const pts = { 1: 0, 2: 0 }; let stake = 1, starter: 1 | 2 = rng() < 0.5 ? 1 : 2;
    while (pts[1] < need && pts[2] < need) {
      let hands: [number, number] = [enc([1, 1, 1]), enc([1, 1, 1])], first: 1 | 2 = 1;
      if (v.draft) {
        first = rng() < 0.5 ? 1 : 2;
        if (v.otherStarts) starter = first === 1 ? 2 : 1;
        hands = draft(S, v.draft, first, starter, pol, rng);
      }
      const res = playRound({ seven: v.seven }, S, hands, starter, pol, rng);
      rounds++; rollsTotal += res.rolls;
      if (res.winner === 0) { draws++; if (v.carry) stake++; }
      else {
        decided++;
        if (res.winner === starter) starterWins++;
        if (v.draft) { firstPickDecided++; if (res.winner === first) firstPickWins++; }
        pts[res.winner] += v.carry ? stake : 1; stake = 1;
      }
      // whoever rolled last starts next: approximated by alternating the starter on decided rounds
      starter = starter === 1 ? 2 : 1;
    }
    if (pts[1] >= need) p1++;
  }
  const pct = (a: number, b: number) => (b ? (100 * a / b).toFixed(1) + "%" : "–");
  return {
    p1: pct(p1, matches), draws: pct(draws, rounds), starter: pct(starterWins, decided),
    roundsPerMatch: (rounds / matches).toFixed(2), rollsPerRound: (rollsTotal / rounds).toFixed(2),
    firstPick: v.draft ? pct(firstPickWins, firstPickDecided) : "–",
  };
}

function exactFacts(v: Variant) {
  POOL = enc(v.pool ?? [2, 2, 2]);
  const S = solver({ seven: v.seven }), full = enc([1, 1, 1]);
  const starterValue = S.V(0, full, full, -1);
  let firstPick = "–";
  if (v.draft) {
    // First picker's value, averaged over who starts the round, with both drafting and playing perfectly.
    const rng = seeded(1);
    const val = (starter: 1 | 2) => { const [h1, h2] = draft(S, v.draft as "alt" | "snake", 1, starter, ["shrewd", "shrewd"], rng); return roundValue(S, h1, h2, starter); };
    firstPick = ((val(1) + val(2)) / 2 * 100).toFixed(1) + "%";
  }
  let passes = "–";
  if (v.seven) {
    let n = 0, yes = 0;
    for (let hp = 0; hp < 64; hp++) for (let ho = 0; ho < 64; ho++) {
      const a = dec(hp), b = dec(ho);
      if (a.some(x => x > 1) || b.some(x => x > 1) || !size(ho)) continue;
      for (let d = 0; d < 3; d++) { n++; const pv = S.passValue(7, hp, ho); if (pv > S.again(7, d, hp, ho)) yes++; }
    }
    passes = `${Math.round(100 * yes / n)}%`;
  }
  return { starterValue: (starterValue * 100).toFixed(1) + "%", firstPick, passes };
}

// ---------- Diagnostics ----------
function diagnostics() {
  POOL = enc((args.includes("--pool") ? args[args.indexOf("--pool") + 1].split(",").map(Number) : [2, 2, 2]) as Hand);
  const S = solver({ seven: false });
  const name = (n: number) => { const h = dec(n); return ["C", "W", "T"].flatMap((c, i) => Array(h[i]).fill(c)).join("") || "-"; };
  // Every split of the six dice into two hands of three, valued for the starter.
  const hands: number[] = [], P = dec(POOL);
  for (let a = 0; a <= P[0]; a++) for (let b = 0; b <= P[1]; b++) { const c = 3 - a - b; if (c >= 0 && c <= P[2] && P[0] - a <= 2 && P[1] - b <= 2 && P[2] - c <= 2) hands.push(enc([a, b, c])); }
  const rows = hands.map(h => { const o = POOL - h; return `${name(h)} v ${name(o)}: starter ${(100 * S.V(0, h, o, -1)).toFixed(1)}%, other side starting ${(100 * (1 - S.V(0, o, h, -1))).toFixed(1)}%`; });
  console.log("Hand pairings (value for the first-named hand; C caltrop, W wire cube, T twin cubes):\n  " + rows.join("\n  "));
  for (const kind of ["alt", "snake"] as const) for (const starter of [1, 2] as const) {
    const [h1, h2] = draft(S, kind, 1, starter, ["shrewd", "shrewd"], seeded(1));
    console.log(`${kind} draft, first picker ${starter === 1 ? "also starts" : "rolls second"}: takes ${name(h1)}, other ${name(h2)}`);
  }
  const S7 = solver({ seven: "free" }), full = enc([1, 1, 1]);
  let passes = 0, sevens = 0;
  for (const hp of [0, 1, 4, 16, 5, 17, 20]) for (const ho of [0, 1, 4, 16, 5, 17, 20, 21]) {
    if (!size(ho)) continue;
    for (const d of [0, 1, 2]) { sevens++; if (1 - S7.V(7, ho, hp, -1) > S7.again(7, d, hp, ho)) passes++; }
  }
  console.log(`Seven: passing is the better choice in ${passes} of ${sevens} sample positions at 7; full-hands starter value ${(100 * S7.V(0, full, full, -1)).toFixed(1)}%`);
}
const args = process.argv.slice(2);
if (args.includes("--diag")) { diagnostics(); process.exit(0); }
if (args.includes("--firstpick")) { firstPickTable(); process.exit(0); }
const N = Number(args[args.indexOf("--matches") + 1]) || 20000;
const VARIANTS: Variant[] = args.includes("--final") ? [
  { name: "current rules", carry: false, seven: false, draft: false },
  { name: "draft 1C 2W 3T snake, other side rolls first", carry: false, seven: false, draft: "snake", pool: [1, 2, 3], otherStarts: true },
  { name: "draft 1C 3W 2T snake, other side rolls first", carry: false, seven: false, draft: "snake", pool: [1, 3, 2], otherStarts: true },
  { name: "draft 2C 2W 2T snake, other side rolls first", carry: false, seven: false, draft: "snake", pool: [2, 2, 2], otherStarts: true },
  { name: "+ seven: pass, discarding a die", carry: false, seven: "costly", draft: false },
  { name: "draft 1-2-3 snake + seven discarding", carry: false, seven: "costly", draft: "snake", pool: [1, 2, 3], otherStarts: true },
  { name: "current rules, best of 5", carry: false, seven: false, draft: false, best: 5 },
  { name: "draws carry over, best of 5 (first to 3 points)", carry: true, seven: false, draft: false, best: 5 },
  { name: "all: carry (bo5) + seven discarding + draft 1-2-3", carry: true, seven: "costly", draft: "snake", pool: [1, 2, 3], otherStarts: true, best: 5 },
] : [
  { name: "current rules", carry: false, seven: false, draft: false },
  { name: "+ draws carry over", carry: true, seven: false, draft: false },
  { name: "+ seven: pass freely", carry: false, seven: "free", draft: false },
  { name: "+ seven: pass, discarding a die", carry: false, seven: "costly", draft: false },
  { name: "+ seven: pass, choosing their die", carry: false, seven: "choose", draft: false },
  { name: "+ draft 2C 2W 2T alternating", carry: false, seven: false, draft: "alt" },
  { name: "+ draft 2C 2W 2T snake", carry: false, seven: false, draft: "snake" },
  { name: "+ draft 1C 3W 2T alternating", carry: false, seven: false, draft: "alt", pool: [1, 3, 2] },
  { name: "+ draft 1C 2W 3T alternating", carry: false, seven: false, draft: "alt", pool: [1, 2, 3] },
  { name: "+ draft 1C 2W 3T snake", carry: false, seven: false, draft: "snake", pool: [1, 2, 3] },
];
console.log(`${N} best-of-3 matches per row. Strong = exact best play; Casual = random choices.\n`);
console.log(["variant", "strong v casual", "draws", "starter wins*", "rounds/match", "rolls/round", "1st pick wins*", "exact: 1st pick", "7: pass is better"].join(" | "));
for (const v of VARIANTS) {
  const a = simulate(v, ["shrewd", "shrewd"], N, v.best ?? 3, 11), b = simulate(v, ["shrewd", "casual"], N, v.best ?? 3, 12), e = exactFacts(v);
  console.log([v.name, b.p1, a.draws, a.starter, a.roundsPerMatch, a.rollsPerRound, a.firstPick, e.firstPick, e.passes].join(" | "));
}
console.log("\n* of decided rounds, strong v strong. Exact values count a draw as half.");

// ---------- First-pick balance: does letting the other side start make up for picking first? ----------
export function firstPickTable() {
  const S = solver({ seven: false });
  const name = (n: number) => { const h = dec(n); return ["C", "W", "T"].flatMap((c, i) => Array(h[i]).fill(c)).join(""); };
  for (const pool of [[2, 2, 2], [1, 3, 2], [1, 2, 3], [2, 1, 3], [1, 1, 4]] as Hand[]) for (const kind of ["alt", "snake"] as const) {
    POOL = enc(pool);
    const out: string[] = [];
    for (const starter of [1, 2] as const) {
      const [h1, h2] = draft(S, kind, 1, starter, ["shrewd", "shrewd"], seeded(1));
      out.push(`${starter === 1 ? "picker 1st also rolls 1st" : "other side rolls 1st"}: ${name(h1)} v ${name(h2)} → ${(100 * roundValue(S, h1, h2, starter)).toFixed(1)}%`);
    }
    console.log(`${pool.join("-")} ${kind.padEnd(5)} | ${out.join(" | ")}`);
  }
}
