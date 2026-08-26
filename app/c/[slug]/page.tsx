import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { CONTINUUM_APP_NAME } from "@/lib/continuum/pwa/config";
import { loadPublicDigitalCard } from "@/lib/continuum/digital-card/public-load";
import { parseSlug } from "@/lib/continuum/digital-card/parse";
import {
  checkDigitalCardReadRateLimit,
  getDigitalCardClientIp,
} from "@/lib/continuum/digital-card/rate-limit";
import { PublicCardActions, PublicCardView } from "./components/public-card";
import { ShareYourInfoForm } from "./components/share-form";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ctx?: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPublicDigitalCard(slug);
  if (result.status !== "found") {
    return { title: CONTINUUM_APP_NAME, robots: { index: false, follow: false } };
  }
  return {
    title: result.card.displayName,
    description: [result.card.memorableTitle, result.card.professionalTitle, result.card.company]
      .filter(Boolean)
      .join(" · "),
    robots: { index: false, follow: false, nocache: true, noarchive: true },
  };
}

export default async function PublicDigitalCardPage({
  params,
  searchParams,
}: PageProps) {
  const headerList = await headers();
  const limited = checkDigitalCardReadRateLimit(getDigitalCardClientIp(headerList));
  if (!limited.allowed) notFound();

  const { slug } = await params;
  const parsed = parseSlug(slug);
  if (!parsed.ok) notFound();

  const result = await loadPublicDigitalCard(parsed.slug);
  if (result.status === "not-found") notFound();
  if (result.status !== "found") {
    return (
      <main className="relative min-h-[100dvh] bg-[#14110f] px-5 py-16 text-[#efe8de]">
        <p className="mx-auto max-w-[22rem] text-center font-serif text-[1.65rem] leading-snug tracking-[-0.03em]">
          This card is unavailable just now.
        </p>
      </main>
    );
  }

  const query = await searchParams;
  const contextToken = query.ctx?.trim() || null;

  return (
    <main className="relative min-h-[100dvh] overflow-x-hidden bg-[#14110f] text-[#efe8de]">
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[34rem] flex-col justify-center px-5 py-[max(2.5rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))]">
        <p className="mb-10 text-center text-[11px] uppercase tracking-[0.28em] text-[#8d8073]">
          {CONTINUUM_APP_NAME}
        </p>
        <PublicCardView
          card={result.card}
          actions={
            <PublicCardActions
              slug={result.card.slug}
              onShare={
                <ShareYourInfoForm
                  slug={result.card.slug}
                  submissionId={randomUUID()}
                  contextToken={contextToken}
                />
              }
            />
          }
        />
      </div>
    </main>
  );
}
