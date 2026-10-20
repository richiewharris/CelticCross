// The setup phase: who sets which piece where.
import { CH, LO, PH, RI, SP, SUMMIT, TIER, type Piece, type Side } from "./rules";

export interface Slot {
  /** Owner of the piece going down. */
  o: Side;
  /** Who sets it. */
  p: Side;
  /** A fixed piece type, or null when the setter chooses. */
  k: Piece | null;
  /** Must go on the summit. */
  top?: boolean;
}

/** Standard setup: each side sets its own pieces, Host first; the Host set their last three alone. */
export const ORDER: Side[] = [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0];

/** "Set your rival's": own Lord, own Chariot on the summit, then the rivals' pieces in turn. */
export const SWAP_SLOTS: Slot[] = [
  { o: 0, p: 0, k: LO },
  { o: 1, p: 1, k: CH, top: true },
  ...[0, 1, 2, 3].flatMap((): Slot[] => [{ o: 1, p: 0, k: RI }, { o: 0, p: 1, k: SP }]),
  { o: 0, p: 1, k: SP }, { o: 0, p: 1, k: SP }, { o: 0, p: 1, k: SP },
];

export const PLACEMENTS = ORDER.length;

export function slotAt(placed: number, swap: boolean): Slot {
  if (swap) return SWAP_SLOTS[placed];
  return { o: ORDER[placed], p: ORDER[placed], k: null };
}

/** Host pieces go on the outer ring; Sí pieces on the slope or summit. */
export const zoneOk = (side: Side, i: number) => (side === 0 ? TIER[i] === 1 : TIER[i] >= 2);

export const slotZone = (slot: Slot, i: number) => (slot.top ? SUMMIT[i] : zoneOk(slot.o, i));

export type Trays = Record<Side, Partial<Record<Piece, number>>>;
export const freshTrays = (): Trays => ({ 0: { [LO]: 1, [SP]: 7 }, 1: { [CH]: 1, [RI]: 4 } });

/** The hold length actually used: the rival's setup plays two turns shorter. */
export const effectiveHold = (holdN: number, swap: boolean) => (swap ? holdN - 2 : holdN);

// ---- The combining variant ----
// The Host may set a Phalanx in place of three Spearmen, so the number of placements is no longer
// fixed: the order is worked out from what is left in the trays.

/** Pieces a side still has to set. In "set your own", a Phalanx not yet chosen is only an option, so it isn't counted. */
export const leftIn = (t: Trays, side: Side) =>
  side === 0 ? (t[0][LO] ?? 0) + (t[0][SP] ?? 0) + (t[0][PH] ?? 0) : (t[1][CH] ?? 0) + (t[1][RI] ?? 0);

/**
 * The next slot in the combining variant. Own setup: Host first, alternate while both sides have
 * pieces left, then whoever still has pieces. Rival's setup: Host's Lord, Sí Chariot on the summit,
 * then the Host set Riders and the Sí set Host pieces (Spearmen, or the Phalanx if the Host chose it) in turn.
 */
export function comboSlot(placed: number, swap: boolean, t: Trays): Slot {
  if (!swap) {
    const h = leftIn(t, 0), si = leftIn(t, 1);
    const p: Side = !h ? 1 : !si ? 0 : ((placed & 1) as Side);
    return { o: p, p, k: null };
  }
  if (placed === 0) return { o: 0, p: 0, k: LO };
  if (placed === 1) return { o: 1, p: 1, k: CH, top: true };
  const h = leftIn(t, 0), ri = t[1][RI] ?? 0;
  const hostSets = !h ? true : !ri ? false : (placed & 1) === 0;
  return hostSets ? { o: 1, p: 0, k: RI } : { o: 0, p: 1, k: null };
}

/** A Phalanx uses up three Spearmen. */
export const PHALANX_COST = 3;
