// The rules cube: the game's numbers and their interactions, computed exactly by the rules, with no play and no
// noise, and chained: every action open in a duel position (primary), every reply open after each (secondary), and
// every follow-up after those (tertiary). The positions are engine/cube.ts's reduced duel positions, so a position
// reached by two lines is one row, and the cube is a graph: each action row names the position it leads to.
//   npx tsx sim/roth/rulescube.ts [--decks ulster,...] [--foes ...] [--settings ford,...] [--pool] [--depth 3]
//                                 [--situations first,later] [--workers 2] [--out sim/roth/cube/rules/<id>]
// Writes <id>.pos.csv.gz (the positions), <id>.act.csv.gz (the actions) and <id>.meta.json. Then:
//   python3 sim/roth/cube/rules.py   (the report: interactions step by step, the other actions, lines)
//
// The starting positions (depth 0): each fighter of a deck (its heroes, its hosts with their monsters, its champions
// standing in), with one support of its deck beside it, against each fighter of the foe's deck with one of its
// supports, at each setting, at the duel's first blow or later in it (both sides struck), both at full Valour, no
// Shield, three cards each to draw. --pool takes every support and fighter a deck of that people could hold (not
// just the starter deck). A draw is an action too, valued over the deck: the best the drawn card can do, by count.
//
// pos columns: pos, depth, deck, fighter, foeDeck, foe, setting, situation, card, foeCard, vSelf, vFoe, shSelf, shFoe,
//   restedSelf, restedFoe, line1, line2, line3, best (the first action of the best line of the deepest look)
// act columns: pos, sig, action, card, mode, cry, dSelf, dFoe, dSelfShield, dFoeShield, spent, struck, <blow steps>,
//   end, next, value (the action alone, in Valour), line2 (it, then the foe's best reply), line3 (and the best
//   follow-up), reply (the foe's best reply), waitTurns, needRests, payValour, payCards (the card's reuse price)
import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { composeHost, DECKS, FACTIONS, poolOf, reuseOf, type CardDef, type Faction, type HostDef, type MonsterDef, type SupportDef } from "../../src/games/roth/engine/cards";
import { DEFAULT_RULES, newCombat, newMatch, type Card, type Side, type State } from "../../src/games/roth/engine/engine";
import { SETTINGS } from "../../src/games/roth/engine/settings";
import { resolveParams } from "../../src/games/roth/engine/params";
import { clearCube, CUBE, CUBE_STEPS, entryByKey, fightersOf, keyOf, lineValue, outValue, positionOf, reduce, remember, type CubeOut } from "../../src/games/roth/engine/cube";
import { registerDummies } from "./dummy";

registerDummies();

interface Fighter { def: CardDef; champ: CardDef | null; other: CardDef | null; id: string }
/** The fighters a deck fields: heroes; each host with monsters (dealt in deck order, two to a host); and each
 *  champion, standing in for the deck's first fighter. The other hero spot holds the deck's next fighter (a host
 *  summons from there). */
function fighters(deck: CardDef[]): Fighter[] {
  const heroes = deck.filter((c) => c.type === "hero");
  const hosts = deck.filter((c): c is HostDef => c.type === "host");
  const mons = deck.filter((c): c is MonsterDef => c.type === "monster");
  const base: CardDef[] = [...heroes];
  let k = 0;
  for (const h of hosts) { const ms = mons.slice(k, k + 2); k += 2; if (ms.length) base.push(composeHost(h, ms) as unknown as CardDef); }
  const out: Fighter[] = base.map((d, i) => ({ def: d, champ: null, other: base[(i + 1) % base.length] ?? null, id: d.id }));
  const champs = [...new Map(deck.filter((c) => c.type === "champion").map((c) => [c.id, c])).values()];
  for (const c of champs) if (base[0]) out.push({ def: base[0], champ: c, other: base[1] ?? null, id: c.id });
  return out;
}
const supports = (deck: CardDef[]) => [...new Map(deck.filter((c): c is SupportDef => c.type === "support").map((c) => [c.id, c])).values()];
/** A deck's whole people: its starter deck, or with --pool every fighter and support such a deck could hold. */
function deckOf(f: string, pool: boolean): CardDef[] {
  if (!pool || !(FACTIONS as readonly string[]).includes(f)) return DECKS[f];
  const P = poolOf(f as Faction);
  return [...DECKS[f].filter((c) => c.type !== "support" && c.type !== "hero" && c.type !== "champion"), ...P.filter((c) => c.type === "hero" || c.type === "champion" || c.type === "support")];
}

