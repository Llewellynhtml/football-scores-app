export function CalendarDatePicker({
  date,
  basePath,
  params = {},
}: {
  date: string;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  return (
    <form className="calendarPicker calendarPickerPrimary" action={basePath} method="get">
      {Object.entries(params).map(([key, value]) =>
        value ? <input key={key} type="hidden" name={key} value={value} /> : null,
      )}

      <span className="calendarPickerIcon" aria-hidden="true">📅</span>

      <label className="calendarPickerFields">
        <span className="calendarPickerLabel">Match date</span>
        <input
          aria-label="Choose match date"
          name="date"
          type="date"
          defaultValue={date}
          required
        />
      </label>

      <button className="calendarApply" type="submit">Apply</button>
    </form>
  );
}
