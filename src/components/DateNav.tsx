import Link from "next/link";
import { dateInSouthAfrica, shiftDate } from "@/lib/dates";

export function DateNav({ date, league }: { date: string; league?: string }) {
  const today = dateInSouthAfrica();
  const items = [
    { label: "Yesterday", value: shiftDate(date, -1) },
    { label: date === today ? "Today" : "Selected", value: date },
    { label: "Tomorrow", value: shiftDate(date, 1) },
  ];

  return (
    <div className="dateNav" aria-label="Match date navigation">
      {items.map((item, index) => {
        const params = new URLSearchParams({ date: item.value });
        if (league) params.set("league", league);
        return (
          <Link className={index === 1 ? "datePill active" : "datePill"} href={`/?${params}`} key={item.label}>
            <span>{item.label}</span>
            <small>{item.value.slice(5)}</small>
          </Link>
        );
      })}
    </div>
  );
}
