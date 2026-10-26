import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { SiteHeader } from "@/components/SiteHeader";
import { getCompetition } from "@/config/competitions";
import { getLeagueFixtures } from "@/lib/football";

type Props = { params: Promise<{ league: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { league } = await params;
  const competition = getCompetition(league);
  if (!competition) return { title: "League not found" };
  return {
    title: `${competition.name} Fixtures & Results | Football Scores`,
    description: `Latest ${competition.name} fixtures and results.`,
  };
}

export default async function LeaguePage({ params }: Props) {
  const { league } = await params;
  const competition = getCompetition(league);
  if (!competition) notFound();

  const fixtures = await getLeagueFixtures(league);

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">{competition.country}</p>
        <div className="sectionHeading">
          <div>
            <h1 className="pageTitle">{competition.name}</h1>
            <p className="muted">Recent and upcoming fixtures for the current season.</p>
          </div>
          <Link className="button" href={`/standings/${competition.slug}`}>View standings</Link>
        </div>
        <MatchList fixtures={fixtures} />
      </section>
    </main>
  );
}
