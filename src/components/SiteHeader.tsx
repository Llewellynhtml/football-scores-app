import Link from "next/link";

export function SiteHeader(_props: { date?: string } = {}) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">LIVE SPORTS</Link>
      <nav className="primaryNav">
        <Link href="/">Scores</Link>
        <Link href="/leagues">Football leagues</Link>
        <Link href="/teams">Football teams</Link>
        <Link href="/sports">Sports</Link>
      </nav>
    </header>
  );
}
