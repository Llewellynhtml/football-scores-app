import type { SportDefinition } from "@/sports/types";

export const SPORTS: SportDefinition[] = [
  {
    slug: "football",
    name: "Football",
    shortName: "Football",
    icon: "⚽",
    status: "live",
    description: "Fixtures, live scores, results, standings, teams and match pages.",
    apiKeyEnv: "API_FOOTBALL_KEY",
    baseUrlEnv: "API_FOOTBALL_BASE_URL",
    defaultBaseUrl: "https://v3.football.api-sports.io",
  },
  {
    slug: "basketball",
    name: "Basketball",
    shortName: "Basketball",
    icon: "🏀",
    status: "live",
    description: "Basketball games, live scores, leagues and results.",
    apiKeyEnv: "API_BASKETBALL_KEY",
    baseUrlEnv: "API_BASKETBALL_BASE_URL",
    defaultBaseUrl: "https://v1.basketball.api-sports.io",
  },
  {
    slug: "nba",
    name: "NBA",
    shortName: "NBA",
    icon: "🏀",
    status: "live",
    description: "NBA games, live scores, teams and results.",
    apiKeyEnv: "API_NBA_KEY",
    baseUrlEnv: "API_NBA_BASE_URL",
    defaultBaseUrl: "https://v2.nba.api-sports.io",
  },
  {
    slug: "american-football",
    name: "American Football",
    shortName: "NFL",
    icon: "🏈",
    status: "live",
    description: "NFL and NCAA schedules, live scores and results.",
    apiKeyEnv: "API_AMERICAN_FOOTBALL_KEY",
    baseUrlEnv: "API_AMERICAN_FOOTBALL_BASE_URL",
    defaultBaseUrl: "https://v1.american-football.api-sports.io",
  },
  {
    slug: "rugby",
    name: "Rugby",
    shortName: "Rugby",
    icon: "🏉",
    status: "live",
    description: "Rugby fixtures, live scores, results and competitions.",
    apiKeyEnv: "API_RUGBY_KEY",
    baseUrlEnv: "API_RUGBY_BASE_URL",
    defaultBaseUrl: "https://v1.rugby.api-sports.io",
  },
  {
    slug: "formula-1",
    name: "Formula 1",
    shortName: "F1",
    icon: "🏎️",
    status: "live",
    description: "Formula 1 races, circuits and race schedules.",
    apiKeyEnv: "API_FORMULA1_KEY",
    baseUrlEnv: "API_FORMULA1_BASE_URL",
    defaultBaseUrl: "https://v1.formula-1.api-sports.io",
  },
  {
    slug: "baseball",
    name: "Baseball",
    shortName: "Baseball",
    icon: "⚾",
    status: "live",
    description: "Baseball games, live scores, leagues and results.",
    apiKeyEnv: "API_BASEBALL_KEY",
    baseUrlEnv: "API_BASEBALL_BASE_URL",
    defaultBaseUrl: "https://v1.baseball.api-sports.io",
  },
  {
    slug: "hockey",
    name: "Hockey",
    shortName: "Hockey",
    icon: "🏒",
    status: "live",
    description: "Hockey games, live scores, competitions and results.",
    apiKeyEnv: "API_HOCKEY_KEY",
    baseUrlEnv: "API_HOCKEY_BASE_URL",
    defaultBaseUrl: "https://v1.hockey.api-sports.io",
  },
  {
    slug: "mma",
    name: "MMA",
    shortName: "MMA",
    icon: "🥊",
    status: "live",
    description: "MMA fight cards, live fight status and schedules.",
    apiKeyEnv: "API_MMA_KEY",
    baseUrlEnv: "API_MMA_BASE_URL",
    defaultBaseUrl: "https://v1.mma.api-sports.io",
  },
  {
    slug: "volleyball",
    name: "Volleyball",
    shortName: "Volleyball",
    icon: "🏐",
    status: "live",
    description: "Volleyball fixtures, live scores and results.",
    apiKeyEnv: "API_VOLLEYBALL_KEY",
    baseUrlEnv: "API_VOLLEYBALL_BASE_URL",
    defaultBaseUrl: "https://v1.volleyball.api-sports.io",
  },
  {
    slug: "handball",
    name: "Handball",
    shortName: "Handball",
    icon: "🤾",
    status: "live",
    description: "Handball matches, live scores and results.",
    apiKeyEnv: "API_HANDBALL_KEY",
    baseUrlEnv: "API_HANDBALL_BASE_URL",
    defaultBaseUrl: "https://v1.handball.api-sports.io",
  },
  {
    slug: "afl",
    name: "AFL",
    shortName: "AFL",
    icon: "🏉",
    status: "live",
    description: "Australian football fixtures, live scores and results.",
    apiKeyEnv: "API_AFL_KEY",
    baseUrlEnv: "API_AFL_BASE_URL",
    defaultBaseUrl: "https://v1.afl.api-sports.io",
  },
];

export function getSport(slug: string) {
  return SPORTS.find((sport) => sport.slug === slug);
}

export function isSportConfigured(sport: SportDefinition) {
  return Boolean(
    process.env[sport.apiKeyEnv]
    ?? process.env.API_SPORTS_KEY
    ?? process.env.API_FOOTBALL_KEY
  );
}

export function enabledSports() {
  return SPORTS.filter((sport) => sport.status === "live" && isSportConfigured(sport));
}
