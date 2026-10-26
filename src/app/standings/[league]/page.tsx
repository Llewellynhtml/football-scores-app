import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeLogo } from "@/components/SafeLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { getStandings, resolveLeague } from "@/lib/football";
import { teamUrl } from "@/lib/slug";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;
  const competition = await resolveLeague(league);
  if (!competition) return { title: "Standings not found" };

  return {
    title: `${competition.name} Standings | Live Sports`,
    description: `Current ${competition.name} table, points, wins, draws, losses and goal difference.`,
  };
}

export default async function StandingsPage({ params }: Props) {
  const { league } = await params;
  const competition = await resolveLeague(league);
  if (!competition) notFound();

  const standings = competition.season.coverage.standings
    ? await getStandings(league)
    : [];

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">{competition.country.name} · {competition.type}</p>
        <div className="sectionHeading">
          <div>
            <h1 className="pageTitle">{competition.name} standings</h1>
            <p className="muted">Season {competition.season.year} table from API-Football.</p>
          </div>
          <Link className="button secondary" href={`/leagues/${league}`}>Fixtures</Link>
        </div>

        {!competition.season.coverage.standings ? (
          <div className="emptyState">
            <h3>Standings are not covered</h3>
            <p>API-Football does not currently report standings coverage for this competition and season.</p>
          </div>
        ) : !standings.length ? (
          <div className="emptyState">
            <h3>No standings loaded</h3>
            <p>The table may not be available yet for this phase of the competition.</p>
          </div>
        ) : (
          <div className="tableWrap">
            <table className="standingsTable">
              <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.team.id}>
                    <td>{row.rank}</td>
                    <td>
                      <Link className="tableTeam" href={teamUrl(row.team.name)} prefetch={false}>
                        <SafeLogo src={row.team.logo} alt={row.team.name} fallbackText={row.team.name} size={24} />
                        <span>{row.team.name}</span>
                      </Link>
                    </td>
                    <td>{row.played}</td><td>{row.win}</td><td>{row.draw}</td><td>{row.lose}</td>
                    <td>{row.goalsDiff > 0 ? `+${row.goalsDiff}` : row.goalsDiff}</td>
                    <td><strong>{row.points}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
