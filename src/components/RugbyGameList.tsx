import Link from "next/link";
import { SafeLogo } from "@/components/SafeLogo";
import type { RugbyGame } from "@/sports/rugby/types";

function score(value: number | null) {
  return value === null ? "—" : String(value);
}

function displayStatus(game: RugbyGame) {
  if (game.status.short.toLowerCase().includes("finished")) return "FT";
  if (game.status.short.toLowerCase().includes("not")) return game.time ?? game.status.short;
  return game.status.short;
}

export function RugbyGameList({ games }: { games: RugbyGame[] }) {
  const groups = games.reduce<Record<string, RugbyGame[]>>((acc, game) => {
    const country = game.league.country?.name;
    const label = country ? `${country} · ${game.league.name}` : game.league.name;
    (acc[label] ??= []).push(game);
    return acc;
  }, {});

  if (!games.length) {
    return (
      <div className="emptyState">
        <h3>No rugby games loaded</h3>
        <p>Configure the Rugby API key or select another date.</p>
      </div>
    );
  }

  return (
    <div className="leagueList">
      {Object.entries(groups).map(([label, leagueGames]) => (
        <section className="leagueCard" key={label}>
          <div className="leagueTitle">
            <SafeLogo src={leagueGames[0].league.logo} alt={leagueGames[0].league.name} fallbackText={leagueGames[0].league.name} size={28} />
            <h3>{label}</h3>
          </div>

          {leagueGames.map((game) => (
            <article className="matchRow" key={game.id}>
              <div className="matchMeta"><span>{displayStatus(game)}</span></div>

              <div className="team">
                <SafeLogo src={game.home.logo} alt={game.home.name} fallbackText={game.home.name} size={26} />
                <span>{game.home.name}</span>
              </div>

              <Link className="score" href={`/sports/rugby/games/${game.id}`} prefetch={false}>
                <strong>{score(game.home.score)}</strong>
                <span>:</span>
                <strong>{score(game.away.score)}</strong>
              </Link>

              <div className="team away">
                <span>{game.away.name}</span>
                <SafeLogo src={game.away.logo} alt={game.away.name} fallbackText={game.away.name} size={26} />
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
