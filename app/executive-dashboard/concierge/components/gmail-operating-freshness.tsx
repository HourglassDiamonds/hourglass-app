"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { GMAIL_OPERATING_FRESHNESS_POLL_MS } from "@/lib/continuum/gmail/index-freshness";
import {
  shouldPollTodayFreshness,
  shouldRefreshTodaySurface,
  shouldSwapTodayAfterRecompute,
  todaySourceFreshnessLabel,
  type TodaySourceHealth,
} from "@/lib/continuum/chief-of-staff/operating-loop/today-refresh";
import { refreshGmailOperatingFreshness } from "../gmail-freshness-actions";
import { probeTodayRecompute, probeTodayCanonicalWatermark } from "../today-read-model-actions";

const TODAY_RECOMPUTE_POLL_MS = 1_000;

/**
 * Today freshness loop.
 * On open, and about once a minute while the tab is visible, check the
 * Gmail and canonical source watermarks (including snooze expiry). Refresh only when that cycle
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
  const [sourceHealth, setSourceHealth] = useState<TodaySourceHealth>("checking");
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const hidden = typeof document !== "undefined" && document.hidden;
      if (!shouldPollTodayFreshness({ documentHidden: hidden, inFlight: inFlight.current })) {
        return;
      }
      inFlight.current = true;
      try {
        const [mail, canonical] = await Promise.allSettled([
          refreshGmailOperatingFreshness(),
          probeTodayCanonicalWatermark(),
        ]);
        if (cancelled) return;
        const currentWatermark = canonical.status === "fulfilled" ? canonical.value : null;
        const result = mail.status === "fulfilled" ? mail.value : null;
        if (mail.status === "fulfilled" && result?.safeErrorCode == null) {
          setSourceHealth("current");
          setLastCheckedAt(Date.now());
        } else if (result?.safeErrorCode === "gmail-sync-already-running") {
          setSourceHealth("checking");
        } else {
          setSourceHealth("delayed");
        }
        const mailChanged = result && result.safeErrorCode !== "unauthorized" && shouldRefreshTodaySurface(result.docketMayHaveChanged);
        if (mailChanged || (currentWatermark && baselineWatermark && currentWatermark !== baselineWatermark)) router.refresh();
      } catch {
        setSourceHealth("delayed");
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
  }, [router, baselineWatermark]);

  useEffect(() => {
    const id = window.setInterval(() => setClock(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);

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

  const health = checking ? "checking" : sourceHealth;
  const label = health === "checking"
    ? "Checking for updates…"
    : todaySourceFreshnessLabel({ health, lastCheckedAt, nowMs: clock });
  return (
    <p
      data-today-freshness={health}
      data-today-refreshing={checking ? "" : undefined}
      className={`mb-3 text-[0.72rem] uppercase tracking-[0.16em] ${health === "delayed" ? "text-[#d6a66f]" : "text-[#81776d]"}`}
      role="status"
    >
      {label}
    </p>
  );
}
