// How people play against the computer, from the site's match records (#/telemetry → Download JSON).
// Each record is replayed by the rules (its seed, both decks and every choice), which checks it and recovers what
// the record leaves out: the setting, the cards drafted, sworn, laid and used, each duel.
//   npx tsx sim/roth/telemetry.ts roth-matches-<date>.json [--json out.json]
// Records from a build whose rules differ from this checkout's may stop replaying part-way; they are counted apart.
import { readFileSync, writeFileSync } from "node:fs";
import { ALL_DEFS, type CardDef } from "../../src/games/roth/engine/cards";
import { applyDecision, newMatch, nextDecision, type State } from "../../src/games/roth/engine/engine";

interface Rec { id: string; data: { build: string; at: number; outcome: string; match: { setup: Record<string, string>; me: 0 | 1; seed: number; decks: { first: string[]; second: string[] }; moves: number[]; undos: number; ms: number | null; result: { winner: number; felled: number[] } | null } } }

/** Replay one record: the final state, and how far it got (a choice the rules don't offer stops it). */
export function replay(m: Rec["data"]["match"]): { S: State; played: number; ok: boolean } {
  const deck = (ids: string[]) => ids.map((id) => ALL_DEFS[id] as CardDef);
  const S = newMatch([deck(m.decks.first), deck(m.decks.second)], {}, m.seed, true);
  let played = 0;
  for (const i of m.moves) {
    const d = nextDecision(S);
    if (!d || i < 0 || i >= d.options.length) return { S, played, ok: false };
    applyDecision(S, d, i, false);
    played++;
  }
  return { S, played, ok: true };
}

if (process.argv[1]?.endsWith("telemetry.ts")) {
  const args = process.argv.slice(2);
  const recs = JSON.parse(readFileSync(args[0], "utf8")) as Rec[];
  const pct = (a: number, b: number) => (b ? ((100 * a) / b).toFixed(0) + "%" : "-");
  const tally = <K extends string>() => new Map<K, { n: number; w: number }>();
  const byLevel = tally<string>(), byDeck = tally<string>(), byFoe = tally<string>(), bySeat = tally<string>();
  const cards = new Map<string, { n: number; w: number }>();
  let bad = 0, abandoned = 0, mismatch = 0;
  const rows: unknown[] = [];
  const add = (t: Map<string, { n: number; w: number }>, k: string, w: number) => { const x = t.get(k) ?? { n: 0, w: 0 }; x.n++; x.w += w; t.set(k, x); };
  for (const r of recs) {
    const m = r.data.match;
    const { S, played, ok } = replay(m);
    if (!ok) { bad++; continue; }
    if (r.data.outcome === "abandoned") { abandoned++; continue; }
    const w = r.data.outcome === "won" ? 1 : r.data.outcome === "drawn" ? 0.5 : 0;
    if (!S.result || (S.result.winner === -1 ? 0.5 : S.result.winner === m.me ? 1 : 0) !== w) mismatch++;
    add(byLevel, m.setup.level, w); add(byDeck, m.setup.mine, w); add(byFoe, m.setup.theirs, w); add(bySeat, m.setup.seat, w);
    for (const p of S.stats?.placed ?? []) if (p.side === m.me) add(cards, ALL_DEFS[p.id]?.name ?? p.id, w);
    rows.push({ id: r.id, build: r.data.build, level: m.setup.level, deck: m.setup.mine, foe: m.setup.theirs, seat: m.setup.seat, outcome: r.data.outcome, setting: S.rules.setting ?? null, moves: played, undos: m.undos, minutes: m.ms ? Math.round(m.ms / 60000) : null });
  }
  const show = (title: string, t: Map<string, { n: number; w: number }>, min = 1) => {
    console.log(`\n${title}`);
    for (const [k, v] of [...t].filter(([, v]) => v.n >= min).sort((a, b) => b[1].n - a[1].n)) console.log(`  ${k.padEnd(28)} ${String(v.n).padStart(5)} matches, the player scored ${pct(v.w, v.n)}`);
  };
  console.log(`${recs.length} records: ${recs.length - bad - abandoned} finished, ${abandoned} left before the end, ${bad} that don't replay on this checkout's rules${mismatch ? `, ${mismatch} whose replayed result differs from the recorded one` : ""}.`);
  show("By computer level", byLevel); show("By the player's deck", byDeck); show("By the computer's deck", byFoe); show("By seat", bySeat);
  show("Cards the player drafted (at least 5 matches)", cards, 5);
  const j = args.indexOf("--json");
  if (j >= 0) writeFileSync(args[j + 1], JSON.stringify(rows, null, 1));
}
