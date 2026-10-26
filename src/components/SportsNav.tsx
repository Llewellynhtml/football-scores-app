import Link from "next/link";
import { SPORTS } from "@/sports/registry";

export function SportsNav() {
  return (
    <div className="sportsNavWrap">
      <nav className="sportsNav" aria-label="Sports">
        {SPORTS.map((sport) => (
          <Link
            className={sport.status === "live" ? "sportTab liveSport" : "sportTab"}
            href={sport.slug === "football" ? "/" : `/sports/${sport.slug}`}
            key={sport.slug}
          >
            <span aria-hidden="true">{sport.icon}</span>
            <span>{sport.shortName}</span>
          </Link>
        ))}
        <Link className="sportTab" href="/sports">All sports</Link>
      </nav>
    </div>
  );
}
