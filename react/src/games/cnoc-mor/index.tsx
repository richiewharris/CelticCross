import "./cnoc-mor.css";
import { GameScope } from "../../kit/GameScope";
import { CnocMorGame } from "./CnocMorGame";

export default function Page() {
  return <GameScope id="cnoc-mor"><CnocMorGame /></GameScope>;
}
