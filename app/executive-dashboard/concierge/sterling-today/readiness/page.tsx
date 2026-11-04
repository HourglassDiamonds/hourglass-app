import { ConciergeBackLink } from "../../components/concierge-back-link";
import { ConciergeShell } from "../../components/concierge-shell";
import { getAuthenticatedSterlingReadiness } from "@/lib/continuum/today-sterling/readiness";
import type { SterlingReadinessReport } from "@/lib/continuum/today-sterling/readiness";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Sterling Today readiness",
  robots: { index: false, follow: false, nocache: true, noarchive: true },
};

export default async function SterlingTodayReadinessPage() {
  const access = await getAuthenticatedSterlingReadiness();
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
        ) : <ReadinessReport report={access.report} />}
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
    ["Indexed coverage", `${report.gmail.indexedMessageCount} messages / ${report.gmail.indexedThreadCount} threads · ${report.gmail.missingCandidateThreadCount} candidate-thread gaps`],
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
