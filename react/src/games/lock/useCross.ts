// State for the classic version: dealing, swapping (drag, tap or keyboard), trying the lock, Cheat aids.
import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useStoredState } from "../../kit/useStoredState";
import { CROSS_TIERS, brokenEdges, dealCross, makeLock, misplaced, nextSwap, solved, type Tile } from "./engine/cross";
import { NEW_PROFILE, openedMessage, skillGain, type Profile, type TierId } from "./engine/knot";
import type { CellLook } from "./components/CrossBoard";

export interface CrossState {
  tier: TierId; tiles: Tile[]; arr: number[];
  movesLeft: number; budget: number; open: boolean; sel: number | null;
  msg: string; msgKind: "" | "good" | "bad"; cheated: boolean;
}

function dealState(tiles: Tile[], tier: TierId, skill: number, cheat: boolean, msg: string, msgKind: CrossState["msgKind"] = ""): CrossState {
  const d = dealCross(tiles, tier, skill);
  return { tier, tiles, arr: d.arr, movesLeft: d.budget, budget: d.budget, open: false, sel: null, msg, msgKind, cheated: cheat };
}
const newMsg = (tier: TierId) => `A ${CROSS_TIERS[tier].name.toLowerCase()} lock. Rejoin the knotwork.`;

export function useCross() {
  const [profile, setProfile] = useStoredState<Profile>("lock-react-v1-profile", NEW_PROFILE);
  const [S, setS] = useState<CrossState>(() => dealState(makeLock(2), 2, profile.skill, false, newMsg(2)));
  const [cheat, setCheat] = useState(false);
  const [flash, setFlash] = useState<number[]>(() => S.arr.map(() => 0));
  const [flashed, setFlashed] = useState<Set<number>>(new Set());
  const [shakes, setShakes] = useState(0);
  const [dragLook, setDragLook] = useState<{ from: number; over: number | null } | null>(null);
  const [ghost, setGhost] = useState<{ t: Tile; bad: ReturnType<typeof brokenEdges> | null } | null>(null);
  const ghostEl = useRef<HTMLDivElement>(null);
  const boardEl = useRef<HTMLDivElement>(null);
  const refocus = useRef<number | null>(null);

  // Keep keyboard focus on the same stone across redraws.
  useLayoutEffect(() => {
    if (refocus.current == null) return;
    const i = refocus.current; refocus.current = null;
    boardEl.current?.querySelector<HTMLElement>(`[data-i="${i}"]`)?.focus({ preventScroll: true });
  });
  // The tumblers fall: shake the board (restarting the animation each time).
  useLayoutEffect(() => {
    const b = boardEl.current; if (!shakes || !b) return;
    b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake");
  }, [shakes]);

  const rememberFocus = () => {
    const a = document.activeElement as HTMLElement | null;
    if (a?.dataset?.i != null && boardEl.current?.contains(a)) refocus.current = +a.dataset.i;
  };
  const update = (next: CrossState) => { rememberFocus(); setFlashed(new Set()); setS(next); };

  const newLock = (tier: TierId) => update(dealState(makeLock(tier), tier, profile.skill, cheat, newMsg(tier)));

  const swap = (a: number, b: number) => {
    if (S.open || a === b) return;
    if (S.movesLeft <= 0) { update({ ...S, msg: "No moves left. Try the lock.", msgKind: "bad", sel: null }); return; }
    const arr = S.arr.slice(); [arr[a], arr[b]] = [arr[b], arr[a]];
    const left = S.movesLeft - 1;
    rememberFocus();
    setS({ ...S, arr, movesLeft: left, sel: null, msg: left === 0 ? "That was your last move. Try the lock." : "", msgKind: "" });
    setFlash(f => f.map((n, i) => (i === a || i === b ? n + 1 : n)));
    setFlashed(new Set([a, b]));
  };

  const tryLock = () => {
    if (S.open) return;
    if (solved(S.tiles, S.arr)) {
      const gain = skillGain(profile.skill, S.tier, S.movesLeft, S.cheated);
      setProfile({ skill: profile.skill + gain, opened: profile.opened + (S.cheated ? 0 : 1), attempts: profile.attempts + 1 });
      update({ ...S, open: true, sel: null, msg: openedMessage(S.cheated, gain), msgKind: "good" });
    } else {
      setProfile({ ...profile, attempts: profile.attempts + 1 });
      update(dealState(S.tiles, S.tier, profile.skill, cheat, "The tumblers fall. The stones scramble again.", "bad"));
      setShakes(n => n + 1);
    }
  };

  const tap = (i: number) => {
    if (S.open) return;
    if (S.sel === null) update({ ...S, sel: i });
    else if (S.sel === i) update({ ...S, sel: null });
    else swap(S.sel, i);
  };

  const toggleCheat = () => {
    const c = !cheat;
    setCheat(c);
    if (c && !S.open) update({ ...S, cheated: true }); else update(S);
  };

  // ---- Drag, drop and tap ----
  const drag = useRef<{ from: number; x: number; y: number; id: number; moving: boolean; over: number | null } | null>(null);
  const cellOf = (el: Element | null) => (el?.closest?.(".cell") as HTMLElement | null) ?? null;
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    const cell = cellOf(e.target as Element);
    if (!cell || S.open || e.button > 0) return;
    drag.current = { from: +cell.dataset.i!, x: e.clientX, y: e.clientY, id: e.pointerId, moving: false, over: null };
    cell.setPointerCapture(e.pointerId);
  };
  const placeGhost = (x: number, y: number) => { const g = ghostEl.current; if (g) { g.style.left = x + "px"; g.style.top = y + "px"; } };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    if (!d.moving) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) return;
      d.moving = true;
      setGhost({ t: S.tiles[S.arr[d.from]], bad: cheat && !S.open ? brokenEdges(S.tiles, S.arr, d.from) : null });
      setDragLook({ from: d.from, over: null });
    }
    placeGhost(e.clientX, e.clientY);
    lastPt.current = [e.clientX, e.clientY];
    const tgt = cellOf(document.elementFromPoint(e.clientX, e.clientY));
    const ti = tgt ? +tgt.dataset.i! : null;
    if (ti !== d.over) { d.over = ti; setDragLook({ from: d.from, over: ti }); }
  };
  const lastPt = useRef<[number, number]>([0, 0]);
  // The ghost mounts on the first move; put it under the pointer straight away.
  useLayoutEffect(() => { if (ghost) placeGhost(...lastPt.current); }, [ghost]);
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    setGhost(null); setDragLook(null);
    if (cancelled) return;
    if (d.moving) { if (d.over != null && d.over !== d.from) swap(d.from, d.over); }
    else tap(d.from);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const cell = cellOf(e.target as Element);
    if (!cell) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); tap(+cell.dataset.i!); }
    if (e.key === "Escape" && S.sel !== null) update({ ...S, sel: null });
  };

  // ---- What the board shows ----
  const aid = cheat && !S.open;
  const wrongSet = new Set(aid ? misplaced(S.tiles, S.arr) : []);
  const hint = aid ? nextSwap(S.tiles, S.arr) : null;
  const isDone = aid && solved(S.tiles, S.arr);
  const look = (i: number): CellLook => ({
    sel: S.sel === i,
    wrong: aid && wrongSet.has(i) && !isDone,
    hint: !!hint && !isDone && hint.includes(i),
    over: !!dragLook && dragLook.over === i && i !== dragLook.from,
    lifted: !!dragLook && dragLook.from === i,
    bad: aid ? brokenEdges(S.tiles, S.arr, i) : null,
  });
  let hintText = "";
  if (aid) {
    if (isDone) hintText = "Every strand joins. Try the lock.";
    else if (hint) {
      const broken = S.arr.reduce((n, _, i) => n + brokenEdges(S.tiles, S.arr, i).length, 0);
      hintText = `Swap the two glowing stones. ${broken} broken join${broken === 1 ? "" : "s"} left.`;
    }
  }

  return {
    S, profile, cheat, look, flash, flashed, hintText, ghost, ghostEl, boardEl,
    tryLock, toggleCheat, newLock: () => newLock(S.tier), pickTier: newLock,
    handlers: { onPointerDown, onPointerMove, onPointerUp: (e: PointerEvent<HTMLDivElement>) => endDrag(e, false), onPointerCancel: (e: PointerEvent<HTMLDivElement>) => endDrag(e, true), onKeyDown },
  };
}
