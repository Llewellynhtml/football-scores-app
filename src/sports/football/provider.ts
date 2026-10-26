import type { Fixture } from "@/lib/football";
import { getFixturesByDate } from "@/lib/football";
import type { SportProvider } from "@/sports/types";

export const footballProvider: SportProvider<Fixture> = {
  sport: "football",
  getEventsByDate: getFixturesByDate,
};
