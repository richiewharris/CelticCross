import { describe, expect, it } from "vitest";
import { replay } from "../../online/types";
import { LEVELS, search } from "./engine/ai";
import { doMove, newGame, statusText } from "./engine/game";
import { mulberry32 } from "./engine/rng";
import { GOLD, WHITE, fromSq, genMoves, initial, play, type Move, type State } from "./engine/rules";
import { fidchellOnline as A, fromMove, historyOf, type OnlineMove } from "./online";

/** Self-play straight through the engine; returns the moves and the final state. */
function selfPlay(seed: number, pick: "random" | "ai"): { moves: Move[]; end: State } {
  const rng = mulberry32(seed);
  let s = initial(), t = 0;
  const moves: Move[] = [];
  while (s.winner === null && moves.length < 600) {
    const ms = genMoves(s.b, s.turn);
    const m = pick === "random" ? ms[Math.floor(rng() * ms.length)] : search(s, LEVELS[1], { rng, now: () => (t += 0.001) })!;
    moves.push(m);
    s = play(s, m);
  }
  return { moves, end: s };
}

describe("Fidchell online adapter", () => {
  it("has Gold and White, Gold first", () => {
    expect(A.seats.map(x => x.label)).toEqual(["Gold", "White"]);
    expect(A.seatToAct(A.start(A.defaultOptions))).toBe("gold");
  });

  it("replays self-played games move for move, with the engine's result", () => {
    const reasons = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { moves, end } = selfPlay(seed, seed % 4 === 0 ? "ai" : "random");
      expect(end.winner).not.toBeNull();
      reasons.add(end.reason!);
      let s = A.start({});
      let g = newGame("pvp", GOLD, 2);
      for (const m of moves) {
        const om = fromMove(m);
        expect(A.seatToAct(s)).toBe(s.turn === GOLD ? "gold" : "white");
        expect(A.result(s)).toBeNull();
        expect(A.legal(s, om)).toBe(true);
        s = A.apply(s, om);
        g = doMove(g, m);
        expect(s).toEqual(g.state);
      }
      // Through JSON, as the store keeps it.
      const doc = JSON.parse(JSON.stringify({ options: {}, moves: moves.map(fromMove) })) as { options: object; moves: OnlineMove[] };
      const r = replay(A, doc);
      expect(r.illegalAt).toBeNull();
      expect(r.s).toEqual(end);
      expect(A.seatToAct(r.s)).toBeNull();
      const res = A.result(r.s)!;
      expect(res.winner).toBe(end.winner === 0 ? null : end.winner === GOLD ? "gold" : "white");
      // Same words as the page's own status line.
      const page = statusText({ ...g, state: end }, false).text;
      if (end.winner === 0) expect(page).toBe(`${res.text} A draw.`);
      else expect(page.replace(" wins:", "")).toBe(res.text);
      expect(historyOf(doc.moves).map(h => h.note)).toEqual(g.history.map(h => h.note));
    }
    expect(reasons).toContain("reduced");
  });

  it("calls the quiet-move draw and the quiet-move win", () => {
    // Shuffle back and forth: 30 quiet moves with five pieces each is a draw.
    let s = A.start({});
    const shuffle: Move[] = [[fromSq("a1"), fromSq("a2")], [fromSq("a5"), fromSq("a4")], [fromSq("a2"), fromSq("a1")], [fromSq("a4"), fromSq("a5")]];
    for (let k = 0; k < 30; k++) {
      expect(A.result(s)).toBeNull();
      s = A.apply(s, fromMove(shuffle[k % 4]));
    }
    expect(A.result(s)).toEqual({ winner: null, text: "30 quiet moves with equal pieces." });
    expect(A.seatToAct(s)).toBeNull();
    expect(A.legal(s, fromMove(shuffle[2]))).toBe(false);

    const t = { ...s, winner: WHITE, reason: "quiet" } as State;
    expect(A.result(t)).toEqual({ winner: "white", text: "White held more pieces after 30 quiet moves." });
  });

  it("refuses illegal and malformed moves", () => {
    const s = A.start({});
    expect(A.legal(s, { f: fromSq("a1"), t: fromSq("a2") })).toBe(true);
    expect(A.legal(s, { f: fromSq("a5"), t: fromSq("a4") })).toBe(false); // White's peg on Gold's turn
    expect(A.legal(s, { f: fromSq("a1"), t: fromSq("b2") })).toBe(false); // diagonal
    expect(A.legal(s, { f: fromSq("a1"), t: fromSq("b1") })).toBe(false); // onto a peg
    expect(A.legal(s, { f: fromSq("c3"), t: fromSq("c4") })).toBe(false); // empty square
    for (const bad of [null, 7, [20, 15], { f: 20 }, { f: "20", t: 15 }, { f: 20.5, t: 15 }, { f: -1, t: 15 }, { f: 20, t: 25 }]) {
      expect(A.legal(s, bad as unknown as OnlineMove)).toBe(false);
    }
  });

  it("replay() stops at the first bad move", () => {
    const { moves } = selfPlay(3, "random");
    const good = moves.slice(0, 6).map(fromMove);
    const bad = [...good, { f: 0, t: 24 }, ...moves.slice(6, 9).map(fromMove)];
    const r = replay(A, { options: {}, moves: bad });
    expect(r.illegalAt).toBe(6);
    expect(r.s).toEqual(replay(A, { options: {}, moves: good }).s);
    expect(historyOf(bad)).toHaveLength(6);
    // A move after the game is over is refused too.
    const { moves: all } = selfPlay(5, "random");
    const over = replay(A, { options: {}, moves: [...all.map(fromMove), fromMove(all[0])] });
    expect(over.illegalAt).toBe(all.length);
  });
});