let uid = 1;
const card = (def: CardDef, owner: Side): Card => ({ uid: uid++, def, owner });
/** A starting position: side 0's fighter on spot 1 with its card beside it, side 1's on spot 7 with its card, each
 *  side's next fighter on its other hero spot; side 0 to act. */
/** Situations: first (the duel's first blow), later (both sides struck), shield (later, the foe holding 2 Shield),
 *  low (later, the fighter 3 below its starting Valour, so a heal has room), geis:<id> (later, that geis of the
 *  foe's laid on the fighter: what breaking it costs). "geis" alone stands for each of the foe deck's geasa. */
function position(A: Fighter, s: SupportDef | null, B: Fighter, t: SupportDef | null, setting: string, sit: string, deckA: CardDef[], deckB: CardDef[], s2: SupportDef | null = null): State | null {
  const later = sit !== "first";
  const S: State = newMatch([deckA, deckB], { setting }, 1);
  for (const [p, P] of S.players.entries()) {
    const fill = supports(p === 0 ? deckA : deckB)[0];
    P.deck = []; P.hand = []; P.omens = []; P.discard = []; P.reserve = fill ? Array.from({ length: 3 }, () => card(fill, p as Side)) : [];
  }
  S.board = Array(12).fill(null);
  S.board[0] = card(A.def, 0); if (s) S.board[1] = card(s, 0); if (s2) S.board[2] = card(s2, 0); if (A.other) S.board[3] = card(A.other, 0);
  S.board[6] = card(B.def, 1); if (t) S.board[7] = card(t, 1); if (B.other) S.board[9] = card(B.other, 1);
  S.quadGeis = [null, null, null, null]; S.quadOath = [null, null, null, null]; S.globalGeis = [];
  if (sit.startsWith("geis:")) {
    const g = deckB.find((c) => c.id === sit.slice(5));
    if (!g || g.type !== "geis") return null;
    if (g.scope === "global") S.globalGeis.push(card(g, 1)); else S.quadGeis[0] = card(g, 1);
  }
  S.phase = "combat";
  try { S.combat = newCombat(S); } catch { return null; }
  const C = S.combat;
  if (C.stage !== "turns") { C.stage = "turns"; C.focusTodo = []; }
  // champions stand in (with their own Valour)
  for (const [p, F] of [[0, A], [1, B]] as [Side, Fighter][]) if (F.champ) {
    const ch = C.champ.slice(); ch[p] = card(F.champ, p); C.champ = ch;
    const v = (F.champ as { valour: number }).valour;
    C.valour[p] = v; C.cap[p] = Math.max(C.cap[p], v);
    const sv = C.startV.map((r) => r.slice()); sv[C.duel][p] = v; C.startV = sv;
  }
  if (C.turn % 2 === 0 ? C.first !== 0 : C.first === 0) C.turn += 1;
  if (later) { C.struck = [true, true]; C.hit = [true, true]; C.supportsUsed = 1; }
  if (sit === "shield") C.shield = [C.shield[0], 2];
  if (sit === "low") { C.valour = [Math.max(1, C.valour[0] - 3), C.valour[1]]; }
  return S;
}
const cycleOf = (s: CardDef | undefined) => { if (!s || s.type !== "support") return [0, 0, 0, 0]; const r = reuseOf(s); return [r.turns ?? 0, r.rest ?? 0, r.valour ?? 0, r.draw ?? 0]; };

