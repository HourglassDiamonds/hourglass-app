"use client";

import Link from "next/link";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

export default function CustomDesignHeroActions() {
  return (
    <div className="mt-7 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6 md:mt-8">
      <Link
        href="/concierge"
        onClick={() => trackConsultationCtaClicked("custom_design:hero")}
        className="inline-flex items-center justify-center rounded-full bg-[#2b2723] px-7 py-3 text-sm tracking-[0.08em] text-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-all duration-300 hover:opacity-95 hover:shadow-[0_2px_6px_rgba(0,0,0,0.12)] focus:outline-none focus:ring-2 focus:ring-[#cbbda9] focus:ring-offset-2 focus:ring-offset-[#efe8de]"
      >
        Begin the Conversation
      </Link>
      <Link
        href="/engagement-rings"
        className="text-[0.92rem] text-[#6b5048] underline underline-offset-4 transition-colors hover:text-[#1f1d1a]"
      >
        Explore Engagement Rings
      </Link>
    </div>
  );
}
