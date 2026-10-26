import Link from "next/link";
import type { FixtureCompetition } from "@/lib/football";

export function CompetitionFilter({
  competitions,
  selected,
  status,
}: {
  competitions: FixtureCompetition[];
  selected?: string;
  status?: string;
}) {
  function href(routeKey?: string) {
    const params = new URLSearchParams();
    if (routeKey) params.set("league", routeKey);
    if (status && status !== "all") params.set("status", status);
    return `/?${params.toString()}`;
  }

  return (
    <div className="filters" aria-label="Competition filter">
      <Link className={!selected ? "filterChip active" : "filterChip"} href={href()}>All</Link>
      {competitions.map((competition) => (
        <Link
          className={selected === competition.routeKey ? "filterChip active" : "filterChip"}
          href={href(competition.routeKey)}
          key={competition.id}
        >
          {competition.name}
        </Link>
      ))}
    </div>
  );
}
