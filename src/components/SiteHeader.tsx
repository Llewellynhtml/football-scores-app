import Link from "next/link";
import { Suspense } from "react";
import { SportsNav } from "@/components/SportsNav";

function SportsNavFallback() {
  return (
    <div className="sportsNavWrap">
      <nav className="sportsNav" aria-label="Sports">
        <span className="sportTab liveSport">⚽ Football</span>
        <span className="sportTab">Loading sports…</span>
      </nav>
    </div>
  );
}

export function SiteHeader() {
  return (
    <>
      <header className="topbar">
        <Link className="brand" href="/">LIVE SPORTS</Link>
        <nav className="primaryNav">
          <Link href="/">Scores</Link>
          <Link href="/leagues">Football leagues</Link>
          <Link href="/teams">Football teams</Link>
          <Link href="/sports">Sports</Link>
        </nav>
      </header>

      <Suspense fallback={<SportsNavFallback />}>
        <SportsNav />
      </Suspense>
    </>
  );
}
