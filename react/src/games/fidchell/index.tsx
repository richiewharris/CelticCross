import "./fidchell.css";
import { GameScope } from "../../kit/GameScope";
import { FidchellGame } from "./FidchellGame";

export default function Page() {
  return <GameScope id="fidchell"><FidchellGame /></GameScope>;
}
