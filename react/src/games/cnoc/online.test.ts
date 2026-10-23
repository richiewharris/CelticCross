import { describe, expect, it } from "vitest";
import { replay } from "../../online/types";
import { LEVELS, cpuPlace, search } from "./engine/ai";
import { cpuSetupChoice } from "./engine/cpu";
import { actor, currentSlot, newGame, placePiece, playMove, rulesOf, seenMap, type Game } from "./engine/game";
import { CH, LO, PH, RI, SP, from, gen, to } from "./engine/rules";
import { slotZone } from "./engine/setup";
import { cnocOnline as A, type CnocMove, type CnocOptions } from "./online";

const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);

/** Play a whole game with the engine alone, noting each action as an online move. */
function selfPlay(o: CnocOptions, seed: number, smart = false, forcePhalanx?: boolean): { g: Game; moves: CnocMove[] } {
  const rnd = rng(seed);
  let g = newGame(o);
  const moves: CnocMove[] = [];
  while (g.phase === "place") {
    const slot = currentSlot(g), { piece, takePhalanx } = cpuSetupChoice(g, 2, rnd, forcePhalanx);
    const at = smart
      ? cpuPlace(g.s, slot.o, piece, 1, slot.o !== slot.p, i => slotZone(slot, i), rulesOf(g))
      : (() => { const holes = [...Array(49).keys()].filter(i => !g.s.b[i] && slotZone(slot, i)); return holes[(rnd() * holes.length) | 0]; })();
    moves.push(takePhalanx ? { at, k: piece, ph: 1 } : { at, k: piece });
    g = placePiece(g, at, piece, takePhalanx);
  }
  for (let t = 0; t < 400 && g.winner === null; t++) {
    const ms = gen(g.s, rulesOf(g));
    const m = smart ? search(g.s, { ...LEVELS[1], ms: 30, noise: 80 }, seenMap(g), rulesOf(g))! : ms[(rnd() * ms.length) | 0];
    moves.push({ f: from(m), t: to(m) });
    g = playMove(g, m);
  }
  return { g, moves };
}

const ALL: CnocOptions[] = [false, true].flatMap(swap => [false, true].map(combine => ({ holdN: 7 as const, swap, combine })));

