import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { SiteHeader } from "@/components/SiteHeader";
import { getTeamBySlug, getTeamFixtures } from "@/lib/football";
import { humanizeSlug } from "@/lib/slug";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const name = humanizeSlug(slug);
  return {
    title: `${name} Fixtures & Team Profile | Football Scores`,
    description: `Latest ${name} team information and upcoming fixtures.`,
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
          <Image src={team.logo} alt={team.name} width={84} height={84} />
          <div>
            <p className="eyebrow">{team.country}</p>
            <h1 className="pageTitle">{team.name}</h1>
            <p className="muted">
              {team.founded ? `Founded ${team.founded}` : "Football club"}
              {team.venue?.name ? ` · ${team.venue.name}` : ""}
            </p>
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
