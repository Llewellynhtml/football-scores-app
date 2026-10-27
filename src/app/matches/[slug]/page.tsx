import type { Metadata } from "next";
import { SafeLogo } from "@/components/SafeLogo";
import { MatchCentreDetails } from "@/components/MatchCentreDetails";
import { LocalDateTime, LocalTimezoneLabel } from "@/components/LocalDateTime";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
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

  const scoreParts = [
    { label: "Half-time", short: "HT", score: match.scoreBreakdown.halftime },
    { label: "Full-time", short: "FT", score: match.scoreBreakdown.fulltime },
    { label: "Extra-time", short: "ET", score: match.scoreBreakdown.extratime },
    { label: "Penalties", short: "PEN", score: match.scoreBreakdown.penalty },
  ].filter(({ score }) => score.home !== null || score.away !== null);

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

        <section className="scoreBreakdownPanel" aria-label="Score breakdown">
          <div className="scoreBreakdownHeading">
            <div>
              <p className="eyebrow">SCORE BREAKDOWN</p>
              <h2>Match score by stage</h2>
            </div>
          </div>
          <div className="scoreBreakdownGrid">
            <div className="scoreBreakdownItem total">
              <span>Total</span>
              <strong>{match.home.goals ?? "—"}–{match.away.goals ?? "—"}</strong>
            </div>
            {scoreParts.map(({ label, short, score }) => (
              <div className="scoreBreakdownItem" key={short}>
                <span>{label}</span>
                <strong>{score.home ?? "—"}–{score.away ?? "—"}</strong>
                <small>{short}</small>
              </div>
            ))}
          </div>
        </section>

        <div className="matchFacts">
          <div><span>Date</span><strong><LocalDateTime value={match.date} mode="date" /></strong></div>
          <div><span>Kick-off</span><strong><LocalDateTime value={match.date} mode="time" /></strong></div>
          <div><span>Venue</span><strong>{match.venue.name ?? "—"}</strong></div>
          <div><span>City</span><strong>{match.venue.city ?? "—"}</strong></div>
          <div><span>Referee</span><strong>{match.referee ?? "—"}</strong></div>
          <div><span>Season</span><strong>{match.league.season}</strong></div>
          <div><span>Round</span><strong>{match.league.round ?? "—"}</strong></div>
          <div><span>Added time</span><strong>{match.extra ? `${match.extra} min` : "—"}</strong></div>
          <div><span>Your timezone</span><strong><LocalTimezoneLabel /></strong></div>
          <div><span>Source timezone</span><strong>{match.timezone ?? "UTC"}</strong></div>
          <div><span>Timestamp</span><strong>{match.timestamp ?? "—"}</strong></div>
          <div><span>First period</span><strong>{match.periods.first ? <LocalDateTime value={match.periods.first} mode="time" /> : "—"}</strong></div>
          <div><span>Second period</span><strong>{match.periods.second ? <LocalDateTime value={match.periods.second} mode="time" /> : "—"}</strong></div>
        </div>

        <MatchCentreDetails fixture={match} />
      </section>
    </main>
  );
}
