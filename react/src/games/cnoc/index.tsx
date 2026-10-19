import "./cnoc.css";
import { GameScope } from "../../kit/GameScope";
import { CnocGame } from "./CnocGame";

export default function Page() {
  return <GameScope id="cnoc"><CnocGame /></GameScope>;
}
