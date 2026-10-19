import type { WinReason } from "./engine/rules";

export const WHY: Record<WinReason, string> = {
  crown: "The Lord reached the cairn at the centre.",
  wipe: "Every Sí piece is taken.",
  lord: "The Lord is taken.",
  nomove: "The other side has no move left.",
  repeat: "The position came round a third time.",
  long: "The game reached 150 moves each.",
};
export const why = (w: WinReason | null) => (w ? WHY[w] : "");
