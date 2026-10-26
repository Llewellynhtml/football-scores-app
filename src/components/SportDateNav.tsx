import Link from "next/link";
import { shiftDate } from "@/lib/dates";

export function SportDateNav({ sport, date }: { sport: string; date: string }) {
  const items = [
    { label: "Yesterday", value: shiftDate(date, -1) },
    { label: "Selected", value: date },
    { label: "Tomorrow", value: shiftDate(date, 1) },
  ];

  return (
    <div className="dateNav" aria-label="Sport date navigation">
      {items.map((item, index) => (
        <Link
          className={index === 1 ? "datePill active" : "datePill"}
          href={`/sports/${sport}?date=${item.value}`}
          key={item.value}
        >
          <span>{item.label}</span>
          <small>{item.value.slice(5)}</small>
        </Link>
      ))}
    </div>
  );
}
