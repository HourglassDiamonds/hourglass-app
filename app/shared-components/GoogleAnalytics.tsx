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

function isPrivateContinuumPath(pathname: string): boolean {
  return pathname.startsWith("/executive-dashboard");
}

function AnalyticsController({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const measurementId = resolveGaMeasurementId();
  const configuredRef = useRef(false);
  const isPrivateApp = isPrivateContinuumPath(pathname);
  const loadGa = enabled && Boolean(measurementId) && !isPrivateApp;

  useEffect(() => {
    if (isPrivateApp) return;

    const query = searchParams.toString();
    // Attribution always runs on public routes — first-party sessionStorage, not GA.
    captureAttributionFromLocation(pathname, query);

    if (!enabled || !measurementId) return;

    if (!configuredRef.current) {
      configureGaWithoutAutomaticPageViews(measurementId);
      configuredRef.current = true;
    }

    pageview(pathname, query);
  }, [pathname, searchParams, enabled, measurementId, isPrivateApp]);

  if (!loadGa || !measurementId) return null;

  return (
    <Script
      src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      strategy="afterInteractive"
    />
  );
}

export default function GoogleAnalytics({
  enabled = false,
}: GoogleAnalyticsProps) {
  return (
    <Suspense fallback={null}>
      <AnalyticsController enabled={enabled} />
    </Suspense>
  );
}
