import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** A modal dialog that must be answered: focus is trapped and the page behind is inert. */
export function Dialog(props: { tone?: "win" | "lose" | "draw"; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const shell = document.getElementById("app-shell");
    if (shell) shell.inert = true;
    ref.current?.querySelector<HTMLElement>("button")?.focus();
    return () => { if (shell) shell.inert = false; };
  }, []);
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !ref.current) return;
    const f = [...ref.current.querySelectorAll<HTMLElement>("button")];
    const i = f.indexOf(document.activeElement as HTMLElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length]?.focus();
  };
  return createPortal(
    <div className="modal" onKeyDown={onKey}>
      <div ref={ref} className={`dialog ${props.tone ?? ""}`} role="dialog" aria-modal="true" aria-label={props.label}>
        {props.children}
      </div>
    </div>,
    document.body,
  );
}
