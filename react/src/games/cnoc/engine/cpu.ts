// The computer's choices during setup: which piece to set next and, in the combining variant,
// whether the Host takes the Phalanx. Shared by the game and the simulator.
import { cpuWantsPhalanx } from "./ai";
import { currentSlot, phalanxOffer, rulesOf, trayChoices, type Game } from "./game";
import { CH, LO, PH, RI, SP, type Piece } from "./rules";
import { slotZone } from "./setup";

export interface SetupChoice {
  piece: Piece;
  /** Rival's setup only: the Host's Lord placement also takes the Phalanx for the Sí to set. */
  takePhalanx: boolean;
}

/** forcePhalanx (simulator only) overrides the computer's judgement on the Phalanx. */
export function cpuSetupChoice(g: Game, lvl: number, rnd: () => number = Math.random, forcePhalanx?: boolean): SetupChoice {
  const slot = currentSlot(g), tr = g.trays[slot.o], choices = trayChoices(g);
  if (phalanxOffer(g) && (forcePhalanx ?? cpuWantsPhalanx(g.s, g.swap, lvl, i => slotZone(slot, i), rulesOf(g), rnd))) {
    return g.swap ? { piece: LO, takePhalanx: true } : { piece: PH, takePhalanx: false };
  }
  if (slot.k) return { piece: slot.k, takePhalanx: false };
  // The Sí setting a Host Phalanx in the rival's setup: as likely as any one of the pieces left.
  if (g.swap && choices.includes(PH)) {
    const left = (tr[SP] ?? 0) + (tr[PH] ?? 0);
    return { piece: rnd() < (tr[PH] ?? 0) / left || !choices.includes(SP) ? PH : SP, takePhalanx: false };
  }
  const special = slot.o === 0 ? LO : CH, plain = slot.o === 0 ? SP : RI;
  const left = (tr[special] ?? 0) + (tr[plain] ?? 0);
  const piece = choices.includes(special) && (rnd() < 1 / left || !choices.includes(plain)) ? special : plain;
  return { piece, takePhalanx: false };
}
