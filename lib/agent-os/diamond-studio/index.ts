/**
 * Diamond Studio Agent V1 — public specialist API.
 *
 * Standalone under the Chief of Staff. NOT a sixth executive.
 * NOT wired into runAgentOsBrief() in V1.
 * No email, outreach, CRM writes, or GA identity matching.
 */

export {
  DIAMOND_STUDIO_AGENT_ID,
  DIAMOND_STUDIO_AGENT_VERSION,
  DIAMOND_STUDIO_AGENT_DISPLAY_NAME,
  STUDIO_AGENT_EVENT_NAMES,
  type StudioAgentEventName,
  type StudioAgentAnonymousEvent,
  type StudioAgentIdentifiableEvent,
  type StudioAgentIngestResult,
  type StudioHealthReport,
  type StudioActivitySummary,
  type IdentifiedStudioActivitySummary,
  type StudioHandoffEnvelope,
} from "./types";

export {
  DIAMOND_STUDIO_AGENT_PRINCIPLES,
  DIAMOND_STUDIO_AGENT_MISSION,
} from "./principles";

export {
  classifyDiamondStudioAgentPermissionTier,
  diamondStudioAgentMayExecute,
  diamondStudioAgentMapsOntoV1Prohibitions,
  DIAMOND_STUDIO_AGENT_GREEN_CAPABILITIES,
  DIAMOND_STUDIO_AGENT_RED_CAPABILITIES,
} from "./permissions";

export { acceptStudioAgentEvent, isStudioAgentEventName, identifiedEventFromStoreRecord } from "./events";

export { runDiamondStudioHealthChecks } from "./health";

export { summarizeStudioActivity } from "./summary";

export {
  summarizeIdentifiedStudioActivity,
  formatIdentifiedStudioSignal,
  formatStudioDailyIntelligencePrep,
} from "./identified-summary";

export {
  studioHandoffToChiefOfStaff,
  studioHandoffToClientAgent,
  STUDIO_CHIEF_OF_STAFF_RELATIONSHIP,
} from "./handoff";

export {
  summarizeStudioOperationalExceptions,
  evaluateStudioOperationalConfig,
  recordStudioOperationalSignal,
  resetStudioOperationalSignals,
  listStudioOperationalSignals,
} from "./operational";
