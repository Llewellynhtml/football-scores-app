export type UnifiedSportEvent = {
  id: string;
  sport: string;
  date: string;
  time: string | null;
  status: string;
  statusLong: string;
  competition: string;
  country: string | null;
  logo: string | null;
  home: { name: string; logo: string | null } | null;
  away: { name: string; logo: string | null } | null;
  homeScore: string | null;
  awayScore: string | null;
  title: string | null;
  subtitle: string | null;
};

export type SportApiStatus = {
  slug: string;
  name: string;
  configured: boolean;
  reachable: boolean;
  plan: string | null;
  used: number | null;
  limit: number | null;
  error: string | null;
};
