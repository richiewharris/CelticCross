// The combining variant: the Host's Phalanx and the Sí merging two Riders into a Chariot.
import { describe, expect, it } from "vitest";
import { LEVELS, cpuPlace, cpuWantsPhalanx, search } from "./ai";
import { cpuSetupChoice } from "./cpu";
import {
  actor, currentSlot, moveNote, newGame, phalanxOffer, placePiece, playMove, rulesOf, seenMap,
  totalPlacements, trayChoices, undo, type Game,
} from "./game";
import { reviewGame } from "./review";
import {
  CH, EMPTY, LO, PH, RI, SP, SUMMIT, apply, count, emptyBoard, gen, immediateWin, isMerge, key, mv, presence, sideOf,
  type Piece, type Rules, type Side,
} from "./rules";
import { slotZone, zoneOk } from "./setup";
import { at, pos } from "./testkit";

const R7: Rules = { holdN: 7 };
const C7: Rules = { holdN: 7, combine: true };
const has = (ms: number[], f: string, t: string) => ms.includes(mv(at(f), at(t)));
const freeHole = (g: Game) => [...Array(49).keys()].find(i => !g.s.b[i] && slotZone(currentSlot(g), i))!;

describe("sideOf", () => {
  it("names the side of every piece", () => {
    const want: [Piece, Side][] = [[SP, 0], [LO, 0], [PH, 0], [RI, 1], [CH, 1]];
    for (const [p, s] of want) expect(sideOf(p)).toBe(s);
  });
});

describe("the Phalanx", () => {
  it("steps one hole in any of the 8 directions", () => {
    const s = pos([".......", ".......", ".......", ".......", ".......", "..P....", "......L"]);
    const ms = gen(s).filter(m => m >> 6 === at("c2"));
    expect(ms).toHaveLength(8);
    for (const t of ["b1", "c1", "d1", "b2", "d2", "b3", "c3", "d3"]) expect(has(ms, "c2", t)).toBe(true);
  });
  it("is blocked by its own pieces and takes by moving onto a Sí piece", () => {
    const s = pos([".......", ".......", ".......", ".......", ".R.....", "S.P....", "......L"]);
    const ms = gen(s).filter(m => m >> 6 === at("c2"));
    expect(has(ms, "c2", "b3")).toBe(true);
    const t = apply(s, mv(at("c2"), at("b3")), R7);
    expect(t.b[at("b3")]).toBe(PH);
    expect(t.b[at("c2")]).toBe(EMPTY);
    expect(t).toMatchObject({ res: 1, why: "wipe" }); // that was the last Sí piece
  });
  it("counts as Host presence on the summit and resets the hold", () => {
    const s = pos([".......", ".......", "...R...", "..P....", ".......", ".......", "L......"], 0, 5);
    const t = apply(s, mv(at("c4"), at("d4")), R7);
    expect(presence(t.b, 0)).toBe(true);
    expect(t.hold).toBe(0);
  });
  it("does not stop the Lord climbing (only Sí pieces on the summit do)", () => {
    const s = pos([".......", ".......", "...P...", ".......", "..L....", ".......", "......."]);
    expect(has(gen(s), "c3", "d4")).toBe(true);
  });
  it("can be taken, and taking it isn't a Lord or wipe win", () => {
    const s = pos([".......", ".......", ".......", ".......", "..P....", ".R.....", "......L"], 1);
    const t = apply(s, mv(at("b2"), at("c3")), R7);
    expect(t.b[at("c3")]).toBe(RI);
    expect(t.res).toBe(0);
  });
});

