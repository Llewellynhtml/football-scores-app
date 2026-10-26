export type Competition = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  country: string;
};

export const FEATURED_COMPETITIONS: Competition[] = [
  { id: 39, slug: "premier-league", name: "Premier League", shortName: "EPL", country: "England" },
  { id: 2, slug: "champions-league", name: "UEFA Champions League", shortName: "UCL", country: "Europe" },
  { id: 140, slug: "la-liga", name: "La Liga", shortName: "LaLiga", country: "Spain" },
  { id: 288, slug: "psl", name: "Premier Soccer League", shortName: "PSL", country: "South Africa" },
];

export function getCompetition(slug: string) {
  return FEATURED_COMPETITIONS.find((competition) => competition.slug === slug);
}

export function getCompetitionById(id: number) {
  return FEATURED_COMPETITIONS.find((competition) => competition.id === id);
}

export function currentFootballSeason(date = new Date()) {
  const year = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Africa/Johannesburg",
      year: "numeric",
    }).format(date),
  );
  const month = Number(
    new Intl.DateTimeFormat("en", {
      timeZone: "Africa/Johannesburg",
      month: "numeric",
    }).format(date),
  );

  return Number(process.env.FOOTBALL_SEASON) || (month >= 7 ? year : year - 1);
}
