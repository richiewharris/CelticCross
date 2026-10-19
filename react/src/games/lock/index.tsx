// Celtic Cross Lock: #/lock plays the current version (a turning dial under a shield),
// #/lock/v1 the classic one (swap stones on a ringed cross).
import "./lock.css";
import "./lock-v1.css";
import { GameScope } from "../../kit/GameScope";
import { CrossGame } from "./CrossGame";
import { LockGame } from "./LockGame";
import { useVersion } from "./useVersion";

export default function Page() {
  const v = useVersion();
  return v === "v1"
    ? <GameScope key="v1" id="lock-v1"><CrossGame /></GameScope>
    : <GameScope key="v2" id="lock"><LockGame /></GameScope>;
}
