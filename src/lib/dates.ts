export function dateInUtc(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function shiftDate(date: string, days: number) {
  const base = new Date(`${date}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export function isISODate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(`${value}T12:00:00Z`).getTime());
}

export function timeInUtc(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function prettyDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

// Backwards-compatible aliases while remaining callers are migrated.
export const dateInSouthAfrica = dateInUtc;
export const timeInSouthAfrica = timeInUtc;
