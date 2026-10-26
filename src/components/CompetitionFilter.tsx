import Link from "next/link";
import { FEATURED_COMPETITIONS } from "@/config/competitions";

export function CompetitionFilter({ date, selected }: { date: string; selected?: string }) {
  return (
    <div className="filters" aria-label="Competition filter">
      <Link className={!selected ? "filterChip active" : "filterChip"} href={`/?date=${date}`}>All</Link>
      {FEATURED_COMPETITIONS.map((competition) => (
        <Link
          className={selected === competition.slug ? "filterChip active" : "filterChip"}
          href={`/?date=${date}&league=${competition.slug}`}
          key={competition.id}
        >
          {competition.shortName}
        </Link>
      ))}
    </div>
  );
}
