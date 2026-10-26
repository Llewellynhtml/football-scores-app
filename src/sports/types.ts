export type SportStatus = "live" | "ready" | "planned";

export type SportDefinition = {
  slug: string;
  name: string;
  shortName: string;
  icon: string;
  status: SportStatus;
  description: string;
  apiKeyEnv: string;
  baseUrlEnv: string;
  defaultBaseUrl: string;
};

export type SportProvider<TEvent = unknown> = {
  sport: string;
  getEventsByDate(date: string): Promise<TEvent[]>;
};
