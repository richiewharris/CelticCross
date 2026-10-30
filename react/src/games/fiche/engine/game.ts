// Match and round state, and the pure steps between them: pick a die, land it, next round.
import { ALL, DICE, bit, landing, type Die, type Rng } from "./dice";
import { chanceOf, keepChance, rerollChance } from "./odds";

export type Player = 1 | 2;
export type Mode = "cpu" | "pvp";
export type Level = 1 | 2 | 3;
export type Best = 3 | 5;
export type Ending = "win" | "bust" | "nine" | "draw" | "spent";

/** A roll; `void` marks a three that was rerolled (it no longer counts). */
export interface Roll { p: Player; d: Die; v: number; seed: number; void?: boolean }
export interface RoundOver { winner: 0 | Player; text: string; why: Ending }
export interface Round {
  total: number;
  hands: Record<Player, number>;
  turn: Player;
  /** The die that must be rolled again (a three or a 7 with no other die left), or -1. */
  forced: number;
  /** A die showing a three that hasn't counted yet: its roller may reroll it (the new roll replaces
   *  the three) or keep it (it counts, and they roll again). -1 when there is none. */
  held: number;
  rolls: Roll[];
  over: RoundOver | null;
  /** Whoever rolled last; they start the next round. */
  last: Player;
  msg: string;
  kind: "" | "again" | "win" | "lose";
}
export interface LogLine { p?: Player; e?: boolean; text: string }
export interface Match {
  mode: Mode; lvl: Level; best: Best;
  wins: Record<Player, number>; draws: number; round: number;
  log: LogLine[];
  /** The match winner, or 0 while it runs. */
  over: 0 | Player;
}
export interface Game { M: Match; R: Round }
export interface Settings { mode: Mode; lvl: Level; best: Best }
export const DEFAULT_SETTINGS: Settings = { mode: "cpu", lvl: 2, best: 3 };

export const other = (p: Player): Player => (p === 1 ? 2 : 1);
export const need = (M: Match) => Math.ceil(M.best / 2);
export const isHuman = (M: Match, p: Player) => M.mode === "pvp" || p === 1;
export const nameOf = (M: Match, p: Player) => (M.mode === "pvp" ? `Player ${p}` : p === 1 ? "You" : "Rival");
/** "You roll" but "Rival rolls" / "Player 1 rolls". */
export const verb = (M: Match, p: Player, a: string, b: string) => (M.mode === "cpu" && p === 1 ? a : b);
const lower = (d: number) => DICE[d].name.toLowerCase();

export function newRound(starter: Player): Round {
  return { total: 0, hands: { 1: ALL, 2: ALL }, turn: starter, forced: -1, held: -1, rolls: [], over: null, last: starter, msg: "", kind: "" };
}

export function newMatch(st: Settings, rng: Rng): Game {
  const M: Match = { mode: st.mode, lvl: st.lvl, best: st.best, wins: { 1: 0, 2: 0 }, draws: 0, round: 1, log: [], over: 0 };
  const R = newRound(rng() < 0.5 ? 1 : 2);
  R.msg = `${nameOf(M, R.turn)} ${verb(M, R.turn, "won", "wins")} the toss and ${verb(M, R.turn, "roll", "rolls")} first.`;
  return { M, R };
}

/** After a round, the next one; whoever rolled last starts. */
export function nextRound(g: Game): Game {
  return { M: { ...g.M, round: g.M.round + 1 }, R: newRound(g.R.last) };
}

export const live = (g: Game) => !g.R.over && !g.M.over;

/** The die the player to move actually rolls if they pick d (a forced die overrides), or null if d is not theirs to roll. */
export function legalDie(g: Game, d: Die): Die | null {
  if (!live(g)) return null;
  if (g.R.held >= 0) return d === g.R.held ? d : null;
  if (g.R.forced >= 0) return g.R.forced as Die;
  return g.R.hands[g.R.turn] & bit(d) ? d : null;
}

/** The die leaves the hand (a forced roll or a reroll uses the die already spent). */
export function takeDie(g: Game, d: Die): Game {
  if (g.R.forced >= 0 || g.R.held >= 0) return g;
  const p = g.R.turn;
  return { ...g, R: { ...g.R, hands: { ...g.R.hands, [p]: g.R.hands[p] & ~bit(d) } } };
}

/** The rolled die comes to rest showing v. Call after takeDie. Rolling the held die rerolls it:
 *  the three is struck out and the new roll takes its place. */