describe("own setup with the Phalanx", () => {
  it("is offered only in the variant, on Host turns, while 3 Spearmen are left", () => {
    expect(trayChoices(newGame())).not.toContain(PH);
    const g = newGame({ combine: true });
    expect(phalanxOffer(g)).toBe(true);
    expect(trayChoices(g)).toEqual(expect.arrayContaining([SP, LO, PH]));
    const g1 = placePiece(g, freeHole(g), SP);
    expect(actor(g1)).toBe(1);
    expect(phalanxOffer(g1)).toBe(false);
  });
  it("uses up 3 Spearmen, so the Host set 2 fewer pieces, and the order still alternates", () => {
    let g = newGame({ combine: true });
    g = placePiece(g, freeHole(g), PH);
    expect(g.trays[0][SP]).toBe(4);
    expect(totalPlacements(g)).toBe(11);
    expect(phalanxOffer(g)).toBe(false);
    const order: Side[] = [0];
    while (g.phase === "place") {
      order.push(actor(g));
      expect(trayChoices(g)).not.toContain(PH);
      g = placePiece(g, freeHole(g), trayChoices(g)[0]);
    }
    expect(order).toEqual([0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]);
    expect(g.placed).toBe(11);
    const b = g.s.b;
    expect(b.filter(p => p === PH)).toHaveLength(1);
    expect(b.filter(p => p === SP)).toHaveLength(4);
    expect(b.filter(p => p === LO)).toHaveLength(1);
    expect(b.filter(p => p === RI)).toHaveLength(4);
    expect(b.filter(p => p === CH)).toHaveLength(1);
  });
  it("can be taken late, but not once fewer than 3 Spearmen are left", () => {
    let g = newGame({ combine: true });
    // Host sets four Spearmen (3 left), the Sí alternate.
    for (let k = 0; k < 8; k++) g = placePiece(g, freeHole(g), actor(g) === 0 ? SP : RI);
    expect(g.trays[0][SP]).toBe(3);
    expect(phalanxOffer(g)).toBe(true);
    const late = placePiece(g, freeHole(g), PH);
    expect(late.trays[0][SP]).toBe(0);
    let h = late;
    while (h.phase === "place") h = placePiece(h, freeHole(h), trayChoices(h)[0]);
    expect(h.placed).toBe(11);
    // Without it: one more Spearman leaves 2, and the offer is gone for good.
    let n = placePiece(g, freeHole(g), SP);
    while (n.phase === "place") {
      expect(phalanxOffer(n)).toBe(false);
      n = placePiece(n, freeHole(n), trayChoices(n)[0]);
    }
    expect(n.placed).toBe(13);
    expect(n.s.b.includes(PH)).toBe(false);
  });
  it("is undone with the placement", () => {
    const g = newGame({ combine: true });
    const g1 = placePiece(g, freeHole(g), PH);
    const back = undo(g1);
    expect(back.trays[0][SP]).toBe(7);
    expect(phalanxOffer(back)).toBe(true);
  });
  it("without it, the variant's setup is the standard order", () => {
    let a = newGame(), b = newGame({ combine: true });
    while (a.phase === "place") {
      expect(actor(b)).toBe(actor(a));
      const p = trayChoices(a)[0], i = freeHole(a);
      a = placePiece(a, i, p); b = placePiece(b, i, p);
    }
    expect(b.phase).toBe("play");
    expect(b.s.b).toEqual(a.s.b);
  });
});

