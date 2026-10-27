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

  try {
    const match = await getFixtureById(id);
    if (!match) return { title: "Match not found" };

    return {
      title: `${match.home.name} vs ${match.away.name} | Football Scores`,
      description: `${match.home.name} vs ${match.away.name} in ${match.league.name}.`,
    };
  } catch (error) {
    console.error("Match metadata API error", { id, error });
    return {
      title: "Football match | Live Sports",
      description: "Football match details.",
    };
  }
}

export default async function MatchPage({ params }: Props) {
  const { slug } = await params;
  const id = fixtureIdFromSlug(slug);
  if (!id) notFound();

  let match: Awaited<ReturnType<typeof getFixtureById>> = null;
  let apiError = false;

  try {
    match = await getFixtureById(id);
  } catch (error) {
    apiError = true;
    console.error("Unable to load API-Football match", { id, error });
  }

  if (!match && !apiError) notFound();

  if (!match) {
    return (
      <main>
        <SiteHeader />
        <section className="content pageTop">
          <div className="notice error">
            Match data could not be loaded from API-Football right now. Please try again later.
          </div>
          <Link className="button secondary" href="/">Back to scores</Link>
        </section>
      </main>
    );
  }

  const date = match.date.slice(0, 10);
  const firstPeriod = match.periods.first
    ? timeInSouthAfrica(new Date(match.periods.first * 1000).toISOString())
    : "—";
  const secondPeriod = match.periods.second
    ? timeInSouthAfrica(new Date(match.periods.second * 1000).toISOString())
    : "—";

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <div className="matchLeagueEyebrow">
          {match.league.flag ? (
            <SafeLogo src={match.league.flag} alt={match.league.country} fallbackText={match.league.country} size={16} />
          ) : null}
          <p className="eyebrow">{match.league.country} · {match.league.name}</p>
        </div>
        <div className="matchHero">
          <Link className="matchTeamHero" href={teamUrl(match.home.name)}>
            <SafeLogo src={match.home.logo} alt={match.home.name} fallbackText={match.home.name} size={74} />
            <h2>{match.home.name}</h2>
            {match.home.winner ? <span className="winnerIndicator heroWinner">Winner</span> : null}
          </Link>
          <div className="heroScore">
            <span className="statusBadge">{match.statusLong}</span>
            <div><strong>{match.home.goals ?? "—"}</strong><span>:</span><strong>{match.away.goals ?? "—"}</strong></div>
          </div>
          <Link className="matchTeamHero" href={teamUrl(match.away.name)}>
            <SafeLogo src={match.away.logo} alt={match.away.name} fallbackText={match.away.name} size={74} />
            <h2>{match.away.name}</h2>
            {match.away.winner ? <span className="winnerIndicator heroWinner">Winner</span> : null}
          </Link>
        </div>

        <div className="matchFacts">
          <div><span>Date</span><strong>{prettyDate(date)}</strong></div>
          <div><span>Kick-off</span><strong>{timeInSouthAfrica(match.date)}</strong></div>
          <div><span>Venue</span><strong>{match.venue.name ?? "—"}</strong></div>
          <div><span>City</span><strong>{match.venue.city ?? "—"}</strong></div>
          <div><span>Referee</span><strong>{match.referee ?? "—"}</strong></div>
          <div><span>Season</span><strong>{match.league.season}</strong></div>
          <div><span>Round</span><strong>{match.league.round ?? "—"}</strong></div>
          <div><span>Added time</span><strong>{match.extra ? `${match.extra} min` : "—"}</strong></div>
          <div><span>Timezone</span><strong>{match.timezone ?? "—"}</strong></div>
          <div><span>Timestamp</span><strong>{match.timestamp ?? "—"}</strong></div>
          <div><span>First period</span><strong>{firstPeriod}</strong></div>
          <div><span>Second period</span><strong>{secondPeriod}</strong></div>
        </div>
      </section>
    </main>
  );
}
