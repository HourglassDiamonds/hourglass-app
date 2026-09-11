"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { GMAIL_OPERATING_FRESHNESS_POLL_MS } from "@/lib/continuum/gmail/index-freshness";
import { refreshGmailOperatingFreshness } from "../gmail-freshness-actions";

/**
 * Silent Today freshness loop. No founder-facing chrome.
 * Founder session required via the server action.
 */
export function GmailOperatingFreshness() {
  const router = useRouter();
  const inFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const result = await refreshGmailOperatingFreshness();
        if (cancelled) return;
        if (result.safeErrorCode === "unauthorized") return;
        if (result.docketMayHaveChanged) router.refresh();
      } catch {
        // Next tick retries. Do not surface mailbox errors on Today.
      } finally {
        inFlight.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, GMAIL_OPERATING_FRESHNESS_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [router]);

  return null;
}
