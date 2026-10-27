import type { Metadata } from "next";
import { SafeLogo } from "@/components/SafeLogo";
import { SafeMedia } from "@/components/SafeMedia";
import { notFound } from "next/navigation";
import { MatchList } from "@/components/MatchList";
import { SiteHeader } from "@/components/SiteHeader";
import { getTeamBySlug, getTeamFixtures } from "@/lib/football";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  try {
    const team = await getTeamBySlug(slug);
    if (!team) return { title: "Team not found" };

    return {
      title: `${team.name} Fixtures & Team Profile | Football Scores`,
      description: `Latest ${team.name} team information and upcoming fixtures.`,
    };
  } catch (error) {
    console.error("Team metadata API error", { slug, error });
    return {
      title: "Football team | Live Sports",
      description: "Football team profile and fixtures.",
    };
  }
}

export default async function TeamPage({ params }: Props) {
  const { slug } = await params;
  let team: Awaited<ReturnType<typeof getTeamBySlug>> = null;
  let fixtures: Awaited<ReturnType<typeof getTeamFixtures>> = [];
  let apiError = false;

  try {
    team = await getTeamBySlug(slug);
  } catch (error) {
    apiError = true;
    console.error("Unable to load API-Football team", { slug, error });
  }

  if (!team && !apiError) notFound();

  if (team) {
    try {
      fixtures = await getTeamFixtures(team.id);
    } catch (error) {
      apiError = true;
      console.error("Unable to load API-Football team fixtures", { teamId: team.id, error });
    }
  }

  if (!team) {
    return (
      <main>
        <SiteHeader />
        <section className="content pageTop">
          <div className="notice error">
            Team data could not be loaded from API-Football right now. Please try again later.
          </div>
        </section>
      </main>
    );
  }

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

        <section className="teamProfileDetails">
          <div className="teamProfileFacts">
            <div>
              <span>Team code</span>
              <strong>{team.code ?? "—"}</strong>
            </div>
            <div>
              <span>National team</span>
              <strong className={team.national ? "teamFlagState active" : "teamFlagState"}>
                {team.national ? "Yes" : "No"}
              </strong>
            </div>
            <div>
              <span>Founded</span>
              <strong>{team.founded ?? "—"}</strong>
            </div>
            <div>
              <span>Country</span>
              <strong>{team.country}</strong>
            </div>
            <div>
              <span>Stadium</span>
              <strong>{team.venue?.name ?? "—"}</strong>
            </div>
            <div>
              <span>Address</span>
              <strong>{team.venue?.address ?? "—"}</strong>
            </div>
            <div>
              <span>City</span>
              <strong>{team.venue?.city ?? "—"}</strong>
            </div>
            <div>
              <span>Capacity</span>
              <strong>{team.venue?.capacity?.toLocaleString("en-ZA") ?? "—"}</strong>
            </div>
            <div>
              <span>Surface</span>
              <strong>{team.venue?.surface ?? "—"}</strong>
            </div>
          </div>

          {team.venue?.image ? (
            <div className="teamVenueCard">
              <SafeMedia src={team.venue.image} alt={team.venue.name ?? `${team.name} stadium`} />
              <div className="teamVenueCaption">
                <div>
                  <p className="eyebrow">HOME VENUE</p>
                  <h2>{team.venue.name ?? "Stadium"}</h2>
                </div>
                <span>{[team.venue.city, team.venue.capacity ? `${team.venue.capacity.toLocaleString("en-ZA")} capacity` : null].filter(Boolean).join(" · ")}</span>
              </div>
            </div>
          ) : null}
        </section>

        <div className="sectionHeading compactHeading">
          <div><p className="eyebrow">NEXT MATCHES</p><h2>Upcoming fixtures</h2></div>
          <span className="badge">{fixtures.length}</span>
        </div>

        {apiError ? (
          <div className="notice error">
            API-Football could not return this team&apos;s fixtures right now. The team page remains available.
          </div>
        ) : (
          <MatchList fixtures={fixtures} />
        )}
      </section>
    </main>
  );
}
