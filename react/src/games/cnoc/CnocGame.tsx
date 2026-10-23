// Cnoc: the whole page, composed from the board, the panels and two hooks
// (usePlayGame for real games, usePuzzles for the trainer).
import { useEffect, useRef, useState } from "react";
import { Segmented } from "../../kit/Segmented";
import { useStoredState } from "../../kit/useStoredState";
import { currentSlot, defaultPiece, phalanxOffer, phalanxTaken, rulesOf, totalPlacements, trayChoices, type Game } from "./engine/game";
import {
  CH, LO, PH, RI, SP, SUMMIT, from, gen, isMerge, presence, sideName, sideOf, to,
  type Piece, type Rules, type Side, type State,
} from "./engine/rules";
import { effectiveHold, slotZone } from "./engine/setup";
import { Board, type Mark } from "./components/Board";
import { HoldStones } from "./components/HoldStones";
import { MoveLog } from "./components/MoveLog";
import { PlayPanel, type Opponent } from "./components/PlayPanel";
import { PuzzlePanel } from "./components/PuzzlePanel";
import { ResultDialog } from "./components/ResultDialog";
import { ReviewPanel } from "./components/ReviewPanel";
import { RulesPanel } from "./components/RulesPanel";
import { Tray } from "./components/Tray";
import { usePlayGame } from "./usePlayGame";
import { usePuzzles } from "./usePuzzles";
import { useOnlineCnoc } from "./useOnlineCnoc";
import { cnocOnline, sideOfSeat, type CnocOptions } from "./online";
import { OnlinePanel } from "../../online/OnlinePanel";
import { leaveOnline } from "../../online/route";
import { why } from "./text";

type Tab = "play" | "puzzles";

function moveMarks(s: State, sel: number | null, rules?: Rules): Map<number, Mark> {
  const marks = new Map<number, Mark>();
  if (sel === null) return marks;
  for (const m of gen(s, rules)) {
    if (from(m) !== sel) continue;
    const t = to(m);
    marks.set(t, isMerge(s.b, m) ? "merge" : s.b[t] ? "cap" : s.b[sel] === LO && SUMMIT[t] ? "win" : "go");
  }
  return marks;
}

const MERGE_HINT = "Two Riders on the summit can merge into a Chariot.";
const canMerge = (s: State, rules?: Rules) => !!rules?.combine && s.turn === 1 && gen(s, rules).some(m => isMerge(s.b, m));

function selHint(s: State, sel: number, rules?: Rules) {
  if (s.b[sel] === LO && presence(s.b, 1)) return "The Lord can't climb onto the summit while a Sí piece stands on it.";
  if (rules?.combine && gen(s, rules).some(m => from(m) === sel && isMerge(s.b, m)))
    return `${MERGE_HINT} Tap the double silver ring to merge them there; a dot to move. Tap the Rider again to let go.`;
  return "Tap a dot to move, a red ring to take. Tap the piece again to let go.";
}

