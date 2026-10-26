import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Football Teams",
  description: "Browse football teams, fixtures, results and statistics.",
};

export default function TeamsPage() {
  return (
    <section className="shell page-section">
      <span className="eyebrow">Clubs</span>
      <h1>Football teams</h1>
      <p className="lead">
        Team pages will become indexable hubs for fixtures, results and
        statistics as the data layer expands.
      </p>
    </section>
  );
}
