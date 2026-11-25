export type FixtureState = "scheduled" | "live" | "halftime" | "extra_time" | "penalties" | "completed" | "postponed" | "cancelled" | "suspended" | "interrupted" | "abandoned" | "administrative" | "unknown";

const STATUS: Record<string, FixtureState> = {
  TBD: "scheduled", NS: "scheduled", "1H": "live", HT: "halftime", "2H": "live", ET: "extra_time",
  BT: "extra_time", P: "penalties", SUSP: "suspended", INT: "interrupted", LIVE: "live",
  FT: "completed", AET: "completed", PEN: "completed", PST: "postponed", CANC: "cancelled",
  ABD: "abandoned", AWD: "administrative", WO: "administrative",
};

export function classifyFixtureStatus(status: string): FixtureState {
  return STATUS[status.toUpperCase()] ?? "unknown";
}

export function isLiveFixtureStatus(status: string) {
  return ["live", "halftime", "extra_time", "penalties", "suspended", "interrupted"].includes(classifyFixtureStatus(status));
}

export function isFinishedFixtureStatus(status: string) {
  return ["completed", "cancelled", "abandoned", "administrative"].includes(classifyFixtureStatus(status));
}
