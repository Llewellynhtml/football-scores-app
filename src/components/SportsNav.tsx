"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SPORTS } from "@/sports/registry";

function datedHref(path: string, date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return path;
  const params = new URLSearchParams({ date });
  return `${path}?${params.toString()}`;
}

export function SportsNav() {
  const searchParams = useSearchParams();
  const selectedDate = searchParams.get("date");

  return (
    <div className="sportsNavWrap">
      <nav className="sportsNav" aria-label="Sports">
        {SPORTS.map((sport) => {
          const path = sport.slug === "football" ? "/" : `/sports/${sport.slug}`;
          return (
            <Link
              className={sport.status === "live" ? "sportTab liveSport" : "sportTab"}
              href={datedHref(path, selectedDate)}
              key={sport.slug}
            >
              <span aria-hidden="true">{sport.icon}</span>
              <span>{sport.shortName}</span>
            </Link>
          );
        })}
        <Link className="sportTab" href={datedHref("/sports", selectedDate)}>All sports</Link>
      </nav>
    </div>
  );
}
