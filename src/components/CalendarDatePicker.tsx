"use client";

import { useRouter } from "next/navigation";

export function CalendarDatePicker({
  date,
  basePath,
  params = {},
}: {
  date: string;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const router = useRouter();

  function changeDate(nextDate: string) {
    if (!nextDate) return;
    const query = new URLSearchParams({ date: nextDate });
    for (const [key, value] of Object.entries(params)) {
      if (value) query.set(key, value);
    }
    router.push(`${basePath}?${query.toString()}`);
  }

  return (
    <label className="calendarPicker">
      <span className="calendarPickerIcon" aria-hidden="true">📅</span>
      <span className="calendarPickerLabel">Choose date</span>
      <input
        aria-label="Choose match date"
        type="date"
        value={date}
        onChange={(event) => changeDate(event.target.value)}
      />
    </label>
  );
}
