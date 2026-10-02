import { approvedSnapshotAdapter } from "./adapters";
import { buildRunKey, runLedgerAutomation } from "./engine";
import { LEDGER_SOURCE_REGISTRY } from "./source-registry";
import type { LedgerAutomationStore } from "./store";
import type {
  FounderDecision,
  FounderDecisionRecord,
  LedgerRunType,
  LedgerSourceAdapter,
  LedgerSourceDefinition,
} from "./types";

const LEDGER_TIME_ZONE = "America/New_York";

export type ExecuteScheduledRunInput = {
  runType: LedgerRunType;
  now?: Date;
  store: LedgerAutomationStore;
  adapter?: LedgerSourceAdapter;
  registry?: readonly LedgerSourceDefinition[];
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

export async function executeScheduledLedgerRun(input: ExecuteScheduledRunInput) {
  const now = input.now ?? new Date();
  const scheduledDate = ledgerScheduledDate(now);
  const runKey = buildRunKey(scheduledDate, input.runType);
  const existing = await input.store.getRun(runKey);
  if (existing) return { created: false, run: existing };

  const previousReview = input.runType === "FRIDAY_DELTA"
    ? await input.store.getRun(buildRunKey(tuesdayDateForFriday(scheduledDate), "TUESDAY_FULL"))
    : null;
  const timestamp = now.toISOString();
  const proposed = await runLedgerAutomation({
    runType: input.runType,
    scheduledDate,
    startedAt: timestamp,
    completedAt: timestamp,
    registry: input.registry ?? LEDGER_SOURCE_REGISTRY,
    adapter: input.adapter ?? approvedSnapshotAdapter,
    previousReview,
  });
  const appended = await input.store.appendRun(proposed);
  return { created: appended.created, run: appended.value };
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
      : "AWAITING_APPROVAL";
  const decisionId = `${input.runKey}:${input.decision}:${input.decidedAt}`;
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
  return (await input.store.appendDecision(record)).value;
}
