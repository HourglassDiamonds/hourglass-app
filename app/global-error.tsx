"use client";

import Footer from "./shared-components/Footer";
import SiteRecovery from "./shared-components/SiteRecovery";
import "./globals.css";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-full bg-hg-body text-hg-ink">
        <div className="flex min-h-screen flex-col">
          <main id="main-content" tabIndex={-1} className="flex-1">
            <SiteRecovery
              eyebrow="Something went wrong"
              title="We couldn’t load this page."
              body="Please try again. If it continues, return home or reach Justin through Concierge."
              onRetry={reset}
            />
          </main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
