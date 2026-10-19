/** Standing stones at the foot of the mound: one lights up for each Sí turn holding the summit. */
export function HoldStones({ hold, of }: { hold: number; of: number }) {
  return (
    <div className="stones" aria-label={`Sí hold: ${hold} of ${of} turns`}>
      <span className="lab">Sí hold</span>
      {Array.from({ length: of }, (_, k) => (
        <span key={k} className={`stone${k < hold ? " on" : ""}`} style={{ height: 22 + (k % 3) * 6 + k * 1.5 }} />
      ))}
    </div>
  );
}
