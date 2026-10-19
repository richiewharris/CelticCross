import "./home.css";
import { GameScope } from "../kit/GameScope";
import { GAMES } from "../games/registry";

const img = (f: string) => `../images/${f}`;
const Arrow = () => <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M3 1.5 L11 7 L3 12.5 Z" fill="currentColor" /></svg>;

export function Home() {
  const featured = GAMES.filter(g => g.featured), more = GAMES.filter(g => !g.featured);
  return (
    <GameScope id="home">
      <div className="home">
        <header>
          <svg className="knot" viewBox="-50 -50 100 100" aria-hidden="true">
            <g fill="none" stroke="#d9b77d" strokeWidth="5" strokeLinecap="round">
              {[0, 120, 240].map(r => <path key={r} transform={`rotate(${r})`} d="M0 0 C 6 -22, 34 -32, 44 -14 C 52 2, 38 18, 24 12 C 14 8, 18 -6, 28 -3" />)}
            </g>
            <circle r="5" fill="#d9b77d" />
          </svg>
          <h1>Celtic Cross Games</h1>
          <p className="lede">Small games to play in the browser: a lost strategy game brought back, the board game of early Ireland, a puzzle lock carved in stone, a dice race to twenty, and a battle for a fairy mound. Nothing to install.</p>
        </header>
        <main className="games">
          {featured.map(g => (
            <article className="card" key={g.id}>
              <a className="shot" href={`#/${g.id}`} aria-label={`Play ${g.title}`}><img src={img(g.image)} alt={g.alt ?? ""} width="720" height="720" /></a>
              <div className="info">
                <p className="kicker">{g.kicker}</p>
                <h2>{g.title}{g.say ? <> <span className="say">{g.say}</span></> : null}</h2>
                <p>{g.blurb}</p>
                {g.facts ? <ul className="facts">{g.facts.map(f => <li key={f}>{f}</li>)}</ul> : null}
                <a className="play" href={`#/${g.id}`}>Play now <Arrow /></a>
              </div>
            </article>
          ))}
        </main>
        <section className="more" aria-labelledby="more-title">
          <h3 id="more-title">Also in the collection</h3>
          <ul>
            {more.map(g => (
              <li key={g.id}><a href={`#/${g.id}`}><img src={img(g.image)} alt="" width="72" height="72" /><span><b>{g.title}</b><span>{g.blurb}</span></span></a></li>
            ))}
            <li><a href="#/lock/v1"><img src={img("celtic-cross-lock.jpg")} alt="" width="72" height="72" style={{ filter: "sepia(.6)" }} /><span><b>Celtic Cross Lock, classic</b><span>The first version of the lock: rejoin the knotwork on a ringed cross by swapping stones.</span></span></a></li>
            <li><a href="#/playground"><img src={img("cnoc.jpg")} alt="" width="72" height="72" style={{ filter: "grayscale(.7)" }} /><span><b>Component playground</b><span>Every game's pieces and boards on one page, for building and checking them.</span></span></a></li>
          </ul>
        </section>
        <footer>
          <p>Monsiv was designed by Harley Bailey; this is an unofficial fan rebuild. This is the React edition; <a href="../">the original pages</a> are still there.</p>
          <p><a href="https://github.com/richiewharris/CelticCross">Source on GitHub</a></p>
        </footer>
      </div>
    </GameScope>
  );
}
