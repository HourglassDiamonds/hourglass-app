import { approvedSnapshotAdapter } from "./adapters";
import { buildRunKey, runLedgerAutomation } from "./engine";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";
import type { LedgerAutomationStore } from "./store";
import { buildCanonicalPublication } from "./publication-factory";
import type { LedgerPublicationStore } from "./publication-store";
import { getCurrentLedgerPublicationFromStore, publishLedgerPublication, rollbackLedgerPublicationPointer } from "./publication-writer";
import { evaluateSafeUpdateAutoPublish } from "./auto-publish-policy";
import { validatePublishedLedger, type AcceptanceResult } from "./post-publication-acceptance";
import type {
  FounderDecision,
  FounderDecisionRecord,
  LedgerRunType,
  LedgerSourceAdapter,
  LedgerSourceDefinition,
} from "./types";

const LEDGER_TIME_ZONE = "America/New_York";

async function publicationBecameCurrent(
  store: LedgerPublicationStore,
  publicationId: string,
): Promise<boolean> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pointer = await store.getCurrentPointer();
    if (pointer?.pointer.currentPublicationId === publicationId) return true;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return false;
}

export type ExecuteScheduledRunInput = {
  runType: LedgerRunType;
  now?: Date;
  store: LedgerAutomationStore;
  adapter?: LedgerSourceAdapter;
  registry?: readonly LedgerSourceDefinition[];
  publicationStore?: LedgerPublicationStore;
  acceptance?: ((publication: import("./publication-types").LedgerPublication) => Promise<AcceptanceResult>) | false;
};

export type ExecuteManualFullRunInput = Omit<ExecuteScheduledRunInput, "runType"> & {
  reviewDate: string;
  runKey?: string;
};

