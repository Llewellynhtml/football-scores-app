import Link from "next/link";

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
          <span>All leagues & cups</span>
        </Link>
        <Link className="sidebarItem" href="/teams">
          <span className="sidebarIcon">♙</span>
          <span>Teams</span>
        </Link>
      </div>

      <div className="sidebarSection">
        <div className="sidebarLabel">Sports</div>
        <Link className="sidebarItem" href="/sports">
          <span className="sidebarIcon">＋</span>
          <span>All sports</span>
        </Link>
      </div>
    </aside>
  );
}
