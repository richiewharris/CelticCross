// What every card and power was worth, PER-style, from a balance.ts --dump file.
//   npx tsx sim/roth/per.ts recs.jsonl   (recs from: npx tsx sim/roth/balance.ts --dump recs.jsonl) [--deck ulster] [--gap 10] [--json out.json]
// Worth is in Valour points: wounds dealt + wounds prevented + Valour healed + enemy heals denied − Valour paid.
// Shield is credited to the card that raised it, in proportion to how much of that side's Shield actually soaked.
import { readFileSync, writeFileSync } from "node:fs";
import { ALL_DEFS } from "../../src/games/roth/engine/cards";

const args = process.argv.slice(2);
const file = args[0];
const opt = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
const only = opt("deck", "");
const gap = Number(opt("gap", "10"));
type L = Record<string, [number, number]>;
interface R { a: string; b: string; aSide: 0 | 1; w: number; ledger: L; placed: { side: number; id: string }[]; used: { side: number; id: string }[] }
const recs: R[] = readFileSync(file, "utf8").trim().split("\n").map((l) => JSON.parse(l));

const name = (k: string) => {
  const [kind, ...rest] = k.split(":");
  const id = rest.join(":");
  if (id === "people:bleed") return "Bleed (Connacht)";
  if (id === "people:mound") return "The mound (Sídhe)";
  if (id === "people:veil") return "The veil (Sídhe)";
  if (id === "people:giant-kin") return "Giant-kin (Fomóire)";
  if (id === "power:swift") return "Swift blows";
  if (id === "power:riposte") return "Ripostes";
  if (id === "rest") return "Resting (Shield)";
  if (id === "guest") return "Guests' heals";
  if (id === "break") return "Breaking geasa/oaths";
  if (id === "shield") return "Shield (unattributed)";
  if (id.startsWith("hero:")) return `${ALL_DEFS[id.slice(5)]?.name ?? id} (quality)`;
  if (id.startsWith("ward:")) return `${ALL_DEFS[id.slice(5)]?.name ?? id} (first-blow ward)`;
  void kind;
  return ALL_DEFS[id]?.name ?? id;
};
const CATS = ["deal", "save", "heal", "deny", "cost"] as const;
type Cat = (typeof CATS)[number];

/** One side's ledger in one match: worth per source and per category, with Shield soak shared out. */
function sideWorth(r: R, side: 0 | 1) {
  const L = r.ledger ?? {};
  const src = new Map<string, Record<Cat, number>>();
  const add = (id: string, c: Cat, v: number) => { if (!v) return; const o = src.get(id) ?? { deal: 0, save: 0, heal: 0, deny: 0, cost: 0 }; o[c] += v; src.set(id, o); };
  let raised = 0;
  for (const [k, v] of Object.entries(L)) if (k.startsWith("shield:")) raised += v[side];
  const soaked = L["save:shield"]?.[side] ?? 0;
  for (const [k, v] of Object.entries(L)) {
    const [kind, ...rest] = k.split(":");
    const id = rest.join(":");
    const x = v[side];
    if (!x) continue;
    if (kind === "shield") add(id, "save", raised ? (x * soaked) / raised : 0);
    else if (k === "save:shield") { if (!raised) add("shield", "save", x); }
    else add(id, kind as Cat, x);
  }
  return src;
}

const deckOf = (r: R, side: number) => (side === r.aSide ? r.a : r.b);
const score = (r: R, side: number) => (r.w === -1 ? 0.5 : r.w === side ? 1 : 0);

// ---- per matchup (deck vs foe), per side
interface Agg { n: number; win: number; cat: Record<Cat, number>; src: Map<string, { v: number; cat: Record<Cat, number> }> }
const agg = new Map<string, Agg>();
// ---- per card per deck: matches present, worth when present, score when present
const cards = new Map<string, { deck: string; id: string; present: number; worth: number; win: number }>();
const decksSeen = new Set<string>();
for (const r of recs) {
  if (r.a === r.b) continue;
  for (const side of [0, 1] as const) {
    const d = deckOf(r, side), f = deckOf(r, 1 - side);
    decksSeen.add(d);
    const key = `${d}|${f}`;
    const A = agg.get(key) ?? { n: 0, win: 0, cat: { deal: 0, save: 0, heal: 0, deny: 0, cost: 0 }, src: new Map() };
    A.n++; A.win += score(r, side);
    const W = sideWorth(r, side);
    for (const [id, c] of W) {
      const s = A.src.get(id) ?? { v: 0, cat: { deal: 0, save: 0, heal: 0, deny: 0, cost: 0 } };
      for (const k of CATS) { A.cat[k] += c[k]; s.cat[k] += c[k]; s.v += k === "cost" ? -c[k] : c[k]; }
      A.src.set(id, s);
    }
    agg.set(key, A);
    // presence: placed on the board, or used (from the hand or the Reserve)
    const here = new Set([...r.placed.filter((p) => p.side === side).map((p) => p.id), ...r.used.filter((u) => u.side === side).map((u) => u.id)]);
    for (const id of new Set([...here, ...[...W.keys()].filter((k) => !k.includes(":") && ALL_DEFS[k])])) {
      const ck = `${d}|${id}`;
      const c = cards.get(ck) ?? { deck: d, id, present: 0, worth: 0, win: 0 };
      c.present++; c.win += score(r, side);
      const w = W.get(id); if (w) c.worth += w.deal + w.save + w.heal + w.deny - w.cost;
      cards.set(ck, c);
    }
  }
}
const f1 = (x: number) => x.toFixed(1);
const total = (c: Record<Cat, number>) => c.deal + c.save + c.heal + c.deny - c.cost;

