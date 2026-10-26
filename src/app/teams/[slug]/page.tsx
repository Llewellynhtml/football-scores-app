import type { Metadata } from "next";
import { SafeLogo } from "@/components/SafeLogo";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { SiteHeader } from "@/components/SiteHeader";
import { getTeamBySlug, getTeamFixtures } from "@/lib/football";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) return { title: "Team not found" };

  return {
    title: `${team.name} Fixtures & Team Profile | Football Scores`,
    description: `Latest ${team.name} team information and upcoming fixtures.`,
  };
}

export default async function TeamPage({ params }: Props) {
  const { slug } = await params;
  const team = await getTeamBySlug(slug);
  if (!team) notFound();

  const fixtures = await getTeamFixtures(team.id);

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <div className="teamHero">
          <SafeLogo src={team.logo} alt={team.name} fallbackText={team.name} size={84} />
          <div>
            <p className="eyebrow">{team.country}</p>
            <h1 className="pageTitle">{team.name}</h1>
            {team.founded || team.venue?.name ? (
              <p className="muted">
                {team.founded ? `Founded ${team.founded}` : ""}
                {team.founded && team.venue?.name ? " · " : ""}
                {team.venue?.name ?? ""}
              </p>
            ) : null}
          </div>
        </div>

        <div className="sectionHeading compactHeading">
          <div><p className="eyebrow">NEXT MATCHES</p><h2>Upcoming fixtures</h2></div>
          <span className="badge">{fixtures.length}</span>
        </div>
        <MatchList fixtures={fixtures} />
      </section>
    </main>
  );
}
