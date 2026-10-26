import Link from "next/link";
import { FEATURED_COMPETITIONS } from "@/config/competitions";

export function FootballSidebar() {
  return (
    <aside className="scoreSidebar" aria-label="Football navigation">
      <div className="sidebarSection">
        <div className="sidebarLabel">Football</div>
        <Link className="sidebarItem active" href="/">
          <span className="sidebarIcon">⚽</span>
          <span>All matches</span>
        </Link>
        <Link className="sidebarItem" href="/leagues">
          <span className="sidebarIcon">▦</span>
          <span>All leagues</span>
        </Link>
        <Link className="sidebarItem" href="/teams">
          <span className="sidebarIcon">♙</span>
          <span>Teams</span>
        </Link>
      </div>

      <div className="sidebarSection">
        <div className="sidebarLabel">Featured leagues</div>
        {FEATURED_COMPETITIONS.map((competition) => (
          <Link className="sidebarItem" href={`/leagues/${competition.slug}`} key={competition.id}>
            <span className="leagueMonogram">{competition.shortName.slice(0, 3)}</span>
            <span>
              <strong>{competition.name}</strong>
              <small>{competition.country}</small>
            </span>
          </Link>
        ))}
      </div>

      <div className="sidebarSection">
        <div className="sidebarLabel">More sports</div>
        <Link className="sidebarItem" href="/sports/rugby">
          <span className="sidebarIcon">🏉</span>
          <span>Rugby</span>
        </Link>
        <Link className="sidebarItem" href="/sports">
          <span className="sidebarIcon">＋</span>
          <span>All sports</span>
        </Link>
      </div>
    </aside>
  );
}
