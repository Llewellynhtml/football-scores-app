import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { prettyDate, timeInSouthAfrica } from "@/lib/dates";
import { getFixtureById } from "@/lib/football";
import { fixtureIdFromSlug, humanizeSlug, teamUrl } from "@/lib/slug";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: `${humanizeSlug(slug)} | Football Scores`,
    description: "Match score, status, teams, venue and competition details.",
  };
}

export default async function MatchPage({ params }: Props) {
  const { slug } = await params;
  const id = fixtureIdFromSlug(slug);
  if (!id) notFound();

  const match = await getFixtureById(id);
  if (!match) notFound();

  const date = match.date.slice(0, 10);

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">{match.league.country} · {match.league.name}</p>
        <div className="matchHero">
          <Link className="matchTeamHero" href={teamUrl(match.home.name)}>
            <Image src={match.home.logo} alt={match.home.name} width={74} height={74} />
            <h2>{match.home.name}</h2>
          </Link>
          <div className="heroScore">
            <span className="statusBadge">{match.statusLong}</span>
            <div><strong>{match.home.goals ?? "-"}</strong><span>:</span><strong>{match.away.goals ?? "-"}</strong></div>
          </div>
          <Link className="matchTeamHero" href={teamUrl(match.away.name)}>
            <Image src={match.away.logo} alt={match.away.name} width={74} height={74} />
            <h2>{match.away.name}</h2>
          </Link>
        </div>

        <div className="matchFacts">
          <div><span>Date</span><strong>{prettyDate(date)}</strong></div>
          <div><span>Kick-off</span><strong>{timeInSouthAfrica(match.date)}</strong></div>
          <div><span>Venue</span><strong>{match.venue.name ?? "TBC"}</strong></div>
          <div><span>Referee</span><strong>{match.referee ?? "TBC"}</strong></div>
        </div>
      </section>
    </main>
  );
}
