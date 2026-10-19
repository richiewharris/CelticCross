import "./fidchell-cups.css";
import { GameScope } from "../../kit/GameScope";
import { CupsGame } from "./CupsGame";

export default function Page() {
  return <GameScope id="fidchell-cups"><CupsGame /></GameScope>;
}
