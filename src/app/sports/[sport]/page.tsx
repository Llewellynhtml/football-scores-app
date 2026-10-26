import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { getSport, isSportConfigured } from "@/sports/registry";

type Props = { params: Promise<{ sport: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport: slug } = await params;
  const sport = getSport(slug);
  if (!sport) return { title: "Sport not found" };
  return {
    title: `${sport.name} | Live Sports`,
    description: sport.description,
  };
}

export default async function SportPage({ params }: Props) {
  const { sport: slug } = await params;
  const sport = getSport(slug);
  if (!sport) notFound();
  if (sport.slug === "football") redirect("/");

  const configured = isSportConfigured(sport);

  return (
    <main>
      <SiteHeader />
      <section className="content pageTop">
        <div className="sportLandingHero">
          <div className="sportLandingIcon" aria-hidden="true">{sport.icon}</div>
          <div>
            <p className="eyebrow">SPORT MODULE</p>
            <h1 className="pageTitle">{sport.name}</h1>
            <p className="muted">{sport.description}</p>
          </div>
        </div>

        <div className="notice">
          <strong>{configured ? "API key detected." : "Provider registered, API calls disabled."}</strong>
          <p>
            This sport is part of the shared platform architecture, but its live data adapter and
            production routes will be activated in a later phase. No requests are being spent on
            this sport yet.
          </p>
        </div>

        <div className="modulePlan">
          <div><span>1</span><p>Provider client and normalized event model</p></div>
          <div><span>2</span><p>Scores and schedule pages</p></div>
          <div><span>3</span><p>Competition and team pages</p></div>
          <div><span>4</span><p>Sport-specific statistics and SEO pages</p></div>
        </div>

        <Link className="button" href="/sports">Back to all sports</Link>
      </section>
    </main>
  );
}
