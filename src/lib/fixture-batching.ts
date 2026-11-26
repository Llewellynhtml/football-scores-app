export function normalizeFixtureIds(ids: number[]) {
  const normalized = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))].sort((a, b) => a - b);
  if (normalized.length === 0) throw new Error("At least one valid fixture ID is required");
  if (normalized.length > 20) throw new Error("API-Football accepts at most 20 fixture IDs per batch");
  return normalized;
}

export function fixtureIdsParameter(ids: number[]) {
  return normalizeFixtureIds(ids).join("-");
}
