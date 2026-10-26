"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SafeLogo } from "@/components/SafeLogo";

export type LeagueCatalogRow = {
  id: number;
  name: string;
  type: string;
  logo: string;
  country: string;
  routeKey: string;
  standings: boolean;
};

export function LeagueCatalog({ leagues }: { leagues: LeagueCatalogRow[] }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("all");
  const [type, setType] = useState("all");

  const countries = useMemo(
    () => [...new Set(leagues.map((league) => league.country))].sort((a, b) => a.localeCompare(b)),
    [leagues],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return leagues.filter((league) => {
      const matchesQuery = !needle
        || league.name.toLowerCase().includes(needle)
        || league.country.toLowerCase().includes(needle);
      const matchesCountry = country === "all" || league.country === country;
      const matchesType = type === "all" || league.type.toLowerCase() === type;
      return matchesQuery && matchesCountry && matchesType;
    });
  }, [leagues, query, country, type]);

  return (
    <section className="allLeaguesSection">
      <div className="sectionHeading">
        <div>
          <p className="eyebrow">CURRENT SEASON</p>
          <h2>All leagues & cups</h2>
        </div>
        <span className="badge">{filtered.length} of {leagues.length}</span>
      </div>

      <div className="leagueCatalogFilters">
        <label className="leagueSearch">
          <span>Search</span>
          <input
            type="search"
            placeholder="League or country"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <label>
          <span>Country</span>
          <select value={country} onChange={(event) => setCountry(event.target.value)}>
            <option value="all">All countries</option>
            {countries.map((name) => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>

        <label>
          <span>Type</span>
          <select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="all">Leagues & cups</option>
            <option value="league">Leagues</option>
            <option value="cup">Cups</option>
          </select>
        </label>
      </div>

      {!filtered.length ? (
        <div className="emptyState">
          <h3>No competitions found</h3>
          <p>Try a different league name, country or competition type.</p>
        </div>
      ) : (
        <div className="leagueCatalogList">
          {filtered.map((league) => (
            <article className="leagueCatalogRow" key={league.id}>
              <SafeLogo src={league.logo} alt={league.name} fallbackText={league.name} size={38} />
              <div className="leagueCatalogIdentity">
                <span>{league.country} · {league.type}</span>
                <strong>{league.name}</strong>
              </div>
              <div className="leagueCatalogActions">
                <Link href={`/leagues/${league.routeKey}`} prefetch={false}>Fixtures</Link>
                {league.standings ? (
                  <Link href={`/standings/${league.routeKey}`} prefetch={false}>Standings</Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
