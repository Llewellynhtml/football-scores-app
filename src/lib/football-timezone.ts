export function utcDatesForLocalDay(localDate: string, timeZone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) throw new Error("Invalid local calendar date");
  try { new Intl.DateTimeFormat("en", { timeZone }).format(new Date()); }
  catch { throw new Error("Invalid IANA timezone"); }
  const center = new Date(`${localDate}T12:00:00Z`);
  const dates = new Set<string>();
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  for (let hours = -36; hours <= 36; hours += 1) {
    const instant = new Date(center.getTime() + hours * 3600000);
    const parts = Object.fromEntries(formatter.formatToParts(instant).map((part) => [part.type, part.value]));
    if (`${parts.year}-${parts.month}-${parts.day}` === localDate) dates.add(instant.toISOString().slice(0, 10));
  }
  if (dates.size === 0) throw new Error("Local calendar day could not be resolved");
  return [...dates].sort();
}