export function ledgerScheduledDate(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: LEDGER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function tuesdayDateForFriday(scheduledDate: string): string {
  const date = new Date(`${scheduledDate}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 3);
  return date.toISOString().slice(0, 10);
}

async function executeLedgerRun(
  input: ExecuteScheduledRunInput,
  scheduledDate: string,
  runKey: string,
  previousReview: Awaited<ReturnType<LedgerAutomationStore["getRun"]>> = null,
) {
  const existing = await input.store.getRun(runKey);
  if (existing) return { created: false, run: existing };

  const now = input.now ?? new Date();
  const timestamp = now.toISOString();
  const proposed = await runLedgerAutomation({
    runType: input.runType,
    scheduledDate,
    runKey,
    startedAt: timestamp,
    completedAt: timestamp,
    registry: input.registry ?? LEDGER_SOURCE_REGISTRY,
    adapter: input.adapter ?? approvedSnapshotAdapter,
    previousReview,
  });
  let finalRun = proposed;
  if (proposed.classification !== "NO_CHANGE" && input.publicationStore) {
    const current = await getCurrentLedgerPublicationFromStore(input.publicationStore);
    const candidate = buildCanonicalPublication(proposed, current, now);
    finalRun = { ...proposed, canonicalPublication: candidate };
    if (proposed.classification === "SAFE_UPDATE") {
      const policy = evaluateSafeUpdateAutoPublish(current, candidate);
      if (policy.eligible) {
        try {
          const publishResult = await publishLedgerPublication(input.publicationStore, candidate, now);
          const acceptance = input.acceptance === false
            ? null
            : input.acceptance ?? (process.env.VERCEL_ENV === "production" ? (publication: import("./publication-types").LedgerPublication) => validatePublishedLedger(publication) : null);
          if (acceptance) {
            const result = await acceptance(candidate);
            if (!result.ok) {
              await rollbackLedgerPublicationPointer(input.publicationStore, publishResult, `Post-publication acceptance failed: ${result.failures.join("; ")}`, now);
              throw new Error("Post-publication acceptance failed; the previous current pointer was restored.");
            }
          }
          finalRun = {
            ...finalRun,
            state: "PUBLISHED",
            stateHistory: [...finalRun.stateHistory, { state: "PUBLISHING", at: timestamp }, { state: "PUBLISHED", at: timestamp }],
            theoreticalAutoPublishEligible: true,
            publicationOccurred: true,
            publicationId: candidate.publicationId,
            publicationDate: candidate.publicationDate,
          };
        } catch (error) {
          if (await publicationBecameCurrent(input.publicationStore, candidate.publicationId)) {
            finalRun = {
              ...finalRun,
              state: "PUBLISHED",
              stateHistory: [...finalRun.stateHistory, { state: "PUBLISHING", at: timestamp }, { state: "PUBLISHED", at: timestamp }],
              theoreticalAutoPublishEligible: true,
              publicationOccurred: true,
              publicationId: candidate.publicationId,
              publicationDate: candidate.publicationDate,
            };
            const appended = await input.store.appendRun(finalRun);
            return { created: appended.created, run: appended.value };
          }
          await input.publicationStore.appendPublicationEvent({
            schemaVersion: "ledger-publication-event-v1",
            eventId: `${candidate.publicationId}:PUBLICATION_FAILED:${timestamp}`,
            publicationId: candidate.publicationId,
            runId: candidate.runId,
            status: "PUBLICATION_FAILED",
            occurredAt: timestamp,
            detail: error instanceof Error ? error.message : "Publication failed safely.",
          });
          finalRun = {
            ...finalRun,
            state: "PUBLICATION_FAILED",
            stateHistory: [...finalRun.stateHistory, { state: "PUBLICATION_FAILED", at: timestamp }],
            theoreticalAutoPublishEligible: true,
          };
        }
      } else {
        finalRun = {
          ...finalRun,
          state: "AWAITING_APPROVAL",
          theoreticalAutoPublishEligible: false,
          evidencePacket: {
            ...finalRun.evidencePacket,
            reasons: [...finalRun.evidencePacket.reasons, ...policy.reasons],
          },
        };
      }
    }
  }
  const appended = await input.store.appendRun(finalRun);
  return { created: appended.created, run: appended.value };
}

export async function executeScheduledLedgerRun(input: ExecuteScheduledRunInput) {
  const now = input.now ?? new Date();
  const scheduledDate = ledgerScheduledDate(now);
  const runKey = buildRunKey(scheduledDate, input.runType);
  const previousReview = input.runType === "FRIDAY_DELTA"
    ? await input.store.getRun(buildRunKey(tuesdayDateForFriday(scheduledDate), "TUESDAY_FULL"))
    : null;
  return executeLedgerRun({ ...input, now }, scheduledDate, runKey, previousReview);
}

export async function executeManualFullLedgerRun(input: ExecuteManualFullRunInput) {
  const runKey = input.runKey ?? `ledger:${input.reviewDate}:manual-full`;
  if (runKey !== `ledger:${input.reviewDate}:manual-full`) {
    throw new Error("Manual full Ledger run key must match its review date.");
  }
  return executeLedgerRun(
    { ...input, runType: "TUESDAY_FULL" },
    input.reviewDate,
    runKey,
  );
}

export type ReviewRunInput = {
  runKey: string;
  decision: FounderDecision;
  decidedAt: string;
  decidedBy: string;
  note?: string;
  store: LedgerAutomationStore;
};

export async function reviewLedgerRun(input: ReviewRunInput): Promise<FounderDecisionRecord> {
  const run = await input.store.getRun(input.runKey);
  if (!run) throw new Error(`Unknown Ledger automation run: ${input.runKey}`);
  if (run.state !== "AWAITING_APPROVAL") {
    throw new Error(`Run ${input.runKey} is not awaiting approval.`);
  }
  const resultingState = input.decision === "APPROVE"
    ? "APPROVED"
    : input.decision === "REJECT"
      ? "REJECTED"
      : "NEEDS_REVISION";
  const decisionId = `${input.runKey}:founder-decision`;
  const record: FounderDecisionRecord = {
    schemaVersion: "ledger-founder-decision-v1",
    decisionId,
    runKey: input.runKey,
    decision: input.decision,
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    note: input.note ?? null,
    resultingState,
  };
  const appended = await input.store.appendDecision(record);
  if (!appended.created && appended.value.decision !== input.decision) {
    throw new Error(`Run ${input.runKey} already has a founder decision.`);
  }
  return appended.value;
}

export type DecideLedgerPublicationInput = ReviewRunInput & {
  publicationStore: LedgerPublicationStore;
};

export async function decideLedgerPublication(input: DecideLedgerPublicationInput) {
  const decision = await reviewLedgerRun(input);
  const run = await input.store.getRun(input.runKey);
  if (!run?.canonicalPublication) throw new Error(`Run ${input.runKey} has no canonical publication proposal.`);
  if (decision.decision !== "APPROVE") {
    return { decision, publication: null, state: decision.resultingState } as const;
  }

  const existingPointer = await input.publicationStore.getCurrentPointer();
  if (existingPointer?.pointer.currentPublicationId === run.canonicalPublication.publicationId) {
    return { decision, publication: run.canonicalPublication, state: "PUBLISHED" as const };
  }

  const approved = {
    ...run.canonicalPublication,
    approvedAt: decision.decidedAt,
    publishedAt: decision.decidedAt,
    audit: {
      ...run.canonicalPublication.audit,
      founderDecision: decision,
      publicationStatus: "APPROVED" as const,
    },
  };
  await publishLedgerPublication(input.publicationStore, approved, new Date(decision.decidedAt));
  return { decision, publication: approved, state: "PUBLISHED" as const };
}
