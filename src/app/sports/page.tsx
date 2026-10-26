import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SPORTS, isSportConfigured } from "@/sports/registry";

export const metadata = {
  title: "Sports | Live Sports",
  description: "Live scores and schedules across all supported API-Sports products.",
};

export default function SportsPage() {
  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <p className="eyebrow">MULTI-SPORT PLATFORM</p>
        <h1 className="pageTitle">All sports</h1>
        <p className="muted sportsIntro">
          Every sport below now has a live data route. On the free API-Sports tier,
          score pages use conservative caching to protect each sport&apos;s daily request allowance.
        </p>

        <div className="sportsGrid">
          {SPORTS.map((sport) => {
            const configured = isSportConfigured(sport);
            return (
              <Link
                className="sportCard"
                href={sport.slug === "football" ? "/" : `/sports/${sport.slug}`}
                key={sport.slug}
              >
                <div className="sportIcon" aria-hidden="true">{sport.icon}</div>
                <div>
                  <div className="sportCardTop">
                    <h2>{sport.name}</h2>
                    <span className={configured ? "status live" : "status"}>
                      {configured ? "Live" : "Key needed"}
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
