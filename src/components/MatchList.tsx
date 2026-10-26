import Image from "next/image";
import Link from "next/link";
import type { Fixture } from "@/lib/football";
import { matchUrl, teamUrl } from "@/lib/slug";
import { timeInSouthAfrica } from "@/lib/dates";

function displayStatus(match: Fixture) {
  if (match.status === "NS") return timeInSouthAfrica(match.date);
  if (match.status === "FT") return "FT";
  if (match.elapsed) return `${match.elapsed}'`;
  return match.status;
}

export function MatchList({ fixtures }: { fixtures: Fixture[] }) {
  const grouped = fixtures.reduce<Record<string, Fixture[]>>((acc, fixture) => {
    const key = `${fixture.league.country} · ${fixture.league.name}`;
    (acc[key] ??= []).push(fixture);
    return acc;
  }, {});

  if (!fixtures.length) {
    return (
      <div className="emptyState">
        <h3>No fixtures found</h3>
        <p>Try another date or competition. Cached data will appear here once available.</p>
      </div>
    );
  }

  return (
    <div className="leagueList">
      {Object.entries(grouped).map(([league, matches]) => (
        <section className="leagueCard" key={league}>
          <div className="leagueTitle">
            <Image src={matches[0].league.logo} alt="" width={28} height={28} />
            <h3>{league}</h3>
          </div>
          {matches.map((match) => (
            <article className="matchRow" key={match.id}>
              <div className="matchMeta"><span>{displayStatus(match)}</span></div>
              <Link className="team" href={teamUrl(match.home.name)}>
                <Image src={match.home.logo} alt="" width={26} height={26} />
                <span>{match.home.name}</span>
              </Link>
              <Link className="score" href={matchUrl(match.home.name, match.away.name, match.id)}>
                <strong>{match.home.goals ?? "-"}</strong><span>:</span><strong>{match.away.goals ?? "-"}</strong>
              </Link>
              <Link className="team away" href={teamUrl(match.away.name)}>
                <span>{match.away.name}</span>
                <Image src={match.away.logo} alt="" width={26} height={26} />
              </Link>
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
