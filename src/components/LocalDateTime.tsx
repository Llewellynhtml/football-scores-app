"use client";

import { useSyncExternalStore } from "react";

type Mode = "time" | "date" | "datetime";

// The server and hydration render use UTC. After hydration, React reads the
// browser snapshot and formats using the visitor's locale and timezone.
const subscribe = () => () => {};
const getServerSnapshot = () => false;
const getClientSnapshot = () => true;

function asDate(value: string | number) {
  if (typeof value === "number") return new Date(value * 1000);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00Z`);
  return new Date(value);
}

function format(value: string | number, mode: Mode, local: boolean) {
  const date = asDate(value);
  if (Number.isNaN(date.getTime())) return "—";

  const options: Intl.DateTimeFormatOptions =
    mode === "time"
      ? { hour: "2-digit", minute: "2-digit" }
      : mode === "date"
        ? { weekday: "short", day: "numeric", month: "short", year: "numeric" }
        : { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" };

  if (!local) options.timeZone = "UTC";

  return new Intl.DateTimeFormat(local ? undefined : "en-GB", options).format(date);
}

export function LocalDateTime({
  value,
  mode = "time",
}: {
  value: string | number;
  mode?: Mode;
}) {
  const local = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const date = asDate(value);
  return <time dateTime={Number.isNaN(date.getTime()) ? undefined : date.toISOString()}>{format(value, mode, local)}</time>;
}

export function LocalTimezoneLabel() {
  const local = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  return <>{local ? (Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC") : "UTC"}</>;
}
