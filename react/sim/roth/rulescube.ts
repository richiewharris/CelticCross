// The rules cube: the game's numbers and their interactions, computed exactly, with no play and no noise. Every card
// of a deck, on every fighter of that deck, against every fighter of every deck, at every setting, in each situation,
// is played once by the rules (a minimal duel position, the engine's own blow, the per-blow trace on), and every step
// of the damage formula recorded.
//   npx tsx sim/roth/rulescube.ts [--decks ulster,connacht,...] [--settings ford,bog,...] [--out sim/roth/cube/rules/<id>.csv.gz]
// Then: python3 sim/roth/cube/rules.py <file> (the interaction matrix, step by step).
//
// Dimensions: deck, fighter, action (use, reuse: used before and ready again, paying its reuse cost; break: in breach
// of one of the foe's geasa (geis), paying its break cost; cry: with the Hound's cry; rest, rest-break; sacrifice and
// summon: a Slúagh host's own), card, geis, foeDeck, foe (dummy_spar: no people at all), setting, first (the first
// blow of the duel against this foe: the veil and wards apply), foeShield (0, 1, 2), rested (the actor rested last
// turn).
// Measures: every BlowRow step (printed ... final) when it struck; and what the action did, end of turn included:
// dSelf, dFoe (Valour), dSelfShield, dFoeShield, spent (Reserve cards); and the card's reuse cycle: waitTurns, needRests,
// payValour, payCards.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { ALL_DEFS, composeHost, DECKS, FACTIONS, reuseOf, type CardDef, type HostDef, type MonsterDef, type SupportDef } from "../../src/games/roth/engine/cards";
import { actorOf, applyDecision, newCombat, newMatch, nextDecision, TRACE, type BlowRow, type Card, type Side, type State } from "../../src/games/roth/engine/engine";
import { SETTINGS } from "../../src/games/roth/engine/settings";
import { resolveParams } from "../../src/games/roth/engine/params";
import { DEFAULT_RULES } from "../../src/games/roth/engine/engine";
import { registerDummies } from "./dummy";

// the neutral sparring partner is a defender too (foeDeck dummy_spar): every people's blows against no people at all
registerDummies();

const STEPS: (keyof BlowRow)[] = ["printed", "base", "kin", "focus", "watch", "wheel", "weak", "fx", "setting", "extra", "atk", "floor", "cap", "ward", "block", "resist", "armour", "mound", "shield", "halved", "aura", "stagger", "final"];

/** The fighters a deck fields: its heroes, and for the Slúagh each host joined with monsters as a player would (the
 *  monsters dealt out in deck order, two to a host while they last). */
function fighters(deck: CardDef[]): CardDef[] {
  const heroes = deck.filter((c) => c.type === "hero");
  const hosts = deck.filter((c): c is HostDef => c.type === "host");
  const mons = deck.filter((c): c is MonsterDef => c.type === "monster");
  const out: CardDef[] = [...heroes];
  let k = 0;
  for (const h of hosts) {
    const ms = mons.slice(k, k + 2);
    k += 2;
    if (ms.length) out.push(composeHost(h, ms) as unknown as CardDef);
  }
  return out;
}
const supports = (deck: CardDef[]) => [...new Map(deck.filter((c): c is SupportDef => c.type === "support").map((c) => [c.id, c])).values()];

let uid = 1;
const card = (def: CardDef, owner: Side): Card => ({ uid: uid++, def, owner });

interface Cell { first: boolean; shield: number; rested: boolean }
/** A minimal duel position: side 0's fighter on spot 1 with card s beside it (and a Reserve to pay with), side 1's on
 *  spot 7, the other pair mirroring them; side 0 to act. A geis from the foe's deck may be laid on side 0's fighter. */
