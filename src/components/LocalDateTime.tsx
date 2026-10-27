"use client";

import { useEffect, useMemo, useState } from "react";

type Mode = "time" | "date" | "datetime";

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
  const fallback = useMemo(() => format(value, mode, false), [value, mode]);
  const [text, setText] = useState(fallback);

  useEffect(() => {
    setText(format(value, mode, true));
  }, [value, mode]);

  return <time dateTime={typeof value === "string" ? value : new Date(value * 1000).toISOString()}>{text}</time>;
}

export function LocalTimezoneLabel() {
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  }, []);

  return <>{timezone}</>;
}
