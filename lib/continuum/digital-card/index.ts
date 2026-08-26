/**
 * Continuum digital card public surface.
 * Does not export the Supabase adapter ??? import that from `./server`.
 */

export {
  DIGITAL_CARD_CONTEXT_STATUSES,
  DIGITAL_CARD_CREATED_BY,
  DIGITAL_CARD_EXCHANGE_EVENT_TYPE,
  DIGITAL_CARD_SCHEMA_VERSION,
  DIGITAL_CARD_SOURCE_SYSTEM,
  IDENTITY_EXCHANGE_RESOLUTIONS,
} from "./types";
export type {
  DigitalCard,
  DigitalCardAdditionalLink,
  DigitalCardContext,
  IdentityExchange,
  PublicDigitalCard,
  SaveDigitalCardInput,
  SaveDigitalCardResult,
  ShareContactInput,
  ShareContactResult,
  SubmittedContact,
} from "./types";
export {
  conciergeMyCardPath,
  DIGITAL_CARD_PUBLIC_PREFIX,
  publicCardPath,
  publicCardVcardPath,
} from "./paths";
export { publicCardAbsoluteUrl } from "./origin";
export {
  isPublicCardSlug,
  parseDigitalCardFields,
  parseShareContact,
  parseSlug,
  suggestSlugFromName,
} from "./parse";
export {
  formatPublicPhone,
  lookupPublicDigitalCard,
  publicMailtoHref,
  publicSmsHref,
  publicTelHref,
  toPublicDigitalCard,
} from "./public";
export { buildPublicVcard, vcardFilename } from "./vcard";
export { InMemoryDigitalCardStore } from "./store";
export type { DigitalCardStore } from "./store";
export { ingestDigitalCardShare } from "./ingest";
export { saveOwnerDigitalCard } from "./owner";
