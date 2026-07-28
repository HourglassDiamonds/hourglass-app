/**
 * Agent OS automated cadence + Chief of Staff email delivery.
 * External write boundary: founder-brief email + optional failure-alert email only.
 */

export {
  buildFounderBriefFingerprint,
  buildFounderBriefFingerprintFromTitles,
  briefFingerprintFromFounderBrief,
  buildRecipientConfigFingerprint,
  buildDeliveryIdempotencyKey,
  buildCooldownSuppressionKey,
  actionTokenFromText,
  impactBucket,
} from "./fingerprint";

export {
  resolveAgentOsEmailConfig,
  isAgentOsEmailConfigured,
} from "./email-config";
export type { AgentOsEmailConfig } from "./email-config";

export {
  cadenceWindowId,
  windowForFrequency,
  FOUNDER_BRIEF_CADENCE_IDS,
  isFounderBriefCadence,
  pickPreferredFounderCadence,
  listDueFounderCadencesInOrder,
  weeklyFounderBriefOccupiesLocalDate,
  founderBriefClaimSucceeded,
} from "./windows";
export type { FounderBriefCadenceId } from "./windows";

export { evaluateDeliveryEligibility } from "./eligibility";
export type { DeliveryEligibility } from "./eligibility";

export {
  reserveDelivery,
  transitionDeliveryStatus,
  resolveUncertainDelivery,
} from "./reserve";
export type { ReserveDeliveryInput, ReserveDeliveryResult } from "./reserve";

export {
  renderFounderBriefEmail,
  renderFailureAlertEmail,
} from "./render-email";
export type { RenderedAgentOsEmail } from "./render-email";

export {
  resendAgentOsEmailSender,
  createFakeEmailSender,
} from "./send-email";
export type { AgentOsEmailSender, EmailSendResult } from "./send-email";

export {
  executeAgentOsCadence,
  inspectAgentOsDeliveries,
} from "./execute";
export type {
  CadenceExecutionMode,
  CadenceRunMode,
  ExecuteCadenceOptions,
  CadenceExecutionResult,
} from "./execute";
