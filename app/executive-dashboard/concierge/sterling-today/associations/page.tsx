import { cookies } from "next/headers";
import { requireInternalClientMemorySession } from "@/lib/continuum/client-memory/read/access";
import { EXECUTIVE_DASHBOARD_SESSION_COOKIE } from "@/lib/executive-dashboard/session";
import { getSupabaseAdmin } from "@/lib/supabase/client";
import { isVerifiedSterlingTodayPreviewRuntime } from "@/lib/continuum/today-sterling/server-config";
import { loadRealClientAssociationBatch } from "@/lib/continuum/today-sterling/real-client-association-load";
import { ConciergeBackLink } from "../../components/concierge-back-link";
import { ConciergeShell } from "../../components/concierge-shell";
import { RealClientAssociationReview } from "../../components/real-client-association-review";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Real-client correspondence review",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function RealClientAssociationsPage() {
  const jar = await cookies();
  const session = await requireInternalClientMemorySession(jar.get(EXECUTIVE_DASHBOARD_SESSION_COOKIE)?.value);
  const client = getSupabaseAdmin();
  const allowed = isVerifiedSterlingTodayPreviewRuntime() && session.ok && client;
  const batch = allowed ? await loadRealClientAssociationBatch(client).catch(() => null) : null;
  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <section className="mt-8 max-w-5xl rounded-3xl border border-[#ad9164]/25 bg-[#17130f] p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#ad9164]">Preview only · founder authenticated · read only</p>
        <h1 className="mt-3 font-serif text-[1.9rem] text-[#efe8de]">Real-client correspondence review</h1>
        <p className="mt-3 max-w-3xl text-[14px] leading-relaxed text-[#a99c90]">
          Provider thread IDs and aggregate chronology are shown for founder review. Subject matching discovers candidates only; it never proves identity, merges people, changes lifecycle, creates work, or publishes Sterling.
        </p>
        {batch ? <RealClientAssociationReview batch={batch} /> : (
          <p role="alert" className="mt-6 rounded-xl border border-[#d39a8a]/30 p-4 text-[13px] text-[#d39a8a]">This protected Preview review batch is unavailable.</p>
        )}
      </section>
    </ConciergeShell>
  );
}
