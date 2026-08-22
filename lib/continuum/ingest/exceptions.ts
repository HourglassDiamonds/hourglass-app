import { randomUUID } from "node:crypto";
import type { ContinuumException } from "../contracts/types";
import { validateExceptionPayload } from "../contracts/validation";
import type { ContinuumStore } from "../persistence/types";

export function buildIdentifiedPersistenceFailedException(input: {
  operationId: string;
  nowIso: string;
}): ContinuumException {
  const payload = { emailsSent: 1 as const };
  const valid = validateExceptionPayload(payload);
  if (!valid.ok) throw new Error(valid.reason);
  return {
    id: randomUUID(),
    exceptionType: "studio.identified_persistence_failed",
    subjectKey: input.operationId,
    subjectEntityId: null,
    status: "open",
    openedAt: input.nowIso,
    lastSeenAt: input.nowIso,
    resolvedAt: null,
    detector: "studio-email-view",
    evidenceId: null,
    payload,
  };
}

export async function recordIdentifiedPersistenceFailedBestEffort(input: {
  store: ContinuumStore | null;
  operationId: string;
  nowIso?: string;
}): Promise<"written" | "skipped" | "failed"> {
  if (!input.store) return "skipped";
  const nowIso = input.nowIso ?? new Date().toISOString();
  try {
    await input.store.upsertOpenException(
      buildIdentifiedPersistenceFailedException({
        operationId: input.operationId,
        nowIso,
      }),
    );
    return "written";
  } catch (error) {
    console.error("[continuum-exception]", {
      failed: true,
      exceptionType: "studio.identified_persistence_failed",
      operationId: input.operationId,
      sharedDatabaseOutagePossible: true,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return "failed";
  }
}