interface Job { A: string; B: string; settings: string[]; situations: string[]; pool: boolean; depth: number; job: number }
function run(j: Job): { pos: string[]; act: string[] } {
  clearCube();
  CUBE.steps = true; CUBE.max = 5_000_000;
  const dA = deckOf(j.A, j.pool), dB = deckOf(j.B, j.pool);
  const ids = new Map<string, number>();
  const idOf = (k: string) => { let i = ids.get(k); if (i === undefined) { i = ids.size; ids.set(k, i); } return `${j.job}.${i}`; };
  const depthOf = new Map<string, number>();
  const meta = new Map<string, (string | number)[]>();
  const pos: string[] = [], act: string[] = [];
  const draws: [string, number[]][] = [];
  const sits = j.situations.flatMap((x) => (x === "geis" ? [...new Set(dB.filter((c) => c.type === "geis").map((c) => "geis:" + c.id))] : [x]));
  for (const A of fighters(dA)) for (const B of fighters(dB)) for (const st of j.settings) for (const sit of sits) {
    const sA = supports(dA), sB = supports(dB);
    for (const s of sA) for (const t of sB) {
      const S = position(A, s, B, t, st, sit, dA, dB);
      if (!S) continue;
      const W = reduce(S);
      const k = keyOf(W);
      remember(W);
      if (!depthOf.has(k)) { depthOf.set(k, 0); meta.set(k, [j.A, A.id, j.B, B.id, st, sit, s.id, t.id]); }
    }
    // a draw from here (no card beside the fighter yet): over the deck's supports by count, the best the card can do
    for (const t of sB) {
      let sum = 0, n = 0;
      const agg = [0, 0, 0, 0, 0, 0, 0];
      for (const s of dA.filter((c): c is SupportDef => c.type === "support")) {
        const S = position(A, s, B, t, st, sit, dA, dB);
        if (!S) continue;
        const W = reduce(S); const k = keyOf(W); remember(W);
        const E = entryByKey(k)!;
        let best: CubeOut | null = null, bv = -Infinity;
        for (const x of E.outs) { if (x.sig.startsWith("rest")) continue; const v = outValue(x) - (x.next ? lineValue(x.next, 1) : 0); if (v > bv) { bv = v; best = x; } }
        if (!best) continue;
        n++; sum += outValue(best);
        agg[0] += best.dSelf; agg[1] += best.dFoe; agg[2] += best.dSelfShield; agg[3] += best.dFoeShield; agg[4] += best.spent; agg[5] += best.struck; agg[6] += bv;
      }
      if (n) draws.push([`${j.A},${A.id},${j.B},${B.id},${st},${sit},${t.id}`, [...agg.map((x) => x / n), sum / n]]);
    }
  }
  // breadth first: depth 0 positions, then where their actions lead (the foe to act: secondary), then on (tertiary)
  let frontier = [...depthOf.keys()];
  for (let dep = 0; dep < j.depth; dep++) {
    const nextF: string[] = [];
    for (const k of frontier) {
      const E = entryByKey(k);
      if (!E) continue;
      for (const x of E.outs) if (x.next && !depthOf.has(x.next)) {
        depthOf.set(x.next, dep + 1);
        // the deck and the starting cards carry over, seen from the side now to act
        const m = meta.get(k)!;
        meta.set(x.next, x.swap ? [m[2], m[3], m[0], m[1], m[4], m[5], m[7], m[6]] : m);
        if (dep + 1 < j.depth) nextF.push(x.next);
      }
    }
    frontier = nextF;
  }
  for (const [k, dep] of depthOf) {
    if (dep >= j.depth) continue;
    const E = entryByKey(k);
    if (!E) continue;
    const W = positionOf(k);
    const m = (meta.get(k) ?? ["", "", "", "", "", "", "", ""]).slice();
    if (W) { const [f0, f1] = fightersOf(W); m[1] = f0; m[3] = f1; }
    // the position's own numbers (from the reduced position's key fields, through the entry's first action's position)
    const lines = [1, 2, 3].map((d) => (d <= j.depth - dep ? lineValue(k, d) : NaN));
    let bestSig = "", bv = -Infinity;
    const L = Math.min(3, j.depth - dep);
    for (const x of E.outs) {
      const v2 = x.next && L >= 2 ? outValue(x) - lineValue(x.next, 1) : outValue(x);
      const v3 = x.next && L >= 3 ? outValue(x) - lineValue(x.next, 2) : v2;
      const vL = L >= 3 ? v3 : L >= 2 ? v2 : outValue(x);
      if (vL > bv) { bv = vL; bestSig = x.sig; }
      // the foe's best reply
      let reply = "";
      if (x.next && L >= 2) {
        const R = entryByKey(x.next);
        let rv = -Infinity;
        for (const y of R?.outs ?? []) { const v = outValue(y) - (y.next && L >= 3 ? lineValue(y.next, 1) : 0); if (v > rv) { rv = v; reply = y.sig; } }
      }
      const [kind, spot, mode, , cry] = x.sig.split(":");
      const Wk = W ?? null;
      const cardDef = kind === "use" && Wk ? Wk.board[Number(spot)]?.def : undefined;
      const cid = kind === "use" ? cardDef?.id ?? "" : kind === "rest" ? "-" : spot;
      act.push([idOf(k), x.sig, kind, cid, mode ?? "", cry ?? "", x.dSelf, x.dFoe, x.dSelfShield, x.dFoeShield, x.spent, x.struck, ...(x.steps ?? CUBE_STEPS.map(() => 0)), x.end, x.next ? idOf(x.next) : "",
        +outValue(x).toFixed(3), L >= 2 ? +v2.toFixed(3) : "", L >= 3 ? +v3.toFixed(3) : "", reply, ...cycleOf(cardDef)].join(","));
    }
    const C = W?.combat;
    pos.push([idOf(k), dep, ...m, C ? C.valour[0] : "", C ? C.valour[1] : "", C ? C.shield[0] : "", C ? C.shield[1] : "", C ? C.rested?.[0] ?? 0 : "", C ? C.rested?.[1] ?? 0 : "",
      ...lines.map((v) => (Number.isNaN(v) ? "" : +v.toFixed(3))), bestSig].join(","));
  }
  // draws as actions of their own (on a position of their own: the fighter with nothing beside it yet)
  for (const [m, v] of draws) act.push([`${j.job}.draw:${m.replaceAll(",", "/")}`, "draw", "draw", "", "", "", ...v.slice(0, 6).map((x) => +x.toFixed(3)), ...CUBE_STEPS.map(() => ""), "", "", +v[7].toFixed(3), +v[6].toFixed(3), "", "", 0, 0, 0, 0].join(","));
  return { pos, act };
}

