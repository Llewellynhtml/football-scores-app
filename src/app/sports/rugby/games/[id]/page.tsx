import Link from "next/link";
import { notFound } from "next/navigation";
import { SafeLogo } from "@/components/SafeLogo";
import { LocalDateTime, LocalTimezoneLabel } from "@/components/LocalDateTime";
import { SiteHeader } from "@/components/SiteHeader";
import { getRugbyGameById } from "@/sports/rugby/provider";

type Props = { params: Promise<{ id: string }> };

export default async function RugbyGamePage({ params }: Props) {
  const { id } = await params;
  const gameId = Number(id);
  if (!Number.isInteger(gameId)) notFound();

  let game: Awaited<ReturnType<typeof getRugbyGameById>> = null;
  let apiError = false;

  try {
    game = await getRugbyGameById(gameId);
  } catch (error) {
    apiError = true;
    console.error("Unable to load API-Rugby game", { gameId, error });
  }

  if (!game && !apiError) notFound();

  if (!game) {
    return (
      <main>
        <SiteHeader />
        <section className="content pageTop">
          <div className="notice error">
            Rugby match data could not be loaded from API-Sports right now. Please try again later.
          </div>
          <Link className="button secondary" href="/sports/rugby">Back to Rugby</Link>
        </section>
      </main>
    );
  }

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">
          {game.league.country?.name ? `${game.league.country.name} · ` : ""}{game.league.name}
        </p>

        <div className="matchHero">
          <div className="matchTeamHero">
            <SafeLogo src={game.home.logo ?? null} alt={game.home.name} fallbackText={game.home.name} size={74} />
            <h2>{game.home.name}</h2>
          </div>

          <div className="heroScore">
            <span className="statusBadge">{game.status.long}</span>
            <div>
              <strong>{game.home.score ?? "—"}</strong>
              <span>:</span>
              <strong>{game.away.score ?? "—"}</strong>
            </div>
          </div>

          <div className="matchTeamHero">
            <SafeLogo src={game.away.logo ?? null} alt={game.away.name} fallbackText={game.away.name} size={74} />
            <h2>{game.away.name}</h2>
          </div>
        </div>

        <div className="matchFacts">
          <div><span>Date</span><strong>{game.timestamp ? <LocalDateTime value={game.timestamp} mode="date" /> : game.date || "—"}</strong></div>
          <div><span>Time</span><strong>{game.timestamp ? <LocalDateTime value={game.timestamp} mode="time" /> : game.time ?? "—"}</strong></div>
          <div><span>Your timezone</span><strong><LocalTimezoneLabel /></strong></div>
          <div><span>Competition</span><strong>{game.league.name}</strong></div>
          <div><span>Status</span><strong>{game.status.long}</strong></div>
        </div>

        <div style={{ marginTop: 24 }}>
          <Link className="button secondary" href="/sports/rugby">Back to Rugby</Link>
        </div>
      </section>
    </main>
  );
}
