type MariaDbCacheTimestamps = {
  expires_at: unknown;
  stale_until: unknown;
  updated_at?: unknown;
};

const timestampPattern = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})?$/;

export function canonicalUtcTimestamp(value: unknown) {
  if (typeof value !== "string") throw new Error("Invalid timestamp");
  const match = timestampPattern.exec(value.trim());
  if (!match) throw new Error("Invalid timestamp");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText = "", zoneText] = match;
  const [year, month, day, hour, minute, second] = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const localEpoch = Date.UTC(year, month - 1, day, hour, minute, second);
  const local = new Date(localEpoch);
  if (local.getUTCFullYear() !== year || local.getUTCMonth() !== month - 1 || local.getUTCDate() !== day || local.getUTCHours() !== hour || local.getUTCMinutes() !== minute || local.getUTCSeconds() !== second) {
    throw new Error("Invalid timestamp");
  }
  let offsetMinutes = 0;
  if (zoneText && zoneText !== "Z") {
    const sign = zoneText[0] === "+" ? 1 : -1;
    const offsetHours = Number(zoneText.slice(1, 3));
    const offsetRemainder = Number(zoneText.slice(4, 6));
    if (offsetHours > 23 || offsetRemainder > 59) throw new Error("Invalid timestamp offset");
    offsetMinutes = sign * (offsetHours * 60 + offsetRemainder);
  }
  const utc = new Date(localEpoch - offsetMinutes * 60_000);
  const fraction = fractionText.padEnd(6, "0");
  return `${utc.toISOString().slice(0, 19)}.${fraction}Z`;
}

export function mariaDbDateTime(value: unknown) {
  return canonicalUtcTimestamp(value).replace("T", " ").slice(0, -1);
}

export function timestampsRepresentSameInstant(left: unknown, right: unknown) {
  return canonicalUtcTimestamp(left) === canonicalUtcTimestamp(right);
}

export function normalizeMariaDbCacheTimestamps<T extends MariaDbCacheTimestamps>(row: T): T {
  return {
    ...row,
    expires_at: canonicalUtcTimestamp(row.expires_at),
    stale_until: canonicalUtcTimestamp(row.stale_until),
    ...(row.updated_at === undefined ? {} : { updated_at: canonicalUtcTimestamp(row.updated_at) }),
  };
}
