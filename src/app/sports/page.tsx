import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SPORTS, isSportConfigured } from "@/sports/registry";

export const metadata = {
  title: "Sports | Live Sports",
  description: "Browse the sports available in the multi-sport scores platform.",
};

export default function SportsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">MULTI-SPORT PLATFORM</p>
        <h1 className="pageTitle">Sports</h1>
        <p className="muted sportsIntro">
          Football is live today. The remaining API-Sports products are registered in the
          platform architecture and can be activated one at a time without rebuilding the site.
        </p>

        <div className="sportsGrid">
          {SPORTS.map((sport) => {
            const configured = isSportConfigured(sport);
            const live = sport.status === "live";
            return (
              <Link
                className="sportCard"
                href={live ? "/" : `/sports/${sport.slug}`}
                key={sport.slug}
              >
                <div className="sportIcon" aria-hidden="true">{sport.icon}</div>
                <div>
                  <div className="sportCardTop">
                    <h2>{sport.name}</h2>
                    <span className={live ? "status live" : configured ? "status configured" : "status"}>
                      {live ? "Live" : configured ? "Configured" : "Ready"}
                    </span>
                  </div>
                  <p>{sport.description}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
