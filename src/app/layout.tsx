import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.SITE_URL ?? "https://plum-trout-603701.hostingersite.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Football Scores",
    template: "%s",
  },
  description: "Fixtures, results, standings and football match data.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    title: "Football Scores",
    description: "Fixtures, results, standings and football match data.",
    url: siteUrl,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
