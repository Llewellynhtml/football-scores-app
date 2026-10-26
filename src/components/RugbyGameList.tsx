import Image from "next/image";
import Link from "next/link";
import type { RugbyGame } from "@/sports/rugby/types";

function score(value: number | null) {
  return value === null ? "-" : String(value);
}

function displayStatus(game: RugbyGame) {
  if (game.status.short.toLowerCase().includes("finished")) return "FT";
  if (game.status.short.toLowerCase().includes("not")) return game.time ?? "TBD";
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
            {leagueGames[0].league.logo ? (
              <Image src={leagueGames[0].league.logo} alt="" width={28} height={28} sizes="28px" quality={50} loading="lazy" />
            ) : (
              <span aria-hidden="true">🏉</span>
            )}
            <h3>{label}</h3>
          </div>

          {leagueGames.map((game) => (
            <article className="matchRow" key={game.id}>
              <div className="matchMeta"><span>{displayStatus(game)}</span></div>

              <div className="team">
                {game.home.logo ? <Image src={game.home.logo} alt="" width={26} height={26} sizes="26px" quality={50} loading="lazy" /> : null}
                <span>{game.home.name}</span>
              </div>

              <Link className="score" href={`/sports/rugby/games/${game.id}`} prefetch={false}>
                <strong>{score(game.home.score)}</strong>
                <span>:</span>
                <strong>{score(game.away.score)}</strong>
              </Link>

              <div className="team away">
                <span>{game.away.name}</span>
                {game.away.logo ? <Image src={game.away.logo} alt="" width={26} height={26} sizes="26px" quality={50} loading="lazy" /> : null}
              </div>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
