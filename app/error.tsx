"use client";

import SiteRecovery from "./shared-components/SiteRecovery";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <SiteRecovery
      eyebrow="Something went wrong"
      title="We couldn’t load this page."
      body="Please try again. If it continues, return home or reach Justin through Concierge."
      onRetry={reset}
    />
  );
}
