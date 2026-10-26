import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getRugbyGameById } from "@/sports/rugby/provider";

type Props = { params: Promise<{ id: string }> };

export default async function RugbyGamePage({ params }: Props) {
  const { id } = await params;
  const gameId = Number(id);
  if (!Number.isInteger(gameId)) notFound();

  const game = await getRugbyGameById(gameId);
  if (!game) notFound();

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">
          {game.league.country?.name ? `${game.league.country.name} · ` : ""}{game.league.name}
        </p>

        <div className="matchHero">
          <div className="matchTeamHero">
            {game.home.logo ? <Image src={game.home.logo} alt={game.home.name} width={74} height={74} /> : <div className="sportLandingIcon">🏉</div>}
            <h2>{game.home.name}</h2>
          </div>

          <div className="heroScore">
            <span className="statusBadge">{game.status.long}</span>
            <div>
              <strong>{game.home.score ?? "-"}</strong>
              <span>:</span>
              <strong>{game.away.score ?? "-"}</strong>
            </div>
          </div>

          <div className="matchTeamHero">
            {game.away.logo ? <Image src={game.away.logo} alt={game.away.name} width={74} height={74} /> : <div className="sportLandingIcon">🏉</div>}
            <h2>{game.away.name}</h2>
          </div>
        </div>

        <div className="matchFacts">
          <div><span>Date</span><strong>{game.date || "—"}</strong></div>
          <div><span>Time</span><strong>{game.time ?? "—"}</strong></div>
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
