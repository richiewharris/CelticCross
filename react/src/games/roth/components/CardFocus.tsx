// Swipe down on a card to pull it into full view. Reading a card never plays it: the gesture only opens this sheet.
// A provider gives cards the gesture; without one (the deck builder, the Codex) cards behave as before.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import type { CardDef } from "../engine/cards";
import { cardText, typeLine } from "../text";
import { faceLines } from "../faceText";
import { CardFace, Rich } from "./Card";

interface FocusApi { open: (d: CardDef, owner?: "mine" | "theirs") => void }
const Ctx = createContext<FocusApi | null>(null);

/** How far down (px) a pointer must travel, mostly vertically, to count as a pull. */
const PULL = 44;

export function CardFocusProvider({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState<{ d: CardDef; owner?: "mine" | "theirs" } | null>(null);
  const open = useCallback((d: CardDef, owner?: "mine" | "theirs") => { if (d.type !== "unknown") setShown({ d, owner }); }, []);
  const close = () => setShown(null);
  useEffect(() => {
    if (!shown) return;
    const on = (e: KeyboardEvent) => { if (e.key === "Escape") setShown(null); };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, [shown]);
  // swipe up on the sheet puts the card back
  const start = useRef<number | null>(null);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      {shown ? (
        <div className="cardsheet" role="dialog" aria-modal="true" aria-label={shown.d.name} onClick={close}
          onPointerDown={(e) => { start.current = e.clientY; }} onPointerUp={(e) => { if (start.current !== null && start.current - e.clientY > PULL) close(); start.current = null; }}>
          <div className="cardsheet-body" onClick={(e) => e.stopPropagation()}>
            <div className="cardsheet-card"><CardFace def={shown.d} owner={shown.owner ?? "mine"} /></div>
            <div className="cardsheet-text">
              <p className="i-type">{typeLine(shown.d)}</p>
              {faceLines(shown.d).map((l, i) => (l.kind === "ability" ? <p key={i} className="i-ability">{l.text}</p> : <p key={i} className={`i-ln i-${l.kind}`}><Rich text={l.text} /></p>))}
              <p className="i-text"><span className="i-exact">Exact rule:</span> {cardText(shown.d)}</p>
            </div>
            <button type="button" className="btn" onClick={close} autoFocus>Close</button>
          </div>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

/** Pointer handlers that open a card when it's pulled down; `swiped()` tells a click handler to ignore that release. */
export function useCardPull(def: CardDef, owner?: "mine" | "theirs") {
  const api = useContext(Ctx);
  const from = useRef<{ x: number; y: number; id: number } | null>(null);
  const pulled = useRef(false);
  if (!api || def.type === "unknown") return null;
  return {
    swiped: () => { const p = pulled.current; pulled.current = false; return p; },
    handlers: {
      onPointerDown: (e: RPointerEvent) => { from.current = { x: e.clientX, y: e.clientY, id: e.pointerId }; pulled.current = false; },
      onPointerMove: (e: RPointerEvent) => {
        const f = from.current;
        if (!f || f.id !== e.pointerId || pulled.current) return;
        const dy = e.clientY - f.y, dx = Math.abs(e.clientX - f.x);
        if (dy > PULL && dx < dy * 0.6) { pulled.current = true; from.current = null; api.open(def, owner); }
      },
      onPointerUp: () => { from.current = null; },
      onPointerCancel: () => { from.current = null; },
    },
  };
}
