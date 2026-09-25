/**
 * Provider-neutral SMS adapter input.
 * A text is evidence. It does not mint a Person, a Project, or a Today item.
 * Provider is an opaque string. This module does not choose a telephony vendor.
 */

import type { PersonRole } from "@/lib/continuum/client-memory/types";
import type {
  SmsIngestClass,
  SmsLineClass,
} from "@/lib/continuum/source-events/types";

export const SMS_BRIDGE_PRODUCER = "sms-source-event-bridge-v1" as const;

export const SMS_SOURCE_REF_VERSION = "sms1" as const;

export const UNSPECIFIED_SMS_PROVIDER = "unspecified" as const;

export type SmsDirection = "inbound" | "outbound" | "unknown";

export type SmsPhoneClassification =
  | "us-compatible"
  | "international"
  | "too-short"
  | "blank";

export type SmsParticipant = {
  phoneHash: string | null;
  classification: SmsPhoneClassification;
};

export type SmsAttachmentMeta = {
  attachmentId: string;
  filename: string | null;
  mimeType: string | null;
  byteSize: number | null;
};

export type MessageAdapterInput = {
  sourceMessageId?: string | null;
  sourceThreadId?: string | null;
  sentAt: string;
  direction: SmsDirection;
  senderPhone?: string | null;
  participantPhones?: readonly string[];
  body?: string | null;
  attachments?: readonly SmsAttachmentMeta[];
  /** Opaque adapter namespace. Not a vendor enum. */
  provider?: string | null;
  ingestClass?: SmsIngestClass;
  lineClass?: SmsLineClass;
  capturedAt?: string;
  /**
   * Mutable carrier label. Accepted so adapters can pass it through,
   * and ignored for identity, idempotency, and person association.
   */
  contactLabel?: string | null;
  /** Existing person the founder explicitly routed this message to. */
  routedPersonId?: string | null;
  founderSelected?: boolean;
  manuallyRouted?: boolean;
  /** Already-confirmed project. Never inferred from a title or label. */
  confirmedProjectId?: string | null;
};

export type NormalizedSmsMessage = {
  provider: string;
  sourceMessageId: string;
  messageIdWasSynthesized: boolean;
  sourceThreadId: string | null;
  conversationKey: string;
  sentAt: string;
  direction: SmsDirection;
  sender: SmsParticipant;
  participants: readonly SmsParticipant[];
  attachmentCount: number;
  hasAttachments: boolean;
  attachments: readonly SmsAttachmentMeta[];
  idempotencyKey: string;
  sourceRef: string;
  ingestClass: SmsIngestClass;
  lineClass: SmsLineClass;
  capturedAt: string;
  founderSelected: boolean;
  manuallyRouted: boolean;
  routedPersonId: string | null;
  confirmedProjectId: string | null;
};

export type SmsParseSurface = {
  message: NormalizedSmsMessage;
  body: string | null;
};

export type SmsIdentityPerson = {
  personId: string;
  phoneHash: string | null;
  role: PersonRole | null;
  displayName?: string | null;
};

export type SmsIdentityWorld = {
  people: readonly SmsIdentityPerson[];
  internalPhoneHashes: readonly string[];
  sharedPhoneHashes: readonly string[];
  founderPhoneHashes?: readonly string[];
};

export const SMS_MUTATION_BOUNDARY = {
  canonical: false,
  writesPersons: false,
  mintPerson: false,
  writesProjects: false,
  mintProject: false,
  choosesProvider: false,
  createsTodayFromIngestAlone: false,
} as const;
