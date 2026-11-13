// The rules cubes: the game's numbers and their interactions, computed exactly by the rules, with no play and no
// noise. Three cubes, each a question of its own:
//
//   primary    every action open to every fighter against every foe, at every setting, from one static position
//              (later in a duel: both sides struck, full Valour, no Shield, nothing rested, nothing laid): what it does.
//   secondary  the positions one action makes (a prior), and every action open after it: is its outcome different
//              from the static position's? A prior is the side's own last action (its card used, a rest, a geis laid,
//              an oath sworn, an omen turned, an attendant called, a sacrifice or summon), the foe's last action (a
//              blow taken, a geis laid on it...), or only a card beside it (a passive or a reaction on the board).
//              Only what changed is written, with what it was before: the cube is the list of things that matter for
//              the next choice.
//   tertiary   two priors (the side's own, then the foe's reply) and the action after: is the outcome what the two
//              secondary changes add up to? Only the interactions (the part that isn't the sum) are written.
//
//   npx tsx sim/roth/rulescube.ts --cube primary|secondary|tertiary [--peoples ulster,...] [--foes ...]
//        [--scope pool|deck] [--hosts all|deck] [--settings ford,...] [--workers 2] [--out sim/roth/cube/rules/<name>]
//
// Scope: pool (default for primary and secondary) takes every support, geis, oath, omen, attendant, hero and
// champion a deck of that people could hold; deck takes the starter deck's (default for tertiary). Hosts: all (every
// host with every pair of monsters; default for primary) or deck (the starter deck's hosts, monsters dealt two to a
// host in deck order). Settings: every setting for primary's board actions (hand cards at the ford), the ford for the
// others. Then: python3 sim/roth/cube/rules.py
import { fork } from "node:child_process";
import { createWriteStream, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";
import { composeHost, DECKS, FACTIONS, poolOf, reuseOf, type CardDef, type Faction, type HostDef, type MonsterDef, type SupportDef } from "../../src/games/roth/engine/cards";
import { applyDecision, cloneState, DEFAULT_RULES, newCombat, newMatch, nextDecision, TRACE, type BlowRow, type Card, type Option, type Side, type State } from "../../src/games/roth/engine/engine";
import { SETTINGS } from "../../src/games/roth/engine/settings";
import { resolveParams } from "../../src/games/roth/engine/params";
import { registerDummies } from "./dummy";

registerDummies();

const STEPS: (keyof BlowRow)[] = ["printed", "base", "kin", "focus", "watch", "wheel", "weak", "fx", "setting", "extra", "atk", "floor", "cap", "ward", "block", "resist", "armour", "mound", "shield", "halved", "aura", "stagger", "final"];
/** An outcome: Valour and Shield changes of the acting side and its foe, Reserve cards spent, the blow's wound, a blow
 *  landed, the duel ended (1 the actor fell, 2 its foe did). */
const OUT = ["dSelf", "dFoe", "dSelfShield", "dFoeShield", "spent", "wound", "struck", "end"] as const;
/** The secondary and tertiary cubes' outcome: the same, and whether the action breaks a geis or oath. */
const OUT2 = [...OUT, "broke"];
type Out = number[];

// ---------------------------------------------------------------- the peoples' cards
interface Fighter { def: CardDef; champ: CardDef | null; other: CardDef | null; id: string }
const isPeople = (p: string) => (FACTIONS as readonly string[]).includes(p);
function cardsOf(people: string, scope: string): CardDef[] {
  return scope === "pool" && isPeople(people) ? poolOf(people as Faction) : DECKS[people];
}
const uniq = <T extends CardDef>(xs: T[]) => [...new Map(xs.map((c) => [c.id, c])).values()];
function fighters(people: string, scope: string, hosts: string): Fighter[] {
  const cs = cardsOf(people, scope);
  const heroes = uniq(cs.filter((c) => c.type === "hero"));
  const hs = uniq(cs.filter((c): c is HostDef => c.type === "host"));
  const ms = uniq(cs.filter((c): c is MonsterDef => c.type === "monster"));
  const base: CardDef[] = [...heroes];
  if (hosts === "all" && hs.length) {
    for (const h of hs) for (let i = 0; i < ms.length; i++) for (let j = i + 1; j < ms.length; j++) base.push(composeHost(h, [ms[i], ms[j]]) as unknown as CardDef);
  } else {
    const dm = DECKS[people].filter((c): c is MonsterDef => c.type === "monster");
    let k = 0;
    for (const h of hs) { const two = dm.slice(k, k + 2); k += 2; if (two.length) base.push(composeHost(h, two) as unknown as CardDef); }
  }
  const out: Fighter[] = base.map((d, i) => ({ def: d, champ: null, other: base[(i + 1) % base.length] === d ? null : base[(i + 1) % base.length], id: d.id }));
  // a host summons from its other host: keep the starter partner beside each composed host
  for (const c of uniq(cs.filter((c) => c.type === "champion"))) if (base[0]) out.push({ def: base[0], champ: c, other: base[1] ?? null, id: c.id });
  return out;
}
const supportsOf = (people: string, scope: string) => uniq(cardsOf(people, scope).filter((c): c is SupportDef => c.type === "support"));
/** Cards played from hand in a duel: geasa, oaths, attendants, and omens (turned face up). */
const handOf = (people: string, scope: string) => uniq(cardsOf(people, scope).filter((c) => c.type === "geis" || c.type === "oath" || c.type === "attendant" || c.type === "omen"));

// ---------------------------------------------------------------- positions
let uid = 1;
const card = (def: CardDef, owner: Side): Card => ({ uid: uid++, def, owner });
interface Spec {
  pa: string; pb: string; A: Fighter; B: Fighter; setting: string;
  /** Supports beside each fighter (spots 2–3 and 8–9). */
  a: (SupportDef | null)[]; b: (SupportDef | null)[];
  /** A card in hand (an omen: face down on an omen spot). */
  ha?: CardDef | null; hb?: CardDef | null;
  actor: Side;
}
/** The static position: later in the duel (both sides struck), full Valour, no Shield, nothing rested or laid; three
 *  cards each to draw; side `actor` to act. */
function build(x: Spec): State | null {
  const dA = DECKS[x.pa], dB = DECKS[x.pb];
  const S: State = newMatch([dA, dB], { setting: x.setting }, 1);
  for (const [p, P] of S.players.entries()) {
    const fill = (p === 0 ? dA : dB).find((c) => c.type === "support");
    P.deck = []; P.hand = []; P.omens = []; P.discard = []; P.reserve = fill ? Array.from({ length: 3 }, () => card(fill, p as Side)) : [];
    const h = p === 0 ? x.ha : x.hb;
    if (h) { if (h.type === "omen") P.omens = [{ card: card(h, p as Side), faceUp: false }]; else P.hand = [card(h, p as Side)]; }
  }
  S.board = Array(12).fill(null);
  S.board[0] = card(x.A.def, 0); if (x.A.other) S.board[3] = card(x.A.other, 0);
  S.board[6] = card(x.B.def, 1); if (x.B.other) S.board[9] = card(x.B.other, 1);
  x.a.forEach((s, i) => { if (s) S.board[1 + i] = card(s, 0); });
  x.b.forEach((s, i) => { if (s) S.board[7 + i] = card(s, 1); });
  S.quadGeis = [null, null, null, null]; S.quadOath = [null, null, null, null]; S.globalGeis = [];
  S.phase = "combat";
  try { S.combat = newCombat(S); } catch { return null; }
  const C = S.combat;
  if (C.stage !== "turns") { C.stage = "turns"; C.focusTodo = []; }
  for (const [p, F] of [[0, x.A], [1, x.B]] as [Side, Fighter][]) if (F.champ) {
    const ch = C.champ.slice(); ch[p] = card(F.champ, p); C.champ = ch;
    const v = (F.champ as { valour: number }).valour;
    C.valour[p] = v; C.cap[p] = Math.max(C.cap[p], v);
    const sv = C.startV.map((r) => r.slice()); sv[C.duel][p] = v; C.startV = sv;
  }
  C.champs = [[], []]; C.guests = [[], []];
  C.struck = [true, true]; C.hit = [true, true]; C.supportsUsed = 1;
  C.turn = 4 + (C.first === x.actor ? 0 : 1);
  return S;
}
/** An option's name, by the card it plays (not where the card lies). */
function sigOf(S: State, o: Option): string {
  const P = S.players;
  if (o.t === "duel") return `${o.act}:${o.act === "use" ? S.board[o.spot]?.def.id : "-"}:${o.mode}:${o.as ?? ""}:${o.cry ? "cry" : ""}`;
  if (o.t === "sacrifice" || o.t === "summon") return `${o.t}:${o.id}`;
  if (o.t === "duelCard") {
    const c = [...P[0].hand, ...P[1].hand, ...P[0].omens.map((x) => x.card), ...P[1].omens.map((x) => x.card)].find((x) => x.uid === o.uid);
    const who = o.target === undefined ? "" : o.target === S.combat!.hs[0] || o.target === S.combat!.hs[1] ? (o.target === S.combat!.hs[actorOfS(S)] ? "self" : "foe") : String(o.target);
    return `card:${c?.def.id}:${who}`;
  }
  if (o.t === "champion") return `champion:${[...S.players[0].hand, ...S.players[1].hand].find((x) => x.uid === o.uid)?.def.id ?? ""}`;
  return "";
}
const actorOfS = (S: State): Side => { const C = S.combat!; return (C.turn % 2 === 0 ? C.first : 1 - C.first) as Side; };
/** The options the cubes play: everything open in the duel but a guest, a draw or a card drawn. */
const playable = (o: Option) => (o.t === "duel" && o.guest < 0) || o.t === "sacrifice" || o.t === "summon" || o.t === "duelCard";

/** Play option i for the side to act; a blow the foe may block, blocked as serves the foe best. The outcome from the
 *  actor's view, and the position after (null if the duel ended). */
function play(S: State, i: number, steps = false): { out: Out; steps?: number[]; after: State | null } {
  const X = cloneState(S);
  X.stats = S.stats ? { ...S.stats, blows: [] } : null;
  const d = nextDecision(X)!;
  const C0 = X.combat!, a = actorOfS(X), o = (1 - a) as Side, duel0 = C0.duel;
  const v0 = [C0.valour[a], C0.valour[o]], s0 = [C0.shield[a], C0.shield[o]], r0 = X.players[a].reserve.length;
  TRACE.on = steps;
  let Y = X;
  try {
    applyDecision(X, d, i, false);
    const d2 = nextDecision(X);
    if (d2 && d2.kind === "block") {
      let bv = Infinity;
      for (let j = 0; j < d2.options.length; j++) {
        const Z = cloneState(X); Z.stats = X.stats ? { ...X.stats, blows: [...(X.stats.blows ?? [])] } : null;
        applyDecision(Z, d2, j, false);
        const Cz = Z.combat!; const same = Cz.duel === duel0 && Cz.stage === "turns";
        const v = same ? Cz.valour[a] - Cz.valour[o] : Cz.endValour[duel0][a] - Cz.endValour[duel0][o];
        if (v < bv) { bv = v; Y = Z; }
      }
    }
  } finally { TRACE.on = false; }
  const C1 = Y.combat!;
  const same = C1.duel === duel0 && C1.stage === "turns";
  const v1 = same ? [C1.valour[a], C1.valour[o]] : [C1.endValour[duel0][a], C1.endValour[duel0][o]];
  const sh1 = same ? [C1.shield[a], C1.shield[o]] : s0;
  const B = Y.stats?.blows?.find((x) => x.side === a);
  const end = same ? 0 : (C1.felled[duel0][a] ? 1 : 0) | (C1.felled[duel0][o] ? 2 : 0);
  return {
    out: [v1[0] - v0[0], v1[1] - v0[1], sh1[0] - s0[0], sh1[1] - s0[1], r0 - Y.players[a].reserve.length, B ? B.final : 0, B ? 1 : 0, end],
    steps: steps ? STEPS.map((k) => (B ? (B[k] as number) : 0)) : undefined,
    after: same ? Y : null,
  };
}
/** Every playable option of the side to act: name -> outcome. Here an action is named without its mode (a card
 *  used in breach of a geis is the same card used, now at a price): the outcome ends with "broke", 1 if it breaks a
 *  geis or oath, 2 if it ignores one (Cathbad), 0 if not. */
const MODES = ["normal", "break", "ignore"];
function outcomes(S: State | null): Map<string, Out> {
  const m = new Map<string, Out>();
  if (!S) return m;
  const d = nextDecision(S);
  if (!d || d.kind !== "duel") return m;
  d.options.forEach((o, i) => {
    if (!playable(o)) return;
    const k = sigOf(S, o).split(":").map((x, j) => (j === 2 && x !== "ignore" ? "" : x)).join(":");
    if (!m.has(k)) m.set(k, [...play(S, i).out, o.t === "duel" ? MODES.indexOf(o.mode) : 0]);
  });
  return m;
}
/** The position after a prior action, with side 0 to act again: after its own action, the foe's turn is passed over
 *  (its end of turn has happened; the foe does nothing), so what is left is what the action itself left behind. */
function mineAgain(S: State | null): State | null {
  if (!S || !S.combat) return null;
  if (actorOfS(S) !== 0) S.combat.turn += 1;
  const d = nextDecision(S);
  return d && d.kind === "duel" && d.player === 0 ? S : null;
}
const cycleOf = (id: string) => { const s = Object.values(DECKS).flat().find((c) => c.id === id) ?? null; if (!s || s.type !== "support") return [0, 0, 0, 0]; const r = reuseOf(s); return [r.turns ?? 0, r.rest ?? 0, r.valour ?? 0, r.draw ?? 0]; };
const sameOut = (x: Out, y: Out) => x.every((v, i) => v === y[i]);

// ---------------------------------------------------------------- the three cubes
interface Job { cube: string; pa: string; pb: string; scope: string; hosts: string; settings: string[]; job: number }
type Emit = (rows: string[]) => void;

/** Primary: every action from the static position. Board actions at every setting; cards from hand at the ford. */
function primary(j: Job, emit: Emit) {
  const FA = fighters(j.pa, j.scope, j.hosts), FB = fighters(j.pb, j.pb.startsWith("dummy") ? "deck" : j.scope, j.hosts);
  const SA = supportsOf(j.pa, j.scope), HA = handOf(j.pa, j.scope);
  for (const A of FA) for (const B of FB) {
    const rows: string[] = [];
    const key = (st: string) => [j.pa, A.id, j.pb, B.id, st];
    for (const st of j.settings) {
      const seen = new Set<string>();
      const add = (S: State | null, only?: (sig: string) => boolean) => {
        if (!S) return;
        const d = nextDecision(S);
        if (!d || d.kind !== "duel") return;
        d.options.forEach((o, i) => {
          if (!playable(o)) return;
          const sig = sigOf(S, o);
          if (seen.has(sig) || (only && !only(sig))) return;
          seen.add(sig);
          const r = play(S, i, true);
          const [kind, id, mode, as, cry] = sig.split(":");
          rows.push([...key(st), kind, id, mode ?? "", as ?? "", cry ?? "", ...r.steps!, ...r.out, ...cycleOf(id)].join(","));
        });
      };
      for (const s of SA) add(build({ pa: j.pa, pb: j.pb, A, B, setting: st, a: [s], b: [], actor: 0 }), (g) => !g.startsWith("rest") || !seen.has(g));
      // rest, sacrifice and summon with nothing beside (the same with a card: measured once)
      add(build({ pa: j.pa, pb: j.pb, A, B, setting: st, a: [], b: [], actor: 0 }));
      if (st === j.settings[0]) for (const h of HA) add(build({ pa: j.pa, pb: j.pb, A, B, setting: st, a: [], b: [], ha: h, actor: 0 }), (g) => g.startsWith("card:"));
    }
    emit(rows);
  }
}

/** The priors of a position: each an action of side 0's own (then the foe passes) or of the foe's (side 1 first),
 *  with what it is, and the position it leaves for side 0 to act in. */
interface Prior { kind: "own" | "foe"; sig: string; card: string; after: State }
function priorsOf(base: (actor: Side, ha?: CardDef | null, hb?: CardDef | null) => State | null, HA: CardDef[], HB: CardDef[], filter?: (sig: string) => boolean): Prior[] {
  const out: Prior[] = [];
  const take = (kind: "own" | "foe", S: State | null) => {
    if (!S) return;
    const d = nextDecision(S);
    if (!d || d.kind !== "duel") return;
    const seen = new Set<string>();
    d.options.forEach((o, i) => {
      if (!playable(o)) return;
      const sig = sigOf(S, o);
      if (seen.has(sig) || (filter && !filter(sig))) return;
      seen.add(sig);
      const r = play(S, i);
      const after = kind === "own" ? mineAgain(r.after) : r.after && nextDecision(r.after)?.kind === "duel" && actorOfS(r.after) === 0 ? r.after : null;
      if (after) out.push({ kind, sig, card: sig.split(":")[1], after });
    });
  };
  take("own", base(0)); take("foe", base(1));
  for (const h of HA) take("own", base(0, h, null));
  for (const h of HB) take("foe", base(1, null, h));
  return out;
}

/** Secondary: for each card c2 beside the fighter, and each prior (a card c1 used, a rest, a hand card, a foe's
 *  action with its card t, or c1 merely beside it), the actions open after: what changed from the static position. */
function secondary(j: Job, emit: Emit) {
  const st = j.settings[0];
  const FA = fighters(j.pa, j.scope, j.hosts), FB = fighters(j.pb, j.pb.startsWith("dummy") ? "deck" : j.scope, j.hosts);
  const SA = supportsOf(j.pa, j.scope), SB = supportsOf(j.pb, j.pb.startsWith("dummy") ? "deck" : j.scope);
  const HA = handOf(j.pa, j.scope), HB = j.pb.startsWith("dummy") ? [] : handOf(j.pb, j.scope);
  for (const A of FA) for (const B of FB) {
    const rows: string[] = [], counts = new Map<string, number[]>();
    const mk = (a: (SupportDef | null)[], b: (SupportDef | null)[], actor: Side, ha?: CardDef | null, hb?: CardDef | null) => build({ pa: j.pa, pb: j.pb, A, B, setting: st, a, b, ha, hb, actor });
    const note = (kind: string, prior: string, after: Map<string, Out>, before: Map<string, Out>) => {
      for (const sig of new Set([...before.keys(), ...after.keys()])) {
        const x = before.get(sig), y = after.get(sig);
        const ck = `${kind}|${prior.split(":")[0]}|${sig.split(":")[0]}`;
        const c = counts.get(ck) ?? [0, 0]; c[0]++;
        const changed = !x || !y || !sameOut(x, y);
        if (changed) c[1]++;
        counts.set(ck, c);
        if (!changed) continue;
        const avail = !x ? "gained" : !y ? "lost" : "both";
        const [k2, id2] = sig.split(":");
        rows.push([j.pa, A.id, j.pb, B.id, kind, prior, prior.split(":")[1] ?? "", sig, k2, id2, avail, ...(x ?? OUT2.map(() => "")), ...(y ?? OUT2.map(() => ""))].join(","));
      }
    };
    for (const c2 of [null, ...SA]) {
      const base0 = outcomes(mk([c2], [], 0));
      // c1 beside it (a passive or a reaction, or only a card waiting), then c1 used first
      for (const c1 of SA) {
        if (c1 === c2 || !c2) continue;
        const Z = mk([c1, c2], [], 0);
        const zb = outcomes(Z);
        // the card beside it only as company: its own use isn't compared (it isn't there in the static position)
        note("beside", `beside:${c1.id}`, new Map([...zb].filter(([g]) => g.split(":")[1] !== c1.id)), base0);
        for (const p of priorsOf((actor) => (actor === 0 ? mk([c1, c2], [], 0) : null), [], [], (g) => g.split(":")[1] === c1.id)) note("own", p.sig, outcomes(p.after), zb);
      }
      // own rests, sacrifices and summons; then each hand card (each against the static position holding it)
      for (const p of priorsOf((actor) => (actor === 0 ? mk([c2], [], 0) : null), [], [], (g) => !g.startsWith("use:") && !g.startsWith("card:"))) note("own", p.sig, outcomes(p.after), base0);
      for (const h of HA) {
        const zh = outcomes(mk([c2], [], 0, h));
        zh.forEach((_, g) => { if (g.startsWith("card:")) zh.delete(g); });
        for (const p of priorsOf((actor) => (actor === 0 ? mk([c2], [], 0, h) : null), [], [], (g) => g.startsWith("card:" + h.id + ":"))) note("own", p.sig, outcomes(p.after), zh);
      }
      // the foe's actions: each card t of its used against us, and its rests and hand cards
      for (const t of [null, ...SB]) {
        const zt = t ? outcomes(mk([c2], [t], 0)) : base0;
        for (const p of priorsOf((actor) => (actor === 1 ? mk([c2], t ? [t] : [], 1) : null), [], [], (g) => (t ? g.split(":")[1] === t.id : !g.startsWith("use:") && !g.startsWith("card:")))) note("foe", p.sig, outcomes(p.after), zt);
      }
      for (const h of HB) for (const p of priorsOf((actor) => (actor === 1 ? mk([c2], [], 1, null, h) : null), [], [], (g) => g.startsWith("card:" + h.id + ":"))) note("foe", p.sig, outcomes(p.after), base0);
    }
    emit(rows);
    emit([...counts.entries()].map(([k, c]) => `#count,${j.pa},${A.id},${j.pb},${B.id},${k.replaceAll("|", ",")},${c[0]},${c[1]}`));
  }
}

/** Tertiary: the side's own action (a card c1, a rest, a hand card), the foe's reply (its card t, a rest, a hand card),
 *  then the side's next action: the interaction, what the two priors together change beyond the sum of each alone. */
function tertiary(j: Job, emit: Emit) {
  const st = j.settings[0];
  const FA = fighters(j.pa, j.scope, j.hosts), FB = fighters(j.pb, j.pb.startsWith("dummy") ? "deck" : j.scope, j.hosts);
  const SA = supportsOf(j.pa, j.scope), SB = supportsOf(j.pb, j.pb.startsWith("dummy") ? "deck" : j.scope);
  const HA = handOf(j.pa, j.scope), HB = j.pb.startsWith("dummy") ? [] : handOf(j.pb, j.scope);
  for (const A of FA) for (const B of FB) {
    const rows: string[] = [];
    let n = 0, nz = 0;
    // the foe's reply comes from a card beside it (t) or from its hand (hb), or is a rest
    const slots: [SupportDef | null, CardDef | null][] = [[null, null], ...SB.map((t): [SupportDef, null] => [t, null]), ...HB.map((h): [null, CardDef] => [null, h])];
    for (const c2 of SA) for (const [t, hb] of slots) {
      const mk = (a: (SupportDef | null)[], actor: Side, ha?: CardDef | null) => build({ pa: j.pa, pb: j.pb, A, B, setting: st, a, b: t ? [t] : [], ha, hb, actor });
      // the foe's priors alone (from the static position, the foe first)
      const foeP = priorsOf((actor) => (actor === 1 ? mk([c2], 1) : null), [], [], (g) => (t ? g.split(":")[1] === t.id : hb ? g.startsWith("card:" + hb.id + ":") : !g.startsWith("use:") && !g.startsWith("card:")));
      const O0 = outcomes(mk([c2], 0));
      const O2 = new Map(foeP.map((p) => [p.sig, outcomes(p.after)]));
      for (const c1 of [null, ...SA.filter((x) => x !== c2)]) {
        const board = c1 ? [c1, c2] : [c2];
        const ownP = c1 ? priorsOf((actor) => (actor === 0 ? mk(board, 0) : null), [], [], (g) => g.split(":")[1] === c1.id)
          : [...priorsOf((actor) => (actor === 0 ? mk(board, 0) : null), [], [], (g) => !g.startsWith("use:") && !g.startsWith("card:")),
            ...HA.flatMap((h) => priorsOf((actor) => (actor === 0 ? mk(board, 0, h) : null), [], [], (g) => g.startsWith("card:" + h.id + ":")))];
        const O0b = c1 ? outcomes(mk(board, 0)) : O0;
        for (const p1 of ownP) {
          const O1 = outcomes(p1.after);
          // the same own action, then the foe's reply played for real
          const S = cloneState(p1.after); // side 0 to act after the pass: undo the pass, the foe acts now
          S.combat!.turn -= 1;
          const d = nextDecision(S);
          if (!d || d.kind !== "duel" || d.player !== 1) continue;
          const seen = new Set<string>();
          d.options.forEach((o, i) => {
            if (!playable(o)) return;
            const sig = sigOf(S, o);
            if (seen.has(sig) || !O2.has(sig)) return;
            seen.add(sig);
            const r = play(S, i);
            if (!r.after || actorOfS(r.after) !== 0) return;
            const O12 = outcomes(r.after), O2s = O2.get(sig)!;
            for (const [a2, y] of O12) {
              const x1 = O1.get(a2), x2 = O2s.get(a2), x0 = O0b.get(a2) ?? O0.get(a2);
              n++;
              if (!x1 || !x2 || !x0) continue;
              const I = y.map((v, k) => v - x1[k] - x2[k] + x0[k]);
              if (I.every((v) => v === 0)) continue;
              nz++;
              rows.push([j.pa, A.id, j.pb, B.id, p1.sig, sig, a2, a2.split(":")[1], ...I, ...y, ...x1, ...x2, ...x0].join(","));
            }
          });
        }
      }
    }
    emit(rows);
    emit([`#count,${j.pa},${A.id},${j.pb},${B.id},${n},${nz}`]);
  }
}

const HEADS: Record<string, string[]> = {
  primary: ["deck", "fighter", "foeDeck", "foe", "setting", "action", "card", "mode", "as", "cry", ...STEPS.map((k) => (k === "setting" ? "setBonus" : k)), ...OUT, "waitTurns", "needRests", "payValour", "payCards"],
  secondary: ["deck", "fighter", "foeDeck", "foe", "kind", "prior", "priorCard", "sig", "action", "card", "avail", ...OUT2.map((k) => k + "0"), ...OUT2],
  tertiary: ["deck", "fighter", "foeDeck", "foe", "own", "reply", "sig", "card", ...OUT2.map((k) => "i_" + k), ...OUT2, ...OUT2.map((k) => k + "1"), ...OUT2.map((k) => k + "2"), ...OUT2.map((k) => k + "0")],
};
const COUNT_HEADS: Record<string, string[]> = {
  secondary: ["deck", "fighter", "foeDeck", "foe", "kind", "priorAction", "action", "compared", "changed"],
  tertiary: ["deck", "fighter", "foeDeck", "foe", "compared", "interacting"],
};

function engineHash(): string {
  const dir = fileURLToPath(new URL("../../src/games/roth/engine/", import.meta.url));
  const h = createHash("sha256");
  for (const f of readdirSync(dir).filter((f) => (f.endsWith(".ts") || f.endsWith(".json")) && !["insights.json", "evalWeights.json", "calcWeights.json"].includes(f)).sort()) { h.update(f); h.update(readFileSync(join(dir, f))); }
  return h.digest("hex").slice(0, 12);
}

if (process.argv.includes("--worker")) {
  process.on("message", (j: Job) => {
    const buf: string[] = [];
    const flush = () => { if (buf.length) { process.send!({ rows: buf.splice(0) }); } };
    const emit: Emit = (rows) => { for (const r of rows) buf.push(r); if (buf.length > 20000) flush(); };
    (j.cube === "primary" ? primary : j.cube === "secondary" ? secondary : tertiary)(j, emit);
    flush();
    process.send!({ done: true });
  });
} else {
  const args = process.argv.slice(2);
  const str = (f: string, d: string) => { const i = args.indexOf(`--${f}`); return i >= 0 ? args[i + 1] : d; };
  const cube = str("cube", "primary");
  const peoples = str("peoples", FACTIONS.join(",")).split(",");
  const foes = str("foes", [...FACTIONS, "dummy_spar"].join(",")).split(",");
  const scope = str("scope", cube === "tertiary" ? "deck" : "pool");
  const hosts = str("hosts", cube === "primary" ? "all" : "deck");
  const settings = str("settings", cube === "primary" ? SETTINGS.map((s) => s.id).join(",") : "ford").split(",");
  const W = Number(str("workers", "2"));
  const engine = engineHash();
  const id = `${cube}-${new Date().toISOString().slice(0, 10)}-${engine}`;
  const out = str("out", `sim/roth/cube/rules/${id}`);
  mkdirSync(dirname(out), { recursive: true });
  const main = createGzip(), cnt = COUNT_HEADS[cube] ? createGzip() : null;
  main.pipe(createWriteStream(`${out}.csv.gz`));
  cnt?.pipe(createWriteStream(`${out}.counts.csv.gz`));
  main.write(HEADS[cube].join(",") + "\n");
  cnt?.write(COUNT_HEADS[cube].join(",") + "\n");
  const jobs: Job[] = [];
  for (const pa of peoples) for (const pb of foes) jobs.push({ cube, pa, pb, scope, hosts, settings, job: jobs.length });
  let rows = 0, counts = 0, next = 0, done = 0;
  const t0 = Date.now();
  await new Promise<void>((resolve) => {
    let live = Math.min(W, jobs.length);
    for (let w = 0; w < Math.min(W, jobs.length); w++) {
      const c = fork(fileURLToPath(import.meta.url), ["--worker"], { execArgv: [...process.execArgv, "--max-old-space-size=2500"] });
      let cur: Job | null = null;
      const feed = () => { if (next < jobs.length) { cur = jobs[next++]; c.send(cur); } else { c.disconnect(); if (--live === 0) resolve(); } };
      c.on("message", (m: { rows?: string[]; done?: boolean }) => {
        if (m.rows) for (const r of m.rows) { if (r.startsWith("#count,")) { cnt?.write(r.slice(7) + "\n"); counts++; } else { main.write(r + "\n"); rows++; } }
        if (m.done) { done++; process.stderr.write(`  ${cur!.pa} vs ${cur!.pb} (${done}/${jobs.length}, ${rows} rows, ${((Date.now() - t0) / 1000).toFixed(0)}s)\n`); feed(); }
      });
      feed();
    }
  });
  await Promise.all([new Promise((r) => main.end(r)), cnt ? new Promise((r) => cnt.end(r)) : Promise.resolve()]);
  writeFileSync(`${out}.meta.json`, JSON.stringify({ id, cube, engine, created: new Date().toISOString(), peoples, foes, scope, hosts, settings, rows, counts, params: resolveParams({ ...DEFAULT_RULES }) }, null, 1) + "\n");
  console.log(`${cube}: ${rows} rows in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${out}.csv.gz`);
}