export function CnocGame() {
  const [tab, setTab] = useStoredState<Tab>("cnoc-react-tab", "play");
  const ol = useOnlineCnoc(), session = ol.session;
  const inGame = session.id !== null;
  // "Online" chosen as the opponent, before an invite is made (an invite link opens it by itself).
  const [onlineView, setOnlineView] = useState(false);
  const online = inGame || onlineView;
  const play = usePlayGame(tab === "play", online);
  const puz = usePuzzles(tab === "puzzles");
  const [pzSel, setPzSel] = useState<number | null>(null);
  const { settings, review } = play;
  const [onlineOpts, setOnlineOpts] = useStoredState<CnocOptions>("cnoc-react-online-options",
    () => ({ holdN: settings.holdN, swap: settings.swap, combine: !!settings.combine }));

  // An invite link opens the Play tab; leaving an online game goes back to the game on this device.
  useEffect(() => { if (inGame) setTab("play"); else setOnlineView(false); }, [inGame]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopReview = play.stopReview;
  useEffect(() => { stopReview(); }, [online, session.id, stopReview]);

  // The online result dialog: opens when a game being watched ends, not when a finished game is opened.
  const [olResultOpen, setOlResultOpen] = useState(false);
  const prevStatus = useRef<string | null>(null);
  useEffect(() => { setOlResultOpen(false); prevStatus.current = null; }, [session.id]);
  useEffect(() => {
    const st = session.doc?.status ?? null;
    if (prevStatus.current === "active" && st === "done") setOlResultOpen(true);
    prevStatus.current = st;
  }, [session.doc?.status]);

  // The game on the board: the online one (replayed from its moves) or the one on this device.
  const og: Game | null = online ? session.s ?? cnocOnline.start(session.doc?.options ?? onlineOpts) : null;
  const g: Game = og ?? play.g;
  const mySide = ol.mySide;
  const ctl = online
    ? { humanTurn: ol.canAct, sel: ol.sel, pick: ol.pick, setPick: ol.setPick, phx: ol.phx, setPhx: ol.setPhx, clickCell: ol.clickCell, thinking: false }
    : { humanTurn: play.humanTurn, sel: play.sel, pick: play.pick, setPick: play.setPick, phx: play.phx, setPhx: play.setPhx, clickCell: play.clickCell, thinking: play.thinking };
  const result = online ? session.doc?.result ?? null : null;
  const onlineDone = online && session.doc?.status === "done";

  // ---- What the board shows ----
  let s: State, marks = new Map<number, Mark>(), sel: number | null = null, last = g.last;
  let best = null, flash = null, hintSq: number | null = null, locked = true, holdOf = effectiveHold(g.holdN, g.swap);
  let status = "", statusTone = "", hint = "", onCell: (i: number) => void = () => {};

  if (tab === "puzzles") {
    const pz = puz.pz;
    s = pz ? pz.g.s : play.g.s;
    holdOf = 7;
    if (pz) {
      last = pz.g.last; flash = pz.flash; hintSq = pz.hintSq;
      status = pz.status; statusTone = pz.phase === "solved" ? "win" : pz.phase === "failed" ? "lose" : "";
      if (pz.phase === "solve") {
        locked = false; sel = pzSel; marks = moveMarks(s, pzSel);
        hint = pzSel !== null ? selHint(s, pzSel) : "Tap a piece to see where it can go.";
        onCell = i => {
          if (pzSel !== null) {
            const m = gen(s).find(x => from(x) === pzSel && to(x) === i);
            if (m !== undefined) { setPzSel(null); puz.move(m); return; }
            if (i === pzSel) { setPzSel(null); return; }
          }
          setPzSel(s.b[i] && sideOf(s.b[i]) === s.turn ? i : null);
        };
      }
    }
  } else if (review) {
    const e = review.v > 0 ? review.list[review.v - 1] : null;
    s = e ? e.after : review.list[0]?.s ?? g.s;
    last = e ? (e.kind === "place" ? { to: e.to } : { from: from(e.m), to: to(e.m) }) : null;
    best = e?.best ?? null;
    status = e ? `Review · ${review.v} of ${review.list.length}` : "Review · the empty board";
    hint = e?.best ? "Dashed green rings: the better choice." : "";
  } else {
    s = g.s;
    locked = !ctl.humanTurn;
    onCell = ctl.clickCell;
    if (online) [status, statusTone] = onlineStatus();
    else if (g.winner !== null) {
      status = `${g.winner === -1 ? "A draw." : `The ${sideName(g.winner)} win.`} ${why(g.why)}`;
      if (settings.mode === "cpu" && g.winner !== -1) statusTone = g.winner === settings.side ? "win" : "lose";
    } else if (ctl.thinking) status = g.phase === "place" ? "The computer sets a piece…" : "The computer is thinking…";
    else if (g.phase === "place") {
      const slot = currentSlot(g), total = totalPlacements(g);
      status = g.swap ? `${sideName(slot.p)}: set a ${sideName(slot.o)} piece (${g.placed + 1} of ${total})` : `${sideName(slot.p)}: set a piece (${g.placed + 1} of ${total})`;
    } else status = settings.mode === "cpu" ? `Your move, ${sideName(settings.side)}` : `${sideName(s.turn)} to move`;

    const showHints = !online || (session.doc?.status === "active" && session.mySeat !== null);
    if (g.phase === "place" && g.winner === null && !onlineDone && showHints) {
      const slot = currentSlot(g);
      hint = slot.top ? "The Sí Chariot starts on the summit." : (slot.o === 0 ? "Host pieces go on the outer ring." : "Sí pieces go on the slope or the summit.")
        + (g.swap && slot.o !== slot.p ? (ctl.humanTurn || !online ? " You're setting your rival's piece: put it where it does least." : "") : "")
        + (ctl.humanTurn && phalanxOffer(g) ? (g.swap
          ? " You may bring a Phalanx in place of three Spearmen; the Sí will set it."
          : " You may take the Phalanx in place of three Spearmen.") : "");
      if (ctl.humanTurn) for (let i = 0; i < 49; i++) if (!s.b[i] && slotZone(slot, i)) marks.set(i, "place");
    } else if (g.phase === "play" && g.winner === null && !onlineDone && showHints) {
      const rules = rulesOf(g);
      sel = ctl.sel;
      if (ctl.humanTurn) marks = moveMarks(s, ctl.sel, rules);
      hint = ctl.sel !== null ? selHint(s, ctl.sel, rules)
        : `Tap a piece to see where it can go.${ctl.humanTurn && canMerge(s, rules) ? ` ${MERGE_HINT}` : ""}`;
    }
  }

  function onlineStatus(): [string, string] {
    if (!inGame) return ["Online: choose the rules, then make an invite link for a friend.", ""];
    const d = session.doc;
    if (session.phase === "connecting") return ["Connecting…", ""];
    if (session.phase === "missing") return ["There's no game at this link.", ""];
    if (!d || session.phase === "error") return ["The online game can't be shown.", ""];
    if (d.status === "open") return [session.mySeat ? "Waiting for your friend to join…" : "You've been invited: choose a side to join.", ""];
    if (session.illegalAt !== null) return ["A move broke the rules, so the game has stopped.", "lose"];
    if (d.status === "done") {
      const r = d.result;
      if (!r) return ["The game is over.", ""];
      if (r.winner === null) return [`A draw. ${r.text}`, ""];
      const winner = sideOfSeat(r.winner)!;
      if (mySide === null) return [`The ${sideName(winner)} win. ${r.text}`, ""];
      return winner === mySide ? [`You win! ${r.text}`, "win"] : [`You lose. ${r.text}`, "lose"];
    }
    const side = g.phase === "place" ? currentSlot(g).p : g.s.turn, who = sideName(side);
    const what = g.phase === "place" ? (g.swap ? `set a ${sideName(currentSlot(g).o)} piece` : "set a piece") : "move";
    const count = g.phase === "place" ? ` (${g.placed + 1} of ${totalPlacements(g)})` : "";
    if (session.myTurn) return [g.phase === "place" ? `Your move, ${who}: ${what}${count}` : `Your move, ${who}`, ""];
    if (mySide !== null) return [`Waiting for the ${who} to ${what}…`, ""];
    return [g.phase === "place" ? `${who}: ${what}${count}` : `${who} to move`, ""];
  }

  // ---- Setup tray ----
  let tray = null;
  const trayShown = tab === "play" && !review && g.phase === "place" && g.winner === null && !onlineDone
    && (!online || session.doc?.status === "active");
  if (trayShown) {
    const slot = currentSlot(g), tr = g.trays[slot.o], kinds: Piece[] = slot.o === 0 ? [SP, LO] : [RI, CH];
    // The combining variant's Phalanx: an option in the Host's own tray, or a piece the Sí must set once chosen.
    const ownPhx = g.combine && !g.swap, swapPhx = g.combine && g.swap && tr[PH] !== undefined;
    if (slot.o === 0 && (ownPhx || swapPhx)) kinds.push(PH);
    const counts = slot.o === 0 && ownPhx ? { ...tr, [PH]: phalanxTaken(g) ? 0 : 1 } : tr;
    const choices = trayChoices(g);
    const picked = defaultPiece(g, ctl.pick);
    const toggle = g.combine && g.swap && ctl.humanTurn && phalanxOffer(g) ? { on: ctl.phx, set: ctl.setPhx } : null;
    tray = (
      <Tray label={ctl.humanTurn ? `${sideName(slot.p)}: choose a ${sideName(slot.o)} piece, then a marked hole` : `${sideName(slot.o)} pieces still to set`}
        kinds={kinds} counts={counts} picked={picked} enabled={k => ctl.humanTurn && choices.includes(k)} onPick={ctl.setPick} phalanxToggle={toggle} />
    );
  }

  const whoLabel = (side: Side) => (online ? (side === mySide ? " (you)" : "") : settings.mode === "cpu" ? (side === settings.side ? " (you)" : " (computer)") : "");
  const ending = online
    ? (result ? (result.winner === null ? `A draw. ${result.text}` : `The ${sideName(sideOfSeat(result.winner)!)} win: ${result.text}`) : "")
    : g.winner === null ? "" : g.winner === -1 ? "A draw." : `The ${sideName(g.winner)} win: ${why(g.why)}`;
  const resultTone = g.winner === -1 || settings.mode !== "cpu" ? "draw" : g.winner === settings.side ? "win" : "lose";
  const resultTitle = g.winner === -1 ? "A draw" : settings.mode === "cpu" ? (g.winner === settings.side ? "You win" : "You lose") : `The ${sideName(g.winner as Side)} win`;

  const opponent: Opponent = online ? "online" : settings.mode;
  const setOpponent = (o: Opponent) => {
    if (o === "online") { setOnlineView(true); return; }
    if (inGame) leaveOnline("cnoc");
    setOnlineView(false);
    if (o !== settings.mode) play.changeSettings({ mode: o });
  };
  const canReview = online ? !!og && onlineDone && og.history.length > 0 : g.winner !== null;
  const reviewThis = () => { setOlResultOpen(false); play.startReview(online && og ? og : undefined); };

  let onlineDialog = null;
  if (online && olResultOpen && result && tab === "play" && !review) {
    const tone = result.winner === null || mySide === null ? "draw" : sideOfSeat(result.winner) === mySide ? "win" : "lose";
    const title = result.winner === null ? "A draw" : mySide === null ? `The ${sideName(sideOfSeat(result.winner)!)} win` : tone === "win" ? "You win" : "You lose";
    onlineDialog = (
      <ResultDialog tone={tone} title={title} text={result.text} review={reviewThis} close={() => setOlResultOpen(false)}
        newGame={session.mySeat ? () => { setOlResultOpen(false); void session.rematch(); } : undefined} newLabel={session.doc?.next ? "Join the rematch" : "Rematch"} />
    );
  }

  return (
    <div className="wrap">
      <header>
        <h1>Cnoc <span className="say">(k’nuk)</span></h1>
        <p className="tag">Take the fairy mound, or hold it.</p>
      </header>
      <div className="game">
        <section className="stage" aria-label="The mound">
          <div className={`status ${statusTone}`} role="status" aria-live="polite">{status}</div>
          <Board b={s.b} marks={marks} selected={sel} last={last} best={best} hint={hintSq} flash={flash} locked={locked} animate onCell={onCell} />
          <HoldStones hold={s.hold} of={holdOf} />
          {tray}
          <p className="hint">{hint}</p>
        </section>
        <aside>
          <Segmented className="tabs" label="Mode" value={tab} onChange={t => { setTab(t); setPzSel(null); }}
            options={[{ value: "play", label: "Play" }, { value: "puzzles", label: "Puzzles" }] as { value: Tab; label: string }[]} />
          {tab === "puzzles" ? (
            <PuzzlePanel side={puz.progress.side} setSide={puz.setSide} solved={puz.progress.solved} pz={puz.pz}
              start={id => { setPzSel(null); puz.start(id); }} hint={puz.hint} showSolution={puz.showSolution} retry={puz.retry} next={puz.next} />
          ) : review ? (
            <ReviewPanel review={review} ending={ending} whoLabel={whoLabel} go={play.goReview} togglePlay={play.togglePlay} close={play.stopReview} />
          ) : (
            <>
              <PlayPanel settings={settings} change={play.changeSettings} opponent={opponent} setOpponent={setOpponent}
                online={online && !inGame ? { options: onlineOpts, change: p => setOnlineOpts(o => ({ ...o, ...p })) } : null}
                newGame={play.newGame} canUndo={play.canUndo} undo={play.takeBack} canReview={canReview} review={reviewThis} />
              {online ? <OnlinePanel session={session} adapter={cnocOnline} options={onlineOpts} title="Cnoc" /> : null}
            </>
          )}
          {review && tab === "play" ? null : (
            <div className="panel">
              <p className="label">Moves</p>
              <MoveLog history={tab === "puzzles" ? puz.pz?.g.history ?? [] : g.history} settingUp={tab === "play" && g.phase === "place"} />
            </div>
          )}
          <RulesPanel holdN={tab === "puzzles" ? 7 : holdOf} combine={tab === "play" && !!g.combine} />
        </aside>
      </div>
      {play.resultOpen && tab === "play" && !online && g.winner !== null ? (
        <ResultDialog tone={resultTone} title={resultTitle} text={why(g.why)} review={() => play.startReview()} newGame={play.newGame} close={play.closeResult} />
      ) : null}
      {onlineDialog}
    </div>
  );
}
