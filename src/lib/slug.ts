export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function teamUrl(name: string) {
  return `/teams/${slugify(name)}`;
}

export function matchUrl(home: string, away: string, id: number) {
  return `/matches/${slugify(home)}-vs-${slugify(away)}-${id}`;
}

export function fixtureIdFromSlug(slug: string) {
  const match = slug.match(/-(\d+)$/);
  return match ? Number(match[1]) : null;
}

export function humanizeSlug(slug: string) {
  return slug
    .replace(/-\d+$/, "")
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
