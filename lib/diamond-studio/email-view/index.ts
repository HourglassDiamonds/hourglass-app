export {
  STUDIO_VIEW_EMAILED_EVENT,
  STUDIO_VIEW_EMAIL_SUBJECT,
  STUDIO_VIEW_EMAIL_CTA,
  type StudioViewEmailedRecord,
  type HandleEmailStudioViewResult,
} from "./types";

export { handleEmailStudioView } from "./handle";
export { parseEmailViewJsonBody, maskStudioViewEmail } from "./validate";
export { renderStudioViewEmail } from "./render-email";
export { studioPublicOrigin, studioAbsoluteShareUrl } from "./origin";
export {
  isStudioViewEmailConfigured,
  resolveStudioViewEmailFrom,
  PREFERRED_STUDIO_VIEW_FROM,
} from "./send";
export {
  persistStudioViewEmailed,
  listStudioViewEmailedFromMemory,
  listStudioViewEmailedByNormalizedEmail,
  getStudioViewEmailedById,
  deleteStudioViewEmailedById,
  resetStudioIdentifiedEventStore,
  memoryFallbackAllowed,
  type StudioPersistResult,
} from "./store";
export {
  checkStudioEmailRateLimit,
  resetStudioEmailRateLimits,
  getStudioEmailClientIp,
} from "./rate-limit";
