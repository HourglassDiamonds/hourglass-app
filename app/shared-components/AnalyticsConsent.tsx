"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  ANALYTICS_CONSENT_MANAGE_EVENT,
  readAnalyticsConsent,
  subscribeAnalyticsConsent,
  writeAnalyticsConsent,
  type AnalyticsConsentChoice,
} from "@/lib/analytics/consent";

type AnalyticsConsentProps = {
  /** Same server gate as GoogleAnalytics — no banner when client GA is off. */
  enabled?: boolean;
};

const BUTTON =
  "inline-flex min-h-11 w-full items-center justify-center rounded-full border border-hg-line bg-transparent px-5 text-[11px] uppercase tracking-[0.22em] text-hg-ink transition-colors hover:border-hg-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory sm:w-auto";

function isPrivateContinuumPath(pathname: string): boolean {
  return pathname.startsWith("/executive-dashboard");
}

function subscribeAlwaysMounted() {
  return () => undefined;
}

export default function AnalyticsConsent({
  enabled = false,
}: AnalyticsConsentProps) {
  const pathname = usePathname() ?? "";
  const headingId = useId();
  const descriptionId = useId();
  const hydrated = useSyncExternalStore(
    subscribeAlwaysMounted,
    () => true,
    () => false,
  );
  const [managing, setManaging] = useState(false);
  const consent = useSyncExternalStore(
    subscribeAnalyticsConsent,
    readAnalyticsConsent,
    () => "undecided" as const,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onManage = () => setManaging(true);
    window.addEventListener(ANALYTICS_CONSENT_MANAGE_EVENT, onManage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_MANAGE_EVENT, onManage);
    };
  }, []);

  const isPrivateApp = isPrivateContinuumPath(pathname);
  const showBanner =
    hydrated &&
    enabled &&
    !isPrivateApp &&
    (consent === "undecided" || managing);

  if (!showBanner) return null;

  function choose(choice: AnalyticsConsentChoice) {
    writeAnalyticsConsent(choice);
    setManaging(false);
  }

  return (
    <div
      role="region"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      className="fixed inset-x-0 bottom-0 z-[60] border-t border-hg-line bg-hg-ivory/95 px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-[10px] sm:px-6"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-4 md:flex-row md:items-end md:justify-between md:gap-8">
        <div className="max-w-[40rem]">
          <p
            id={headingId}
            className="text-[11px] uppercase tracking-[0.28em] text-hg-eyebrow"
          >
            Analytics
          </p>
          <p
            id={descriptionId}
            className="mt-2 text-[13px] leading-relaxed text-[#4e463f]"
          >
            Google Analytics helps us understand visits, only if you allow it.
            Concierge, studios, and the rest of the site work either way. Read
            the{" "}
            <Link
              href="/privacy"
              className="underline decoration-[#c4b8a8] underline-offset-4 transition-colors hover:text-hg-ink"
            >
              Privacy
            </Link>{" "}
            page, or change this later from Analytics in the footer.
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          <button type="button" className={BUTTON} onClick={() => choose("granted")}>
            Allow analytics
          </button>
          <button type="button" className={BUTTON} onClick={() => choose("denied")}>
            Decline analytics
          </button>
        </div>
      </div>
    </div>
  );
}
