/**
 * Protected-plane current-state read model over the Gmail metadata index.
 * Answers latest inbound/outbound and whether newer indexed activity exists
 * since a previous sync watermark. Does not build Meeting Prep or Project Desk.
 */

import type { GmailIndexStore } from "@/lib/continuum/client-memory/gmail/store";
import type {
  GmailIndexedMessage,
  GmailMessageDirection,
} from "@/lib/continuum/client-memory/gmail/types";
import { GMAIL_INCREMENTAL_JOB_KEY } from "./types";

export type GmailCurrentStatePointer = {
  messageId: string;
  threadId: string;
  sentAt: string;
  indexedAt: string;
  direction: GmailMessageDirection;
};

export type GmailCurrentState = {
  latestInbound: GmailCurrentStatePointer | null;
  latestOutbound: GmailCurrentStatePointer | null;
  lastSuccessfulSyncAt: string | null;
  hasNewerIndexedActivity: boolean;
};

function pointer(row: GmailIndexedMessage): GmailCurrentStatePointer {
  return {
    messageId: row.messageId,
    threadId: row.threadId,
    sentAt: row.sentAt,
    indexedAt: row.indexedAt,
    direction: row.direction,
  };
}

function laterIso(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return Date.parse(a) >= Date.parse(b) ? a : b;
}

export async function readGmailCurrentState(
  index: GmailIndexStore,
  sinceIso?: string | null,
): Promise<GmailCurrentState> {
  const [inbound, outbound, checkpoint] = await Promise.all([
    index.listLatestByDirection("inbound", 1),
    index.listLatestByDirection("outbound", 1),
    index.getCheckpoint(GMAIL_INCREMENTAL_JOB_KEY),
  ]);
  const latestInbound = inbound[0] ? pointer(inbound[0]) : null;
  const latestOutbound = outbound[0] ? pointer(outbound[0]) : null;
  const lastSuccessfulSyncAt =
    checkpoint?.status === "completed" && checkpoint.historyId
      ? checkpoint.updatedAt
      : null;
  const newestSent = laterIso(
    latestInbound?.sentAt ?? null,
    latestOutbound?.sentAt ?? null,
  );
  const newestIndexed = laterIso(
    latestInbound?.indexedAt ?? null,
    latestOutbound?.indexedAt ?? null,
  );
  const activityAt = laterIso(
    laterIso(newestSent, newestIndexed),
    lastSuccessfulSyncAt,
  );
  const hasNewerIndexedActivity = Boolean(
    sinceIso &&
      activityAt &&
      Number.isFinite(Date.parse(sinceIso)) &&
      Date.parse(activityAt) > Date.parse(sinceIso),
  );
  return {
    latestInbound,
    latestOutbound,
    lastSuccessfulSyncAt,
    hasNewerIndexedActivity,
  };
}

export function gmailCurrentStatePublicView(state: GmailCurrentState): {
  latestInboundAt: string | null;
  latestOutboundAt: string | null;
  lastSuccessfulSyncAt: string | null;
  hasNewerIndexedActivity: boolean;
} {
  return {
    latestInboundAt: state.latestInbound?.sentAt ?? null,
    latestOutboundAt: state.latestOutbound?.sentAt ?? null,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
    hasNewerIndexedActivity: state.hasNewerIndexedActivity,
  };
}
