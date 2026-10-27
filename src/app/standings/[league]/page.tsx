import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeLogo } from "@/components/SafeLogo";
import { LocalDateTime } from "@/components/LocalDateTime";
import { SiteHeader } from "@/components/SiteHeader";
import { getStandings, resolveLeague, type LeagueCatalogItem, type StandingRecord, type StandingRow } from "@/lib/football";
import { teamUrl } from "@/lib/slug";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;

  try {
    const competition = await resolveLeague(league);
    if (!competition) return { title: "Standings not found" };

    return {
      title: `${competition.name} Standings | Live Sports`,
      description: `Current ${competition.name} table, points, wins, draws, losses, form, home and away records.`,
    };
  } catch (error) {
    console.error("Standings metadata API error", { league, error });
    return {
      title: "Football standings | Live Sports",
      description: "Football league standings.",
    };
  }
}

function recordText(record: StandingRecord) {
  return `${record.win}-${record.draw}-${record.lose}`;
}

function goalsText(record: StandingRecord) {
  return `${record.goalsFor}:${record.goalsAgainst}`;
}


function FormCell({ form }: { form: string | null }) {
  if (!form) return <span className="standingsMuted">—</span>;

  return (
    <span className="formRun" aria-label={`Form ${form}`}>
      {form.split("").map((result, index) => (
        <span className={`formResult form-${result.toLowerCase()}`} key={`${result}-${index}`}>
          {result}
        </span>
      ))}
    </span>
  );
}

export default async function StandingsPage({ params }: Props) {
  const { league } = await params;
  let competition: LeagueCatalogItem | null = null;
  let standings: StandingRow[] = [];
  let apiError = false;

  try {
    competition = await resolveLeague(league);
  } catch (error) {
    apiError = true;
    console.error("Unable to resolve API-Football standings league", { league, error });
  }

  if (!competition && !apiError) notFound();

  if (competition?.season.coverage.standings) {
    try {
      standings = await getStandings(competition.routeKey);
    } catch (error) {
      apiError = true;
      console.error("Unable to load API-Football standings", {
        league: competition.routeKey,
        error,
      });
    }
  }

  if (!competition) {
    return (
      <main>
        <SiteHeader />
        <section className="content pageTop">
          <div className="notice error">
            Standings data could not be loaded from API-Football right now. Please try again later.
          </div>
          <Link className="button secondary" href="/leagues">All leagues</Link>
        </section>
      </main>
    );
  }

  const groupedStandings = standings.reduce<Record<string, StandingRow[]>>((groups, row) => {
    const group = row.group?.trim() || "Standings";
    (groups[group] ??= []).push(row);
    return groups;
  }, {});

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">{competition.country.name} · {competition.type}</p>
        <div className="sectionHeading">
          <div>
            <h1 className="pageTitle">{competition.name} standings</h1>
            <p className="muted">
              Season {competition.season.year}. Rank, records, form, movement and qualification/relegation zones are supplied by API-Football.
            </p>
          </div>
          <Link className="button secondary" href={`/leagues/${competition.routeKey}`}>Fixtures</Link>
        </div>

        {apiError ? (
          <div className="notice error">
            API-Football could not return standings for this competition right now. The page remains available instead of failing.
          </div>
        ) : !competition.season.coverage.standings ? (
          <div className="emptyState">
            <h3>Standings are not covered</h3>
            <p>API-Football does not currently report standings coverage for this competition and season.</p>
          </div>
        ) : !standings.length ? (
          <div className="emptyState">
            <h3>No standings loaded</h3>
            <p>API-Football returned no standings for this competition and season.</p>
          </div>
        ) : (
          <div className="standingsGroups">
            {Object.entries(groupedStandings).map(([group, rows]) => (
              <section className="standingsGroup" key={group}>
                <div className="standingsGroupHeading">
                  <div>
                    <p className="eyebrow">GROUP</p>
                    <h2>{group}</h2>
                  </div>
                  <span className="badge">{rows.length} teams</span>
                </div>

                <div className="tableWrap">
                  <table className="standingsTable standingsTableDetailed">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Club</th>
                        <th>P</th><th>W</th><th>D</th><th>L</th>
                        <th>GF</th><th>GA</th><th>GD</th><th>Pts</th>
                        <th>Form</th>
                        <th>Status</th>
                        <th>Home</th>
                        <th>Away</th>
                        <th>Zone / description</th>
                        <th>Updated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={`${group}-${row.team.id}-${row.rank}`}>
                          <td>{row.rank}</td>
                          <td>
                            <Link className="tableTeam" href={teamUrl(row.team.name)} prefetch={false}>
                              <SafeLogo src={row.team.logo} alt={row.team.name} fallbackText={row.team.name} size={24} />
                              <span>{row.team.name}</span>
                            </Link>
                          </td>
                          <td>{row.played}</td>
                          <td>{row.win}</td>
                          <td>{row.draw}</td>
                          <td>{row.lose}</td>
                          <td>{row.goalsFor}</td>
                          <td>{row.goalsAgainst}</td>
                          <td>{row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}</td>
                          <td><strong>{row.points}</strong></td>
                          <td><FormCell form={row.form} /></td>
                          <td>
                            {row.status ? (
                              <span className={`standingStatus standingStatus-${row.status.toLowerCase()}`}>{row.status}</span>
                            ) : <span className="standingsMuted">—</span>}
                          </td>
                          <td>
                            <div className="standingSplit">
                              <strong>{recordText(row.home)}</strong>
                              <small>{goalsText(row.home)} GF:GA</small>
                            </div>
                          </td>
                          <td>
                            <div className="standingSplit">
                              <strong>{recordText(row.away)}</strong>
                              <small>{goalsText(row.away)} GF:GA</small>
                            </div>
                          </td>
                          <td className="standingDescription">{row.description ?? "—"}</td>
                          <td className="standingUpdated">{row.update ? <LocalDateTime value={row.update} mode="datetime" /> : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
