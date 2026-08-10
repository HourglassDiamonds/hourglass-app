"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackDiamondStudioEvent } from "@/app/diamond-studio/analytics";
import type { DiamondStudioEventProperties } from "@/app/diamond-studio/analytics";

type ShareStudioViewProps = {
  /** Fully resolved absolute or same-origin URL to copy. */
  getShareUrl: () => string;
  analyticsProps: () => DiamondStudioEventProperties;
  className?: string;
};

export default function ShareStudioView({
  getShareUrl,
  analyticsProps,
  className = "",
}: ShareStudioViewProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  const handleShare = useCallback(async () => {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackDiamondStudioEvent("diamond_studio_share", analyticsProps());
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setCopied(false);
        resetTimer.current = null;
      }, 2000);
    } catch {
      /* clipboard denied — fail quietly */
    }
  }, [analyticsProps, getShareUrl]);

  return (
    <p className={`dts-stage-trust ${className}`.trim()}>
      <button
        type="button"
        className="dts-stage-trust-link dts-share-view"
        onClick={handleShare}
        aria-live="polite"
      >
        {copied ? "Link copied" : "Share this view"}
      </button>
    </p>
  );
}
