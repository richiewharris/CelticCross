import type { WinReason } from "./engine/rules";

export const WHY: Record<WinReason, string> = {
  crown: "The Lord stands on the summit.",
  wipe: "Every Sí piece is taken.",
  lord: "The Lord is taken.",
  hold: "The Sí held the summit.",
  nomove: "The other side has no move left.",
  repeat: "The position came round a third time.",
};
export const why = (w: WinReason | null) => (w ? WHY[w] : "");