function engineHash(): string {
  const dir = fileURLToPath(new URL("../../src/games/roth/engine/", import.meta.url));
  const h = createHash("sha256");
  for (const f of readdirSync(dir).filter((f) => (f.endsWith(".ts") || f.endsWith(".json")) && !["insights.json", "evalWeights.json", "calcWeights.json"].includes(f)).sort()) { h.update(f); h.update(readFileSync(join(dir, f))); }
  return h.digest("hex").slice(0, 12);
}

if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => process.send!(run(j)));
} else {
  const args = process.argv.slice(2);
  const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
  const decks = str("decks", FACTIONS.join(",")).split(",");
  const foes = str("foes", [...FACTIONS, "dummy_spar"].join(",")).split(",");
  const settings = str("settings", "ford").split(",");
  const situations = str("situations", "first,later").split(",");
  const depth = Number(str("depth", "3")), W = Number(str("workers", "2")), pool = args.includes("--pool");
  void SETTINGS;
  const jobs: Job[] = [];
  for (const A of decks) for (const B of foes) jobs.push({ A, B, settings, situations, pool, depth, job: jobs.length });
  const pos: string[] = [], act: string[] = [];
  const t0 = Date.now();
  let next = 0, done = 0;
  await new Promise<void>((resolve) => {
    let live = Math.min(W, jobs.length);
    for (let w = 0; w < live; w++) {
      const c = fork(fileURLToPath(import.meta.url), ["--worker"], { execArgv: [...process.execArgv, "--max-old-space-size=3000"] });
      let cur: Job | null = null;
      const feed = () => { if (next < jobs.length) { cur = jobs[next++]; c.send(cur); } else { c.disconnect(); if (--live === 0) resolve(); } };
      c.on("message", (m: { pos: string[]; act: string[] }) => {
        for (const r of m.pos) pos.push(r);
        for (const r of m.act) act.push(r);
        done++;
        process.stderr.write(`  ${cur!.A} vs ${cur!.B}: ${m.pos.length} positions, ${m.act.length} actions (${done}/${jobs.length}, ${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
        feed();
      });
      feed();
    }
  });
  const engine = engineHash();
  const id = `${new Date().toISOString().slice(0, 10)}-${engine}${pool ? "-pool" : ""}`;
  const out = str("out", `sim/roth/cube/rules/${id}`);
  mkdirSync(dirname(out), { recursive: true });
  const posHead = ["pos", "depth", "deck", "fighter", "foeDeck", "foe", "setting", "situation", "card", "foeCard", "vSelf", "vFoe", "shSelf", "shFoe", "restedSelf", "restedFoe", "line1", "line2", "line3", "best"];
  const actHead = ["pos", "sig", "action", "card", "mode", "cry", "dSelf", "dFoe", "dSelfShield", "dFoeShield", "spent", "struck", ...CUBE_STEPS.map((k) => (k === "setting" ? "setBonus" : k)), "end", "next", "value", "line2", "line3", "reply", "waitTurns", "needRests", "payValour", "payCards"];
  writeFileSync(`${out}.pos.csv.gz`, gzipSync([posHead.join(","), ...pos].join("\n") + "\n"));
  writeFileSync(`${out}.act.csv.gz`, gzipSync([actHead.join(","), ...act].join("\n") + "\n"));
  writeFileSync(`${out}.meta.json`, JSON.stringify({ id, engine, created: new Date().toISOString(), decks, foes, settings, situations, depth, pool, positions: pos.length, actions: act.length, value: "engine/cube.ts CUBE_VALUE", params: resolveParams({ ...DEFAULT_RULES }) }, null, 1) + "\n");
  console.log(`${pos.length} positions, ${act.length} actions in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}.*`);
}