function position(a: CardDef, s: SupportDef | null, b: CardDef, setting: string, cell: Cell, deckA: CardDef[], deckB: CardDef[], geis: CardDef | null, used: boolean): State | null {
  const S: State = newMatch([deckA, deckB], { setting }, 1);
  const filler = supports(deckA)[0];
  for (const [p, P] of S.players.entries()) { P.deck = []; P.hand = []; P.omens = []; P.discard = []; P.reserve = p === 0 && filler ? Array.from({ length: 6 }, () => card(filler, 0)) : []; }
  S.board = Array(12).fill(null);
  S.board[0] = card(a, 0); if (s) S.board[1] = card(s, 0);
  S.board[3] = card(a, 0);
  S.board[6] = card(b, 1); S.board[9] = card(b, 1);
  S.quadGeis = [null, null, null, null]; S.quadOath = [null, null, null, null]; S.globalGeis = [];
  if (geis && geis.type === "geis") { if (geis.scope === "global") S.globalGeis.push(card(geis, 1)); else S.quadGeis[0] = card(geis, 1); }
  S.phase = "combat";
  S.combat = newCombat(S);
  const C = S.combat;
  if (C.stage !== "turns") { C.stage = "turns"; C.focusTodo = []; }
  if (actorOf(C) !== 0) C.turn += 1;
  C.shield[1] = cell.shield;
  if (!cell.first) { C.struck = [true, true]; C.hit = [true, true]; }
  if (cell.rested) C.rested = [1, 0];
  if (used && s) {
    // used before, and ready again: long enough ago, with rests between
    const u = C.uses.slice(); u[1] = 1; C.uses = u;
    const lu = C.lastUse.slice(); lu[1] = -10; C.lastUse = lu;
    const rs = C.restsSince.slice(); rs[1] = 5; C.restsSince = rs;
    C.acts = [10, C.acts[1]];
  }
  return S;
}
type Pick = (o: Record<string, unknown>) => boolean;
/** Play the first option the pick matches; what it did to both sides, and the blow's steps if it struck. */
function act(S: State | null, pick: Pick): (number | string)[] | null {
  if (!S) return null;
  const d = nextDecision(S);
  if (!d || d.kind !== "duel" || d.player !== 0) return null;
  const i = d.options.findIndex((o) => pick(o as unknown as Record<string, unknown>));
  if (i < 0) return null;
  const C = S.combat!;
  const v0 = [C.valour[0], C.valour[1]], s0 = [C.shield[0], C.shield[1]], r0 = S.players[0].reserve.length;
  TRACE.on = true;
  S.stats!.blows = [];
  try { applyDecision(S, d, i, false); } finally { TRACE.on = false; }
  const B = S.stats!.blows!.find((x) => x.side === 0);
  const C1 = S.combat!;
  // if the action ended the duel, its end Valour says what it did
  const same = C1.duel === 0 && C1.stage === "turns";
  const v1 = same ? [C1.valour[0], C1.valour[1]] : [C1.endValour[0][0], C1.endValour[0][1]];
  const sh1 = same ? [C1.shield[0], C1.shield[1]] : [s0[0], s0[1]];
  const spent = r0 - S.players[0].reserve.length;
  return [...STEPS.map((k) => (B ? (B[k] as number) : 0)), B ? 1 : 0, v1[0] - v0[0], v1[1] - v0[1], sh1[0] - s0[0], sh1[1] - s0[1], spent];
}
/** A card's reuse: own turns it must wait, rests it needs, Valour and Reserve cards it costs (the rules' reuseOf). */
const cycleOf = (s: SupportDef | null) => { if (!s) return [0, 0, 0, 0]; const r = reuseOf(s); return [r.turns ?? 0, r.rest ?? 0, r.valour ?? 0, r.draw ?? 0]; };
const useOf = (mode: string): Pick => (o) => o.t === "duel" && o.act === "use" && o.spot === 1 && (o.guest as number) < 0 && !o.cry && !o.as && o.mode === mode;
function engineHash(): string {
  const dir = fileURLToPath(new URL("../../src/games/roth/engine/", import.meta.url));
  const h = createHash("sha256");
  for (const f of readdirSync(dir).filter((f) => (f.endsWith(".ts") || f.endsWith(".json")) && !["insights.json", "evalWeights.json", "calcWeights.json"].includes(f)).sort()) { h.update(f); h.update(readFileSync(join(dir, f))); }
  return h.digest("hex").slice(0, 12);
}

