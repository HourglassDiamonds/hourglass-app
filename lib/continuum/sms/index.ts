export type {
  MessageAdapterInput,
  NormalizedSmsMessage,
  SmsAttachmentMeta,
  SmsDirection,
  SmsIdentityPerson,
  SmsIdentityWorld,
  SmsParseSurface,
  SmsParticipant,
  SmsPhoneClassification,
} from "./types";
export { SMS_BRIDGE_PRODUCER, SMS_MUTATION_BOUNDARY, UNSPECIFIED_SMS_PROVIDER } from "./types";
export {
  conversationKeyFor,
  fallbackSmsMessageId,
  normalizeSmsMessage,
  packSmsSourceRef,
  smsIdempotencyKey,
} from "./normalize";
export {
  existingPersonById,
  isInternalPhoneHash,
  isVendorRole,
  isWorkContactRole,
  resolveSmsPersonIdentity,
} from "./identity";
export type { SmsIdentityDecision } from "./identity";
export {
  admittedSmsEvents,
  projectSmsObservations,
  smsTodayAdmission,
  smsTodaySurface,
} from "./bridge";
export type { SmsBridgeObservation, SmsTodaySurface } from "./bridge";
