"use client";

import ConsultationCtaLink from "../shared-components/ConsultationCtaLink";
import { event as gtagEvent } from "@/lib/gtag";

function trackRingStudioCta(location: string) {
  if (typeof window === "undefined") return;

  try {
    gtagEvent("ring_studio_cta_clicked", {
      location,
      destination: "#ring-studio",
      page_path: window.location.pathname,
    });
  } catch {
    /* provider missing or blocked */
  }
}

export default function EngagementRingsHeroActions() {
  const scrollToRingStudio = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    trackRingStudioCta("engagement_rings:hero");
    document.getElementById("ring-studio")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6 md:mt-8">
      <a
        href="#ring-studio"
        onClick={scrollToRingStudio}
        className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hg-focus focus-visible:ring-offset-2 focus-visible:ring-offset-hg-ivory"
      >
        Explore the Ring Studio
      </a>
      <ConsultationCtaLink
        location="engagement_rings:hero"
        className="hg-tap text-[0.92rem] text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]"
      >
        Begin the Conversation
      </ConsultationCtaLink>
    </div>
  );
}
