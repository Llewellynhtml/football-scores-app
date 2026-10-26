import Image from "next/image";
import { getTodayFixtures } from "@/lib/api-football";
import type { Fixture } from "@/types/football";

function formatKickoff(date: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).format(new Date(date));
}

function scoreValue(value: number | null) {
  return value === null ? "–" : String(value);
}

function MatchCard({ match }: { match: Fixture }) {
  const live = ["1H", "HT", "2H", "ET", "BT", "P", "SUSP", "INT", "LIVE"].includes(
    match.fixture.status.short,
  );

  return (
    <article className="match-card">
      <div className="match-meta">
        <span>{match.league.name}</span>
        <span className={live ? "status live" : "status"}>
          {live
            ? `${match.fixture.status.elapsed ?? ""}' LIVE`
            : match.fixture.status.short === "NS"
              ? formatKickoff(match.fixture.date)
              : match.fixture.status.long}
        </span>
      </div>
      <div className="team-row">
        <div className="team">
          <Image
            src={match.teams.home.logo}
            alt=""
            width={28}
            height={28}
            unoptimized
          />
          <span>{match.teams.home.name}</span>
        </div>
        <strong>{scoreValue(match.goals.home)}</strong>
      </div>
      <div className="team-row">
        <div className="team">
          <Image
            src={match.teams.away.logo}
            alt=""
            width={28}
            height={28}
            unoptimized
          />
          <span>{match.teams.away.name}</span>
        </div>
        <strong>{scoreValue(match.goals.away)}</strong>
      </div>
    </article>
  );
}

export default async function Home() {
  const fixtures = await getTodayFixtures();
  const hasApiKey = Boolean(process.env.API_FOOTBALL_KEY);

  return (
    <>
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <span className="eyebrow">Football, without the noise</span>
            <h1>Scores, fixtures and standings built for speed.</h1>
            <p>
              Follow today&apos;s football, then move naturally into league,
              team and match pages designed for both fans and search.
            </p>
          </div>
          <div className="hero-stat">
            <span>Today</span>
            <strong>{fixtures.length}</strong>
            <small>fixtures loaded</small>
          </div>
        </div>
      </section>

      <section className="shell content-grid">
        <div>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Match centre</span>
              <h2>Today&apos;s fixtures</h2>
            </div>
            <span className="updated">Africa/Johannesburg time</span>
          </div>

          {fixtures.length > 0 ? (
            <div className="matches">
              {fixtures.slice(0, 30).map((match) => (
                <MatchCard key={match.fixture.id} match={match} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h3>{hasApiKey ? "No fixtures returned yet" : "API connection ready"}</h3>
              <p>
                {hasApiKey
                  ? "The application is connected, but API-Football returned no fixtures for the current date."
                  : "Add API_FOOTBALL_KEY in the hosting environment to load live football data. The key is never exposed to the browser."}
              </p>
            </div>
          )}
        </div>

        <aside className="sidebar-card">
          <span className="eyebrow">MVP roadmap</span>
          <h2>Built to grow</h2>
          <ol>
            <li>Today&apos;s fixtures and results</li>
            <li>League standings</li>
            <li>Team and league pages</li>
            <li>Match centre and statistics</li>
            <li>SEO content and internal linking</li>
          </ol>
        </aside>
      </section>
    </>
  );
}
