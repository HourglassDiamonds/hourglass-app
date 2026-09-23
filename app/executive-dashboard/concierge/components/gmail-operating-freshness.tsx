"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GMAIL_OPERATING_FRESHNESS_POLL_MS } from "@/lib/continuum/gmail/index-freshness";
import {
  shouldPollTodayFreshness,
  shouldRefreshTodaySurface,
  shouldSwapTodayAfterRecompute,
} from "@/lib/continuum/chief-of-staff/operating-loop/today-refresh";
import { refreshGmailOperatingFreshness } from "../gmail-freshness-actions";
import { probeTodayRecompute } from "../today-read-model-actions";

const TODAY_RECOMPUTE_POLL_MS = 1_000;

/**
 * Today freshness loop.
 * On open, and about once a minute while the tab is visible, check the
 * Gmail source watermark. Refresh the server render only when that cycle
 * reports a meaningful docket change. Hidden tabs do not poll.
 * A source-change navigation shows the last composed docket and this line
 * until the background recomposition stores a newer watermark.
 */
export function GmailOperatingFreshness({
  refreshing = false,
  baselineWatermark = null,
}: {
  refreshing?: boolean;
  baselineWatermark?: string | null;
}) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [checking, setChecking] = useState(refreshing);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const hidden = typeof document !== "undefined" && document.hidden;
      if (!shouldPollTodayFreshness({ documentHidden: hidden, inFlight: inFlight.current })) {
        return;
      }
      inFlight.current = true;
      try {
        const result = await refreshGmailOperatingFreshness();
        if (cancelled) return;
        if (result.safeErrorCode === "unauthorized") return;
        if (shouldRefreshTodaySurface(result.docketMayHaveChanged)) router.refresh();
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

    function onVisibility() {
      if (document.visibilityState === "visible") void tick();
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  useEffect(() => {
    setChecking(refreshing);
    if (!refreshing) return;
    let cancelled = false;
    const started = Date.now();
    const probeInFlight = { current: false };
    const observedPending = { current: false };
    const swapped = { current: false };

    async function tick() {
      const hidden = typeof document !== "undefined" && document.hidden;
      if (!shouldPollTodayFreshness({ documentHidden: hidden, inFlight: probeInFlight.current })) {
        return;
      }
      probeInFlight.current = true;
      try {
        const probe = await probeTodayRecompute();
        if (cancelled) return;
        if (probe.pending) observedPending.current = true;
        const decision = shouldSwapTodayAfterRecompute({
          baselineWatermark,
          cacheWatermark: probe.cacheWatermark,
          pending: probe.pending,
          elapsedMs: Date.now() - started,
          observedPending: observedPending.current,
        });
        if (decision === "swap" && !swapped.current) {
          swapped.current = true;
          router.refresh();
        }
        if (decision === "keep") setChecking(false);
      } catch {
        if (!cancelled) setChecking(false);
      } finally {
        probeInFlight.current = false;
      }
    }

    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, TODAY_RECOMPUTE_POLL_MS);
    function onVisibility() {
      if (document.visibilityState === "visible") void tick();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [baselineWatermark, refreshing, router]);

  if (!checking) return null;
  return (
    <p
      data-today-refreshing
      className="mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-[#b7aa9c]"
    >
      Checking for updates…
    </p>
  );
}
