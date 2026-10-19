// The flow of a game: rolls landing, moves, toasts and treason, with the page's notes and roll log.
// Pure functions from one Game record to the next; the hook adds the timers and the dice spin.
import { type Level } from "./ai";
import {
  JUG, NAME, PASS, at, d6, legalNow, move, N, MID, newState, other, QUIET_LIMIT, passTurn, rollAgain, rollOutcome, sq, toast, treason, withDice,
  type Rng, type Side, type State,
} from "./rules";

export type Mode = "cpu" | "pvp";
export type Turns = "tablero" | "one";
export type NoteKind = "" | "warn" | "queen";
export interface LogEntry { who: string; text: string }
export interface Settings { mode: Mode; side: Side; lvl: Level; turns: Turns }
export interface Game extends Settings {
  state: State;
  note: string;
  noteKind: NoteKind;
  log: LogEntry[];
  /** The current roll's log line while its moves are being made. */
  pendingLog: string | null;
  /** Friend mode: the wronged rival is choosing which of the traitor's cups to drink. */
  treasonPick: boolean;
  /** A pass or a dead roll is on show before the dice go across. */
  wait: "pass" | null;
  /** Changes with every new game (so the board starts from fresh pieces). */
  nonce: number;
}

export const DEFAULT_SETTINGS: Settings = { mode: "cpu", side: 1, lvl: 2, turns: "tablero" };
export const START_CURSOR = at(N - 1, MID);

export function newGame(st: Settings, rng: Rng = Math.random, nonce = Date.now()): Game {
  const q = d6(rng) + d6(rng);
  return {
    ...st, state: newState(q), note: `The Queen rolls ${q}. That's the Queen's number for this game.`, noteKind: "queen",
    log: [], pendingLog: null, treasonPick: false, wait: null, nonce,
  };
}

export const isHuman = (g: Settings, side: Side) => g.mode === "pvp" || side === g.side;
export const over = (g: Game) => g.state.winner !== null;
const say = (g: Game, note: string, noteKind: NoteKind = ""): Game => ({ ...g, note, noteKind });
const addLog = (g: Game, text: string): Game => ({ ...g, log: [...g.log, { who: NAME[g.state.turn], text }] });
const finishLog = (g: Game): Game => (g.pendingLog ? { ...addLog(g, g.pendingLog.replace(/,$/, "")), pendingLog: null } : g);
const lower = (s: Side) => NAME[s].toLowerCase();

/** The dice land on `d`. */
export function land(g0: Game, d: [number, number]): Game {
  const sum = d[0] + d[1];
  let g: Game = { ...g0, state: withDice(g0.state, d) };
  const out = rollOutcome(g.state), turn = g.state.turn, who = NAME[turn];
  if (out === "queen") {
    g = addLog(g, `${sum}: the Queen's number`);
    return isHuman(g, turn)
      ? say(g, `${sum}, the Queen's number! Tap “To the Queen!”, then pick a ${lower(other(turn))} cup to drink.`, "queen")
      : say(g, `${who} rolled the Queen's number, ${sum}. “To the Queen!”`, "queen");
  }
  if (out === "pass" || out === "stuck") {
    g = addLog(g, out === "pass" ? `${sum}: pass` : `${d[0]}+${d[1]}: no move`);
    g = say(g, out === "pass"
      ? `${who} rolled ${sum}, a pass number. The dice go to ${lower(other(turn))}.`
      : `${who} rolled ${d[0]} and ${d[1]}. No cup can move that far, so the turn ends.`, "warn");
    return { ...g, wait: "pass" };
  }
  g = { ...g, pendingLog: `${d[0]}+${d[1]}:` };
  return say(g, isHuman(g, turn) ? `${d[0]} and ${d[1]}. Move a cup for each die, two different cups. You must use both if you can.` : "");
}

/** The pass (or dead roll) has been shown: the dice go across. */
export const endWait = (g: Game): Game => ({ ...say(g, ""), state: passTurn(g.state), wait: null });

