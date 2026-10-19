// The setup phase: who sets which piece where.
import { CH, LO, RI, SP, SUMMIT, TIER, type Piece, type Side } from "./rules";

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
