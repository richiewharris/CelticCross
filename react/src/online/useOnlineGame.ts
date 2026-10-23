// One online game, followed live: sign-in, the document, the replayed position, and the actions
// a player can take. Every move is checked against the game's own rules before it is sent, and
// every move received is checked again on replay.
import { useCallback, useEffect, useRef, useState } from "react";
import { getBackend, OnlineError } from "./backend";
import { goOnline } from "./route";
import { yourMoveAlert, markTitle } from "./notify";
import { recordGameEnd, recordGameStart } from "./analytics";
import { replay, type OnlineAdapter, type OnlineDoc, type OnlineGameSummary, type OnlineResult, type SeatId } from "./types";

export type OnlinePhase = "off" | "connecting" | "missing" | "error" | "open" | "active" | "done";

export interface OnlineSession<S, M, O> {
  id: string | null;
  phase: OnlinePhase;
  error: string | null;
  uid: string | null;
  doc: OnlineDoc<M, O> | null;
  mySeat: SeatId | null;
  s: S | null;
  myTurn: boolean;
  illegalAt: number | null;
  busy: boolean;
  create(options: O, seat: SeatId): Promise<void>;
  join(seat: SeatId): Promise<void>;
  play(m: M): Promise<boolean>;
  resign(): Promise<void>;
  rematch(): Promise<void>;
  myGames: OnlineGameSummary[] | null;
  loadMyGames(): Promise<void>;
  clearError(): void;
}

const message = (e: unknown) => (e instanceof OnlineError || e instanceof Error ? e.message : "Something went wrong.");

