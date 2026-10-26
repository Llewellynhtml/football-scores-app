import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Football Scores",
    template: "%s | Football Scores",
  },
  description:
    "Football fixtures, results, standings and match information in one fast, mobile-friendly experience.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="shell nav-wrap">
            <Link className="brand" href="/">
              <span className="brand-mark">FS</span>
              <span>Football Scores</span>
            </Link>
            <nav aria-label="Main navigation">
              <Link href="/">Scores</Link>
              <Link href="/leagues">Leagues</Link>
              <Link href="/teams">Teams</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="shell">
            <p>Football Scores · Built for fast fixtures, results and standings.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
