import Image from "next/image";
import Link from "next/link";
import { getCompetitionById } from "@/config/competitions";
import type { Fixture } from "@/lib/football";
import { matchUrl, teamUrl } from "@/lib/slug";
import { timeInSouthAfrica } from "@/lib/dates";

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);

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
        <div className="emptyIcon">⌁</div>
        <h3>No matches found</h3>
        <p>Try another date, competition or match-status filter.</p>
      </div>
    );
  }

  return (
    <div className="leagueList">
      {Object.entries(grouped).map(([league, matches]) => {
        const featured = getCompetitionById(matches[0].league.id);
        return (
          <section className="leagueCard" key={league}>
            <div className="leagueTitle">
              <div className="leagueIdentity">
                <Image src={matches[0].league.logo} alt="" width={24} height={24} sizes="24px" quality={50} loading="lazy" />
                <div>
                  <small>{matches[0].league.country}</small>
                  <h3>{matches[0].league.name}</h3>
                </div>
              </div>
              {featured ? (
                <Link className="leagueAction" href={`/standings/${featured.slug}`} prefetch={false}>Standings</Link>
              ) : (
                <span className="leagueCount">{matches.length}</span>
              )}
            </div>

            {matches.map((match) => {
              const live = LIVE_STATUSES.has(match.status);
              return (
                <article className={live ? "matchRow liveRow" : "matchRow"} key={match.id}>
                  <div className={live ? "matchMeta liveMeta" : "matchMeta"}>
                    {live ? <span className="liveDot" /> : null}
                    <span>{displayStatus(match)}</span>
                  </div>

                  <Link className="team" href={teamUrl(match.home.name)} prefetch={false}>
                    <Image src={match.home.logo} alt="" width={24} height={24} sizes="24px" quality={50} loading="lazy" />
                    <span>{match.home.name}</span>
                  </Link>

                  <Link className="score" href={matchUrl(match.home.name, match.away.name, match.id)} prefetch={false}>
                    <strong>{match.home.goals ?? "-"}</strong>
                    <span>:</span>
                    <strong>{match.away.goals ?? "-"}</strong>
                  </Link>

                  <Link className="team away" href={teamUrl(match.away.name)} prefetch={false}>
                    <span>{match.away.name}</span>
                    <Image src={match.away.logo} alt="" width={24} height={24} sizes="24px" quality={50} loading="lazy" />
                  </Link>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
