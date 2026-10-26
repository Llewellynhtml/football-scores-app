import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="topbar">
      <Link className="brand" href="/">FOOTBALL SCORES</Link>
      <nav>
        <Link href="/">Scores</Link>
        <Link href="/leagues">Leagues</Link>
        <Link href="/teams">Teams</Link>
      </nav>
    </header>
  );
}
