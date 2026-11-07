// Lock races: #/lock/race sets one up (or practises alone), #/lock/race/<id> is a race room.
import { useEffect, useState } from "react";
import { raceIdFrom } from "../../../online/races";
import { VariantNav } from "../components/VariantNav";
import { RaceRoom } from "./RaceRoom";
import { RaceSetup } from "./RaceSetup";
import "./race.css";

function useRaceId() {
  const [id, setId] = useState(() => raceIdFrom(window.location.hash));
  useEffect(() => {
    const on = () => setId(raceIdFrom(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return id;
}

export default function RacePage() {
  const id = useRaceId();
  return (
    <div className="wrap race">
      <header>
        <h1>Celtic Cross Lock</h1>
        <p className="tag">A race against the clock: open as many locks as you can before your time runs out. Race a friend by link, then let anyone take on the same locks.</p>
        <VariantNav current="race" />
      </header>
      {id ? <RaceRoom key={id} id={id} /> : <RaceSetup />}
    </div>
  );
}
