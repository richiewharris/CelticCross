import "./goldmines.css";
import { GameScope } from "../../kit/GameScope";
import { GoldminesGame } from "./GoldminesGame";

export default function Page() {
  return <GameScope id="goldmines"><GoldminesGame /></GameScope>;
}
