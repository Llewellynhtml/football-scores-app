import type { Metadata } from "next";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Live Sports",
    template: "%s",
  },
  description: "Live scores, fixtures, results and schedules across supported sports.",
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
