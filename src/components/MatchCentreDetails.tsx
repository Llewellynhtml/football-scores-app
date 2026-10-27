import { SafeLogo } from "@/components/SafeLogo";
import type {
  Fixture,
  FixtureLineup,
  FixturePlayerPerformance,
  FixtureTeamStatistics,
} from "@/lib/football";

function eventMinute(elapsed: number | null, extra: number | null) {
  if (elapsed === null) return "—";
  return extra ? `${elapsed}+${extra}'` : `${elapsed}'`;
}

function statValue(value: string | number | null) {
  if (value === null || value === "") return "—";
  return String(value);
}

function compactPair(a: number | null, b: number | null) {
  if (a === null && b === null) return "—";
  return `${a ?? "—"}/${b ?? "—"}`;
}

function playerRows(players: FixturePlayerPerformance[]) {
  return players.filter((entry) => entry.player.name);
}

function TeamLineup({ lineup }: { lineup: FixtureLineup }) {
  return (
    <section className="lineupTeamCard">
      <div className="matchCentreTeamHeader">
        <SafeLogo
          src={lineup.team.logo}
          alt={lineup.team.name ?? "Team"}
          fallbackText={lineup.team.name ?? "Team"}
          size={34}
        />
        <div>
          <strong>{lineup.team.name ?? "Team"}</strong>
          <span>{lineup.formation ? `Formation ${lineup.formation}` : "Formation unavailable"}</span>
        </div>
      </div>

      {lineup.coach.name ? (
        <div className="coachRow">
          <SafeLogo
            src={lineup.coach.photo}
            alt={lineup.coach.name}
            fallbackText={lineup.coach.name}
            size={30}
          />
          <div><span>Coach</span><strong>{lineup.coach.name}</strong></div>
        </div>
      ) : null}

      <div className="lineupListBlock">
        <h3>Starting XI</h3>
        {lineup.startXI.length ? (
          <div className="lineupPlayers">
            {lineup.startXI.map((player, index) => (
              <div className="lineupPlayer" key={player.id ?? `start-${index}`}>
                <span className="shirtNumber">{player.number ?? "—"}</span>
                <div>
                  <strong>{player.name ?? "—"}</strong>
                  <small>{[player.pos, player.grid].filter(Boolean).join(" · ") || "—"}</small>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="matchCentreEmpty">Starting XI not supplied by API-Football.</p>}
      </div>

      <div className="lineupListBlock">
        <h3>Substitutes</h3>
        {lineup.substitutes.length ? (
          <div className="lineupPlayers">
            {lineup.substitutes.map((player, index) => (
              <div className="lineupPlayer" key={player.id ?? `sub-${index}`}>
                <span className="shirtNumber">{player.number ?? "—"}</span>
                <div>
                  <strong>{player.name ?? "—"}</strong>
                  <small>{player.pos ?? "—"}</small>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="matchCentreEmpty">Substitutes not supplied by API-Football.</p>}
      </div>
    </section>
  );
}

function TeamStatistics({ left, right }: { left?: FixtureTeamStatistics; right?: FixtureTeamStatistics }) {
  const types = Array.from(new Set([
    ...(left?.statistics.map((stat) => stat.type) ?? []),
    ...(right?.statistics.map((stat) => stat.type) ?? []),
  ]));

  if (!types.length) return <p className="matchCentreEmpty">Team statistics are not available for this fixture.</p>;

  const leftMap = new Map(left?.statistics.map((stat) => [stat.type, stat.value]) ?? []);
  const rightMap = new Map(right?.statistics.map((stat) => [stat.type, stat.value]) ?? []);

  return (
    <div className="teamStatsTable">
      <div className="teamStatsHeader">
        <strong>{left?.team.name ?? "Home"}</strong>
        <span>Statistic</span>
        <strong>{right?.team.name ?? "Away"}</strong>
      </div>
      {types.map((type) => (
        <div className="teamStatsRow" key={type}>
          <strong>{statValue(leftMap.get(type) ?? null)}</strong>
          <span>{type}</span>
          <strong>{statValue(rightMap.get(type) ?? null)}</strong>
        </div>
      ))}
    </div>
  );
}

function PlayerStatistics({ fixture }: { fixture: Fixture }) {
  if (!fixture.players.length) {
    return <p className="matchCentreEmpty">Player statistics are not available for this fixture.</p>;
  }

  return (
    <div className="playerStatsTeams">
      {fixture.players.map((team) => {
        const rows = playerRows(team.players);
        return (
          <section className="playerStatsTeam" key={team.team.id ?? team.team.name ?? "team"}>
            <div className="matchCentreTeamHeader">
              <SafeLogo
                src={team.team.logo}
                alt={team.team.name ?? "Team"}
                fallbackText={team.team.name ?? "Team"}
                size={32}
              />
              <strong>{team.team.name ?? "Team"}</strong>
            </div>

            {!rows.length ? (
              <p className="matchCentreEmpty">No player statistics supplied.</p>
            ) : (
              <div className="playerStatsTableWrap">
                <table className="playerStatsTable">
                  <thead>
                    <tr>
                      <th>Player</th><th>Min</th><th>Pos</th><th>Rating</th><th>G</th><th>A</th>
                      <th>Shots</th><th>Passes</th><th>Key</th><th>Acc</th><th>Tkl</th><th>Int</th>
                      <th>Duels</th><th>Drib</th><th>Fouls</th><th>Y/R</th><th>Saves</th><th>Off</th><th>Pen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry, index) => (
                      <tr key={entry.player.id ?? `${entry.player.name}-${index}`}>
                        <td>
                          <div className="playerIdentity">
                            <SafeLogo
                              src={entry.player.photo}
                              alt={entry.player.name ?? "Player"}
                              fallbackText={entry.player.name ?? "Player"}
                              size={28}
                            />
                            <span>
                              <strong>{entry.player.name ?? "—"}</strong>
                              {entry.games.captain ? <small>Captain</small> : entry.games.substitute ? <small>Sub</small> : null}
                            </span>
                          </div>
                        </td>
                        <td>{entry.games.minutes ?? "—"}</td>
                        <td>{entry.games.position ?? "—"}</td>
                        <td>{entry.games.rating ?? "—"}</td>
                        <td>{entry.goals.total ?? "—"}</td>
                        <td>{entry.goals.assists ?? "—"}</td>
                        <td>{compactPair(entry.shots.on, entry.shots.total)}</td>
                        <td>{entry.passes.total ?? "—"}</td>
                        <td>{entry.passes.key ?? "—"}</td>
                        <td>{entry.passes.accuracy ?? "—"}</td>
                        <td>{entry.tackles.total ?? "—"}</td>
                        <td>{entry.tackles.interceptions ?? "—"}</td>
                        <td>{compactPair(entry.duels.won, entry.duels.total)}</td>
                        <td>{compactPair(entry.dribbles.success, entry.dribbles.attempts)}</td>
                        <td>{compactPair(entry.fouls.drawn, entry.fouls.committed)}</td>
                        <td>{compactPair(entry.cards.yellow, entry.cards.red)}</td>
                        <td>{entry.goals.saves ?? "—"}</td>
                        <td>{entry.offsides ?? "—"}</td>
                        <td>{compactPair(entry.penalty.scored, entry.penalty.missed)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function MatchCentreDetails({ fixture }: { fixture: Fixture }) {
  const hasAny = fixture.events.length || fixture.lineups.length || fixture.statistics.length || fixture.players.length;

  if (!hasAny) {
    return (
      <section className="matchCentreSection">
        <div className="matchCentreHeading">
          <p className="eyebrow">MATCH CENTRE</p>
          <h2>Detailed match data</h2>
        </div>
        <p className="matchCentreEmpty">
          API-Football did not supply events, lineups, team statistics or player statistics for this fixture.
        </p>
      </section>
    );
  }

  return (
    <div className="matchCentre">
      <section className="matchCentreSection">
        <div className="matchCentreHeading">
          <p className="eyebrow">EVENTS</p>
          <h2>Match timeline</h2>
        </div>
        {fixture.events.length ? (
          <div className="eventTimeline">
            {fixture.events.map((event, index) => (
              <div className="eventTimelineRow" key={`${event.time.elapsed}-${event.type}-${event.player.id ?? index}`}>
                <span className="eventMinute">{eventMinute(event.time.elapsed, event.time.extra)}</span>
                <SafeLogo
                  src={event.team.logo}
                  alt={event.team.name ?? "Team"}
                  fallbackText={event.team.name ?? "Team"}
                  size={24}
                />
                <div className="eventTimelineText">
                  <strong>{event.player.name ?? event.team.name ?? event.type ?? "Event"}</strong>
                  <span>
                    {[event.type, event.detail, event.assist.name ? `Assist: ${event.assist.name}` : null, event.comments]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : <p className="matchCentreEmpty">No event timeline supplied by API-Football.</p>}
      </section>

      <section className="matchCentreSection">
        <div className="matchCentreHeading">
          <p className="eyebrow">LINEUPS</p>
          <h2>Teams and formations</h2>
        </div>
        {fixture.lineups.length ? (
          <div className="lineupsGrid">
            {fixture.lineups.map((lineup, index) => (
              <TeamLineup lineup={lineup} key={lineup.team.id ?? `lineup-${index}`} />
            ))}
          </div>
        ) : <p className="matchCentreEmpty">Lineups are not available for this fixture.</p>}
      </section>

      <section className="matchCentreSection">
        <div className="matchCentreHeading">
          <p className="eyebrow">STATISTICS</p>
          <h2>Team statistics</h2>
        </div>
        <TeamStatistics left={fixture.statistics[0]} right={fixture.statistics[1]} />
      </section>

      <section className="matchCentreSection">
        <div className="matchCentreHeading">
          <p className="eyebrow">PLAYER STATISTICS</p>
          <h2>Individual performances</h2>
        </div>
        <PlayerStatistics fixture={fixture} />
      </section>
    </div>
  );
}
