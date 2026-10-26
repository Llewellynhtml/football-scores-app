import { dateInSouthAfrica } from "@/lib/dates";
import { getFixturesByDate, type Fixture } from "@/lib/football";

export async function getTodayFixtures(): Promise<Fixture[]> {
  try {
    return await getFixturesByDate(dateInSouthAfrica());
  } catch (error) {
    console.error("Unable to load today's fixtures", error);
    return [];
  }
}