const args = process.argv.slice(2);
const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
const decks = str("decks", FACTIONS.join(",")).split(",");
const settings = str("settings", SETTINGS.map((x) => x.id).join(",")).split(",");
const cells: Cell[] = [];
for (const first of [true, false]) for (const shield of [0, 1, 2]) for (const rested of [false, true]) cells.push({ first, shield, rested });
const rows: string[] = [];
const t0 = Date.now();
for (const A of decks) for (const B of [...decks, "dummy_spar"]) {
  const dA = DECKS[A], dB = DECKS[B];
  const geasa = [...new Map(dB.filter((c) => c.type === "geis").map((c) => [c.id, c])).values()];
  for (const a of fighters(dA)) for (const b of fighters(dB)) for (const st of settings) for (const c of cells) {
    const key = (action: string, cardId: string, geis: string) => [A, a.id, action, cardId, geis, B, b.id, st, c.first ? 1 : 0, c.shield, c.rested ? 1 : 0];
    const push = (k: (string | number)[], r: (number | string)[] | null, s: SupportDef | null = null) => { if (r) rows.push([...k, ...r, ...cycleOf(s)].join(",")); };
    for (const s of supports(dA)) {
      push(key("use", s.id, ""), act(position(a, s, b, st, c, dA, dB, null, false), useOf("normal")), s);
      push(key("reuse", s.id, ""), act(position(a, s, b, st, c, dA, dB, null, true), useOf("normal")), s);
      // in breach of each of the foe's geasa that forbids it (a geis of the foe's laid on this fighter)
      for (const g of geasa) push(key("break", s.id, g.id), act(position(a, s, b, st, c, dA, dB, g, false), useOf("break")), s);
      // the Hound's cry, where it can be given
      push(key("cry", s.id, ""), act(position(a, s, b, st, c, dA, dB, null, false), (o) => o.t === "duel" && o.act === "use" && o.spot === 1 && o.cry === true && o.mode === "normal"), s);
    }
    push(key("rest", "-", ""), act(position(a, null, b, st, c, dA, dB, null, false), (o) => o.t === "duel" && o.act === "rest" && o.mode === "normal"));
    for (const g of geasa) push(key("rest-break", "-", g.id), act(position(a, null, b, st, c, dA, dB, g, false), (o) => o.t === "duel" && o.act === "rest" && o.mode === "break"));
    for (const t of ["sacrifice", "summon"]) {
      const S = position(a, null, b, st, c, dA, dB, null, false);
      const d = S && nextDecision(S);
      for (const o of d?.options ?? []) if (o.t === "sacrifice" || o.t === "summon") if (o.t === t) { const id = o.id; push(key(t, id, ""), act(position(a, null, b, st, c, dA, dB, null, false), (x) => x.t === t && x.id === id)); }
    }
  }
  process.stderr.write(`  ${A} vs ${B}: ${rows.length} rows (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
}
const engine = engineHash();
const id = `${new Date().toISOString().slice(0, 10)}-${engine}`;
const out = str("out", `sim/roth/cube/rules/${id}.csv.gz`);
mkdirSync(dirname(out), { recursive: true });
const head = ["deck", "fighter", "action", "card", "geis", "foeDeck", "foe", "setting", "first", "foeShield", "rested", ...STEPS.map((k) => (k === "setting" ? "setBonus" : k)), "struck", "dSelf", "dFoe", "dSelfShield", "dFoeShield", "spent", "waitTurns", "needRests", "payValour", "payCards"];
writeFileSync(out, gzipSync([head.join(","), ...rows].join("\n") + "\n"));
writeFileSync(out.replace(/\.csv\.gz$/, ".meta.json"), JSON.stringify({ id, engine, created: new Date().toISOString(), decks, settings, rows: rows.length, params: resolveParams({ ...DEFAULT_RULES }) }, null, 1) + "\n");
console.log(`${rows.length} cells in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}`);
void ALL_DEFS;
