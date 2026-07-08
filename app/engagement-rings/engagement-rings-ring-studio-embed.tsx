"use client";

import { useEffect, useRef, useState } from "react";

const EMBED_SRC = "/ring-studio/ring-studio-embed.html?embed=1";
const STANDALONE_SRC = "/ring-studio/ring-studio-embed.html";
const HEIGHT_MESSAGE_TYPE = "hourglass-ring-studio-height";
const FALLBACK_HEIGHT = 760;
const FALLBACK_HEIGHT_XL = 820;
const MIN_HEIGHT = 520;
const MAX_HEIGHT = 1400;
const XL_MQ = "(min-width: 1280px)";

type RingStudioHeightMessage = {
  type: typeof HEIGHT_MESSAGE_TYPE;
  height: number;
};

function isTrustedRingStudioOrigin(origin: string): boolean {
  if (typeof window === "undefined") return false;
  return origin === window.location.origin;
}

function normalizeHeight(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.ceil(value);
  if (rounded < MIN_HEIGHT || rounded > MAX_HEIGHT) return null;
  return rounded;
}

function fallbackHeight(): number {
  if (typeof window === "undefined") return FALLBACK_HEIGHT;
  return window.matchMedia(XL_MQ).matches
    ? FALLBACK_HEIGHT_XL
    : FALLBACK_HEIGHT;
}

export default function EngagementRingsRingStudioEmbed() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(fallbackHeight);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isTrustedRingStudioOrigin(event.origin)) return;
      const data = event.data as RingStudioHeightMessage | null;
      if (!data || data.type !== HEIGHT_MESSAGE_TYPE) return;
      if (
        iframeRef.current &&
        event.source &&
        event.source !== iframeRef.current.contentWindow
      ) {
        return;
      }
      const next = normalizeHeight(data.height);
      if (next == null) return;
      setIframeHeight((prev) => (prev === next ? prev : next));
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <>
      <div className="mt-9 md:hidden">
        <a
          href={STANDALONE_SRC}
          className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#efe8de]"
        >
          Open Ring Studio
        </a>
      </div>

      <div
        className="mt-9 hidden md:mt-10 md:block"
        style={{ minHeight: Math.max(iframeHeight, FALLBACK_HEIGHT) }}
      >
        <div className="rounded-[32px] border border-[#e4dbcf]/70 bg-[radial-gradient(circle_at_62%_36%,rgba(255,255,255,0.62),rgba(248,243,235,0.42)_42%,rgba(239,232,222,0.28)_100%)] p-5 md:p-6 lg:p-7">
          <div className="overflow-hidden rounded-[24px] bg-[var(--hg-ivory,#efe8de)]/40">
            <iframe
              ref={iframeRef}
              src={EMBED_SRC}
              title="Hourglass Ring Studio"
              className="block w-full border-0 bg-transparent"
              style={{
                height: iframeHeight,
                minHeight: FALLBACK_HEIGHT,
                maxHeight: MAX_HEIGHT,
              }}
              loading="lazy"
              scrolling="no"
            />
          </div>
        </div>
      </div>
    </>
  );
}
