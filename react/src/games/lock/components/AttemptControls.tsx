// The buttons for one attempt at a lock, shared by every version: Try the lock, New/Next lock and a
// small Start over; after a failed try, Retry this lock and Scramble take Try's place.
import { useEffect, useRef, type ReactNode } from "react";

export interface AttemptControlsProps {
  open: boolean;
  failed: boolean;
  /** Something has been played since the deal, so Start over would change something. */
  canStartOver: boolean;
  tryLabel: ReactNode;
  /** Extra class for the Try button (the cube's has the triskele). */
  tryClass?: string;
  newLabel: string; nextLabel: string;
  /** The second choice after a failure (default "Scramble"). */
  scrambleLabel?: string;
  /** Show New lock beside Retry and Scramble after a failure (default true). */
  newWhenFailed?: boolean;
  onTry: () => void; onNew: () => void; onRetry: () => void; onScramble: () => void; onStartOver: () => void;
}

export function AttemptControls(p: AttemptControlsProps) {
  const retryRef = useRef<HTMLButtonElement>(null), tryRef = useRef<HTMLButtonElement>(null);
  // The button that was pressed goes away when the attempt fails or restarts: hand focus to the
  // button that took its place, unless focus has gone somewhere else on purpose.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    const a = document.activeElement;
    if (a && a !== document.body) return;
    (p.failed ? retryRef : tryRef).current?.focus({ preventScroll: true });
  }, [p.failed]);

  const scramble = p.scrambleLabel ?? "Scramble";
  if (p.failed) {
    return (
      <>
        <button ref={retryRef} className="btn primary" type="button" onClick={p.onRetry}>Retry this lock</button>
        <button className="btn" type="button" onClick={p.onScramble}>{scramble}</button>
        {p.newWhenFailed !== false && <button className="btn" type="button" onClick={p.onNew}>{p.newLabel}</button>}
      </>
    );
  }
  return (
    <>
      <button ref={tryRef} className={`btn${p.tryClass ? ` ${p.tryClass}` : ""}${p.open ? "" : " primary"}`} type="button" disabled={p.open} onClick={p.onTry}>{p.tryLabel}</button>
      <button className={`btn${p.open ? " primary" : ""}`} type="button" onClick={p.onNew}>{p.open ? p.nextLabel : p.newLabel}</button>
      {!p.open && (
        <button className="btn minor" type="button" disabled={!p.canStartOver} onClick={p.onStartOver}
          title="Put the stones back as this lock was dealt, with all its turns">Start over</button>
      )}
    </>
  );
}
