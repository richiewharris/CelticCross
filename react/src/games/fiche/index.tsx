import "./fiche.css";
import { GameScope } from "../../kit/GameScope";
import { FicheGame } from "./FicheGame";

export default function Page() {
  return <GameScope id="fiche"><FicheGame /></GameScope>;
}
