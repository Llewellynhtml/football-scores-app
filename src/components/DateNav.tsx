import { CalendarDatePicker } from "@/components/CalendarDatePicker";

export function DateNav({
  date,
  league,
  status,
}: {
  date: string;
  league?: string;
  status?: string;
}) {
  return (
    <div className="dateNav calendarOnlyNav" aria-label="Match date selector">
      <CalendarDatePicker
        date={date}
        basePath="/"
        params={{ league, status: status && status !== "all" ? status : undefined }}
      />
    </div>
  );
}
