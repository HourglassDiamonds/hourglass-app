"use client";

import {
  configureGaWithoutAutomaticPageViews,
  pageview,
  resolveGaMeasurementId,
} from "@/lib/gtag";
import { captureAttributionFromLocation } from "@/lib/attribution";
import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";

type GoogleAnalyticsProps = {
  /** Server-computed: production (or explicit GA_CLIENT_ENABLED) with measurement ID. */
  enabled?: boolean;
};

function AnalyticsController({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const measurementId = resolveGaMeasurementId();
  const configuredRef = useRef(false);

  useEffect(() => {
    const query = searchParams.toString();
    // Attribution always runs — first-party sessionStorage, not GA.
    captureAttributionFromLocation(pathname, query);

    if (!enabled || !measurementId) return;

    if (!configuredRef.current) {
      configureGaWithoutAutomaticPageViews(measurementId);
      configuredRef.current = true;
    }

    pageview(pathname, query);
  }, [pathname, searchParams, enabled, measurementId]);

  return null;
}

export default function GoogleAnalytics({
  enabled = false,
}: GoogleAnalyticsProps) {
  const measurementId = resolveGaMeasurementId();
  const loadGa = enabled && Boolean(measurementId);

  return (
    <>
      {loadGa ? (
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
          strategy="afterInteractive"
        />
      ) : null}
      <Suspense fallback={null}>
        <AnalyticsController enabled={loadGa} />
      </Suspense>
    </>
  );
}