/** After each single move: either another die waits, or this roll is done. */
export function settle(g: Game): Game {
  const s = g.state;
  if (over(g)) return finishLog(g);
  if (legalNow(s).length) return g;
  g = finishLog(g);
  if (g.turns === "one") return { ...say(g, ""), state: passTurn(s) };
  g = { ...g, state: rollAgain(s) };
  if (isHuman(g, g.state.turn)) g = say(g, g.note && /drinks|Sláinte/.test(g.note) ? g.note + " Roll again." : "Roll again.", g.noteKind);
  return g;
}

/** Move the cup on `from` to `to` with die `k`. */
export function playStep(g: Game, k: number, from: number, to: number): Game {
  const before = g.state;
  const r = move(before, k, from, to);
  g = { ...g, state: r.s, pendingLog: (g.pendingLog || "") + ` ${sq(from)}${r.caps.length ? "×" : "–"}${sq(to)},` };
  if (r.caps.length) {
    g = say(g, `${NAME[before.turn]} drinks ${r.caps.length === 1 ? "a cup" : r.caps.length + " cups"} of ${lower(other(before.turn))}. Sláinte!`, "queen");
  } else if (isHuman(g, before.turn)) g = say(g, legalNow(g.state).length ? "Now move a different cup with the other die." : "", "");
  return settle(g);
}

/** “To the Queen!”: the roller drinks the rival cup on `target`. */
export function playToast(g: Game, target: number): Game {
  const s = g.state;
  if (!s.dice) return g;
  const sum = s.dice[0] + s.dice[1];
  g = addLog(g, `toasts the Queen, drinks ${sq(target)}`);
  g = { ...g, state: toast(s, target).s };
  return say(g, `“To the Queen!” ${NAME[s.turn]} drinks a cup of ${lower(other(s.turn))}.`
    + (over(g) ? "" : PASS.includes(sum) ? " That was also a pass number, so the dice go across." : isHuman(g, s.turn) ? " Roll again." : ""), "queen");
}

/** Against the computer: the player rolled on without toasting, and the computer drinks `victim`. */
export function treasonByComputer(g: Game, victim: number): Game {
  const s = g.state;
  g = addLog(g, "treason! rival drinks " + sq(victim));
  g = { ...g, state: treason(s, victim).s };
  return say(g, `Treason to the Queen! ${NAME[other(s.turn)]} drinks one of your cups.`, "warn");
}

/** Friend mode: rolling on without toasting lets the rival pick one of the roller's cups. */
export function startTreasonPick(g: Game): Game {
  const t = g.state.turn;
  return say({ ...g, treasonPick: true }, `Treason to the Queen! ${NAME[other(t)]}, tap one of ${lower(t)}'s cups to drink it.`, "warn");
}
export function treasonPicked(g: Game, i: number): Game {
  const s = g.state;
  if (!g.treasonPick || s.b[i] !== s.turn) return g;
  g = addLog(g, "treason! rival drinks " + sq(i));
  g = { ...g, state: treason(s, i).s, treasonPick: false };
  return say(g, `${NAME[other(s.turn)]} drinks for the Queen. Now roll.`, "warn");
}

/** The line above the board. */
export function statusLine(g: Game): { text: string; tone: "" | "win" | "lose" } {
  const s = g.state;
  if (s.winner !== null) {
    const w = s.winner;
    if (w === 0) return { text: `${QUIET_LIMIT} quiet moves and both sides drank the same. A draw.`, tone: "" };
    const skunk = s.jug[w] === JUG ? " A skunk!" : "";
    const text = s.reason === "dry" ? `${NAME[w]} wins. ${NAME[other(w)]}'s jug ran dry.${skunk}` : `${NAME[w]} wins, having drunk more after ${QUIET_LIMIT} quiet moves.${skunk}`;
    return { text, tone: g.mode === "cpu" ? (w === g.side ? "win" : "lose") : "" };
  }
  if (g.mode === "cpu") return { text: s.turn === g.side ? `Your turn (${NAME[g.side]})` : "The computer's turn", tone: "" };
  return { text: `${NAME[s.turn]}'s turn`, tone: "" };
}

/** A saved game we can trust. */
export function isGame(v: unknown): v is Game {
  const g = v as Game | null;
  return !!g && typeof g === "object" && !!g.state && Array.isArray(g.state.b) && g.state.b.length === N * N && Array.isArray(g.log);
}
