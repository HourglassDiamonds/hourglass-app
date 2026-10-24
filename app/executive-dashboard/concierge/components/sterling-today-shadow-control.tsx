"use client";

import { useActionState } from "react";
import {
  runSterlingTodayAssemblyAction,
  runSterlingTodaySarahAssemblyAction,
  runSterlingTodaySarahPackagePreflightAction,
  runSterlingTodaySarahSemanticAction,
  runSterlingTodaySemanticAction,
  type SterlingTodayActionState,
} from "../sterling-today-actions";

function Count({ label, value }: { label: string; value: number | null | undefined }) {
  return (
    <div className="flex justify-between gap-4">
      <dt>{label}</dt>
      <dd>{value ?? "—"}</dd>
    </div>
  );
}

function Timestamp({ value }: { value: string | null }) {
  return <span>{value ? new Date(value).toLocaleString() : "—"}</span>;
}

function WorkUnitCoverage({ state }: { state: NonNullable<SterlingTodayActionState> }) {
  if (state.workUnitCoverage.length === 0) return null;
  return (
    <details className="mt-6 border-t border-white/10 pt-5">
      <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
        Per-work-unit evidence coverage ({state.workUnitCoverage.length})
      </summary>
      <div className="mt-4 space-y-3">
        {state.workUnitCoverage.map((row) => (
          <div key={row.workUnitRef} className="rounded-xl border border-white/10 p-4 text-[12px] text-[#b8aa9d]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="text-[#efe8de]">{row.workUnitRef}</code>
              <span>{row.classification}{row.recordIdentifier ? ` · ${row.recordIdentifier}` : ""}</span>
            </div>
            <p className="mt-2 text-[#d3c7bb]">{row.evidenceStatus} · {row.modelEligible ? "eligible" : "blocked"}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
              <Count label="Required threads" value={row.requiredThreadCount} />
              <Count label="Missing exact" value={row.missingExactThreadCount} />
              <Count label="Provider failed" value={row.providerFailedThreadCount} />
              <Count label="Rate-limited" value={row.providerRateLimitedThreadCount} />
              <Count label="Other provider" value={row.otherProviderErrorThreadCount} />
              <Count label="Budget-deferred" value={row.budgetDeferredThreadCount} />
              <Count label="Missing indexed" value={row.missingIndexedThreadCount} />
              <Count label="Indexed only" value={row.indexedOnlyThreadCount} />
              <Count label="Verification reused" value={row.reusedVerificationThreadCount} />
            </dl>
            <p className="mt-3">Indexed freshness: <Timestamp value={row.latestIndexedEvidenceAt} /></p>
            <p>Live-verified freshness: <Timestamp value={row.latestLiveVerifiedEvidenceAt} /></p>
            <p>Last successful verification: <Timestamp value={row.lastSuccessfulVerificationAt} /></p>
            {row.blockReason ? <p className="mt-2 text-[#d5a98c]">Block: {row.blockReason}</p> : null}
            {row.suppressionReason ? <p className="mt-1">Suppressed: {row.suppressionReason}</p> : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function NamedCaseCoverage({ state }: { state: NonNullable<SterlingTodayActionState> }) {
  if (state.namedCaseCoverage.length === 0) return null;
  return (
    <details className="mt-6 border-t border-white/10 pt-5">
      <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
        Named-case acceptance coverage ({state.namedCaseCoverage.length})
      </summary>
      <div className="mt-4 space-y-2 text-[12px] text-[#b8aa9d]">
        {state.namedCaseCoverage.map((row) => (
          <div key={row.caseId} className="rounded-xl border border-white/10 p-3">
            <p className="text-[#efe8de]">{row.caseId}</p>
            <p>{row.evidenceStatus} · {row.resolution} · {row.workUnitRefs.length} matching unit(s)</p>
            {row.blockReasons.length ? <p className="mt-1 text-[#d5a98c]">{row.blockReasons.join(", ")}</p> : null}
          </div>
        ))}
      </div>
    </details>
  );
}

function SafeResult({ state }: { state: NonNullable<SterlingTodayActionState> }) {
  return (
    <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">{state.verdict}</p>
      <dl className="mt-4 space-y-2 text-[13px] text-[#c4b7aa]">
        <Count label="Work units" value={state.counts?.workUnits} />
        <Count label="Eligible" value={state.completeness?.modelEligibleWorkUnitCount} />
        <Count label="Blocked" value={state.completeness?.blockedWorkUnitCount} />
        <Count label="Scoped" value={state.scope?.total} />
        <Count label="Scope unresolved" value={state.scope?.unresolved} />
        <Count label="Gmail required" value={state.gmail?.requiredThreadCount} />
        <Count label="Gmail scheduled" value={state.gmail?.scheduledThreadCount} />
        <Count label="Successfully retrieved" value={state.gmail?.completedThreadCount} />
        <Count label="Provider rate-limited" value={state.gmail?.providerRateLimitedThreadCount} />
        <Count label="Other provider errors" value={state.gmail?.otherProviderErrorThreadCount} />
        <Count label="Not requested — budget exhausted" value={state.gmail?.budgetDeferredThreadCount} />
        <Count label="Missing indexed evidence" value={state.gmail?.missingIndexedThreadCount} />
        <Count label="Assembly ms" value={state.performance?.assemblyLatencyMs} />
        <Count label="Model ms" value={state.performance?.modelLatencyMs} />
        <Count label="Input tokens" value={state.performance?.tokenUsage?.inputTokens} />
        <Count label="Output tokens" value={state.performance?.tokenUsage?.outputTokens} />
        <Count label="Validation errors" value={state.validation?.errorCount} />
      </dl>
      {state.target ? (
        <div className="mt-5 rounded-xl border border-[#ad9164]/30 p-4 text-[12px] text-[#b8aa9d]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">Selected target evidence</p>
          <p className="mt-2 text-[#efe8de]">{state.target.selectedWorkUnitRef ?? "No trusted target selected"}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <Count label="Required target threads" value={state.target.requiredThreadCount} />
            <Count label="Scheduled target threads" value={state.target.scheduledThreadCount} />
            <Count label="Live retrieved" value={state.target.successfullyLiveRetrievedThreadCount} />
            <Count label="Missing or failed" value={state.target.missingOrFailedThreadCount} />
            <Count label="Provider failed" value={state.target.providerFailedThreadCount} />
            <Count label="Budget-deferred" value={state.target.budgetDeferredThreadCount} />
            <Count label="Indexed messages required" value={state.target.requiredIndexedMessageCount} />
            <Count label="Live messages retrieved" value={state.target.successfullyLiveRetrievedMessageCount} />
            <Count label="Evidence messages included" value={state.target.includedEvidenceMessageCount} />
            <Count label="Excluded ambiguous associations" value={state.target.excludedOrAmbiguousAssociationCount} />
            <Count label="Secondary matches" value={state.target.secondaryWorkUnitRefs.length} />
          </dl>
          <p className="mt-3">Latest verified source: {state.target.latestVerifiedSourceAt ?? "Unavailable"}</p>
          <p className="mt-3">Target completeness: {state.target.complete ? "complete" : "blocked"}</p>
          {state.target.stoppedAtStage ? <p className="mt-2 text-[#d5a98c]">
            Stopped at: {state.target.stoppedAtStage}
          </p> : null}
        </div>
      ) : null}
      {state.packagePreflight ? (
        <div className="mt-5 rounded-xl border border-[#ad9164]/30 p-4 text-[12px] text-[#b8aa9d]">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">Sarah package preflight</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
            <Count label="Required target threads" value={state.packagePreflight.requiredTargetThreadCount} />
            <Count label="Scheduled target threads" value={state.packagePreflight.scheduledTargetThreadCount} />
            <Count label="Live retrieved threads" value={state.packagePreflight.liveRetrievedTargetThreadCount} />
            <Count label="Indexed messages" value={state.packagePreflight.indexedMessageCount} />
            <Count label="Live messages" value={state.packagePreflight.liveMessageCount} />
            <Count label="Included messages" value={state.packagePreflight.includedMessageCount} />
            <Count label="Evidence references" value={state.packagePreflight.citationHandleCount} />
            <Count label="Serialized request bytes" value={state.packagePreflight.serializedRequestBytes} />
            <Count label="Request-byte ceiling" value={state.packagePreflight.requestByteCeiling} />
          </dl>
          <p className="mt-3">Message parity: {state.packagePreflight.messageCountParity ? "pass" : "fail"}</p>
          <p>Chronology: {state.packagePreflight.chronologyValid ? "pass" : "fail"}</p>
          <p>Source attribution: {state.packagePreflight.sourceAttributionValid ? "pass" : "fail"}</p>
          <p>Source provenance: {state.packagePreflight.provenanceValid ? "pass" : "fail"}</p>
          <p>October 21 Mod 9 evidence: {state.packagePreflight.mod9EvidencePresent ? "present" : "absent"}</p>
          <p>64,000-byte ceiling: {state.packagePreflight.requestByteCeilingPassed ? "pass" : "fail"}</p>
          {state.packagePreflight.chronologyInvariant ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <Count label="Missing message IDs" value={state.packagePreflight.chronologyInvariant.missingMessageIdCount} />
              <Count label="Malformed message IDs" value={state.packagePreflight.chronologyInvariant.malformedMessageIdCount} />
              <Count label="Duplicate message IDs" value={state.packagePreflight.chronologyInvariant.duplicateMessageIdCount} />
              <Count label="Invalid timestamps" value={state.packagePreflight.chronologyInvariant.invalidTimestampCount} />
              <Count label="Out-of-order messages" value={state.packagePreflight.chronologyInvariant.outOfOrderMessageCount} />
              <Count label="Missing required threads" value={state.packagePreflight.chronologyInvariant.missingRequiredThreadCount} />
              <Count label="Wrong-thread messages" value={state.packagePreflight.chronologyInvariant.requiredThreadMembershipMismatchCount} />
              <Count label="Provenance mismatches" value={state.packagePreflight.chronologyInvariant.provenanceMismatchCount} />
              <Count label="Unexpected evidence members" value={state.packagePreflight.chronologyInvariant.unexpectedEvidenceMembershipCount} />
              <Count label="Indexed/live count delta" value={state.packagePreflight.chronologyInvariant.indexedLiveCountDisagreementCount} />
              <Count label="Indexed/included count delta" value={state.packagePreflight.chronologyInvariant.indexedIncludedCountDisagreementCount} />
            </dl>
          ) : null}
          {state.packagePreflight.extractionDiagnostics ? (
            <details className="mt-4 border-t border-white/10 pt-4">
              <summary className="cursor-pointer text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
                Privacy-safe extraction diagnostics
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
                <Count label="Messages classified" value={state.packagePreflight.extractionDiagnostics.totalMessageCount} />
                <Count label="Provenance mismatches" value={state.packagePreflight.extractionDiagnostics.provenanceMismatchCount} />
                <Count label="Decoding succeeded" value={state.packagePreflight.extractionDiagnostics.decodingSucceededCount} />
                <Count label="Current text found" value={state.packagePreflight.extractionDiagnostics.currentMessageTextFoundCount} />
                <Count label="Operational text recognized" value={state.packagePreflight.extractionDiagnostics.operationalTextRecognizedCount} />
                <Count label="Attachment metadata present" value={state.packagePreflight.extractionDiagnostics.attachmentMetadataPresentCount} />
                <Count label="Provider fallback affected" value={state.packagePreflight.extractionDiagnostics.providerFallbackAffectedCount} />
                <Count label="Uncertain extraction" value={state.packagePreflight.extractionDiagnostics.uncertainCount} />
              </dl>
              <div className="mt-3 space-y-2">
                {state.packagePreflight.extractionDiagnostics.mismatches.map((row) => (
                  <div key={row.messageRef} className="rounded-lg border border-white/10 p-3">
                    <p className="text-[#efe8de]">{row.messageRef} · {row.outcome}</p>
                    <p>Decode: {row.decodingSucceeded ? "succeeded" : "not verified"}</p>
                    <p>Current text: {row.currentMessageTextFound ? "found" : "not found"}</p>
                    <p>Operational text: {row.operationalTextRecognized ? "recognized" : "not recognized"}</p>
                    <p>Attachment metadata: {row.attachmentMetadataPresent ? "present" : "absent"}</p>
                    <p>Provider fallback affected extraction: {row.providerFallbackAffectedExtraction ? "yes" : "no"}</p>
                    <p>Uncertain: {row.extractionUncertain ? "yes" : "no"}</p>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          <p className="mt-3">Verified chronology: <Timestamp value={state.packagePreflight.earliestVerifiedMessageAt} />
            {" — "}<Timestamp value={state.packagePreflight.latestVerifiedMessageAt} /></p>
          {state.packagePreflight.componentBytes ? (
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2">
              <Count label="Instructions bytes" value={state.packagePreflight.componentBytes.instructions} />
              <Count label="Working-set bytes" value={state.packagePreflight.componentBytes.workingSet} />
              <Count label="Schema bytes" value={state.packagePreflight.componentBytes.outputSchema} />
              <Count label="Envelope/encoding bytes" value={state.packagePreflight.componentBytes.envelopeAndEncodingOverhead} />
              <Count label="Evidence-record bytes" value={state.packagePreflight.componentBytes.evidenceRecords} />
              <Count label="Operational-text bytes" value={state.packagePreflight.componentBytes.operationalText} />
              <Count label="Attachment metadata bytes" value={state.packagePreflight.componentBytes.attachmentMetadata} />
              <Count label="Repeated operational-text bytes" value={state.packagePreflight.componentBytes.repeatedOperationalText} />
              <Count label="Quoted-text bytes" value={state.packagePreflight.componentBytes.quotedText} />
              <Count label="Possible signature bytes" value={state.packagePreflight.componentBytes.possibleSignatureText} />
            </dl>
          ) : null}
        </div>
      ) : null}
      {state.continuity ? (
        <div className="mt-5 rounded-xl border border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">
            Retrieval continuity · {state.continuity.status}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px] text-[#b8aa9d] sm:grid-cols-4">
            <Count label="Verification reused" value={state.continuity.reusedVerificationCount} />
            <Count label="Verification expired" value={state.continuity.expiredVerificationCount} />
            <Count label="Verification invalidated" value={state.continuity.invalidatedVerificationCount} />
            <Count label="Verification persisted" value={state.continuity.persistedVerificationCount} />
            <Count label="Persistence conflicts" value={state.continuity.persistenceConflictCount} />
            <Count label="Persistence failures" value={state.continuity.persistenceFailureCount} />
          </dl>
          <p className="mt-3 text-[12px] text-[#9d9084]">
            Continuity metadata is assembly planning only and never substitutes for semantic source evidence.
          </p>
        </div>
      ) : null}
      {state.safeErrors.length ? (
        <p className="mt-4 text-[12px] text-[#9d9084]">Safe status: {state.safeErrors.join(", ")}</p>
      ) : null}
      {state.candidateCoverage ? (
        <p className="mt-4 text-[12px] text-[#9d9084]">
          Candidate frontier: {state.candidateCoverage.selected} selected; {state.candidateCoverage.suppressed} suppressed
          ({Object.entries(state.candidateCoverage.suppressedByReason).map(([reason, count]) => `${reason}: ${count}`).join(", ")}).
        </p>
      ) : null}
      <NamedCaseCoverage state={state} />
      <WorkUnitCoverage state={state} />
    </div>
  );
}

function SemanticProposal({ state }: { state: NonNullable<SterlingTodayActionState> }) {
  if (!state.proposal) return null;
  return (
    <div className="mt-6 rounded-2xl border border-[#ad9164]/30 bg-black/20 p-5">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">Validated Sarah proposal</p>
      <div className="mt-4 space-y-4 text-[13px] leading-relaxed text-[#c4b7aa]">
        {state.proposal.assessments.map((assessment) => (
          <div key={assessment.workUnitRef} className="rounded-xl border border-white/10 p-4">
            <p className="text-[#efe8de]">{assessment.operationalSubstage ??
              assessment.canonicalLifecycleStage ?? "Stage remains uncertain"}</p>
            <p className="mt-2">{assessment.explanation}</p>
            <p className="mt-2">Next owner: {assessment.nextStepOwner}</p>
            {assessment.obligations.map((obligation, index) => (
              <p key={`${obligation.status}-${index}`} className="mt-2">
                {obligation.status}: {obligation.description} · {obligation.responsibleParty}
              </p>
            ))}
            {assessment.ambiguities.length ? <p className="mt-2 text-[#d5a98c]">
              Uncertainty: {assessment.ambiguities.join("; ")}
            </p> : null}
            <p className="mt-2 text-[11px] text-[#81766c]">Evidence: {assessment.citations.join(", ")}</p>
          </div>
        ))}
        {state.proposal.recommendations.map((recommendation, index) => (
          <div key={`${recommendation.title}-${index}`} className="rounded-xl border border-white/10 p-4">
            <p className="text-[#efe8de]">{recommendation.title}</p>
            <p className="mt-2">{recommendation.summary}</p>
            <p className="mt-2 text-[11px] text-[#81766c]">Evidence: {recommendation.citations.join(", ")}</p>
          </div>
        ))}
        {state.proposal.portfolioAmbiguities.length ? <p className="text-[#d5a98c]">
          Portfolio uncertainty: {state.proposal.portfolioAmbiguities.join("; ")}
        </p> : null}
        <p className="text-[11px] text-[#81766c]">
          Proposal only. Canonical mutations proposed: {state.proposal.mutationProposalCount}. Nothing was applied.
        </p>
      </div>
    </div>
  );
}

export function SterlingTodayShadowControl({ semanticAvailable, sarahSemanticAvailable }: {
  semanticAvailable: boolean;
  sarahSemanticAvailable: boolean;
}) {
  const [assembly, assemblyAction, assemblyPending] = useActionState(runSterlingTodayAssemblyAction, null);
  const [sarahAssembly, sarahAssemblyAction, sarahAssemblyPending] = useActionState(runSterlingTodaySarahAssemblyAction, null);
  const [sarahPackagePreflight, sarahPackagePreflightAction, sarahPackagePreflightPending] = useActionState(
    runSterlingTodaySarahPackagePreflightAction,
    null,
  );
  const [sarahSemantic, sarahSemanticAction, sarahSemanticPending] = useActionState(
    runSterlingTodaySarahSemanticAction,
    null,
  );
  const [semantic, semanticAction, semanticPending] = useActionState(runSterlingTodaySemanticAction, null);
  const executionPending = assemblyPending || sarahAssemblyPending || sarahPackagePreflightPending ||
    sarahSemanticPending || semanticPending;
  return (
    <section className="mt-8 max-w-2xl rounded-3xl border border-[#ad9164]/25 bg-[#17130f] p-6 md:p-8">
      <p className="text-[10px] uppercase tracking-[0.24em] text-[#ad9164]">Founder shadow execution</p>
      <h1 className="mt-3 font-serif text-[1.9rem] font-normal tracking-[-0.035em] text-[#efe8de]">
        Sterling-native Today
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-[#a99c90]">
        Read-only acceptance. This control does not publish Today or apply canonical changes.
      </p>
      <div className="mt-7 rounded-2xl border border-[#ad9164]/25 bg-black/20 p-5">
        <p className="text-[11px] uppercase tracking-[0.18em] text-[#ad9164]">Sarah / C026143</p>
        <p className="mt-2 text-[12px] leading-relaxed text-[#9d9084]">
          Fixed server-owned scope. Sarah&apos;s required threads are retrieved live in this request or the result remains blocked.
        </p>
        <form action={sarahAssemblyAction} className="mt-4">
          <button type="submit" disabled={executionPending}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#71685f]">
            {sarahAssemblyPending ? "Assembling Sarah evidence…" : "Run Sarah Evidence Assembly"}
          </button>
        </form>
        <form action={sarahPackagePreflightAction} className="mt-3">
          <button type="submit" disabled={executionPending}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#71685f]">
            {sarahPackagePreflightPending ? "Measuring Sarah package…" : "Run Sarah Package Preflight"}
          </button>
        </form>
        <form action={sarahSemanticAction} className="mt-3">
          <button type="submit" disabled={!sarahSemanticAvailable || executionPending}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#71685f]">
            {sarahSemanticPending ? "Reasoning about Sarah…" : "Run Sarah Semantic Shadow Once"}
          </button>
        </form>
        <p className="mt-2 text-[12px] text-[#81766c]">
          {sarahSemanticAvailable
            ? "One-shot Sarah semantic authorization is available only if its server record is still unused."
            : "Sarah semantic execution is disabled."}
        </p>
      </div>
      {sarahAssembly ? <SafeResult state={sarahAssembly} /> : null}
      {sarahPackagePreflight ? <SafeResult state={sarahPackagePreflight} /> : null}
      {sarahSemantic ? <><SafeResult state={sarahSemantic} /><SemanticProposal state={sarahSemantic} /></> : null}
      <form action={assemblyAction} className="mt-7">
        <button type="submit" disabled={executionPending}
          className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#71685f]">
          {assemblyPending ? "Assembling…" : "Run evidence assembly"}
        </button>
      </form>
      {assembly ? <SafeResult state={assembly} /> : null}
      <div className="mt-8 border-t border-white/10 pt-7">
        <form action={semanticAction}>
          <button type="submit" disabled={!semanticAvailable || executionPending}
            className="inline-flex min-h-11 items-center text-[11px] uppercase tracking-[0.2em] text-[#efe8de] outline-none hover:text-[#ad9164] focus-visible:text-[#ad9164] disabled:text-[#71685f]">
            {semanticPending ? "Reasoning…" : "Run semantic shadow"}
          </button>
        </form>
        <p className="mt-2 text-[12px] text-[#81766c]">
          {semanticAvailable ? "Founder-triggered semantic shadow is available." : "Semantic execution is disabled."}
        </p>
        {semantic ? <SafeResult state={semantic} /> : null}
      </div>
    </section>
  );
}