describe("rival's setup with the Phalanx", () => {
  it("is chosen with the Host's Lord; the Sí then set it among the Host's pieces", () => {
    let g = newGame({ swap: true, combine: true });
    expect(currentSlot(g)).toMatchObject({ o: 0, p: 0, k: LO });
    expect(phalanxOffer(g)).toBe(true);
    expect(trayChoices(g)).toEqual([LO]); // the choice rides on the Lord, it isn't a piece the Host set
    g = placePiece(g, freeHole(g), LO, true);
    expect(g.history[0].note).toMatch(/Phalanx/);
    expect(g.trays[0]).toMatchObject({ [SP]: 4, [PH]: 1, [LO]: 0 });
    expect(totalPlacements(g)).toBe(11);
    expect(phalanxOffer(g)).toBe(false);
    const slots: string[] = [];
    let sawPh = false;
    while (g.phase === "place") {
      const slot = currentSlot(g);
      slots.push(`${slot.p}${slot.o}`);
      const ch = trayChoices(g);
      if (slot.p === 1 && slot.o === 0 && ch.includes(PH)) sawPh = true;
      const piece = ch.includes(PH) ? PH : ch[0];
      g = placePiece(g, freeHole(g), piece);
    }
    expect(sawPh).toBe(true);
    // Sí Chariot, then Host-sets-Rider / Sí-sets-Host-piece in turn, then the last Host piece.
    expect(slots).toEqual(["11", "01", "10", "01", "10", "01", "10", "01", "10", "10"]);
    expect(g.placed).toBe(11);
    expect(g.s.b.filter(p => p === PH)).toHaveLength(1);
    expect(g.s.b.filter(p => p === SP)).toHaveLength(4);
    expect(SUMMIT[g.s.b.indexOf(CH)]).toBe(true);
    for (let i = 0; i < 49; i++) if (g.s.b[i] === PH) expect(zoneOk(0, i)).toBe(true);
  });
  it("declined, it is the standard rival's setup", () => {
    let g = newGame({ swap: true, combine: true });
    g = placePiece(g, freeHole(g), LO, false);
    while (g.phase === "place") g = placePiece(g, freeHole(g), trayChoices(g)[0]);
    expect(g.placed).toBe(13);
    expect(g.s.b.includes(PH)).toBe(false);
  });
  it("can't be asked for outside the variant or after the Lord", () => {
    const std = placePiece(newGame({ swap: true }), 0, LO, true);
    expect(std.trays[0][SP]).toBe(7);
    expect(std.trays[0][PH]).toBeUndefined();
  });
});

describe("merging Riders", () => {
  // Riders on d4 and e4 (summit), the Host Lord far away.
  const both = pos([".......", ".......", ".......", "...RR..", ".......", ".......", "L......"], 1);
  it("needs the variant", () => {
    expect(gen(both).some(m => isMerge(both.b, m))).toBe(false);
    expect(gen(both, C7).filter(m => isMerge(both.b, m))).toHaveLength(2);
  });
  it("puts one Chariot on the target hole and empties the other", () => {
    const m = mv(at("d4"), at("e4"));
    expect(gen(both, C7)).toContain(m);
    const t = apply(both, m, C7);
    expect(t.b[at("e4")]).toBe(CH);
    expect(t.b[at("d4")]).toBe(EMPTY);
    expect(t.b.filter(p => p === RI)).toHaveLength(0);
    expect(count(both.b, 1)).toBe(2);
    expect(count(t.b, 1)).toBe(1);
    expect(t.res).toBe(0);
    expect(moveNote(both, m)).toBe("R d4+e4=C");
  });
  it("works diagonally across the cross", () => {
    const s = pos([".......", ".......", "...R...", "..R....", ".......", ".......", "L......"], 1);
    expect(has(gen(s, C7), "c4", "d5")).toBe(true);
    expect(has(gen(s, C7), "d5", "c4")).toBe(true);
  });
  it("needs both Riders on the summit", () => {
    // d4 on the summit, e5 on the slope next to it.
    const s = pos([".......", ".......", "....R..", "...R...", ".......", ".......", "L......"], 1);
    expect(gen(s, C7).some(m => isMerge(s.b, m))).toBe(false);
  });
  it("needs them adjacent", () => {
    const s = pos([".......", ".......", ".......", "..R.R..", ".......", ".......", "L......"], 1);
    expect(gen(s, C7).some(m => isMerge(s.b, m))).toBe(false);
  });
  it("only while the Sí have no Chariot on the board", () => {
    const s = pos([".......", ".......", ".......", "...RR..", ".......", "C......", "L......"], 1);
    expect(gen(s, C7).some(m => isMerge(s.b, m))).toBe(false);
  });
  it("is only for Riders: Host pieces never merge", () => {
    const s = pos([".......", ".......", ".......", "...PP..", ".......", ".......", "L......"]);
    expect(gen(s, C7).some(m => s.b[m & 63] === PH)).toBe(false);
  });
  it("keeps Sí presence on the summit and counts toward the hold", () => {
    const s = { ...both, hold: 6 };
    expect(apply(s, mv(at("d4"), at("e4")), C7)).toMatchObject({ res: 2, why: "hold" });
  });
  it("is played and logged through the game", () => {
    const g: Game = { ...newGame({ combine: true }), s: both, phase: "play", placed: 13 };
    const g1 = playMove(g, mv(at("d4"), at("e4")));
    expect(g1.history.at(-1)!.note).toBe("R d4+e4=C");
    expect(g1.s.b[at("e4")]).toBe(CH);
    // the new Chariot can't merge again
    expect(gen({ ...g1.s, turn: 1 }, rulesOf(g1)).some(m => isMerge(g1.s.b, m))).toBe(false);
  });
});

