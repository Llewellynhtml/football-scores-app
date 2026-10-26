import Link from "next/link";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "finished", label: "Finished" },
  { value: "scheduled", label: "Scheduled" },
];

export function StatusFilter({
  date,
  league,
  selected = "all",
}: {
  date: string;
  league?: string;
  selected?: string;
}) {
  return (
    <div className="statusFilters" aria-label="Match status filter">
      {FILTERS.map((filter) => {
        const params = new URLSearchParams({ date });
        if (league) params.set("league", league);
        if (filter.value !== "all") params.set("status", filter.value);

        return (
          <Link
            className={selected === filter.value ? "statusFilter active" : "statusFilter"}
            href={`/?${params}`}
            key={filter.value}
          >
            {filter.value === "live" ? <span className="liveDot" /> : null}
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
