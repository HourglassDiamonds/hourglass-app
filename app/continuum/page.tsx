import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/seo/site-metadata";
import Header from "../shared-components/Header";

export const metadata: Metadata = pageMetadata({
  title: "Continuum",
  description:
    "Learn about Continuum, the private relationship and project intelligence system used by Hourglass Diamonds, including how authorized Google account data is handled.",
  path: "/continuum",
});

export default function ContinuumPage() {
  return (
    <div className="min-h-screen bg-hg-ivory text-hg-ink">
      <div className="mx-auto max-w-[1200px] px-6 md:px-10">
        <Header />
      </div>

      <section className="mx-auto max-w-[760px] px-6 py-20 md:px-10 md:py-28">
        <div className="mb-10 text-[11px] uppercase tracking-[0.28em] text-[#6d655e]">
          Continuum
        </div>

        <h1 className="mb-6 text-[32px] leading-[1.2] text-[#1f1d1a] md:text-[38px]">
          Private relationship and project intelligence for Hourglass Diamonds
        </h1>

        <div className="space-y-10 text-[15px] leading-[1.7] text-[#4e463f]">
          <p>
            Continuum is Hourglass Diamonds&apos; private business operating
            system for organizing client relationships, project context,
            communication history, and follow-up.
          </p>

          <p>
            It brings authorized business information into one protected
            workspace so Hourglass can maintain better continuity across client
            conversations and jewelry projects.
          </p>

          <div className="space-y-4">
            <h2 className="text-[18px] font-medium leading-[1.35] text-[#1f1d1a]">
              Google Account and Gmail
            </h2>
            <p>
              When an authorized Hourglass account is connected, Continuum can
              use read-only Gmail access to help organize relevant communication
              history and connect it with existing relationship and project
              context.
            </p>
            <p>
              It does not use Gmail permission to send, edit, or delete
              messages. Access is limited to authorized Hourglass use and can be
              disconnected.
            </p>
          </div>

          <div>
            <Link
              href="/privacy"
              className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.26em] text-[#625b54] transition-colors hover:text-[#1f1d1a]"
            >
              Privacy Policy
            </Link>
          </div>

          <p className="text-[13px] leading-[1.7] text-[#6d655e]">
            Continuum is currently an internal Hourglass Diamonds system and is
            not offered as a public consumer service.
          </p>
        </div>
      </section>
    </div>
  );
}
