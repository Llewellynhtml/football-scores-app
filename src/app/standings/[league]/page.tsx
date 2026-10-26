import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getCompetition } from "@/config/competitions";
import { getStandings } from "@/lib/football";
import { teamUrl } from "@/lib/slug";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;
  const competition = getCompetition(league);
  if (!competition) return { title: "Standings not found" };
  return {
    title: `${competition.name} Standings | Football Scores`,
    description: `Current ${competition.name} table, points, wins, draws, losses and goal difference.`,
  };
}

export default async function StandingsPage({ params }: Props) {
  const { league } = await params;
  const competition = getCompetition(league);
  if (!competition) notFound();

  const standings = await getStandings(league);

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">{competition.shortName}</p>
        <div className="sectionHeading">
          <div>
            <h1 className="pageTitle">{competition.name} standings</h1>
            <p className="muted">Current league table from API-Football.</p>
          </div>
          <Link className="button secondary" href={`/leagues/${competition.slug}`}>Fixtures</Link>
        </div>

        {!standings.length ? (
          <div className="emptyState"><h3>No standings loaded</h3><p>Add the API key or try again after the cache refreshes.</p></div>
        ) : (
          <div className="tableWrap">
            <table className="standingsTable">
              <thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.team.id}>
                    <td>{row.rank}</td>
                    <td>
                      <Link className="tableTeam" href={teamUrl(row.team.name)}>
                        <Image src={row.team.logo} alt="" width={24} height={24} />
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
