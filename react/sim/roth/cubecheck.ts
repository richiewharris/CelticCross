// Checks the cube against the rules where it matters: in real duels. Plays matches between the standard computers and,
// at every duel decision, plays each board option on the real position too, and compares what it did with what the
// cube says (Valour and Shield of both sides). Then how often a position was already in the cube, and how long a
// lookup takes against playing the option out.
//   npx tsx sim/roth/cubecheck.ts [--n 4] [--level skilled]
import { DECKS, FACTIONS } from "../../src/games/roth/engine/cards";
import { actorOf, applyDecision, cloneState, newMatch, nextDecision, type Policy, type State } from "../../src/games/roth/engine/engine";
import { makePolicy } from "../../src/games/roth/engine/ai";
import { CUBE, cubeable, lookup } from "../../src/games/roth/engine/cube";
import { hashSeed, Rng } from "../../src/games/roth/engine/rng";

const args = process.argv.slice(2);
const num = (f: string, d: number) => { const i = args.indexOf(`--${f}`); return i >= 0 ? Number(args[i + 1]) : d; };
const n = num("n", 2), level = args.includes("--level") ? args[args.indexOf("--level") + 1] : "skilled";

/** The real outcome of option i, the defender blocking as the cube assumes (whatever leaves it best off). */
function real(S: State, i: number): number[] | null {
  const X = cloneState(S);
  const d = nextDecision(X)!;
  const C0 = X.combat!, a = actorOf(C0), o = 1 - a, duel0 = C0.duel;
  const v0 = [C0.valour[a], C0.valour[o]], s0 = [C0.shield[a], C0.shield[o]];
  applyDecision(X, d, i, false);
  let Y = X;
  const d2 = nextDecision(X);
  if (d2 && d2.kind === "block") {
    let bv = Infinity;
    for (let j = 0; j < d2.options.length; j++) {
      const Z = cloneState(X); applyDecision(Z, d2, j, false);
      const Cz = Z.combat!; const same = Cz.duel === duel0 && Cz.stage === "turns";
      const v = same ? Cz.valour[a] - Cz.valour[o] : Cz.endValour[duel0][a] - Cz.endValour[duel0][o];
      if (v < bv) { bv = v; Y = Z; }
    }
  }
  const C1 = Y.combat!;
  const same = C1 && C1.duel === duel0 && C1.stage === "turns";
  const v1 = same ? [C1.valour[a], C1.valour[o]] : [C1.endValour[duel0][a], C1.endValour[duel0][o]];
  const sh1 = same ? [C1.shield[a], C1.shield[o]] : s0;
  return [v1[0] - v0[0], v1[1] - v0[1], sh1[0] - s0[0], sh1[1] - s0[1]];
}

let opts = 0, exact = 0, missing = 0, decisions = 0;
const wrong = new Map<string, number>();
let tCube = 0, tReal = 0;
for (const A of FACTIONS) for (const B of FACTIONS) {
  if (A === B) continue;
  for (let k = 0; k < n; k++) {
    const seed = hashSeed(7, `cube-${A}-${B}`, k);
    const S = newMatch([DECKS[A], DECKS[B]], {}, seed);
    const pol = [makePolicy(level), makePolicy(level)] as [Policy, Policy];
    const rng = [new Rng(hashSeed(seed, 1)), new Rng(hashSeed(seed, 2))];
    for (let guard = 0; guard < 5000; guard++) {
      const d = nextDecision(S);
      if (!d) break;
      if (d.kind === "duel" && S.combat && !S.combat.pending && !S.combat.drawn) {
        decisions++;
        const t0 = performance.now();
        const L = lookup(S);
        tCube += performance.now() - t0;
        if (L) d.options.forEach((o, i) => {
          if (!cubeable(o)) return;
          opts++;
          const x = L.entry.outs.find((y) => y.sig === L.sig(o));
          const t1 = performance.now();
          const r = real(S, i);
          tReal += performance.now() - t1;
          if (!x || !r) { missing++; return; }
          const c = [x.dSelf, x.dFoe, x.dSelfShield, x.dFoeShield];
          if (c.every((v, j) => v === r[j])) exact++;
          else { const why = `${o.t === "duel" ? o.act : o.t} ${S.board[(o as { spot?: number }).spot ?? -1]?.def.id ?? ""}: cube ${c.join(",")} real ${r.join(",")}`; wrong.set(why, (wrong.get(why) ?? 0) + 1); }
        });
      }
      const i = pol[d.player].choose(S, d, rng[d.player]);
      applyDecision(S, d, i);
    }
  }
  process.stderr.write(`  ${A} vs ${B}: ${opts} options, ${exact} exact, cube ${CUBE.map.size} entries\n`);
}
console.log(`${decisions} duel decisions, ${opts} board options: ${exact} exact (${((100 * exact) / opts).toFixed(2)}%), ${missing} not in the cube`);
console.log(`lookups: ${CUBE.hits} hits, ${CUBE.misses} filled; ${(tCube / decisions).toFixed(3)} ms a decision (filling included) against ${(tReal / opts).toFixed(3)} ms an option played out`);
const top = [...wrong.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
for (const [k, v] of top) console.log(`  ${v}x ${k}`);