// ---- 1. each deck's ledger against the field
console.log("Each deck's worth per match against the field (Valour points): dealt / prevented / healed / denied / paid = net");
for (const d of [...decksSeen].sort()) {
  const rows = [...agg.entries()].filter(([k]) => k.startsWith(d + "|")).map(([, a]) => a);
  const n = rows.reduce((s, a) => s + a.n, 0), win = rows.reduce((s, a) => s + a.win, 0);
  const c = { deal: 0, save: 0, heal: 0, deny: 0, cost: 0 } as Record<Cat, number>;
  for (const a of rows) for (const k of CATS) c[k] += a.cat[k];
  console.log(`  ${d.padEnd(9)} ${f1(100 * win / n).padStart(5)}%   ${f1(c.deal / n).padStart(5)} / ${f1(c.save / n).padStart(5)} / ${f1(c.heal / n).padStart(4)} / ${f1(c.deny / n).padStart(4)} / ${f1(c.cost / n).padStart(4)} = ${f1(total(c) / n)}`);
}

// ---- 2. the lopsided matchups, side by side
const pairs = new Set<string>();
for (const k of agg.keys()) { const [d, f] = k.split("|"); pairs.add([d, f].sort().join("|")); }
const lop = [...pairs].map((p) => { const [x, y] = p.split("|"); const A = agg.get(`${x}|${y}`)!; return { x, y, s: A.win / A.n }; })
  .filter((p) => Math.abs(p.s - 0.5) * 100 >= gap && (!only || p.x === only || p.y === only)).sort((p, q) => Math.abs(q.s - 0.5) - Math.abs(p.s - 0.5));
console.log(`\nMatchups at least ${gap} points off even${only ? ` (with ${only})` : ""}: each side's worth per match, then its top sources.`);
for (const { x, y } of lop) {
  for (const [d, f] of [[x, y], [y, x]]) {
    const A = agg.get(`${d}|${f}`)!;
    const c = A.cat, n = A.n;
    console.log(`\n  ${d} vs ${f}: ${f1(100 * A.win / n)}%   dealt ${f1(c.deal / n)}, prevented ${f1(c.save / n)}, healed ${f1(c.heal / n)}, denied ${f1(c.deny / n)}, paid ${f1(c.cost / n)}  = net ${f1(total(c) / n)}`);
    const top = [...A.src.entries()].sort((p, q) => q[1].v - p[1].v).slice(0, 10);
    for (const [id, s] of top) {
      const parts = CATS.filter((k) => Math.abs(s.cat[k]) / n >= 0.05).map((k) => `${k} ${f1(s.cat[k] / n)}`).join(", ");
      console.log(`      ${name("x:" + id).padEnd(34)} ${f1(s.v / n).padStart(5)}   (${parts})`);
    }
  }
}

// ---- 3. card PER: worth per match when present, how often present, score when present
console.log("\nCards by deck: worth per match when present (PER), present in % of matches, the deck's score when present.");
for (const d of [...decksSeen].sort()) {
  if (only && d !== only) continue;
  const n = [...agg.entries()].filter(([k]) => k.startsWith(d + "|")).reduce((s, [, a]) => s + a.n, 0);
  const rows = [...cards.values()].filter((c) => c.deck === d && ALL_DEFS[c.id]?.type === "support").sort((p, q) => q.worth / q.present - p.worth / p.present);
  console.log(`  ${d}:`);
  for (const c of rows) console.log(`      ${name("x:" + c.id).padEnd(34)} PER ${f1(c.worth / c.present).padStart(5)}   present ${f1(100 * c.present / n).padStart(5)}%   score ${f1(100 * c.win / c.present).padStart(5)}%`);
}

// ---- 4. people-wide and hero powers, per match, for the deck that has them
console.log("\nPowers (per match the deck played): ");
const powers = new Map<string, { v: number; n: number }>();
for (const [k, A] of agg) {
  const d = k.split("|")[0];
  for (const [id, s] of A.src) if (id.startsWith("people:") || id.startsWith("power:") || id.startsWith("hero:") || id.startsWith("ward:") || id === "rest" || id === "guest") {
    const pk = `${d}|${id}`; const p = powers.get(pk) ?? { v: 0, n: 0 }; p.v += s.v; powers.set(pk, p);
  }
}
const nOf = (d: string) => [...agg.entries()].filter(([k]) => k.startsWith(d + "|")).reduce((s, [, a]) => s + a.n, 0);
for (const [k, p] of [...powers.entries()].sort((a, b) => a[0].localeCompare(b[0]) || b[1].v - a[1].v)) {
  const [d, id] = k.split("|");
  if (only && d !== only) continue;
  console.log(`  ${d.padEnd(9)} ${name("x:" + id).padEnd(36)} ${f1(p.v / nOf(d)).padStart(5)}`);
}
const out = opt("json", "");
if (out) writeFileSync(out, JSON.stringify({ agg: Object.fromEntries([...agg].map(([k, a]) => [k, { ...a, src: Object.fromEntries(a.src) }])), cards: [...cards.values()] }));
