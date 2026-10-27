import Link from "next/link";
import { SafeLogo } from "@/components/SafeLogo";
import type { Fixture } from "@/lib/football";
import { matchUrl, slugify, teamUrl } from "@/lib/slug";
import { timeInSouthAfrica } from "@/lib/dates";

const LIVE_STATUSES = new Set(["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"]);

function displayStatus(match: Fixture) {
  if (match.status === "NS") return timeInSouthAfrica(match.date);
  if (match.status === "FT") return "FT";
  if (match.elapsed) return match.extra ? `${match.elapsed}+${match.extra}'` : `${match.elapsed}'`;
  return match.status;
}

function periodTime(timestamp: number | null) {
  if (!timestamp) return null;
  return new Intl.DateTimeFormat("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp * 1000));
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
        <p>API-Football returned no matches for the current competition or match-status filter.</p>
      </div>
    );
  }

  return (
    <div className="leagueList">
      {Object.entries(grouped).map(([league, matches]) => {
        const first = matches[0];
        const routeKey = `${slugify(first.league.name)}-${first.league.id}`;

        return (
          <section className="leagueCard" key={league}>
            <div className="leagueTitle">
              <div className="leagueIdentity">
                <SafeLogo src={first.league.logo} alt={first.league.name} fallbackText={first.league.name} size={24} />
                <div>
                  <div className="leagueCountryLine">
                    {first.league.flag ? (
                      <SafeLogo src={first.league.flag} alt={first.league.country} fallbackText={first.league.country} size={14} />
                    ) : null}
                    <small>{first.league.country}</small>
                  </div>
                  <h3>{first.league.name}</h3>
                </div>
              </div>
              <Link className="leagueAction" href={`/leagues/${routeKey}`} prefetch={false}>League</Link>
            </div>

            {matches.map((match) => {
              const live = LIVE_STATUSES.has(match.status);
              return (
                <article className={live ? "matchRow liveRow" : "matchRow"} key={match.id}>
                  <div className={live ? "matchMeta liveMeta" : "matchMeta"}>
                    {live ? <span className="liveDot" /> : null}
                    <span>{displayStatus(match)}</span>
                  </div>

                  <Link className={match.home.winner ? "team winnerTeam" : "team"} href={teamUrl(match.home.name)} prefetch={false}>
                    <SafeLogo src={match.home.logo} alt={match.home.name} fallbackText={match.home.name} size={24} />
                    <span>{match.home.name}</span>
                    {match.home.winner ? <span className="winnerIndicator">Winner</span> : null}
                  </Link>

                  <Link className="score" href={matchUrl(match.home.name, match.away.name, match.id)} prefetch={false}>
                    <strong>{match.home.goals ?? "-"}</strong>
                    <span>:</span>
                    <strong>{match.away.goals ?? "-"}</strong>
                  </Link>

                  <Link className={match.away.winner ? "team away winnerTeam" : "team away"} href={teamUrl(match.away.name)} prefetch={false}>
                    {match.away.winner ? <span className="winnerIndicator">Winner</span> : null}
                    <span>{match.away.name}</span>
                    <SafeLogo src={match.away.logo} alt={match.away.name} fallbackText={match.away.name} size={24} />
                  </Link>

                  <div className="matchExtraMeta">
                    {match.referee ? (
                      <span><strong>Referee</strong> {match.referee}</span>
                    ) : null}
                    {match.venue.name ? (
                      <span><strong>Venue</strong> {match.venue.name}</span>
                    ) : null}
                    {match.venue.city ? (
                      <span><strong>City</strong> {match.venue.city}</span>
                    ) : null}
                    <span><strong>Season</strong> {match.league.season}</span>
                    {match.league.round ? (
                      <span><strong>Round</strong> {match.league.round}</span>
                    ) : null}
                    {match.extra ? (
                      <span><strong>Added time</strong> {match.extra} min</span>
                    ) : null}
                    {match.timezone ? (
                      <span><strong>Timezone</strong> {match.timezone}</span>
                    ) : null}
                    {match.timestamp ? (
                      <span><strong>Timestamp</strong> {match.timestamp}</span>
                    ) : null}
                    {periodTime(match.periods.first) ? (
                      <span><strong>1H start</strong> {periodTime(match.periods.first)}</span>
                    ) : null}
                    {periodTime(match.periods.second) ? (
                      <span><strong>2H start</strong> {periodTime(match.periods.second)}</span>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
