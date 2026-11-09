// Find puzzle candidates: positions from Skilled self-play where one choice is clearly, provably best.
//   npx tsx sim/roth/puzzlegen.ts --games 300 --seed 1 > candidates.json
import { DECKS, FACTIONS } from "../../src/games/roth/engine/cards";
import { applyDecision, cloneState, newMatch, nextDecision, observe, type State } from "../../src/games/roth/engine/engine";
import { CasualPolicy, SkilledPolicy } from "../../src/games/roth/engine/ai";
import { Rng } from "../../src/games/roth/engine/rng";
import { optionValues, packState } from "../../src/games/roth/puzzles/position";
import { optionLabel } from "../../src/games/roth/text";

const args = process.argv.slice(2);
const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
const games = num("games", 200), seed0 = num("seed", 1);
const sk = new SkilledPolicy(), cas = new CasualPolicy();
const out: unknown[] = [];

/** Puzzles leave guests and champions out: strip them from both hands. */
function puzzleReady(S: State): State {
  const T = cloneState(S);
  for (const P of T.players) P.hand = P.hand.filter((c) => c.def.type !== "hero" && c.def.type !== "champion");
  if (T.combat) { T.combat.guests = [[], []]; T.combat.champs = [[], []]; }
  return T;
}

for (let g = 0; g < games; g++) {
  const rng = new Rng(seed0 * 1000 + g);
  const a = FACTIONS[rng.int(5)], b = FACTIONS[rng.int(5)];
  const S = newMatch([DECKS[a], DECKS[b]], {}, seed0 * 7777 + g, false);
  for (let guard = 0; guard < 400; guard++) {
    const d = nextDecision(S);
    if (!d) break;
    const kind = d.kind === "place" && S.step === 6 && S.sub === 1 ? "draft"
      : d.kind === "action" && S.step === 6 && !S.reversed ? "play"
      : d.kind === "duel" && !S.reversed && (S.combat!.turn <= 1) ? "combat" : null;
    if (kind && d.options.length >= 3) {
      const P = puzzleReady(S);
      const { d: pd, values } = optionValues(P);
      const finite = values.filter((v) => Number.isFinite(v));
      const best = Math.max(...finite);
      const bestIdx = values.map((v, i) => (v === best ? i : -1)).filter((i) => i >= 0);
      const second = Math.max(...finite.filter((v) => v < best), -Infinity);
      const cIdx = cas.choose(observe(P, pd.player), pd, new Rng(g));
      const casualWrong = !bestIdx.includes(cIdx);
      const gap = best - second;
      if (bestIdx.length <= 2 && gap >= 10 && casualWrong && Number.isFinite(second)) {
        out.push({
          kind, decks: pd.player === 0 ? [a, b] : [b, a], me: pd.player, step: S.step, duel: S.combat?.duel, turn: S.combat?.turn,
          gap, best, values, labels: pd.options.map((o) => optionLabel(P, pd, o)), bestIdx, casual: cIdx, state: packState(P),
        });
      }
    }
    const pol = sk;
    const i = d.options.length === 1 ? 0 : pol.choose(observe(S, d.player), d, rng);
    applyDecision(S, d, i, false);
  }
  if (g % 20 === 0) process.stderr.write(`game ${g}: ${out.length} candidates\n`);
}
process.stdout.write(JSON.stringify(out));

