import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { GenericEventList } from "@/components/GenericEventList";
import { LocalDateTime } from "@/components/LocalDateTime";
import { SiteHeader } from "@/components/SiteHeader";
import { dateInUtc } from "@/lib/dates";
import { getEventsByDate, sportHasKey } from "@/sports/generic/provider";
import { getSport } from "@/sports/registry";
import type { UnifiedSportEvent, EventValidationBatch } from "@/sports/generic/types";

type Props = {
  params: Promise<{ sport: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport: slug } = await params;
  const sport = getSport(slug);
  if (!sport) return { title: "Sport not found" };
  return {
    title: `${sport.name} Scores & Fixtures | Live Sports`,
    description: `${sport.name} live scores, fixtures and results.`,
  };
}

export default async function SportPage({ params }: Props) {
  const { sport: slug } = await params;
  const sport = getSport(slug);
  if (!sport) notFound();
  if (slug === "football") redirect("/");
  if (slug === "rugby") redirect("/sports/rugby");

  const date = dateInUtc();
  let events: UnifiedSportEvent[] = [];
  let diagnostics: EventValidationBatch["diagnostics"] = { received: 0, accepted: 0, rejected: 0, reasons: {} };
  let apiError = false;

  try {
    const batch = await getEventsByDate(slug, date);
    events = batch.events;
    diagnostics = batch.diagnostics;
  } catch {
    apiError = true;
  }

  return (
    <main>
      <SiteHeader />

      <div className="sportScoreShell">
        <section className="scoreboardIntro sportScoreIntro">
          <div>
            <p className="eyebrow">{sport.name.toUpperCase()}</p>
            <h1>{sport.name} scores</h1>
            <p><LocalDateTime value={date} mode="date" /> · Your local time</p>
          </div>
          <div className="scoreboardMetric">
            <span>{apiError ? "—" : events.length}</span>
            <small>events</small>
          </div>
        </section>

        <section className="scorePanel">
          {!sportHasKey(slug) && (
            <div className="notice">
              No API-Sports key is available to this module yet. Add <code>API_SPORTS_KEY</code> or the sport-specific key in Hostinger.
            </div>
          )}

          {apiError ? (
            <div className="notice error">
              API-Sports could not return {sport.name} data right now. This is usually caused by a temporary rate limit, daily quota, or provider availability issue.
            </div>
          ) : null}

          {!apiError && diagnostics.rejected > 0 && (
            <div className="notice validationNotice">
              {diagnostics.rejected} malformed API record{diagnostics.rejected === 1 ? "" : "s"} were safely skipped.
            </div>
          )}

          {!apiError ? (
            <>
              <div className="sectionHeading compactScoreHeading">
                <div>
                  <p className="eyebrow">LIVE DATA</p>
                  <h2><LocalDateTime value={date} mode="date" /></h2>
                </div>
                <span className="badge">15 min free-tier cache</span>
              </div>

              <GenericEventList events={events} icon={sport.icon} />
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