describe("repetition", () => {
  it("counts the Phalanx as 3 pieces and a merged Chariot as 1", () => {
    const b = emptyBoard(); b[0] = PH; b[1] = LO; b[2] = CH; b[3] = RI;
    expect(count(b, 0)).toBe(4);
    expect(count(b, 1)).toBe(2);
  });
  it("a third repetition goes to the side with fewer pieces, the Phalanx counting 3", () => {
    // Host: Phalanx + Lord = 4. Sí: 3 Riders = 3. The Sí have fewer, so the Sí win it.
    const s = pos([".......", ".R...R.", ".......", ".......", ".......", ".....R.", "P.....L"]);
    let g: Game = { ...newGame({ combine: true }), s, phase: "play", placed: 11 };
    const cycle = [mv(at("a1"), at("a2")), mv(at("f6"), at("e5")), mv(at("a2"), at("a1")), mv(at("e5"), at("f6"))];
    for (let k = 0; k < 8 && g.winner === null; k++) g = playMove(g, cycle[k % 4]);
    expect(g.why).toBe("repeat");
    expect(g.winner).toBe(1);
    expect(seenMap(g).get(key(g.s))).toBe(3);
  });
});

describe("the computer with the new pieces", () => {
  const opts = { depth: 4, ms: 2000, noise: 0 };
  it("takes the last Sí piece with the Phalanx's diagonal step", () => {
    const s = pos([".......", ".......", ".......", ".......", ".R.....", "S.P....", "......L"]);
    const m = search(s, opts, new Map(), C7)!;
    expect(m).toBe(mv(at("c2"), at("b3")));
  });
  it("takes a Phalanx off the summit to finish the hold", () => {
    const s = pos([".......", ".......", "..R....", "...P...", ".......", ".R.....", "......L"], 1, 6);
    const m = search(s, opts, new Map(), C7)!;
    expect(m).toBe(mv(at("c5"), at("d4")));
    expect(immediateWin(s, m, C7)).toBe(true);
  });
  it("searches merges: with only merges and losing moves, it merges", () => {
    // Riders d4 and e4; every other Sí piece is gone, and the Host Phalanx on f5 / Spearman on f4 / c5 / c3
    // leave each plain Rider step walking into a take. A merge is a legal reply the search must consider.
    const s = pos([".......", ".......", "..S..P.", "...RRS.", "..S....", ".......", "L......"], 1);
    const merges = gen(s, C7).filter(m => isMerge(s.b, m));
    expect(merges).toHaveLength(2);
    const m = search(s, { depth: 3, ms: 2000, noise: 0 }, new Map(), C7)!;
    expect(gen(s, C7)).toContain(m);
  });
  it("judges the Phalanx: the High King always decides the same way, the Novice varies", () => {
    const g = newGame({ combine: true }), slot = currentSlot(g), zone = (i: number) => slotZone(slot, i);
    const hk = new Set([0.1, 0.5, 0.9].map(r => cpuWantsPhalanx(g.s, false, 4, zone, rulesOf(g), () => r)));
    expect(hk.size).toBe(1);
    const nov = new Set([0.01, 0.99].map(r => cpuWantsPhalanx(g.s, false, 1, zone, rulesOf(g), () => r)));
    expect(nov.size).toBe(2);
  });
  it("sets up a whole variant game by itself, in both setups", () => {
    for (const swap of [false, true]) {
      let g = newGame({ combine: true, swap });
      while (g.phase === "place") {
        const slot = currentSlot(g), { piece, takePhalanx } = cpuSetupChoice(g, 2);
        g = placePiece(g, cpuPlace(g.s, slot.o, piece, 2, slot.o !== slot.p, i => slotZone(slot, i), rulesOf(g)), piece, takePhalanx);
      }
      expect(g.placed === 11 || g.placed === 13).toBe(true);
      expect(g.s.b.filter(p => p === PH).length).toBe(g.placed === 11 ? 1 : 0);
    }
  });
});

