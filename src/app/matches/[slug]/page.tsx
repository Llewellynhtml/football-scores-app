import type { Metadata } from "next";
import { SafeLogo } from "@/components/SafeLogo";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { prettyDate, timeInSouthAfrica } from "@/lib/dates";
import { getFixtureById } from "@/lib/football";
import { fixtureIdFromSlug, teamUrl } from "@/lib/slug";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const id = fixtureIdFromSlug(slug);
  if (!id) return { title: "Match not found" };

  const match = await getFixtureById(id);
  if (!match) return { title: "Match not found" };

  return {
    title: `${match.home.name} vs ${match.away.name} | Football Scores`,
    description: `${match.home.name} vs ${match.away.name} in ${match.league.name}.`,
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
            <SafeLogo src={match.home.logo} alt={match.home.name} fallbackText={match.home.name} size={74} />
            <h2>{match.home.name}</h2>
          </Link>
          <div className="heroScore">
            <span className="statusBadge">{match.statusLong}</span>
            <div><strong>{match.home.goals ?? "—"}</strong><span>:</span><strong>{match.away.goals ?? "—"}</strong></div>
          </div>
          <Link className="matchTeamHero" href={teamUrl(match.away.name)}>
            <SafeLogo src={match.away.logo} alt={match.away.name} fallbackText={match.away.name} size={74} />
            <h2>{match.away.name}</h2>
          </Link>
        </div>

        <div className="matchFacts">
          <div><span>Date</span><strong>{prettyDate(date)}</strong></div>
          <div><span>Kick-off</span><strong>{timeInSouthAfrica(match.date)}</strong></div>
          <div><span>Venue</span><strong>{match.venue.name ?? "—"}</strong></div>
          <div><span>Referee</span><strong>{match.referee ?? "—"}</strong></div>
        </div>
      </section>
    </main>
  );
}
