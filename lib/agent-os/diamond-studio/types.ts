/**
 * Diamond Studio Agent V1 — typed contracts.
 * Specialist under the Chief of Staff. Not a sixth executive.
 * Read-only. No client outreach. No identity inference from GA.
 */

import type { DiamondStudioConfiguration } from "@/lib/diamond-studio/configuration";

export const DIAMOND_STUDIO_AGENT_ID = "diamond-studio-agent" as const;
export const DIAMOND_STUDIO_AGENT_VERSION = "1.0.0" as const;
export const DIAMOND_STUDIO_AGENT_DISPLAY_NAME = "Diamond Studio Agent" as const;

export const STUDIO_AGENT_EVENT_NAMES = [
  "studio_snapshot_created",
  "studio_snapshot_shared",
  "studio_share_card_created",
  "diamond_studio_share",
  "diamond_studio_view",
  "studio_session_engaged",
  "consultation_cta_clicked",
  "studio_view_emailed",
] as const;

export type StudioAgentEventName = (typeof STUDIO_AGENT_EVENT_NAMES)[number];

export const STUDIO_AGENT_SNAPSHOT_VARIANTS = ["clean", "card"] as const;
export type StudioAgentSnapshotVariant =
  (typeof STUDIO_AGENT_SNAPSHOT_VARIANTS)[number];

/** Anonymous Studio activity — configuration only, never PII. */
export type StudioAgentAnonymousEvent = {
  event: StudioAgentEventName;
  timestamp: string;
  sessionId?: string;
  configuration: DiamondStudioConfiguration;
  sharePath: string;
  sourceAttribution?: string;
  snapshotVariant?: StudioAgentSnapshotVariant;
};

/**
 * Identified Studio activity. Raw email lives only in the server-side
 * identified event store. The Agent summary uses a masked address and
 * never infers purchase intent.
 */
export type StudioAgentIdentifiableEvent = {
  contactId: string;
  emailHashOrInternalReference: string;
  maskedEmail: string;
  configuration: DiamondStudioConfiguration;
  action: "studio_view_emailed";
  timestamp: string;
  studioSharePath: string;
};

export type StudioAgentIngestResult =
  | { ok: true; event: StudioAgentAnonymousEvent }
  | { ok: false; reason: "unknown_event" | "invalid_payload" | "pii_rejected" };

export type StudioHealthCheckId =
  | "band-asset-coverage"
  | "registry-paths"
  | "url-parse-serialize"
  | "default-band-width"
  | "metal-preservation"
  | "representative-share-links"
  | "snapshot-generation"
  | "snapshot-calibration";

export type StudioHealthCheck = {
  id: StudioHealthCheckId;
  ok: boolean;
  detail: string;
};

export type StudioHealthReport = {
  healthy: boolean;
  checks: StudioHealthCheck[];
  facts: string[];
  inferences: string[];
};

export type StudioActivitySummary = {
  eventCount: number;
  snapshotCount: number;
  shareCount: number;
  cardCount: number;
  emailedCount: number;
  popularShapes: Array<{ shape: string; count: number }>;
  materialSignals: string[];
  identityInvented: false;
  notes: string[];
};

export type IdentifiedStudioActivityLine = {
  maskedEmail: string;
  configurationLabel: string;
};

export type IdentifiedStudioActivitySummary = {
  emailedCount: number;
  lines: IdentifiedStudioActivityLine[];
  identityInvented: false;
  purchaseIntentInferred: false;
  notes: string[];
};

export type StudioHandoffTarget =
  | "diamond-studio-agent"
  | "client-sales-agent"
  | "chief-of-staff"
  | "founder";

/**
 * Future routing only. V1 does not send, match contacts, or surface
 * founder noise. Identity is never inferred from anonymous GA.
 */
export type StudioHandoffEnvelope = {
  from: "diamond-studio-agent";
  to: StudioHandoffTarget;
  reason: string;
  requiresIdentity: boolean;
  material: boolean;
};