describe("review of a variant game", () => {
  it("grades every placement and move, the Phalanx and merges included", () => {
    let g = newGame({ combine: true });
    g = placePiece(g, freeHole(g), PH);
    while (g.phase === "place") {
      const holes = [...Array(49).keys()].filter(i => !g.s.b[i] && slotZone(currentSlot(g), i));
      g = placePiece(g, holes[(g.placed * 5) % holes.length], trayChoices(g)[0]);
    }
    for (let t = 0; t < 160 && g.winner === null; t++) {
      const lv = g.s.turn === 0 ? { ...LEVELS[3], ms: 120, noise: 0 } : { ...LEVELS[1], ms: 40 };
      g = playMove(g, search(g.s, lv, seenMap(g), rulesOf(g))!);
    }
    const list = reviewGame(g, 80);
    expect(list.every(e => e.q)).toBe(true);
    expect(list.some(e => e.kind === "place" && e.piece === PH)).toBe(true);
    expect(list.filter(e => e.kind === "place")).toHaveLength(11);
  });
});

// ---- Standard games are untouched ----

describe("standard Cnoc is unchanged", () => {
  it("gen() is identical with the flag off or absent", () => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    for (let n = 0; n < 10; n++) {
      let g = newGame();
      while (g.phase === "place") {
        const ch = trayChoices(g), holes = [...Array(49).keys()].filter(i => !g.s.b[i] && slotZone(currentSlot(g), i));
        g = placePiece(g, holes[(rnd() * holes.length) | 0], ch[(rnd() * ch.length) | 0]);
      }
      for (let t = 0; t < 80 && g.winner === null; t++) {
        const a = gen(g.s);
        const off: Rules = { holdN: 7, combine: false };
        expect(gen(g.s, off)).toEqual(a);
        expect(gen(g.s, rulesOf(g))).toEqual(a);
        g = playMove(g, a[(rnd() * a.length) | 0]);
      }
    }
    expect(rulesOf(newGame())).toEqual({ holdN: 7 });
    expect("combine" in newGame()).toBe(false);
  });

  // A fingerprint of gen, apply, key, count, evalHost, placeScore and whole random games (both setups),
  // recorded from the engine before the variant was added.
  it("matches the engine fingerprint from before the variant", async () => {
    const { evalHost, placeScore } = await import("./ai");
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x80000000);
    let h = 0;
    const mix = (s: string) => { for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0; };
    for (const swap of [false, true]) for (let n = 0; n < 40; n++) {
      let g: Game = newGame({ swap });
      while (g.phase === "place") {
        const slot = currentSlot(g), ch = trayChoices(g), piece = ch[(rnd() * ch.length) | 0];
        const holes = [...Array(49).keys()].filter(i => !g.s.b[i] && slotZone(slot, i));
        mix(String(placeScore(g.s, slot.o, piece, holes[0], rulesOf(g))));
        g = placePiece(g, holes[(rnd() * holes.length) | 0], piece);
      }
      for (let t = 0; t < 120 && g.winner === null; t++) {
        const ms = gen(g.s); mix(ms.join(","));
        for (const m of ms) { const a = apply(g.s, m, rulesOf(g)); mix(key(a) + a.res + a.why); }
        mix(String(evalHost(g.s, rulesOf(g))) + count(g.s.b, 0) + count(g.s.b, 1) + seenMap(g).size);
        g = playMove(g, ms[(rnd() * ms.length) | 0]);
      }
      mix(String(g.winner) + g.why);
    }
    expect(h).toBe(-1620685045);
  });

  it("standard rules never offer the Phalanx or a merge", () => {
    expect(cpuSetupChoice(newGame(), 4).piece).not.toBe(PH);
    const s = pos([".......", ".......", ".......", "...RR..", ".......", ".......", "L......"], 1);
    expect(gen(s, R7).some(m => isMerge(s.b, m))).toBe(false);
  });
});
