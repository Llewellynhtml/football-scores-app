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
    </aside>
  );
}
