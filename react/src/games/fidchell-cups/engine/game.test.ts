import { describe, expect, it } from "vitest";
import {
  DEFAULT_SETTINGS, endWait, isGame, land, newGame, playStep, playToast, startTreasonPick, statusLine, treasonByComputer, treasonPicked,
  type Game, type Settings,
} from "./game";
import { MEAD, WINE } from "./rules";
import { at, dice, pos } from "./testkit";

const fresh = (st: Partial<Settings> = {}, queen = 8): Game => newGame({ ...DEFAULT_SETTINGS, ...st }, dice(queen - 4, 4), 1);

describe("a game", () => {
  it("opens with the Queen's number rolled from the injected rng", () => {
    const g = newGame(DEFAULT_SETTINGS, dice(2, 5), 7);
    expect(g.state.queen).toBe(7);
    expect(g.note).toBe("The Queen rolls 7. That's the Queen's number for this game.");
    expect(g.noteKind).toBe("queen");
    expect(isGame(g)).toBe(true);
    expect(isGame({ state: { b: [] } })).toBe(false);
  });
  it("a pass number is logged, shown, then the dice go across", () => {
    let g = land(fresh(), [5, 6]);
    expect(g.wait).toBe("pass");
    expect(g.log).toEqual([{ who: "Mead", text: "11: pass" }]);
    expect(g.note).toBe("Mead rolled 11, a pass number. The dice go to wine.");
    g = endWait(g);
    expect(g.state.turn).toBe(WINE);
    expect(g.wait).toBeNull();
    expect(g.note).toBe("");
  });
  it("logs both moves of a roll on one line, then the roller rolls again", () => {
    let g = land(fresh({ mode: "pvp" }), [1, 2]);
    expect(g.note).toMatch(/^1 and 2\. Move a cup/);
    g = playStep(g, 0, at("d1"), at("d2"));
    expect(g.note).toBe("Now move a different cup with the other die.");
    g = playStep(g, 1, at("a1"), at("a3"));
    expect(g.log.at(-1)).toEqual({ who: "Mead", text: "1+2: d1–d2, a1–a3" });
    expect(g.state.turn).toBe(MEAD);
    expect(g.state.dice).toBeNull();
    expect(g.note).toBe("Roll again.");
  });
  it("with one roll a turn, the dice go across after the moves", () => {
    let g = land(fresh({ mode: "pvp", turns: "one" }), [1, 2]);
    g = playStep(playStep(g, 0, at("d1"), at("d2")), 1, at("a1"), at("a3"));
    expect(g.state.turn).toBe(WINE);
  });
  it("toasting the Queen drinks the chosen cup and says so", () => {
    let g = land(fresh({}, 6), [2, 4]);
    expect(g.state.queenPending).toBe(true);
    expect(g.log.at(-1)?.text).toBe("6: the Queen's number");
    g = playToast(g, at("c7"));
    expect(g.log.at(-1)?.text).toBe("toasts the Queen, drinks c7");
    expect(g.note).toBe("“To the Queen!” Mead drinks a cup of wine. Roll again.");
    expect(g.state.drinks[MEAD]).toBe(1);
  });
  it("against the computer, treason lets it drink one of the player's cups", () => {
    const g = treasonByComputer(land(fresh({}, 6), [3, 3]), at("a1"));
    expect(g.note).toBe("Treason to the Queen! Wine drinks one of your cups.");
    expect(g.state.drinks[WINE]).toBe(1);
    expect(g.state.turn).toBe(MEAD);
  });
  it("between friends, the rival picks a cup of the traitor's", () => {
    let g = startTreasonPick(land(fresh({ mode: "pvp" }, 6), [1, 5]));
    expect(g.note).toBe("Treason to the Queen! Wine, tap one of mead's cups to drink it.");
    expect(treasonPicked(g, at("a7"))).toBe(g); // a wine cup: not allowed
    g = treasonPicked(g, at("b1"));
    expect(g.treasonPick).toBe(false);
    expect(g.note).toBe("Wine drinks for the Queen. Now roll.");
    expect(g.log.at(-1)).toEqual({ who: "Mead", text: "treason! rival drinks b1" });
  });
  it("names the winner, the reason and a skunk", () => {
    const g = fresh();
    const won = { ...g, state: { ...pos([".......", ".......", ".......", ".......", ".......", ".......", "M......"]), winner: MEAD as 1, reason: "dry" as const } };
    expect(statusLine(won)).toEqual({ text: "Mead wins. Wine's jug ran dry. A skunk!", tone: "win" });
    const lost = { ...won, side: WINE as 2, state: { ...won.state, jug: { 1: 2, 2: 0 }, reason: "quiet" as const } };
    expect(statusLine(lost)).toEqual({ text: "Mead wins, having drunk more after 60 quiet moves.", tone: "lose" });
    expect(statusLine({ ...won, state: { ...won.state, winner: 0 } }).text).toBe("60 quiet moves and both sides drank the same. A draw.");
    expect(statusLine(g).text).toBe("Your turn (Mead)");
    expect(statusLine({ ...g, mode: "pvp" }).text).toBe("Mead's turn");
  });
});
