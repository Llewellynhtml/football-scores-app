import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Football Leagues",
  description: "Browse football leagues, fixtures, results and standings.",
};

export default function LeaguesPage() {
  return (
    <section className="shell page-section">
      <span className="eyebrow">Competitions</span>
      <h1>Football leagues</h1>
      <p className="lead">
        League discovery and standings will be connected to API-Football in the
        next implementation step.
      </p>
    </section>
  );
}
