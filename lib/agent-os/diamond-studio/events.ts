/**
 * Typed Studio event ingest. Unknown events are ignored, not thrown.
 * Raw email / names are rejected. Identity is never inferred.
 */

import {
  configurationsEqual,
  DIAMOND_STUDIO_CONFIGURATION_DEFAULTS,
  type DiamondStudioConfiguration,
} from "@/lib/diamond-studio/configuration";
import { parseStudioSearchParams } from "@/lib/diamond-studio/url-state";
import {
  STUDIO_AGENT_EVENT_NAMES,
  type StudioAgentAnonymousEvent,
  type StudioAgentEventName,
  type StudioAgentIdentifiableEvent,
  type StudioAgentIngestResult,
} from "./types";
import { maskStudioViewEmail } from "@/lib/diamond-studio/email-view/validate";
import type { StudioViewEmailedRecord } from "@/lib/diamond-studio/email-view/types";

const EVENT_SET = new Set<string>(STUDIO_AGENT_EVENT_NAMES);

const PII_KEYS = [
  "email",
  "name",
  "firstName",
  "lastName",
  "phone",
  "address",
] as const;

function isIsoTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 10) return false;
  const t = Date.parse(value);
  return Number.isFinite(t);
}

function isConfiguration(value: unknown): value is DiamondStudioConfiguration {
  if (!value || typeof value !== "object") return false;
  const c = value as Record<string, unknown>;
  const required = [
    "shape",
    "carat",
    "ringSize",
    "bandWidth",
    "skinTone",
    "orientation",
    "metal",
  ];
  if (required.some((key) => !(key in c))) return false;
  const params = new URLSearchParams({
    shape: String(c.shape),
    carat: String(c.carat),
    ringSize: String(c.ringSize),
    bandWidth: String(c.bandWidth),
    skinTone: String(c.skinTone),
    orientation: String(c.orientation),
    metal: String(c.metal),
  });
  const roundTrip = parseStudioSearchParams(params);
  return (
    roundTrip.loadedFromUrl &&
    roundTrip.state.shape === c.shape &&
    Math.abs(roundTrip.state.carat - Number(c.carat)) < 0.001 &&
    Math.abs(roundTrip.state.ringSize - Number(c.ringSize)) < 0.001 &&
    Math.abs(roundTrip.state.bandWidth - Number(c.bandWidth)) < 0.001 &&
    roundTrip.state.skinTone === c.skinTone &&
    roundTrip.state.orientation === c.orientation &&
    roundTrip.state.metal === c.metal
  );
}

function containsPii(record: Record<string, unknown>): boolean {
  for (const key of PII_KEYS) {
    if (key in record && record[key] != null && record[key] !== "") return true;
  }
  for (const value of Object.values(record)) {
    if (typeof value === "string" && /@/.test(value) && /\./.test(value)) {
      return true;
    }
  }
  return false;
}

export function isStudioAgentEventName(
  value: unknown,
): value is StudioAgentEventName {
  return typeof value === "string" && EVENT_SET.has(value);
}

export function acceptStudioAgentEvent(
  payload: unknown,
): StudioAgentIngestResult {
  if (!payload || typeof payload !== "object") {
    return { ok: false, reason: "invalid_payload" };
  }
  const record = payload as Record<string, unknown>;
  if (containsPii(record)) {
    return { ok: false, reason: "pii_rejected" };
  }
  if (!isStudioAgentEventName(record.event)) {
    return { ok: false, reason: "unknown_event" };
  }
  if (!isIsoTimestamp(record.timestamp)) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (!isConfiguration(record.configuration)) {
    return { ok: false, reason: "invalid_payload" };
  }
  if (typeof record.sharePath !== "string" || !record.sharePath.startsWith("/")) {
    return { ok: false, reason: "invalid_payload" };
  }

  const event: StudioAgentAnonymousEvent = {
    event: record.event,
    timestamp: record.timestamp,
    configuration: record.configuration,
    sharePath: record.sharePath,
  };
  if (typeof record.sessionId === "string" && record.sessionId.length > 0) {
    event.sessionId = record.sessionId;
  }
  if (typeof record.sourceAttribution === "string") {
    event.sourceAttribution = record.sourceAttribution;
  }
  if (record.snapshotVariant === "clean" || record.snapshotVariant === "card") {
    event.snapshotVariant = record.snapshotVariant;
  }
  return { ok: true, event };
}

/**
 * Convert a successful Email This View store record into an Agent-facing
 * identifiable event. Raw email is not copied onto the Agent object.
 */
export function identifiedEventFromStoreRecord(
  record: StudioViewEmailedRecord,
): StudioAgentIdentifiableEvent {
  return {
    contactId: record.emailHash,
    emailHashOrInternalReference: record.emailHash,
    maskedEmail: maskStudioViewEmail(record.emailNormalized),
    configuration: record.configuration,
    action: "studio_view_emailed",
    timestamp: record.timestamp,
    studioSharePath: record.studioSharePath,
  };
}

export function defaultStudioConfiguration(): DiamondStudioConfiguration {
  return { ...DIAMOND_STUDIO_CONFIGURATION_DEFAULTS };
}

export { configurationsEqual };
