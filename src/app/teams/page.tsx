import Link from "next/link";
import { SafeLogo } from "@/components/SafeLogo";
import { SiteHeader } from "@/components/SiteHeader";
import { searchTeams, type TeamProfile } from "@/lib/football";
import { teamUrl } from "@/lib/slug";

type Props = {
  searchParams: Promise<{ q?: string }>;
};

export const metadata = {
  title: "Football Teams | Live Sports",
  description: "Search API-Football team data and open team profiles.",
};

export default async function TeamsPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  let teams: TeamProfile[] = [];
  let apiError = false;

  if (query.length >= 3) {
    try {
      teams = await searchTeams(query);
    } catch {
      apiError = true;
    }
  }

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">API-FOOTBALL TEAM SEARCH</p>
        <h1 className="pageTitle">Teams</h1>
        <p className="muted">
          Search results are returned by API-Football. No team names or team IDs are stored on this page.
        </p>

        <form className="teamSearchForm" action="/teams" method="get">
          <label>
            <span>Team name</span>
            <input
              type="search"
              name="q"
              minLength={3}
              defaultValue={query}
              placeholder="Search a team"
              required
            />
          </label>
          <button type="submit">Search</button>
        </form>

        {query && query.length < 3 ? (
          <div className="notice">Enter at least 3 characters to search API-Football.</div>
        ) : null}

        {apiError ? (
          <div className="notice error">Team data could not be loaded from API-Football right now.</div>
        ) : null}

        {query.length >= 3 && !apiError && !teams.length ? (
          <div className="emptyState">
            <h3>No teams found</h3>
            <p>API-Football returned no teams for this search.</p>
          </div>
        ) : null}

        {teams.length ? (
          <div className="teamSearchResults">
            {teams.map((team) => (
              <Link className="teamSearchCard" href={teamUrl(team.name)} key={team.id} prefetch={false}>
                <SafeLogo src={team.logo} alt={team.name} fallbackText={team.name} size={42} />
                <div>
                  <strong>{team.name}</strong>
                  <span>{team.country || "—"}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </main>
  );
}
