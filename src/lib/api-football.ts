import { dateInUtc } from "@/lib/dates";
import { getFixturesByDate, type Fixture } from "@/lib/football";

// Do not convert upstream failures into an empty fixture list: zero matches is valid data.
export async function getTodayFixtures(): Promise<Fixture[]> {
  return getFixturesByDate(dateInUtc());
}