export function land(g: Game, d: Die, v: number, seed: number): Game {
  const M: Match = { ...g.M, wins: { ...g.M.wins }, log: [...g.M.log] };
  const R: Round = { ...g.R, hands: { ...g.R.hands }, rolls: [...g.R.rolls] };
  const p = R.turn;
  if (R.held >= 0) {
    for (let i = R.rolls.length - 1; i >= 0; i--) if (R.rolls[i].p === p && !R.rolls[i].void) { R.rolls[i] = { ...R.rolls[i], void: true }; break; }
    R.held = -1;
  }
  R.rolls.push({ p, d, v, seed });
  R.last = p;
  R.forced = -1;
  // A three that doesn't land exactly on 20 waits: reroll it, or keep it.
  if (v === 3 && R.total + 3 !== 20) {
    R.held = d;
    const me = nameOf(M, p), then = landing(R.total + 3, 3);
    const keep = then === "bust" ? `keep it and go over 20` : then === "nine" ? "keep it and land on 9" : then === "draw" ? "keep it and draw at 12" : "keep it and roll again";
    R.msg = `A three on the ${lower(d)}. ${me} can reroll the ${lower(d)}, or ${keep}.`;
    R.kind = "again";
    M.log.push({ p, text: `${DICE[d].name} 3 (${R.total} → ${R.total + 3}?)` });
    return { M, R };
  }
  R.total += v;
  M.log.push({ p, text: `${DICE[d].name} ${v} → ${R.total}` });
  return resolve(M, R, d, v);
}

/** Keep the held three: it counts, and the total lands as usual (a three rolls again). */
export function keepHeld(g: Game): Game {
  if (!live(g) || g.R.held < 0) return g;
  const M: Match = { ...g.M, wins: { ...g.M.wins }, log: [...g.M.log] };
  const R: Round = { ...g.R, hands: { ...g.R.hands }, rolls: [...g.R.rolls] };
  const d = R.held as Die;
  R.held = -1;
  R.total += 3;
  M.log.push({ p: R.turn, text: `keeps the 3 → ${R.total}` });
  return resolve(M, R, d, 3);
}

function resolve(M: Match, R: Round, d: Die, v: number): Game {
  const p = R.turn;
  const what = landing(R.total, v), o = other(p), me = nameOf(M, p), them = nameOf(M, o);
  const end = (winner: 0 | Player, text: string, why: Ending) => endRound(M, R, winner, text, why);
  if (what === "win") end(p, `${me} ${verb(M, p, "land", "lands")} on 20 and ${verb(M, p, "take", "takes")} the round!`, "win");
  else if (what === "bust") end(o, `${R.total}. ${me} ${verb(M, p, "go", "goes")} over 20 and ${verb(M, p, "lose", "loses")} the round.`, "bust");
  else if (what === "nine") end(o, `Nine! ${them} ${verb(M, o, "take", "takes")} the round.`, "nine");
  else if (what === "draw") end(0, "Twelve. The round is drawn.", "draw");
  else if (what === "again") {
    const why = v === 3 && R.total === 7 ? "A three, and the total is 7" : v === 3 ? `A three on the ${lower(d)}` : "The total lands on 7";
    if (!R.hands[p]) {
      R.forced = d;
      R.msg = `${why}. ${me} ${verb(M, p, "roll", "rolls")} again with the same ${lower(d)}.`;
    } else R.msg = `${why}. ${me} ${verb(M, p, "roll", "rolls")} again.`;
    R.kind = "again";
    M.log.push({ e: true, text: R.msg });
  } else {
    R.kind = "";
    if (R.hands[o]) { R.turn = o; R.msg = ""; }
    else if (R.hands[p]) R.msg = `${them} ${verb(M, o, "have", "has")} no dice left, so ${me.toLowerCase() === "you" ? "you" : me} ${verb(M, p, "keep", "keeps")} rolling.`;
    else end(0, `All six dice are spent at ${R.total}. The round is drawn.`, "spent");
  }
  return { M, R };
}

function endRound(M: Match, R: Round, winner: 0 | Player, text: string, why: Ending) {
  R.over = { winner, text, why };
  R.msg = text;
  R.kind = winner === 0 ? "" : M.mode === "cpu" ? (winner === 1 ? "win" : "lose") : "win";
  if (winner) M.wins[winner]++; else M.draws++;
  M.log.push({ e: true, text });
  M.over = M.wins[1] >= need(M) ? 1 : M.wins[2] >= need(M) ? 2 : 0;
}

/** Pick d (or the held die, to reroll it), roll it with the given result. d must be legal (see legalDie). */
export function applyRoll(g: Game, d: Die, v: number, seed = 0.5): Game {
  return land(takeDie(g, d), d, v, seed);
}

/** The coach: each die's chance of taking the round for the player to move, or null if it can't be
 *  rolled. With a three held, only the held die (a reroll) has a chance; see keepOdds for keeping. */
export function diceOdds(R: Round): (number | null)[] {
  const p = R.turn, hp = R.hands[p], ho = R.hands[other(p)];
  if (R.held >= 0) return ([0, 1, 2] as Die[]).map(d => (d === R.held ? rerollChance(R.total, hp, ho, d) : null));
  return ([0, 1, 2] as Die[]).map(d => (hp & bit(d) || R.forced === d ? chanceOf(R.total, hp, ho, d, R.forced) : null));
}

/** The coach's chance of taking the round by keeping the held three, or null when none is held. */
export function keepOdds(R: Round): number | null {
  if (R.held < 0) return null;
  const p = R.turn;
  return keepChance(R.total, R.hands[p], R.hands[other(p)], R.held as Die);
}
