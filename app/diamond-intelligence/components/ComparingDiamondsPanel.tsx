"use client";

import Link from "next/link";
import { trackConsultationCtaClicked } from "@/lib/consultation-cta";

export default function ComparingDiamondsPanel({
  visible,
}: {
  visible: boolean;
}) {
  if (!visible) return null;

  return (
    <div className="rounded-xl border border-[#ebe4da]/45 bg-white/35 px-5 py-5 ring-1 ring-[#ebe4da]/25 md:px-6">
      <p className="text-[10px] uppercase tracking-[0.28em] text-[#6b5048]">
        Concierge
      </p>
      <p className="mt-2.5 text-[13px] leading-[1.72] text-[#5f5851]">
        We can review this diamond alongside comparable options and provide
        candid guidance on value, performance, and tradeoffs.
      </p>
      <Link
        href="/concierge"
        className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-[#2b2723] px-4 py-3 text-[10px] uppercase tracking-[0.26em] text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#cbbda9]"
        onClick={() =>
          trackConsultationCtaClicked("diamond_intelligence:comparing_diamonds")
        }
      >
        Begin the Conversation
      </Link>
    </div>
  );
}
