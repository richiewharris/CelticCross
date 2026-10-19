import "./monsiv.css";
import { loadFonts } from "../../kit/fonts";
import { GameScope } from "../../kit/GameScope";
import { MonsivGame } from "./MonsivGame";

loadFonts("https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap");

export default function Page() {
  return <GameScope id="monsiv"><MonsivGame /></GameScope>;
}
