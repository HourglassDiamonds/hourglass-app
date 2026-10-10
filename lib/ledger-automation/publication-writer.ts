import {
  OCTOBER_10_LEDGER_PUBLICATION,
  OCTOBER_10_LEDGER_PUBLICATION_ID,
} from "./baseline-publication";
import type { LedgerPublication, LedgerPublicationEvent, LedgerPublicationPointer } from "./publication-types";
import type { LedgerPublicationStore, VersionedPointer } from "./publication-store";
import {
  LedgerPublicationValidationError,
  validateLedgerPublication,
} from "./publication-validation";

function event(
  publication: LedgerPublication,
  status: LedgerPublicationEvent["status"],
  occurredAt: string,
  detail: string,
): LedgerPublicationEvent {
  return {
    schemaVersion: "ledger-publication-event-v1",
    eventId: `${publication.publicationId}:${status}:${occurredAt}`,
    publicationId: publication.publicationId,
    runId: publication.runId,
    status,
    occurredAt,
    detail,
  };
}

export async function getPublicationById(
  store: LedgerPublicationStore,
  publicationId: string,
): Promise<LedgerPublication | null> {
  if (publicationId === OCTOBER_10_LEDGER_PUBLICATION_ID) return structuredClone(OCTOBER_10_LEDGER_PUBLICATION);
  return store.getPublication(publicationId);
}

export async function getCurrentLedgerPublicationFromStore(
  store: LedgerPublicationStore,
): Promise<LedgerPublication> {
  const pointer = await store.getCurrentPointer();
  if (!pointer) return structuredClone(OCTOBER_10_LEDGER_PUBLICATION);
  const publication = await getPublicationById(store, pointer.pointer.currentPublicationId);
  if (!publication) throw new Error(`Current Ledger publication ${pointer.pointer.currentPublicationId} is missing.`);
  return publication;
}

export type PublishResult = {
  publication: LedgerPublication;
  priorPointer: VersionedPointer | null;
  currentPointer: VersionedPointer;
};

export async function publishLedgerPublication(
  store: LedgerPublicationStore,
  publication: LedgerPublication,
  now = new Date(),
): Promise<PublishResult> {
  const priorPointer = await store.getCurrentPointer();
  const priorId = priorPointer?.pointer.currentPublicationId ?? OCTOBER_10_LEDGER_PUBLICATION_ID;
  if (publication.previousPublicationId !== priorId) {
    throw new Error(`Publication predecessor ${publication.previousPublicationId ?? "none"} is not current (${priorId}).`);
  }

  const issues = await validateLedgerPublication(publication, {
    publicationIdExists: async (id) => (await getPublicationById(store, id)) !== null,
    predecessorExists: async (id) => (await getPublicationById(store, id)) !== null,
  });
  if (issues.length > 0) throw new LedgerPublicationValidationError(issues);

  const occurredAt = now.toISOString();
  await store.appendPublicationEvent(event(publication, "PUBLISHING", occurredAt, "Canonical publication validated; staging immutable artifact."));
  await store.appendPublication(structuredClone(publication));

  const pointer: LedgerPublicationPointer = {
    schemaVersion: "ledger-publication-pointer-v1",
    currentPublicationId: publication.publicationId,
    previousPublicationId: priorId,
    updatedAt: occurredAt,
  };
  const currentPointer = await store.writeCurrentPointer(pointer, priorPointer?.version ?? null);
  await store.appendPublicationEvent(event(publication, "PUBLISHED", occurredAt, "Atomic current pointer advanced."));
  return { publication: structuredClone(publication), priorPointer, currentPointer };
}

export async function rollbackLedgerPublicationPointer(
  store: LedgerPublicationStore,
  result: PublishResult,
  reason: string,
  now = new Date(),
): Promise<void> {
  const priorId = result.currentPointer.pointer.previousPublicationId;
  if (!priorId) throw new Error("No prior Ledger publication exists for rollback.");
  const pointer: LedgerPublicationPointer = {
    schemaVersion: "ledger-publication-pointer-v1",
    currentPublicationId: priorId,
    previousPublicationId: result.priorPointer?.pointer.previousPublicationId ?? null,
    updatedAt: now.toISOString(),
  };
  await store.writeCurrentPointer(pointer, result.currentPointer.version);
  await store.appendPublicationEvent(event(result.publication, "PUBLICATION_FAILED", now.toISOString(), reason));
}
