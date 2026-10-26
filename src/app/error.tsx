"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error", error);
  }, [error]);

  return (
    <main>
      <section className="content pageTop">
        <div className="emptyState">
          <h1>Sports data is temporarily unavailable</h1>
          <p>
            The data provider could not complete this request. You can retry without leaving the site.
          </p>
          <div className="cardActions">
            <button className="button" type="button" onClick={reset}>Try again</button>
            <Link className="button secondary" href="/">Back to scores</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
