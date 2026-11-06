import { ConciergeBackLink } from "../../components/concierge-back-link";
import { ConciergeShell } from "../../components/concierge-shell";
import { getAuthenticatedSterlingReadiness } from "@/lib/continuum/today-sterling/readiness";
import type { SterlingReadinessReport } from "@/lib/continuum/today-sterling/readiness";
import Link from "next/link";
import {
  recomputeCanonicalToday,
  runOneControlledGmailRefreshChunk,
  runZeroWriteGmailReadinessCheck,
} from "./actions";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
export const metadata = {
  title: "Sterling Today readiness",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function SterlingTodayReadinessPage({
  searchParams,
}: {
  searchParams: Promise<{
    readiness?: string;
    gmail?: string;
    indexed?: string;
    remaining?: string;
    code?: string;
    recompute?: string;
  }>;
}) {
  const access = await getAuthenticatedSterlingReadiness();
  const { readiness, gmail, indexed, remaining, code, recompute } = await searchParams;
  return (
    <ConciergeShell>
      <ConciergeBackLink />
      <section className="mt-8 max-w-4xl rounded-3xl border border-[#ad9164]/25 bg-[#17130f] p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#ad9164]">Preview only · read only</p>
        <h1 className="mt-3 font-serif text-[1.9rem] text-[#efe8de]">Sterling publication readiness</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-[#a99c90]">
          This check reads aggregate state only. It does not contact Gmail, run a model, create a proposal,
          change canonical data, or publish Sterling.
        </p>
        {!access.ok ? (
          <p role="alert" className="mt-6 rounded-xl border border-[#d39a8a]/30 p-4 text-[13px] text-[#d39a8a]">
            {access.reason === "not-preview" ? "Unavailable outside verified isolated Preview." :
              access.reason === "unauthorized" ? "Founder authentication is required." : "Readiness data is unavailable."}
          </p>
        ) : <>
          <ReadinessReport report={access.report} />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <form action={runZeroWriteGmailReadinessCheck} className="rounded-2xl border border-white/10 p-4">
              <p className="text-[12px] leading-relaxed text-[#a99c90]">
                Re-read connection, authorization, checkpoint, coverage, and publication metadata. This never contacts Gmail or writes data.
              </p>
              {readiness ? <p role="status" className={`mt-3 text-[12px] ${readiness === "completed" ? "text-[#a9bd8e]" : "text-[#d39a8a]"}`}>
                {readiness === "completed" ? "Zero-write Gmail readiness check completed." : `Readiness check blocked · ${readiness}`}
              </p> : null}
              <button type="submit" className="mt-4 rounded-full border border-[#ad9164]/50 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#d8c6aa] hover:border-[#ad9164]">
                Check Gmail readiness
              </button>
            </form>
            <form action={runOneControlledGmailRefreshChunk} className="rounded-2xl border border-white/10 p-4">
              <p className="text-[12px] leading-relaxed text-[#a99c90]">
                Run exactly one bounded, lease-protected Gmail page. The recurring kill switch remains off and no retry or second chunk starts automatically.
              </p>
              {gmail ? <p role="status" className={`mt-3 text-[12px] ${gmail === "completed" || gmail === "progressed" || gmail === "recovering" ? "text-[#a9bd8e]" : "text-[#d39a8a]"}`}>
                Gmail chunk · {gmail} · {indexed ?? "0"} indexed · pages remaining {remaining ?? "unknown"}{code ? ` · ${code}` : ""}
              </p> : null}
              <button type="submit" className="mt-4 rounded-full border border-[#ad9164]/50 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#d8c6aa] hover:border-[#ad9164]">
                Run one Gmail refresh chunk
              </button>
            </form>
          </div>
          <form action={recomputeCanonicalToday} className="mt-6 rounded-2xl border border-white/10 p-4">
            <p className="text-[12px] leading-relaxed text-[#a99c90]">
              Rebuild canonical Today once from current Preview evidence. This does not ingest Gmail, publish Sterling,
              change client records, or enable recurring work.
            </p>
            {recompute ? <p role="status" className={`mt-3 text-[12px] ${recompute === "completed" ? "text-[#a9bd8e]" : "text-[#d39a8a]"}`}>
              {recompute === "completed" ? "Canonical Today recomputation completed." : "Canonical Today recomputation did not complete."}
            </p> : null}
            <button type="submit" className="mt-4 rounded-full border border-[#ad9164]/50 px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-[#d8c6aa] hover:border-[#ad9164]">
              Recompute canonical Today
            </button>
          </form>
        </>}
        <Link href="/executive-dashboard/concierge/sterling-today/associations" className="mt-6 inline-block text-[11px] uppercase tracking-[0.14em] text-[#ad9164] underline underline-offset-4">
          Open real-client correspondence review
        </Link>
      </section>
    </ConciergeShell>
  );
}

function ReadinessReport({ report }: { report: SterlingReadinessReport }) {
  const rows: Array<[string, string]> = [
    ["Gmail connection", report.gmail.connectionStatus],
    ["Gmail authorization", `${report.gmail.authorizationStatus}${report.gmail.authorizationReason ? ` · ${report.gmail.authorizationReason}` : ""}`],
    ["Last successful ingestion", report.gmail.lastSuccessfulIngestionAt ?? "None recorded"],
    ["Checkpoint", `${report.gmail.checkpointStatus ?? "missing"} · ${report.gmail.checkpointAgeHours ?? "unknown"}h old`],
    ["Post-authorization ingestion", report.gmail.successfulIngestionAfterAuthorization ? "verified" : "required"],
    ["Indexed coverage", `${report.gmail.indexedMessageCount} messages / ${report.gmail.indexedThreadCount} threads`],
    ["Fixture Candidate references", `${report.gmail.fixtureCandidateThreadCount} fixture-era / ${report.gmail.currentCandidateThreadCount} current-provider threads · diagnostic only`],
    ["Real-client association coverage", `${report.gmail.trustedRealClientThreadCount} trusted / ${report.gmail.realClientThreadCount} discovered · ${report.gmail.unresolvedRealClientThreadCount} unresolved`],
    ["Association persistence", report.gmail.associationPersistence],
    ["Canonical Project/Job watermark", report.watermarks.canonicalProjectJob],
    ["Founder correction / Candidate watermark", report.watermarks.founderCorrectionCandidateReview],
    ["Today rebuild", `${report.today.status} · ${report.today.lastSuccessfulRebuildAt ?? "never"}`],
    ["Correspondence", report.today.correspondenceStatus ?? "not recorded"],
    ["Sterling validation", report.sterling.validationReady ? "ready" : "blocked"],
    ["Publication", `${report.sterling.publicationState} · expires ${report.sterling.expiresAt ?? "not applicable"}`],
    ["Publisher", report.sterling.publisherEnabled ? "ON" : "OFF"],
  ];
  return <div className="mt-7 space-y-6">
    <dl className="divide-y divide-white/10 rounded-2xl border border-white/10">
      {rows.map(([label, value]) => <div key={label} className="grid gap-1 p-3 sm:grid-cols-[210px_1fr]">
        <dt className="text-[11px] uppercase tracking-[0.12em] text-[#81766c]">{label}</dt>
        <dd className="break-all text-[12px] text-[#c4b7aa]">{value}</dd>
      </div>)}
    </dl>
    <section>
      <h2 className="text-[11px] uppercase tracking-[0.16em] text-[#ad9164]">Publishing blocked because</h2>
      {report.publishingBlockedReasons.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-[12px] text-[#d6a66f]">
        {report.publishingBlockedReasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul> : <p className="mt-3 text-[12px] text-[#a9bd8e]">No readiness blocker detected.</p>}
    </section>
  </div>;
}
