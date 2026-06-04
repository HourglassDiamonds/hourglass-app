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
    <div className="rounded-lg border border-[#ebe4da]/80 bg-white/35 px-4 py-4 md:px-5">
      <p className="text-[11px] tracking-[0.14em] text-[#6b5048]">
        Already considering another diamond?
      </p>
      <p className="mt-2 text-[13px] leading-[1.7] text-[#5f5851]">
        We can review it alongside comparable options and provide candid guidance
        on value, performance, and tradeoffs before you make a final decision.
      </p>
      <Link
        href="/concierge"
        className="mt-3.5 inline-flex w-full items-center justify-center rounded-full bg-[#2b2723] px-4 py-2.5 text-[11px] tracking-[0.14em] text-white transition-opacity hover:opacity-90"
        onClick={() =>
          trackConsultationCtaClicked("diamond_intelligence:comparing_diamonds")
        }
      >
        Begin the Conversation
      </Link>
    </div>
  );
}
