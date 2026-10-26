export type RugbyGame = {
  id: number;
  date: string;
  time: string | null;
  timestamp: number | null;
  timezone: string | null;
  status: {
    short: string;
    long: string;
  };
  league: {
    id: number;
    name: string;
    type?: string | null;
    logo?: string | null;
    country?: {
      name?: string | null;
      code?: string | null;
      flag?: string | null;
    } | null;
    season?: number | null;
  };
  home: {
    id: number;
    name: string;
    logo?: string | null;
    score: number | null;
  };
  away: {
    id: number;
    name: string;
    logo?: string | null;
    score: number | null;
  };
};

export type RugbyLeague = {
  id: number;
  name: string;
  type?: string | null;
  logo?: string | null;
  country?: {
    id?: number | null;
    name?: string | null;
    code?: string | null;
    flag?: string | null;
  } | null;
  seasons?: Array<{
    season: number;
    current?: boolean;
  }>;
};

export type RugbyStandingRow = {
  position: number;
  team: {
    id: number;
    name: string;
    logo?: string | null;
  };
  games: {
    played: number;
    win: number;
    draw: number;
    lose: number;
  };
  points: number;
  goalsDiff?: number | null;
  form?: string | null;
};