describe("Cnoc online adapter", () => {
  it("replays self-played games move for move, in every setup and piece option", () => {
    const whys = new Set<string>();
    for (const o of ALL) for (let n = 0; n < 12; n++) {
      const force = o.combine ? n % 2 === 0 : undefined;
      const { g, moves } = selfPlay({ ...o, holdN: n % 3 ? 7 : 8 }, 100 + n * 7, n % 4 === 3, force);
      const opts = { ...o, holdN: (n % 3 ? 7 : 8) as 7 | 8 };
      // Step by step: the adapter agrees with the engine on who acts and accepts each move.
      let s = A.start(opts);
      for (const m of moves) {
        expect(A.seatToAct(s)).toBe(actor(s) === 0 ? "host" : "si");
        expect(A.legal(s, m)).toBe(true);
        expect(A.result(s)).toBeNull();
        s = A.apply(s, m);
      }
      expect(s).toEqual(g);
      const r = replay(A, { options: opts, moves });
      expect(r.illegalAt).toBeNull();
      expect(r.s).toEqual(g);
      if (g.winner !== null) {
        whys.add(g.why!);
        expect(A.seatToAct(r.s)).toBeNull();
        const res = A.result(r.s)!;
        expect(res.winner).toBe(g.winner === -1 ? null : g.winner === 0 ? "host" : "si");
        expect(res.text.length).toBeGreaterThan(5);
      }
      if (o.combine && force) expect(g.s.b.includes(PH) || g.history.some(h => h.note.includes("Phalanx"))).toBe(true);
    }
    expect(whys.size).toBeGreaterThan(1);
  });

  it("starts with the Host setting, and the setter acts during setup", () => {
    const s = A.start({ holdN: 7, swap: true, combine: false });
    expect(A.seatToAct(s)).toBe("host");
    const s1 = A.apply(s, { at: 0, k: LO });
    expect(A.seatToAct(s1)).toBe("si"); // the Sí set their Chariot on the summit
    const s2 = A.apply(s1, { at: 24, k: CH });
    expect(A.seatToAct(s2)).toBe("host"); // the Host set a Sí Rider
    expect(A.legal(s2, { at: 8, k: RI })).toBe(true);
    expect(A.legal(s2, { at: 1, k: RI })).toBe(false); // Riders go on the slope or summit
  });

  it("refuses illegal moves", () => {
    const s = A.start(A.defaultOptions);
    const bad: unknown[] = [
      { at: 24, k: SP },          // Host pieces go on the outer ring
      { at: 0, k: RI },           // not the Host's piece
      { at: 0, k: PH },           // no Phalanx in standard pieces
      { at: 0, k: SP, ph: 1 },    // no Phalanx choice in standard pieces
      { at: 49, k: SP }, { at: -1, k: SP }, { at: 1.5, k: SP }, { at: "0", k: SP },
      { at: 0, k: SP, x: 1 },     // stray fields
      { f: 0, t: 1 },             // no play during setup
      null, 7, [0, 1], "a1",
    ];
    for (const m of bad) expect(A.legal(s, m as CnocMove)).toBe(false);
    const taken = A.apply(s, { at: 0, k: SP });
    expect(A.legal(taken, { at: 0, k: RI })).toBe(false); // hole taken (and Riders go up the mound anyway)

    // Combining, own setup: the Phalanx is a piece in the Host's tray, not a flag.
    const c = A.start({ holdN: 7, swap: false, combine: true });
    expect(A.legal(c, { at: 0, k: PH })).toBe(true);
    expect(A.legal(c, { at: 0, k: SP, ph: 1 })).toBe(false);
    // Combining, rival's setup: the flag rides only on the Host's Lord.
    const cs = A.start({ holdN: 7, swap: true, combine: true });
    expect(A.legal(cs, { at: 0, k: LO, ph: 1 })).toBe(true);
    expect(A.legal(cs, { at: 0, k: LO, ph: 2 } as unknown as CnocMove)).toBe(false);
    const cs1 = A.apply(cs, { at: 0, k: LO, ph: 1 }), cs2 = A.apply(cs1, { at: 24, k: CH });
    expect(A.legal(cs2, { at: 8, k: RI, ph: 1 })).toBe(false);

    // In play: only the engine's moves, by the side to move.
    const { g } = selfPlay(A.defaultOptions, 5);
    const mid = replay(A, { options: A.defaultOptions, moves: selfPlay(A.defaultOptions, 5).moves.slice(0, 15) }).s;
    expect(mid.phase).toBe("play");
    const legal = gen(mid.s, rulesOf(mid));
    const notLegal = { f: 0, t: 48 };
    expect(legal.includes(0 * 64 + 48)).toBe(false);
    expect(A.legal(mid, notLegal)).toBe(false);
    expect(A.legal(mid, { at: 3, k: SP })).toBe(false);
    if (g.winner !== null) expect(A.legal(g, { f: from(legal[0]), t: to(legal[0]) })).toBe(false); // game over
  });

  it("replay() stops at the first bad move", () => {
    const { moves } = selfPlay({ holdN: 7, swap: false, combine: true }, 42);
    const cut = 20;
    const broken = [...moves.slice(0, cut), { f: 0, t: 48 }, ...moves.slice(cut + 1)];
    const r = replay(A, { options: { holdN: 7, swap: false, combine: true }, moves: broken });
    expect(r.illegalAt).toBe(cut);
    expect(r.s).toEqual(replay(A, { options: { holdN: 7, swap: false, combine: true }, moves: moves.slice(0, cut) }).s);
    // A move after the end of the game is refused too.
    const done = selfPlay(A.defaultOptions, 9);
    if (done.g.winner !== null) {
      const extra = replay(A, { options: A.defaultOptions, moves: [...done.moves, done.moves[done.moves.length - 1]] });
      expect(extra.illegalAt).toBe(done.moves.length);
    }
  });

  it("describes the options an invite carries", () => {
    expect(A.describeOptions!({ holdN: 8, swap: true, combine: true })).toBe("hold 6 turns · set your rival's pieces · combining pieces");
    expect(A.seats.map(x => x.label)).toEqual(["Host", "Sí"]);
  });

  it("states a third repetition the game's own way", () => {
    const g = { ...newGame(), winner: -1 as const, why: "repeat" as const };
    expect(A.result(g)).toEqual({ winner: null, text: "The position came round a third time." });
  });
});
