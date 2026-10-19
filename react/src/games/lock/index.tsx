// Celtic Cross Lock: #/lock plays the dial (a turning disc under a shield); #/lock/earn, #/lock/stack
// and #/lock/cube are variants; #/lock/v1 is the classic version (swap stones on a ringed cross).
import "./lock.css";
import "./lock-v1.css";
import { GameScope } from "../../kit/GameScope";
import { CrossGame } from "./CrossGame";
import { LockGame } from "./LockGame";
import { EarnGame } from "./earn/EarnGame";
import { StackGame } from "./stack/StackGame";
import { CubeGame } from "./cube/CubeGame";
import { useVersion } from "./useVersion";

export default function Page() {
  const v = useVersion();
  if (v === "v1") return <GameScope key="v1" id="lock-v1"><CrossGame /></GameScope>;
  const Game = v === "earn" ? EarnGame : v === "stack" ? StackGame : v === "cube" ? CubeGame : LockGame;
  return <GameScope key={v} id="lock"><Game /></GameScope>;
}
