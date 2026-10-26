import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { FEATURED_COMPETITIONS } from "@/config/competitions";

export const metadata = {
  title: "Football Leagues | Football Scores",
  description: "Browse featured football competitions, fixtures and standings.",
};

export default function LeaguesPage() {
  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">FEATURED COMPETITIONS</p>
        <h1 className="pageTitle">Leagues</h1>
        <div className="cardGrid">
          {FEATURED_COMPETITIONS.map((competition) => (
            <article className="featureCard" key={competition.id}>
              <span className="featureCode">{competition.shortName}</span>
              <h2>{competition.name}</h2>
              <p>{competition.country}</p>
              <div className="cardActions">
                <Link href={`/leagues/${competition.slug}`}>Fixtures</Link>
                <Link href={`/standings/${competition.slug}`}>Standings</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
