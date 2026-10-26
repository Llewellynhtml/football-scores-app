import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.SITE_URL ?? "https://palegoldenrod-clam-775783.hostingersite.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Live Sports",
    template: "%s",
  },
  description: "Live scores, fixtures, results and schedules across football, rugby, basketball, NBA, NFL, Formula 1, baseball, hockey, MMA, volleyball, handball and AFL.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "Live Sports",
    description: "A multi-sport live scores and statistics platform.",
    url: siteUrl,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