export function useOnlineGame<S, M, O>(adapter: OnlineAdapter<S, M, O>, id: string | null, gameTitle: string): OnlineSession<S, M, O> {
  const [uid, setUid] = useState<string | null>(null);
  const [doc, setDoc] = useState<OnlineDoc<M, O> | null>(null);
  const [phase, setPhase] = useState<OnlinePhase>(id ? "connecting" : "off");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [myGames, setMyGames] = useState<OnlineGameSummary[] | null>(null);
  const docRef = useRef(doc); docRef.current = doc;
  const uidRef = useRef(uid); uidRef.current = uid;
  const lastLen = useRef<number | null>(null);

  // Follow the game in the address.
  useEffect(() => {
    if (!id) { setPhase("off"); setDoc(null); lastLen.current = null; markTitle(false); return; }
    let stop = () => {}, live = true;
    setPhase("connecting"); setDoc(null); setError(null); lastLen.current = null;
    getBackend().then(async b => {
      const me = await b.signIn();
      if (!live) return;
      setUid(me);
      stop = b.watch(id, d => {
        if (!live) return;
        if (!d) { setPhase("missing"); setDoc(null); return; }
        const typed = d as OnlineDoc<M, O>;
        // Alert when the other player has just moved and it is now our turn.
        if (lastLen.current !== null && typed.moves.length > lastLen.current && typed.turn === me) {
          yourMoveAlert(`${gameTitle}: your move`, "Your friend has moved.", `online-${id}`);
        }
        lastLen.current = typed.moves.length;
        setDoc(typed); setPhase(typed.status);
      }, e => { if (live) { setError(e.message); setPhase("error"); } });
    }).catch(e => { if (live) { setError(message(e)); setPhase("error"); } });
    return () => { live = false; stop(); };
  }, [id, gameTitle]);

  const rep = doc ? replay(adapter, doc) : null;
  const s = rep ? rep.s : null;
  const mySeat = doc && uid ? (Object.keys(doc.seats).find(k => doc.seats[k] === uid) ?? null) : null;
  const myTurn = !!(doc && uid && doc.status === "active" && doc.turn === uid && rep && rep.illegalAt === null);

  const guard = async (f: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await f(); } catch (e) { setError(message(e)); } finally { setBusy(false); }
  };

  const create = useCallback(async (options: O, seat: SeatId) => {
    await guard(async () => {
      const b = await getBackend(), me = await b.signIn();
      const seats = Object.fromEntries(adapter.seats.map(x => [x.id, x.id === seat ? me : null]));
      const firstSeat = adapter.seatToAct(adapter.start(options)) ?? adapter.seats[0].id;
      const now = Date.now();
      const d: OnlineDoc<M, O> = { v: 1, game: adapter.game, options, seats, players: [me], creator: me, status: "open", firstSeat, moves: [], turn: null, result: null, next: null, createdAt: now, updatedAt: now };
      const newId = await b.create(d as OnlineDoc);
      recordGameStart(adapter.game, { mode: "online" });
      goOnline(adapter.game, newId);
    });
  }, [adapter]);

  const join = useCallback(async (seat: SeatId) => {
    if (!id) return;
    await guard(async () => {
      const b = await getBackend(), me = await b.signIn();
      await b.join(id, seat, me);
    });
  }, [id]);

  const play = useCallback(async (m: M): Promise<boolean> => {
    const d = docRef.current, me = uidRef.current;
    if (!id || !d || !me || d.status !== "active" || d.turn !== me) return false;
    const r = replay(adapter, d);
    if (r.illegalAt !== null || !adapter.legal(r.s, m)) return false;
    const s2 = adapter.apply(r.s, m);
    const result: OnlineResult | null = adapter.result(s2);
    const nextSeat = adapter.seatToAct(s2);
    const nextTurn = result || nextSeat === null ? null : d.seats[nextSeat] ?? null;
    // Show the move at once; the server's copy replaces this when it arrives.
    const optimistic: OnlineDoc<M, O> = { ...d, moves: [...d.moves, m], turn: nextTurn, status: result ? "done" : "active", result };
    setDoc(optimistic); lastLen.current = optimistic.moves.length;
    let ok = true;
    await guard(async () => {
      try {
        const b = await getBackend();
        await b.move(id, me, d.moves.length, m, nextTurn, result);
        if (result) recordGameEnd(adapter.game, { mode: "online", result: result.winner === null ? "draw" : result.winner === Object.keys(d.seats).find(k => d.seats[k] === me) ? "win" : "loss" });
      } catch (e) { ok = false; setDoc(d); lastLen.current = d.moves.length; throw e; }
    });
    return ok;
  }, [adapter, id]);

  const resign = useCallback(async () => {
    const d = docRef.current, me = uidRef.current;
    if (!id || !d || !me) return;
    const seat = Object.keys(d.seats).find(k => d.seats[k] === me);
    if (!seat) return;
    const other = Object.keys(d.seats).find(k => k !== seat) ?? null;
    const label = adapter.seats.find(x => x.id === seat)?.label ?? seat;
    await guard(async () => {
      const b = await getBackend();
      await b.resign(id, me, { winner: other, text: `The ${label} resigned.`, resigned: seat });
      recordGameEnd(adapter.game, { mode: "online", result: "resigned" });
    });
  }, [adapter, id]);

  const rematch = useCallback(async () => {
    const d = docRef.current, me = uidRef.current;
    if (!id || !d || !me) return;
    if (d.next) { goOnline(adapter.game, d.next); return; }
    const seat = Object.keys(d.seats).find(k => d.seats[k] === me);
    const other = adapter.seats.find(x => x.id !== seat)?.id ?? adapter.seats[0].id;
    await guard(async () => {
      const b = await getBackend();
      const seats = Object.fromEntries(adapter.seats.map(x => [x.id, x.id === other ? me : null]));
      const firstSeat = adapter.seatToAct(adapter.start(d.options)) ?? adapter.seats[0].id;
      const now = Date.now();
      const nd: OnlineDoc<M, O> = { ...d, seats, players: [me], creator: me, status: "open", firstSeat, moves: [], turn: null, result: null, next: null, createdAt: now, updatedAt: now };
      const newId = await b.create(nd as OnlineDoc);
      await b.offerRematch(id, me, newId);
      recordGameStart(adapter.game, { mode: "online" });
      goOnline(adapter.game, newId);
    });
  }, [adapter, id]);

  const loadMyGames = useCallback(async () => {
    try {
      const b = await getBackend(), me = await b.knownUid();
      if (!me) { setMyGames([]); return; }
      setUid(u => u ?? me);
      setMyGames(await b.myGames(adapter.game, me));
    } catch { setMyGames([]); }
  }, [adapter.game]);

  return {
    id, phase, error, uid, doc, mySeat, s, myTurn, illegalAt: rep?.illegalAt ?? null, busy,
    create, join, play, resign, rematch, myGames, loadMyGames, clearError: () => setError(null),
  };
}
