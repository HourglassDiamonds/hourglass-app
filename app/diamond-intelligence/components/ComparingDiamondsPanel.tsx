"use client";

import Link from "next/link";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";
import { DI_LINK } from "./di-editorial-classes";

export default function ComparingDiamondsPanel({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="rounded-lg border border-[#ebe4da]/30 bg-white/25 px-4 py-4 md:px-5 md:py-5">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#6b5048]">
        Concierge
      </p>
      <p className="mt-0.5 text-[13px] leading-[1.72] text-[#5f5851]">
        We can review this diamond alongside comparable options and provide
        candid guidance on value, performance, and tradeoffs.
      </p>
      <Link
        href="/concierge"
        className={`mt-4 inline-block ${DI_LINK} text-[11px] tracking-[0.1em]`}
        onClick={() =>
          trackConsultationCtaClicked("diamond_intelligence:comparing_diamonds")
        }
      >
        Begin the Conversation
      </Link>
    </div>
  );
}
