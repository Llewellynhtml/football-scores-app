import { CalendarDatePicker } from "@/components/CalendarDatePicker";

export function SportDateNav({ sport, date }: { sport: string; date: string }) {
  return (
    <div className="dateNav calendarOnlyNav" aria-label="Sport date selector">
      <CalendarDatePicker date={date} basePath={`/sports/${sport}`} />
    </div>
  );
}
