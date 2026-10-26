import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

const examples = [
  ["mamelodi-sundowns", "Mamelodi Sundowns"],
  ["arsenal", "Arsenal"],
  ["barcelona", "Barcelona"],
  ["real-madrid", "Real Madrid"],
];

export const metadata = {
  title: "Football Teams | Football Scores",
  description: "Team profiles, upcoming fixtures and football information.",
};

export default function TeamsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">TEAM DIRECTORY</p>
        <h1 className="pageTitle">Teams</h1>
        <p className="muted">Team pages use clean search-friendly URLs and are resolved against API-Football.</p>
        <div className="cardGrid">
          {examples.map(([slug, name]) => (
            <Link className="featureCard" href={`/teams/${slug}`} key={slug}>
              <span className="featureCode">TEAM</span>
              <h2>{name}</h2>
              <p>Profile and upcoming fixtures</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
