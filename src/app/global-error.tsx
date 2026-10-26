"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main>
          <section className="content pageTop">
            <div className="emptyState">
              <h1>The sports service could not load</h1>
              <p>A temporary server or data-provider error occurred.</p>
              <button className="button" type="button" onClick={reset}>Try again</button>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
